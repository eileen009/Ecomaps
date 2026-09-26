// =========================================================
// EcoMaps · Panel admin - revisión de aportes con foto (módulo 5)
// Se carga solo en /admin/acciones.
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
      <img src="/static/${accion.foto_url}" alt="Evidencia de reciclaje">
      <div class="admin-accion-card__body">
        <h3>${accion.categoria} · ${accion.cantidad} ${accion.unidad}</h3>
        <p>${accion.punto ? accion.punto : 'Sin punto asociado'}</p>
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
      } else {
        alert('No se pudo actualizar el aporte.');
      }
    };

    div.querySelector('[data-confirmar]').addEventListener('click', () => revisar('confirmada'));
    div.querySelector('[data-rechazar]').addEventListener('click', () => revisar('rechazada'));
    return div;
  }

  fetch('/api/acciones?estado=pendiente', {
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
    })
    .catch(() => {
      contenedor.innerHTML = '<p class="map-layout__panel-vacio">No se pudo cargar la lista.</p>';
    });
});
