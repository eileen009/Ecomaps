// =========================================================
// EcoMaps · Cuenta (común a /perfil y /empresa)
// Foto de perfil + nombre y correo de la cuenta.
// Cuando el usuario cambia, avisa con el evento "usuario-actualizado"
// para que cada página pinte lo suyo (puntos, etc.) sin pedirlo otra vez.
// =========================================================

const AVATAR_DEFAULT = '/static/assets/img/avatar-default.svg';
const MAX_FOTO_BYTES = 5 * 1024 * 1024; // igual que MAX_CONTENT_LENGTH del backend

document.addEventListener('DOMContentLoaded', async () => {
  const sesion = obtenerSesion();
  if (!sesion) return;

  // Pinta ya con la sesión (sin esperar red) y refresca con una sola petición.
  aplicarUsuario(sesion.usuario, false);
  initSubidaFoto();
  initFormCuenta();
  const usuario = await cargarUsuarioActual();
  if (usuario) aplicarUsuario(usuario, false);
});

function $cuenta(clave) {
  return document.querySelectorAll(`[data-perfil="${clave}"]`);
}

// Guarda en sesión (si hace falta), pinta lo común y avisa a la página.
function aplicarUsuario(usuario, guardar = true) {
  const sesion = obtenerSesion();
  if (guardar && sesion) guardarSesion(usuario, sesion.token);

  $cuenta('nombre').forEach((el) => { el.textContent = usuario.nombre || 'Usuario'; });
  $cuenta('nombre-mini').forEach((el) => { el.textContent = usuario.nombre || 'Mi cuenta'; });
  $cuenta('correo').forEach((el) => { el.textContent = usuario.correo || ''; });

  const src = urlFoto(usuario.foto_url, AVATAR_DEFAULT);
  [...$cuenta('foto'), ...$cuenta('foto-mini')].forEach((img) => {
    img.onerror = () => { img.onerror = null; img.src = AVATAR_DEFAULT; };
    img.src = src;
  });

  const marco = document.querySelector('[data-perfil="marco-img"]');
  if (marco) marco.src = urlMarco(usuario.marco_avatar || usuario.nivel);

  // Solo rellena el formulario si el usuario no lo está editando.
  const form = document.getElementById('form-cuenta');
  if (form && !form.dataset.editando) {
    form.querySelector('#cuenta-nombre').value = usuario.nombre || '';
    form.querySelector('#cuenta-correo').value = usuario.correo || '';
  }

  document.dispatchEvent(new CustomEvent('usuario-actualizado', { detail: usuario }));
}

// ----- Foto de perfil -----
function initSubidaFoto() {
  const avatar = document.getElementById('avatar');
  const input = document.getElementById('avatar-input');
  if (!avatar || !input) return;

  const msg = document.querySelector('[data-perfil="avatar-msg"]');
  const textoAyuda = msg.innerHTML;
  const mostrarMsg = (texto, esError = false) => {
    msg.textContent = texto;
    msg.classList.toggle('is-error', esError);
  };

  input.addEventListener('change', async () => {
    const archivo = input.files[0];
    if (!archivo) return;

    // Validación en el navegador: evita subir algo que el servidor va a rechazar.
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type)) {
      mostrarMsg('La foto debe ser JPG, PNG o WEBP.', true);
      input.value = '';
      return;
    }
    if (archivo.size > MAX_FOTO_BYTES) {
      mostrarMsg('La foto supera los 5 MB.', true);
      input.value = '';
      return;
    }

    const sesion = obtenerSesion();
    const cuerpo = new FormData();
    cuerpo.set('foto', archivo);
    avatar.classList.add('is-subiendo');
    mostrarMsg('Subiendo foto…');

    try {
      const r = await fetch('/api/usuarios/me/foto', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sesion.token}` },
        body: cuerpo,
      });
      const datos = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(datos.error || 'No se pudo subir la foto.');

      aplicarUsuario(datos);
      mostrarMsg('¡Foto actualizada!');
      setTimeout(() => { msg.innerHTML = textoAyuda; msg.classList.remove('is-error'); }, 2500);
    } catch (error) {
      mostrarMsg(error.message, true);
    } finally {
      avatar.classList.remove('is-subiendo');
      input.value = '';
    }
  });
}

// ----- Nombre y correo de la cuenta -----
function initFormCuenta() {
  const form = document.getElementById('form-cuenta');
  if (!form) return;

  const errorEl = form.querySelector('[data-form-error]');
  const okEl = form.querySelector('[data-cuenta-ok]');
  form.addEventListener('input', () => { form.dataset.editando = '1'; okEl.hidden = true; });

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    errorEl.hidden = true;
    okEl.hidden = true;

    const nombre = form.querySelector('#cuenta-nombre').value.trim();
    const correo = form.querySelector('#cuenta-correo').value.trim();
    if (!nombre) {
      errorEl.textContent = 'El nombre no puede quedar vacío.';
      errorEl.hidden = false;
      return;
    }
    if (!form.querySelector('#cuenta-correo').checkValidity() || !correo) {
      errorEl.textContent = 'Escribe un correo válido.';
      errorEl.hidden = false;
      return;
    }

    const sesion = obtenerSesion();
    const boton = form.querySelector('button[type="submit"]');
    boton.disabled = true;
    try {
      const r = await fetch('/api/usuarios/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion.token}` },
        body: JSON.stringify({ nombre, correo }),
      });
      const datos = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(datos.error || 'No se pudieron guardar los datos.');

      delete form.dataset.editando;
      aplicarUsuario(datos);
      okEl.hidden = false;
    } catch (error) {
      errorEl.textContent = error.message;
      errorEl.hidden = false;
    } finally {
      boton.disabled = false;
    }
  });
}
