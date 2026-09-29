// =========================================================
// EcoMaps · Revisión de aportes con foto (módulo 5)
// Se usa en /admin/acciones (todos los pendientes) y en /empresa
// (solo los de sus puntos). El listado sale de data-endpoint.
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
  const contenedor = document.getElementById('lista-acciones');
  if (!contenedor) return;

  const sesion = obtenerSesion();
  if (!sesion) return; // initProteccionPagina ya redirige a /login

  function tarjeta(accion) {
    const div = document.createElement('div');
    div.className = 'admin-accion-card';
    div.innerHTML = `
      <img src="${escaparHTML(urlFoto(accion.foto_url))}" alt="Evidencia de reciclaje">
      <div class="admin-accion-card__body">
        <h3>${escaparHTML(accion.categoria)} · ${escaparHTML(accion.cantidad)} ${escaparHTML(accion.unidad)}</h3>
        <p>${accion.punto ? escaparHTML(accion.punto) : 'Sin punto asociado'}</p>
        <div class="admin-accion-card__acciones">
          <button type="button" class="btn btn--primary" data-confirmar>Confirmar</button>
          <button type="button" class="btn--rechazar" data-rechazar>Rechazar</button>
        </div>
      </div>
    `;

    const revisar = async (estado) => {
      const respuesta = await fetch(`/api/acciones/${accion.id}/estado`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sesion.token}`,
        },
        body: JSON.stringify({ estado }),
      });
      if (respuesta.ok) {
        div.remove();
        avisarCambio();
        if (!contenedor.querySelector('.admin-accion-card')) {
          contenedor.innerHTML = '<p class="map-layout__panel-vacio">No hay aportes pendientes por revisar.</p>';
        }
      } else {
        const datos = await respuesta.json().catch(() => ({}));
        mostrarAviso({ tipo: 'error', mensaje: datos.error || 'No se pudo actualizar el aporte.' });
      }
    };

    div.querySelector('[data-confirmar]').addEventListener('click', () => revisar('confirmada'));
    div.querySelector('[data-rechazar]').addEventListener('click', () => revisar('rechazada'));
    return div;
  }

  const endpoint = contenedor.dataset.endpoint || '/api/acciones?estado=pendiente';
  const avisarCambio = () => document.dispatchEvent(new CustomEvent('aportes-cambiaron', {
    detail: contenedor.querySelectorAll('.admin-accion-card').length,
  }));

  fetch(endpoint, {
    headers: { Authorization: `Bearer ${sesion.token}` },
  })
    .then((respuesta) => (respuesta.ok ? respuesta.json() : []))
    .then((acciones) => {
      contenedor.innerHTML = '';
      if (!acciones.length) {
        contenedor.innerHTML = '<p class="map-layout__panel-vacio">No hay aportes pendientes por revisar.</p>';
        return;
      }
      acciones.forEach((accion) => contenedor.appendChild(tarjeta(accion)));
      avisarCambio();
    })
    .catch(() => {
      contenedor.innerHTML = '<p class="map-layout__panel-vacio">No se pudo cargar la lista.</p>';
    });
});
