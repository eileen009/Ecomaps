// EcoMaps - lógica principal
// Por ahora: solo interacción de la interfaz (pestañas de login/registro).
// Sin conexión a backend todavía.

document.addEventListener('DOMContentLoaded', () => {

  // ===== Pestañas de la página de login/registro =====
  const tabButtons = document.querySelectorAll('[data-tab]');
  const tabPanels = document.querySelectorAll('.tabs__panel');

  const activarPestana = (nombre) => {
    tabButtons.forEach((btn) => {
      const activo = btn.dataset.tab === nombre;
      btn.classList.toggle('is-active', activo);
      btn.setAttribute('aria-selected', activo);
    });
    tabPanels.forEach((panel) => {
      const activo = panel.id === `panel-${nombre}`;
      panel.classList.toggle('is-active', activo);
      panel.hidden = !activo;
    });
  };

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => activarPestana(btn.dataset.tab));
  });

  // Enlaces internos que cambian de pestaña (ej. "Crear cuenta" dentro del formulario)
  document.querySelectorAll('[data-tab-link]').forEach((link) => {
    link.addEventListener('click', (evento) => {
      evento.preventDefault();
      activarPestana(link.dataset.tabLink);
    });
  });

  // Si la URL llega con #registro, abrir esa pestaña directamente
  if (window.location.hash === '#registro') {
    activarPestana('registro');
  }

  // ===== Mostrar / ocultar contraseña =====
  document.querySelectorAll('[data-toggle-password]').forEach((boton) => {
    boton.addEventListener('click', () => {
      const input = document.getElementById(boton.dataset.togglePassword);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  // ===== Formularios de ejemplo (login / registro): aún sin backend =====
  document.querySelectorAll('[data-demo-form]').forEach((form) => {
    form.addEventListener('submit', (evento) => {
      evento.preventDefault();
      alert('Funcionalidad de ejemplo: todavía no está conectada al servidor.');
    });
  });

  // Botón "Continuar con Google" (demo, sin backend)
  document.querySelectorAll('[data-demo-google]').forEach((boton) => {
    boton.addEventListener('click', () => {
      alert('Inicio de sesión con Google: pendiente de conectar.');
    });
  });
});
