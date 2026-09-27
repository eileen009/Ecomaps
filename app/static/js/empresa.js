// =========================================================
// EcoMaps · Panel de empresa: info de contacto y horarios del punto
// Se carga solo en /empresa.
// =========================================================

// El editor de horarios (tabla de 7 días) vive en horario.js.
const ESTADO_PUNTO = {
  activo: { texto: 'Publicado en el mapa', clase: 'is-confirmada' },
  pendiente: { texto: 'En revisión', clase: 'is-pendiente' },
  rechazado: { texto: 'Rechazado', clase: 'is-rechazada' },
  reportado: { texto: 'Reportado', clase: 'is-rechazada' },
};

let misPuntos = [];

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('form-empresa');
  const sesion = obtenerSesion();
  if (!form || !sesion) return;

  construirTablaHorario();

  try {
    const r = await fetch('/api/puntos/mios', { headers: { Authorization: `Bearer ${sesion.token}` } });
    misPuntos = r.ok ? await r.json() : [];
  } catch (error) {
    misPuntos = [];
  }

  if (!misPuntos.length) {
    document.getElementById('empresa-vacio').hidden = false;
    return;
  }

  form.hidden = false;
  if (misPuntos.length > 1) {
    const select = document.getElementById('punto-select');
    select.innerHTML = misPuntos.map((p) => `<option value="${p.id}">${p.nombre}</option>`).join('');
    select.addEventListener('change', () => cargarPunto(misPuntos.find((p) => String(p.id) === select.value)));
    document.getElementById('empresa-selector').hidden = false;
  }
  cargarPunto(misPuntos[0]);

  form.addEventListener('submit', (e) => { e.preventDefault(); guardar(form); });
});

// ----- Cargar / guardar -----
function cargarPunto(punto) {
  document.getElementById('form-empresa').dataset.idPunto = punto.id;
  document.getElementById('emp-nombre').value = punto.nombre || '';
  document.getElementById('emp-telefono').value = punto.telefono_contacto || '';
  document.getElementById('emp-correo').value = punto.email_contacto || '';
  document.querySelector('[data-empresa="ubicacion"]').textContent = `${punto.direccion}, ${punto.ciudad}`;
  document.querySelector('[data-empresa="materiales"]').textContent =
    punto.materiales && punto.materiales.length ? punto.materiales.join(', ') : 'Sin materiales registrados';

  const estado = ESTADO_PUNTO[punto.estado] || ESTADO_PUNTO.pendiente;
  const chip = document.querySelector('[data-empresa="estado"]');
  chip.textContent = estado.texto;
  chip.className = `estado-chip ${estado.clase}`;

  const aviso = document.querySelector('[data-empresa="horario-antiguo"]');
  const entendido = textoAHorario(punto.horario);
  aviso.hidden = entendido;
  if (!entendido) {
    aviso.textContent = `Horario actual (escrito a mano): "${punto.horario}". Configúralo abajo y guarda para reemplazarlo.`;
  }
  actualizarVistaHorario();
}

async function guardar(form) {
  const errorEl = form.querySelector('[data-form-error]');
  const okEl = form.querySelector('[data-empresa="ok"]');
  errorEl.hidden = true;
  okEl.hidden = true;

  // Validación local: cada día abierto debe cerrar después de abrir.
  const diaMalo = diaHorarioInvalido();
  if (diaMalo) {
    errorEl.textContent = `Revisa el horario del ${diaMalo}: la hora de cierre debe ser posterior a la de apertura.`;
    errorEl.hidden = false;
    return;
  }

  const sesion = obtenerSesion();
  const id = form.dataset.idPunto;
  const boton = form.querySelector('button[type="submit"]');
  boton.disabled = true;

  try {
    const r = await fetch(`/api/puntos/mios/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion.token}` },
      body: JSON.stringify({
        nombre: document.getElementById('emp-nombre').value,
        telefono_contacto: document.getElementById('emp-telefono').value,
        email_contacto: document.getElementById('emp-correo').value,
        horario: horarioATexto(),
      }),
    });
    const datos = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(datos.error || 'No se pudieron guardar los cambios.');

    // Actualiza la copia local (sin volver a pedir la lista completa).
    misPuntos = misPuntos.map((p) => (p.id === datos.id ? datos : p));
    const opcion = document.querySelector(`#punto-select option[value="${datos.id}"]`);
    if (opcion) opcion.textContent = datos.nombre;
    okEl.hidden = false;
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.hidden = false;
  } finally {
    boton.disabled = false;
  }
}


// ----- Sello de verificación (dato que pinta cuenta.js) -----
document.addEventListener('usuario-actualizado', ({ detail: usuario }) => {
  document.querySelector('[data-empresa="verificada"]').hidden = !usuario.verificada;
  document.querySelector('[data-empresa="no-verificada"]').hidden = !!usuario.verificada;
});

// ----- Contador de aportes pendientes en el menú (lo avisa admin_acciones.js) -----
document.addEventListener('aportes-cambiaron', ({ detail: total }) => {
  const contador = document.querySelector('[data-empresa="num-aportes"]');
  contador.textContent = total;
  contador.hidden = total === 0;
});
