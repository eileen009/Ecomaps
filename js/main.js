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

  // ===== Animación al hacer scroll (una sola vez por elemento) =====
  // Código verde: un único IntersectionObserver reutilizado, sin librerías externas.
  const elementosRevelables = document.querySelectorAll('.reveal');
  if (elementosRevelables.length && 'IntersectionObserver' in window) {
    const observador = new IntersectionObserver((entradas) => {
      entradas.forEach((entrada) => {
        if (entrada.isIntersecting) {
          entrada.target.classList.add('is-visible');
          observador.unobserve(entrada.target); // deja de observar: ahorra recursos
        }
      });
    }, { threshold: 0.15 });

    elementosRevelables.forEach((el, i) => {
      el.style.setProperty('--indice', i % 6); // escalona grupos de tarjetas
      observador.observe(el);
    });
  } else {
    elementosRevelables.forEach((el) => el.classList.add('is-visible'));
  }

  // ===== Filtros rápidos del mapa (chips de tipo de residuo) =====
  document.querySelectorAll('.map-quicktags button').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.map-quicktags button').forEach((b) => b.classList.remove('is-active'));
      chip.classList.add('is-active');
      const buscador = document.getElementById('mapa-buscador');
      if (buscador) buscador.value = chip.textContent.trim();
    });
  });

  // ===== Pestañas del panel admin (marcar enlace activo) =====
  document.querySelectorAll('.admin__nav a').forEach((link) => {
    link.addEventListener('click', (evento) => {
      if (link.getAttribute('href') !== '#') return;
      evento.preventDefault();
      document.querySelectorAll('.admin__nav a').forEach((a) => a.classList.remove('is-active'));
      link.classList.add('is-active');
    });
  });

  // ===== Formulario "Proponer punto": marcar ubicación de ejemplo en el mapa =====
  const mapaPicker = document.querySelector('[data-map-picker]');
  if (mapaPicker) {
    mapaPicker.addEventListener('click', (evento) => {
      const pin = mapaPicker.querySelector('.map-picker__pin');
      const rect = mapaPicker.getBoundingClientRect();
      const x = evento.clientX - rect.left;
      const y = evento.clientY - rect.top;
      let marcador = pin;
      if (!marcador) {
        marcador = document.createElement('div');
        marcador.className = 'map-picker__pin';
        marcador.textContent = '📍';
        mapaPicker.appendChild(marcador);
      }
      marcador.style.left = `${x}px`;
      marcador.style.top = `${y}px`;
      const hint = mapaPicker.querySelector('.map-picker__hint');
      if (hint) hint.textContent = 'Ubicación marcada (ejemplo)';
    });
  }
});
