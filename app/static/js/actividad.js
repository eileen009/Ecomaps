// =========================================================
// EcoMaps · Registrar actividad (módulo 5: puntos con evidencia)
// Se carga solo en /actividad.
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-actividad');
  if (!form) return;

  initFotoDropzone();
  pintarResumenYHistorial();
  const selectPunto = document.getElementById('punto');
  const parametros = new URLSearchParams(window.location.search);
  const puntoPreseleccionado = parametros.get('punto');

  // Puntos activos reales (misma API que usa el mapa) para no inventar nombres.
  fetch('/api/puntos?estado=activo')
    .then((respuesta) => (respuesta.ok ? respuesta.json() : []))
    .then((puntos) => {
      puntos.forEach((punto) => {
        const opcion = document.createElement('option');
        opcion.value = punto.id;
        opcion.textContent = `${punto.nombre} (${punto.ciudad})`;
        if (puntoPreseleccionado && String(punto.id) === puntoPreseleccionado) {
          opcion.selected = true;
        }
        selectPunto.appendChild(opcion);
      });
    })
    .catch(() => { /* sin conexión: el select se queda solo con "Sin especificar" */ });

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const errorEl = form.querySelector('[data-form-error]');
    errorEl.hidden = true;

    const sesion = obtenerSesion();
    if (!sesion) {
      window.location.href = '/login?next=/actividad';
      return;
    }

    const cuerpo = new FormData();
    cuerpo.set('categoria', document.getElementById('material').value);
    cuerpo.set('cantidad', document.getElementById('cantidad').value);
    cuerpo.set('unidad', document.getElementById('unidad').value);
    if (selectPunto.value) cuerpo.set('id_punto', selectPunto.value);
    // Se reduce antes de enviar: las fotos del celular suelen pasar el límite de 5 MB.
    cuerpo.set('foto', await reducirFoto(document.getElementById('foto').files[0]));
    const boton = form.querySelector('button[type="submit"]');
    boton.disabled = true;

    try {
      const respuesta = await fetch('/api/acciones', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sesion.token}` },
        body: cuerpo,
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo registrar la actividad.');

      await mostrarAviso({
        titulo: '¡Aporte registrado!',
        mensaje: 'Gracias por reciclar. Un administrador revisará la foto y confirmará tus puntos.',
        boton: 'Ver mi perfil',
      });
      window.location.href = '/perfil';
    } catch (error) {
      errorEl.textContent = error.message;
      errorEl.hidden = false;
    } finally {
      boton.disabled = false;
    }
  });
});


// ===== Vista previa de la foto en la zona de arrastre =====
function initFotoDropzone() {
  const zona = document.getElementById('foto-dropzone');
  const input = document.getElementById('foto');
  if (!zona || !input) return;

  const textoOriginal = zona.querySelector('.foto-dropzone__texto').outerHTML;
  const iconoOriginal = zona.querySelector('.foto-dropzone__icon').outerHTML;

  const mostrarPreview = (archivo) => {
    if (!archivo) return;
    const url = URL.createObjectURL(archivo);
    zona.querySelectorAll('.foto-dropzone__icon, .foto-dropzone__texto, .foto-dropzone__preview, .foto-dropzone__quitar').forEach((el) => el.remove());

    const img = document.createElement('img');
    img.src = url;
    img.className = 'foto-dropzone__preview';
    zona.appendChild(img);

    const quitar = document.createElement('button');
    quitar.type = 'button';
    quitar.className = 'foto-dropzone__quitar';
    quitar.setAttribute('aria-label', 'Quitar foto');
    quitar.textContent = '✕';
    quitar.addEventListener('click', (evento) => {
      evento.preventDefault();
      input.value = '';
      zona.querySelectorAll('.foto-dropzone__preview, .foto-dropzone__quitar').forEach((el) => el.remove());
      zona.insertAdjacentHTML('afterbegin', iconoOriginal + textoOriginal);
    });
    zona.appendChild(quitar);
  };

  input.addEventListener('change', () => mostrarPreview(input.files[0]));

  // Arrastrar y soltar (además de tocar para seleccionar, que ya funciona por ser un <label>)
  ['dragenter', 'dragover'].forEach((evt) => {
    zona.addEventListener(evt, (e) => { e.preventDefault(); zona.classList.add('is-dragover'); });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    zona.addEventListener(evt, (e) => { e.preventDefault(); zona.classList.remove('is-dragover'); });
  });
  zona.addEventListener('drop', (e) => {
    if (e.dataTransfer.files.length) {
      input.files = e.dataTransfer.files;
      mostrarPreview(input.files[0]);
    }
  });
}


// ===== Resumen de puntos + historial real (sin datos de ejemplo) =====
const ESTADO_ACCION = {
  pendiente: { texto: 'En revisión', clase: 'is-pendiente' },
  confirmada: { texto: 'Confirmada', clase: 'is-confirmada' },
  rechazada: { texto: 'Rechazada', clase: 'is-rechazada' },
};

async function pintarResumenYHistorial() {
  const sesion = obtenerSesion();
  if (!sesion) return;

  const [usuario, acciones] = await Promise.all([
    cargarUsuarioActual(),
    fetch('/api/acciones/mias', { headers: { Authorization: `Bearer ${sesion.token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
  ]);

  const puntos = usuario.puntos_totales ?? 0;
  const { avance, faltan } = progresoNivel(puntos);
  document.querySelector('[data-resumen="puntos"]').textContent = puntos.toLocaleString('es-CO');
  document.querySelector('[data-resumen="nivel"]').textContent = usuario.nivel ?? 1;
  document.querySelector('[data-resumen="barra"]').style.width = `${avance}%`;
  document.querySelector('[data-resumen="falta"]').innerHTML =
    `Te faltan <strong>${faltan} puntos</strong> para el nivel ${(usuario.nivel ?? 1) + 1}.`;

  const lista = document.getElementById('historial');
  if (!acciones.length) {
    lista.innerHTML = '<p class="profile-panel__nota">Aún no has registrado aportes. ¡Registra el primero arriba!</p>';
    return;
  }
  // Solo los 10 más recientes: la API ya los trae ordenados por fecha.
  const recientes = acciones.slice(0, 10);
  lista.innerHTML = recientes.map((a) => {
    const estado = ESTADO_ACCION[a.estado] || ESTADO_ACCION.pendiente;
    const fecha = new Date(a.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
    const lugar = a.punto || 'Sin punto especificado';
    const puntosTxt = a.estado === 'confirmada' ? `+${a.puntos_otorgados} pts` : '';
    // Rechazado: se muestra por qué. Confirmado: botón para ver el recibo del punto.
    const motivo = a.estado === 'rechazada' && a.motivo_rechazo
      ? `<small class="activity-row__motivo"><b>Motivo:</b> ${escaparHTML(a.motivo_rechazo)}</small>` : '';
    const recibo = a.recibo
      ? `<button type="button" class="activity-row__recibo" data-recibo="${a.id}">Ver recibo ${escaparHTML(a.recibo.codigo)}</button>` : '';
    return `<article class="activity-row"><span class="activity-row__icon">♻</span>
      <div><strong>${escaparHTML(a.categoria || 'Material')} · ${escaparHTML(a.cantidad)} ${escaparHTML(a.unidad)}</strong><small>${escaparHTML(lugar)} · ${fecha}</small>${motivo}${recibo}</div>
      <span class="estado-chip ${estado.clase}">${estado.texto}</span><b>${puntosTxt}</b></article>`;
  }).join('');

  lista.querySelectorAll('[data-recibo]').forEach((boton) => {
    boton.addEventListener('click', () => {
      const accion = recientes.find((x) => x.id === Number(boton.dataset.recibo));
      if (accion) abrirRecibo(accion.recibo);
    });
  });
}


// ===== Recibo digital: lo emite el punto al confirmar y llega a quien aportó =====
function abrirRecibo(r) {
  let dialogo = document.getElementById('dialogo-recibo');
  if (!dialogo) {
    dialogo = document.createElement('dialog');
    dialogo.id = 'dialogo-recibo';
    dialogo.className = 'recibo-dialogo';
    document.body.appendChild(dialogo);
  }
  const fila = (titulo, valor) => `<div><dt>${titulo}</dt><dd>${escaparHTML(valor ?? '—')}</dd></div>`;
  const fecha = r.fecha
    ? new Date(r.fecha).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' }) : '—';
  const quien = r.recibido_por ? `${r.recibido_por}${r.recibido_por_rol === 'admin' ? ' (administración EcoMaps)' : ''}` : '—';

  dialogo.innerHTML = `
    <article class="recibo">
      <header class="recibo__cabecera">
        <img src="/static/assets/img/logo.png" alt="" width="44" height="44">
        <div><strong>EcoMaps</strong><span>Recibo de recepción de material</span></div>
      </header>
      <p class="recibo__codigo">N.º <b>${escaparHTML(r.codigo)}</b></p>
      <dl class="recibo__datos">
        ${fila('Fecha de recepción', fecha)}
        ${fila('Punto de reciclaje', r.punto)}
        ${fila('Dirección', r.direccion)}
        ${fila('Material', r.categoria)}
        ${fila('Cantidad declarada', `${r.cantidad_declarada} ${r.unidad}`)}
        ${fila('Cantidad recibida', `${r.cantidad_recibida} ${r.unidad}`)}
        ${fila('Recibido y confirmado por', quien)}
        ${fila('Puntos otorgados', r.puntos)}
      </dl>
      <p class="recibo__nota">Este recibo lo emitió el punto de reciclaje al confirmar la entrega. El código es único.</p>
    </article>
    <div class="recibo__acciones">
      <button type="button" class="btn btn--primary" data-imprimir>Imprimir / guardar PDF</button>
      <button type="button" class="btn btn--outline" data-cerrar>Cerrar</button>
    </div>`;

  dialogo.querySelector('[data-cerrar]').addEventListener('click', () => dialogo.close());
  dialogo.querySelector('[data-imprimir]').addEventListener('click', () => {
    document.body.classList.add('imprimiendo-recibo');
    window.addEventListener('afterprint', () => document.body.classList.remove('imprimiendo-recibo'), { once: true });
    window.print();
  });
  dialogo.showModal();
}
