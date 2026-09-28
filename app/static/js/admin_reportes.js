// =========================================================
// EcoMaps · Panel admin - reportes de problemas (módulo 7)
// Se carga solo en /admin/reportes.
// =========================================================

const TIPO_REPORTE = {
  cerrado: 'Punto cerrado',
  no_existe: 'El punto no existe',
  direccion_incorrecta: 'Ubicación incorrecta',
  horario_cambio: 'Cambió el horario',
  material_no_recibido: 'Ya no recibe un material',
  otro: 'Otro',
};

document.addEventListener('DOMContentLoaded', () => {
  const lista = document.getElementById('lista-reportes');
  const filtro = document.getElementById('filtro-reportes');
  const sesion = obtenerSesion();
  if (!lista || !sesion) return;
  const headers = { Authorization: `Bearer ${sesion.token}` };

  const botones = (estado) => ({
    pendiente: '<button class="btn btn--outline" data-estado="revisado">Marcar revisado</button><button class="btn btn--primary" data-estado="resuelto">✔ Resuelto</button>',
    revisado: '<button class="btn btn--primary" data-estado="resuelto">✔ Resuelto</button>',
    resuelto: '<button class="btn btn--outline" data-estado="pendiente">Reabrir</button>',
  }[estado]);

  const tarjeta = (r) => `
    <article class="reporte-card" data-id="${r.id}">
      <div class="reporte-card__info">
        <span class="estado-chip is-pendiente">${TIPO_REPORTE[r.tipo] || escaparHTML(r.tipo)}</span>
        <h3>${r.punto ? escaparHTML(r.punto) : 'Punto eliminado'}</h3>
        <p class="reporte-card__meta">📍 ${escaparHTML(r.direccion)}${r.ciudad ? ', ' + escaparHTML(r.ciudad) : ''} · por ${escaparHTML(r.usuario)} · ${new Date(r.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</p>
        ${r.comentario ? `<p class="reporte-card__comentario">“${escaparHTML(r.comentario)}”</p>` : ''}
      </div>
      <div class="reporte-card__acciones">${botones(r.estado)}</div>
    </article>`;

  async function cargar() {
    lista.innerHTML = '<p class="map-layout__panel-vacio">Cargando…</p>';
    try {
      const r = await fetch(`/api/reportes?estado=${filtro.value}`, { headers });
      const reportes = r.ok ? await r.json() : [];
      lista.innerHTML = reportes.length
        ? reportes.map(tarjeta).join('')
        : '<p class="map-layout__panel-vacio">No hay reportes en este estado.</p>';
    } catch (e) {
      lista.innerHTML = '<p class="map-layout__panel-vacio">No se pudo cargar la lista.</p>';
    }
  }

  lista.addEventListener('click', async (evento) => {
    const boton = evento.target.closest('[data-estado]');
    if (!boton) return;
    const card = boton.closest('[data-id]');
    boton.disabled = true;
    const r = await fetch(`/api/reportes/${card.dataset.id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: boton.dataset.estado }),
    });
    if (r.ok) {
      card.remove(); // cambió de estado: ya no pertenece a este filtro
      if (!lista.querySelector('.reporte-card')) lista.innerHTML = '<p class="map-layout__panel-vacio">No hay reportes en este estado.</p>';
    } else {
      alert('No se pudo actualizar el reporte.');
      boton.disabled = false;
    }
  });

  filtro.addEventListener('change', cargar);
  cargar();
});
