// =========================================================
// EcoMaps · Recuperar contraseña
//   /recuperar            → pide el enlace  (POST /api/auth/recuperar)
//   /restablecer/<token>  → guarda la nueva (POST /api/auth/restablecer)
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
  const formPedir = document.querySelector('[data-form-recuperar]');
  const formNueva = document.querySelector('[data-form-restablecer]');

  // Envía el formulario y muestra el error o el mensaje de éxito.
  async function enviar(form, endpoint, cuerpo) {
    const errorEl = form.querySelector('[data-form-error]');
    const boton = form.querySelector('button[type="submit"]');
    errorEl.hidden = true;
    boton.disabled = true;

    try {
      const respuesta = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo completar la solicitud. Intenta de nuevo.');

      const ok = form.parentElement.querySelector('[data-ok]');
      ok.querySelector('[data-ok-texto]').textContent = datos.mensaje || '';
      form.hidden = true;
      ok.hidden = false;
    } catch (error) {
      errorEl.textContent = error.message;
      errorEl.hidden = false;
      boton.disabled = false;
    }
  }

  function mostrarError(form, texto) {
    const errorEl = form.querySelector('[data-form-error]');
    errorEl.textContent = texto;
    errorEl.hidden = false;
  }

  if (formPedir) {
    formPedir.addEventListener('submit', (evento) => {
      evento.preventDefault();
      const correo = formPedir.querySelector('#recuperar-email').value.trim();
      if (!correo || !formPedir.querySelector('#recuperar-email').checkValidity()) {
        mostrarError(formPedir, 'Escribe un correo electrónico válido.');
        return;
      }
      enviar(formPedir, '/api/auth/recuperar', { correo });
    });
  }

  if (formNueva) {
    formNueva.addEventListener('submit', (evento) => {
      evento.preventDefault();
      const password = formNueva.querySelector('#nueva-password').value;
      const confirmar = formNueva.querySelector('#confirmar-password').value;
      if (password.length < 8) {
        mostrarError(formNueva, 'La contraseña debe tener al menos 8 caracteres.');
        return;
      }
      if (password !== confirmar) {
        mostrarError(formNueva, 'Las dos contraseñas no coinciden.');
        return;
      }
      enviar(formNueva, '/api/auth/restablecer', { token: formNueva.dataset.token, password });
    });
  }
});
