// =========================================================
// EcoMaps · Registrar actividad (módulo 5: puntos con evidencia)
// Se carga solo en /actividad.
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-actividad');
  if (!form) return;

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
    cuerpo.set('foto', document.getElementById('foto').files[0]);

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

      alert('¡Listo! Tu aporte quedó registrado. Un administrador confirmará tus puntos al revisar la foto.');
      window.location.href = '/perfil';
    } catch (error) {
      errorEl.textContent = error.message;
      errorEl.hidden = false;
    } finally {
      boton.disabled = false;
    }
  });
});
