// =========================================================
// EcoMaps · Revisión de aportes con foto (módulo 5)
// Se usa en /admin/acciones (todos los pendientes) y en /empresa
// (solo los de sus puntos). El listado sale de data-endpoint.
//
// Confirmar: quien revisa indica la cantidad que REALMENTE recibió. Si el
//            usuario adjuntó el recibo que le dio el punto, se muestra aquí
//            como respaldo extra (no se depende solo de la foto).
// Rechazar:  es obligatorio escribir el motivo; el usuario lo verá.
// =========================================================

const MOTIVOS_SUGERIDOS = [
  'El material no coincide con el de la foto',
  'La foto no es legible o está borrosa',
  'La cantidad declarada no coincide con la foto',
  'No hay evidencia de que se haya entregado en este punto',
];

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
        <h3>${escaparHTML(accion.categoria)} · declarado: ${escaparHTML(accion.cantidad)} ${escaparHTML(accion.unidad)}</h3>
        <p>${accion.punto ? escaparHTML(accion.punto) : 'Sin punto asociado'}</p>
        ${accion.foto_recibo_url
          ? `<p class="accion-recibo-adjunto"><a href="${escaparHTML(urlFoto(accion.foto_recibo_url))}" target="_blank" rel="noopener">Ver recibo adjunto por el usuario</a></p>`
          : '<p class="accion-recibo-adjunto accion-recibo-adjunto--vacio">El usuario no adjuntó recibo.</p>'}

        <div data-bloque-confirmar>
          <label class="accion-recibida">Cantidad recibida (${escaparHTML(accion.unidad)})
            <input type="number" min="0.01" max="99999" step="0.01" value="${escaparHTML(accion.cantidad)}" data-recibida>
          </label>
          <div class="admin-accion-card__acciones">
            <button type="button" class="btn btn--primary" data-confirmar>Confirmar aporte</button>
            <button type="button" class="btn--rechazar" data-rechazar>Rechazar</button>
          </div>
        </div>

        <div class="accion-rechazo" data-panel-rechazo hidden>
          <label for="motivo-${accion.id}">Motivo del rechazo <small>(el usuario lo verá)</small></label>
          <div class="accion-rechazo__sugeridos">
            ${MOTIVOS_SUGERIDOS.map((m) => `<button type="button" data-sugerido="${escaparHTML(m)}">${escaparHTML(m)}</button>`).join('')}
          </div>
          <textarea id="motivo-${accion.id}" rows="3" maxlength="255" data-motivo placeholder="Escribe por qué se rechaza este aporte"></textarea>
          <p class="form__error" data-error hidden></p>
          <div class="admin-accion-card__acciones">
            <button type="button" class="btn btn--primary" data-enviar-rechazo>Enviar rechazo</button>
            <button type="button" class="btn--rechazar" data-cancelar-rechazo>Cancelar</button>
          </div>
        </div>
      </div>
    `;

    const bloqueConfirmar = div.querySelector('[data-bloque-confirmar]');
    const panelRechazo = div.querySelector('[data-panel-rechazo]');
    const campoMotivo = div.querySelector('[data-motivo]');
    const errorEl = div.querySelector('[data-error]');
    const recibida = div.querySelector('[data-recibida]');

    const revisar = async (estado, extra = {}) => {
      const botones = div.querySelectorAll('button');
      botones.forEach((b) => { b.disabled = true; });
      const respuesta = await fetch(`/api/acciones/${accion.id}/estado`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sesion.token}`,
        },
        body: JSON.stringify({ estado, ...extra }),
      }).catch(() => null);

      if (respuesta && respuesta.ok) {
        const revisada = await respuesta.json().catch(() => ({}));
        div.remove();
        avisarCambio();
        if (!contenedor.querySelector('.admin-accion-card')) {
          contenedor.innerHTML = '<p class="map-layout__panel-vacio">No hay aportes pendientes por revisar.</p>';
        }
        if (estado === 'confirmada') mostrarAviso({ titulo: 'Aporte confirmado', mensaje: `Se otorgaron ${revisada.puntos_otorgados} puntos.` });
        return;
      }
      botones.forEach((b) => { b.disabled = false; });
      const datos = respuesta ? await respuesta.json().catch(() => ({})) : {};
      const mensaje = datos.error || 'No se pudo actualizar el aporte.';
      if (estado === 'rechazada') { errorEl.textContent = mensaje; errorEl.hidden = false; }
      else mostrarAviso({ tipo: 'error', mensaje });
    };

    div.querySelector('[data-confirmar]').addEventListener('click', () => {
      const valor = Number(recibida.value);
      if (!(valor > 0)) { recibida.focus(); mostrarAviso({ tipo: 'error', mensaje: 'Escribe la cantidad que realmente recibiste.' }); return; }
      revisar('confirmada', { cantidad_recibida: valor });
    });

    div.querySelector('[data-rechazar]').addEventListener('click', () => {
      bloqueConfirmar.hidden = true;
      panelRechazo.hidden = false;
      campoMotivo.focus();
    });
    div.querySelector('[data-cancelar-rechazo]').addEventListener('click', () => {
      panelRechazo.hidden = true;
      errorEl.hidden = true;
      bloqueConfirmar.hidden = false;
    });
    panelRechazo.querySelectorAll('[data-sugerido]').forEach((chip) => {
      chip.addEventListener('click', () => { campoMotivo.value = chip.dataset.sugerido; campoMotivo.focus(); });
    });
    div.querySelector('[data-enviar-rechazo]').addEventListener('click', () => {
      const motivo = campoMotivo.value.trim();
      if (motivo.length < 5) {
        errorEl.textContent = 'Escribe el motivo del rechazo (mínimo 5 caracteres).';
        errorEl.hidden = false;
        campoMotivo.focus();
        return;
      }
      errorEl.hidden = true;
      revisar('rechazada', { motivo });
    });
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
