// =========================================================
// EcoMaps · Reportar problema en un punto (módulo 7)
// Se carga solo en /reportar. Acepta ?punto=ID para llegar
// con el punto ya elegido desde el mapa.
// =========================================================

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('form-reporte');
  if (!form) return;

  const select = document.getElementById('punto-reportado');
  const info = document.getElementById('punto-reportado-info');
  const errorEl = form.querySelector('[data-form-error]');
  const puntoInicial = new URLSearchParams(window.location.search).get('punto');

  if (!obtenerSesion()) document.getElementById('reporte-aviso-sesion').hidden = false;

  // Misma API pública que usa el mapa (solo puntos activos).
  let puntos = [];
  try {
    const r = await fetch('/api/puntos?estado=activo');
    puntos = r.ok ? await r.json() : [];
  } catch (e) { puntos = []; }

  if (!puntos.length) {
    select.innerHTML = '<option value="">No hay puntos publicados para reportar</option>';
    select.disabled = true;
    info.textContent = 'Cuando haya puntos activos en el mapa podrás reportarlos aquí.';
  } else {
    select.innerHTML = '<option value="">Selecciona un punto</option>' + puntos
      .map((p) => `<option value="${escaparHTML(p.id)}">${escaparHTML(p.nombre)} · ${escaparHTML(p.ciudad)}</option>`).join('');
    if (puntoInicial) select.value = puntoInicial;
  }

  const mostrarInfo = () => {
    const p = puntos.find((x) => String(x.id) === select.value);
    info.textContent = p ? `📍 ${p.direccion}, ${p.ciudad}${p.horario ? ' · ' + p.horario : ''}` : '';
  };
  select.addEventListener('change', mostrarInfo);
  mostrarInfo();

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    errorEl.hidden = true;
    const error = (msg) => { errorEl.textContent = msg; errorEl.hidden = false; };

    const sesion = obtenerSesion();
    if (!sesion) {
      window.location.href = `/login?next=${encodeURIComponent('/reportar' + window.location.search)}`;
      return;
    }

    const tipo = form.querySelector('input[name="tipo"]:checked');
    const comentario = document.getElementById('descripcion').value.trim();
    if (!select.value) return error('Selecciona el punto que quieres reportar.');
    if (!tipo) return error('Elige qué problema encontraste.');
    if (tipo.value === 'otro' && !comentario) return error('Cuéntanos brevemente cuál es el problema.');

    const boton = form.querySelector('button[type="submit"]');
    boton.disabled = true;
    try {
      const r = await fetch(`/api/puntos/${select.value}/reportes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion.token}` },
        body: JSON.stringify({ tipo: tipo.value, comentario }),
      });
      const datos = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(datos.error || 'No se pudo enviar el reporte.');
      await mostrarAviso({
        titulo: '¡Reporte enviado!',
        mensaje: 'Gracias por avisarnos. Un administrador lo revisará para mantener el mapa al día.',
        boton: 'Volver al mapa',
      });
      window.location.href = '/mapa';
    } catch (e) {
      error(e.message);
    } finally {
      boton.disabled = false;
    }
  });
});
