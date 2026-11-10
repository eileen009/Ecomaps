// =========================================================
// EcoMaps · Registrar actividad (módulo 5: puntos con evidencia)
// Se carga solo en /actividad.
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-actividad');
  if (!form) return;

  initFotoDropzone();
  pintarResumenYHistorial();
  document.getElementById('material').addEventListener('change', () => pintarAvisoFoto());
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
    const archivoRecibo = document.getElementById('foto-recibo').files[0];
    if (archivoRecibo) cuerpo.set('foto_recibo', await reducirFoto(archivoRecibo));
    const boton = form.querySelector('button[type="submit"]');
    boton.disabled = true;
    // Revisión automática: si el modelo ya analizó la foto, se envía lo que vio (nunca bloquea el envío).
    const detectada = await esperarPrevalidacion(6000);
    if (detectada) {
      cuerpo.set('categoria_detectada', detectada.clase);
      cuerpo.set('confianza_deteccion', detectada.confianza.toFixed(4));
    }

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
      prevalidarFoto(null);
    });
    zona.appendChild(quitar);
    prevalidarFoto(archivo);
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
    // Rechazado: se muestra por qué. Si adjuntó el recibo del punto, enlace para verlo.
    const motivo = a.estado === 'rechazada' && a.motivo_rechazo
      ? `<small class="activity-row__motivo"><b>Motivo:</b> ${escaparHTML(a.motivo_rechazo)}</small>` : '';
    const recibo = a.foto_recibo_url
      ? `<a class="activity-row__recibo" href="${escaparHTML(urlFoto(a.foto_recibo_url))}" target="_blank" rel="noopener">Ver recibo adjunto</a>` : '';
    return `<article class="activity-row"><span class="activity-row__icon">♻</span>
      <div><strong>${escaparHTML(a.categoria || 'Material')} · ${escaparHTML(a.cantidad)} ${escaparHTML(a.unidad)}</strong><small>${escaparHTML(lugar)} · ${fecha}</small>${motivo}${recibo}</div>
      <span class="estado-chip ${estado.clase}">${estado.texto}</span><b>${puntosTxt}</b></article>`;
  }).join('');
}


// ===== Revisión automática de la foto =====
// El modelo de /clasificar corre en el navegador (clasificarImagen() de clasificar.js).
// Aquí solo se compara lo que ve con el material que eligió la persona: si no coincide, se le avisa
// y el aporte llega marcado para que el administrador lo mire primero. Nunca impide enviar.
const PREV_UMBRAL = 0.6;   // el servidor usa el mismo valor
const PREV_CLASE_DE_MATERIAL = { 'plástico': 'plastico', 'vidrio': 'vidrio', 'papel': 'papel_carton', 'cartón': 'papel_carton', 'metal': 'metal', 'orgánico': 'organico' };
const PREV_NOMBRE = { plastico: 'plástico', vidrio: 'vidrio', papel_carton: 'papel o cartón', metal: 'metal', organico: 'orgánico', no_aprovechable: 'un residuo no aprovechable' };
const PREV_SVG = { plastico: 'plastico', vidrio: 'vidrio', papel_carton: 'papel', metal: 'metal', organico: 'organico', no_aprovechable: 'no_aprovechable' };
const prevalidacion = { turno: 0, promesa: null, resultado: null, analizando: false };

function prevalidarFoto(archivo) {
  const turno = ++prevalidacion.turno;
  prevalidacion.resultado = null;
  prevalidacion.promesa = null;
  if (!archivo || typeof clasificarImagen !== 'function') {
    prevalidacion.analizando = false;
    pintarAvisoFoto();
    return;
  }
  prevalidacion.analizando = true;
  pintarAvisoFoto();
  prevalidacion.promesa = (async () => {
    const url = URL.createObjectURL(archivo);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const r = await clasificarImagen(img);
      if (turno === prevalidacion.turno) prevalidacion.resultado = { clase: r.clase, confianza: r.confianza };
    } catch (e) {
      console.warn('[revisión de foto]', e);   // sin modelo o sin red: el aporte se envía igual
    } finally {
      URL.revokeObjectURL(url);
      if (turno === prevalidacion.turno) { prevalidacion.analizando = false; pintarAvisoFoto(); }
    }
    return turno === prevalidacion.turno ? prevalidacion.resultado : null;
  })();
}

// Espera el resultado, pero nunca más de `ms`: enviar el aporte no debe depender del modelo.
async function esperarPrevalidacion(ms) {
  if (prevalidacion.resultado) return prevalidacion.resultado;
  if (!prevalidacion.promesa) return null;
  return Promise.race([prevalidacion.promesa, new Promise((ok) => setTimeout(() => ok(null), ms))]);
}

function pintarAvisoFoto() {
  const caja = document.getElementById('foto-analisis');
  if (!caja) return;
  caja.className = 'foto-analisis';
  caja.replaceChildren();
  if (prevalidacion.analizando) {
    caja.classList.add('foto-analisis--carga');
    caja.textContent = 'Revisando la foto…';
    caja.hidden = false;
    return;
  }
  const r = prevalidacion.resultado;
  if (!r) { caja.hidden = true; return; }

  const material = (document.getElementById('material').value || '').trim().toLowerCase();
  const esperada = PREV_CLASE_DE_MATERIAL[material];
  const nombre = PREV_NOMBRE[r.clase] || r.clase;
  const pct = Math.round(r.confianza * 100);
  let texto, tono;
  if (r.confianza < PREV_UMBRAL) {
    texto = 'No pudimos identificar bien el material en la foto. Puedes enviarla igual: un administrador la revisará.';
    tono = 'warn';
  } else if (r.clase === 'no_aprovechable') {
    texto = 'La foto parece un residuo no aprovechable. Puedes enviarla igual: un administrador la revisará.';
    tono = 'warn';
  } else if (esperada && esperada !== r.clase) {
    texto = `La foto parece ${nombre} (${pct} %), pero elegiste ${material}. Puedes enviarla igual: un administrador la revisará.`;
    tono = 'warn';
  } else if (esperada) {
    texto = `La foto coincide con lo que elegiste: parece ${nombre} (${pct} %).`;
    tono = 'ok';
  } else {
    texto = `La foto parece ${nombre} (${pct} %).`;
    tono = 'ok';
  }
  caja.classList.add(`foto-analisis--${tono}`);
  const ico = document.createElement('img');
  ico.src = `/static/assets/img/materiales/${PREV_SVG[r.clase] || 'plastico'}.svg`;
  ico.alt = '';
  const t = document.createElement('span');
  t.textContent = texto;
  caja.append(ico, t);
  caja.hidden = false;
}
