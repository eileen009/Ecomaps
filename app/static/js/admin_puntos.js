// =========================================================
// EcoMaps · Panel admin - gestión de puntos de reciclaje
// Se carga solo en /admin. Aprobar, rechazar, editar y eliminar.
// =========================================================

const ESTADOS_PUNTO = {
  activo: { texto: 'Activo', clase: 'status-dot--activo' },
  pendiente: { texto: 'Pendiente', clase: 'status-dot--pendiente' },
  reportado: { texto: 'Reportado', clase: 'status-dot--reportado' },
  rechazado: { texto: 'Rechazado', clase: 'status-dot--rechazado' },
};

// Botones de cambio de estado según el estado actual.
const ACCIONES_ESTADO = {
  pendiente: [['activo', '✔ Aprobar', 'aprobar'], ['rechazado', 'Rechazar', 'rechazar']],
  activo: [['rechazado', 'Ocultar del mapa', 'rechazar']],
  reportado: [['activo', 'Reactivar', 'aprobar'], ['rechazado', 'Ocultar del mapa', 'rechazar']],
  rechazado: [['activo', 'Publicar', 'aprobar']],
};

// Escapa texto que viene de usuarios antes de meterlo en HTML (evita XSS).
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

document.addEventListener('DOMContentLoaded', () => {
  const tabla = document.getElementById('tabla-puntos');
  const sesion = obtenerSesion();
  if (!tabla || !sesion) return;

  const headers = { Authorization: `Bearer ${sesion.token}` };
  const buscador = document.getElementById('buscar-punto');
  const filtroCiudad = document.getElementById('filtro-ciudad');
  const filtroEstado = document.getElementById('filtro-estado');
  const totalEl = document.getElementById('total-puntos');
  let puntos = [];
  let categorias = null; // se piden una sola vez, al abrir el primer formulario

  // ----- Resumen (tarjetas + número del menú lateral) -----
  async function cargarResumen() {
    try {
      const r = await fetch('/api/puntos/resumen', { headers });
      if (!r.ok) return;
      const datos = await r.json();
      document.querySelectorAll('[data-resumen]').forEach((el) => {
        el.textContent = Number(datos[el.dataset.resumen] || 0).toLocaleString('es-CO');
      });
      const nav = document.querySelector('[data-nav-pendientes]');
      if (nav) { nav.textContent = datos.pendiente; nav.hidden = !datos.pendiente; }
    } catch (e) { /* sin conexión: las tarjetas quedan en "–" */ }
  }

  // ----- Lista (se pide por estado; ciudad y búsqueda filtran en memoria) -----
  async function cargarPuntos() {
    tabla.innerHTML = '<tr><td colspan="6" class="admin-table__vacio">Cargando…</td></tr>';
    try {
      const r = await fetch(`/api/puntos?estado=${filtroEstado.value}`, { headers });
      puntos = r.ok ? await r.json() : [];
    } catch (e) { puntos = []; }

    const ciudades = [...new Set(puntos.map((p) => p.ciudad))].sort();
    const elegida = filtroCiudad.value;
    filtroCiudad.innerHTML = '<option value="">Todas las ciudades</option>'
      + ciudades.map((c) => `<option ${c === elegida ? 'selected' : ''}>${esc(c)}</option>`).join('');
    pintar();
  }

  function pintar() {
    const q = buscador.value.trim().toLowerCase();
    const ciudad = filtroCiudad.value;
    const visibles = puntos.filter((p) => (!ciudad || p.ciudad === ciudad)
      && (!q || `${p.nombre} ${p.direccion}`.toLowerCase().includes(q)));

    totalEl.textContent = `${visibles.length} de ${puntos.length} puntos`;
    if (!visibles.length) {
      tabla.innerHTML = `<tr><td colspan="6" class="admin-table__vacio">${
        puntos.length ? 'Ningún punto coincide con la búsqueda.' : 'No hay puntos en este estado.'}</td></tr>`;
      return;
    }
    tabla.innerHTML = visibles.map((p) => {
      const est = ESTADOS_PUNTO[p.estado] || ESTADOS_PUNTO.pendiente;
      const botones = (ACCIONES_ESTADO[p.estado] || [])
        .map(([estado, texto, tipo]) => `<button type="button" class="admin-btn admin-btn--${tipo}" data-estado="${estado}">${texto}</button>`)
        .join('');
      const fecha = new Date(p.fecha_creacion).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
      return `<tr data-id="${p.id}">
        <td><span class="admin-table__point">${esc(p.nombre)}</span><span class="admin-table__id">ID #${p.id}${p.horario ? ' · ' + esc(p.horario) : ''}</span></td>
        <td>📍 ${esc(p.direccion)}<span class="admin-table__id">${esc(p.ciudad)}</span></td>
        <td>${(p.materiales || []).map((m) => `<span class="tag">${esc(m)}</span>`).join(' ') || '—'}</td>
        <td><span class="status-dot ${est.clase}">${est.texto}</span></td>
        <td>${fecha}</td>
        <td><div class="admin-table__actions">${botones}
          <button type="button" class="admin-btn" data-editar>Editar</button>
          <button type="button" class="admin-btn admin-btn--peligro" data-eliminar>Eliminar</button></div></td>
      </tr>`;
    }).join('');
  }

  // ----- Acciones de cada fila -----
  tabla.addEventListener('click', async (e) => {
    const boton = e.target.closest('button');
    if (!boton) return;
    const id = Number(boton.closest('[data-id]').dataset.id);
    const punto = puntos.find((p) => p.id === id);

    if (boton.dataset.editar !== undefined) { abrirEdicion(punto); return; }

    let peticion;
    if (boton.dataset.estado) {
      peticion = fetch(`/api/puntos/${id}/estado`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: boton.dataset.estado }),
      });
    } else if (boton.dataset.eliminar !== undefined) {
      if (!(await confirmarAccion({
        titulo: '¿Eliminar este punto?',
        mensaje: `Se eliminará "${punto.nombre}" junto con sus reportes. Esta acción no se puede deshacer.`,
        boton: 'Eliminar punto',
      }))) return;
      peticion = fetch(`/api/puntos/${id}`, { method: 'DELETE', headers });
    } else return;

    boton.disabled = true;
    const r = await peticion;
    if (!r.ok) {
      const datos = await r.json().catch(() => ({}));
      mostrarAviso({ tipo: 'error', mensaje: datos.error || 'No se pudo completar la acción.' });
      boton.disabled = false;
      return;
    }
    await Promise.all([cargarPuntos(), cargarResumen()]);
  });

  // ----- Edición en el diálogo -----
  const dialogo = document.getElementById('dialogo-punto');
  const form = document.getElementById('form-punto');
  const campos = {
    nombre: 'ep-nombre', direccion: 'ep-direccion', ciudad: 'ep-ciudad',
    horario: 'ep-horario', telefono_contacto: 'ep-telefono', email_contacto: 'ep-correo',
  };

  async function abrirEdicion(punto) {
    if (!categorias) {
      try {
        const r = await fetch('/api/categorias');
        categorias = r.ok ? (await r.json()).map((c) => c.nombre) : [];
      } catch (e) { categorias = []; }
    }
    form.dataset.id = punto.id;
    Object.entries(campos).forEach(([clave, id]) => { document.getElementById(id).value = punto[clave] || ''; });
    document.getElementById('ep-materiales').innerHTML = categorias.map((c) => `
      <label><input type="checkbox" value="${esc(c)}" ${(punto.materiales || []).includes(c) ? 'checked' : ''}> ${esc(c)}</label>`).join('');
    form.querySelector('[data-form-error]').hidden = true;
    dialogo.showModal();
  }

  dialogo.querySelector('[data-cerrar-dialogo]').addEventListener('click', () => dialogo.close());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = form.querySelector('[data-form-error]');
    const cuerpo = {};
    Object.entries(campos).forEach(([clave, id]) => { cuerpo[clave] = document.getElementById(id).value.trim(); });
    cuerpo.materiales = [...form.querySelectorAll('#ep-materiales input:checked')].map((c) => c.value);

    if (!cuerpo.nombre || !cuerpo.direccion || !cuerpo.ciudad) {
      errorEl.textContent = 'Nombre, dirección y ciudad son obligatorios.';
      errorEl.hidden = false;
      return;
    }
    const r = await fetch(`/api/puntos/${form.dataset.id}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    if (!r.ok) {
      const datos = await r.json().catch(() => ({}));
      errorEl.textContent = datos.error || 'No se pudieron guardar los cambios.';
      errorEl.hidden = false;
      return;
    }
    dialogo.close();
    cargarPuntos();
  });

  buscador.addEventListener('input', pintar);
  filtroCiudad.addEventListener('change', pintar);
  filtroEstado.addEventListener('change', cargarPuntos);

  cargarResumen();
  cargarPuntos();
});
