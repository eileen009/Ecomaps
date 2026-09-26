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
  };// =========================================================
// EcoMaps · JavaScript del frontend
// Solo interacción visual/demostrativa. Sin backend todavía.
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initLoginTabs();
  initPasswordToggle();
  initDemoForms();
  initGoogleDemo();
  initScrollReveal();
  initMapQuickFilters();
  initAdminNavigation();
  initMapPicker();
});

// ===== Menú principal =====
function initMobileMenu() {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.nav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    const abierto = nav.classList.toggle('nav--open');
    toggle.setAttribute('aria-expanded', String(abierto));
    toggle.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
  });

  // Marca automáticamente la página actual.
  const pagina = window.location.pathname.split('/').pop() || 'index.html';
  nav.querySelectorAll('.nav__link').forEach((link) => {
    const activa = link.getAttribute('href') === pagina;
    link.classList.toggle('nav__link--active', activa);
  });
}

// ===== Pestañas de inicio de sesión / registro =====
function initLoginTabs() {
  const tabButtons = document.querySelectorAll('[data-tab]');
  const tabPanels = document.querySelectorAll('.tabs__panel');
  if (!tabButtons.length) return;

  const activarPestana = (nombre) => {
    tabButtons.forEach((btn) => {
      const activo = btn.dataset.tab === nombre;
      btn.classList.toggle('is-active', activo);
      btn.setAttribute('aria-selected', String(activo));
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

  document.querySelectorAll('[data-tab-link]').forEach((link) => {
    link.addEventListener('click', (evento) => {
      evento.preventDefault();
      activarPestana(link.dataset.tabLink);
    });
  });

  if (window.location.hash === '#registro') activarPestana('registro');
}

// ===== Mostrar / ocultar contraseña =====
function initPasswordToggle() {
  document.querySelectorAll('[data-toggle-password]').forEach((boton) => {
    boton.addEventListener('click', () => {
      const input = document.getElementById(boton.dataset.togglePassword);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });
}

// ===== Formularios de demostración =====
function initDemoForms() {
  const mensajes = {
    actividad: 'Actividad registrada como demostración. Más adelante se conectará con la base de datos.',
    perfil: 'Cambios guardados como demostración. Más adelante se conectarán con tu cuenta.',
    reporte: 'Reporte enviado como demostración. Más adelante será almacenado para revisión.'
  };

  document.querySelectorAll('[data-demo-form]').forEach((form) => {
    form.addEventListener('submit', (evento) => {
      evento.preventDefault();
      alert('Funcionalidad de ejemplo: todavía no está conectada al servidor.');
    });
  });

  document.querySelectorAll('.demo-action-form').forEach((form) => {
    form.addEventListener('submit', (evento) => {
      evento.preventDefault();
      const accion = form.dataset.demoAction;
      alert(mensajes[accion] || 'Acción realizada en modo demostración.');
    });
  });
}

// ===== Inicio de sesión con Google: demo =====
function initGoogleDemo() {
  document.querySelectorAll('[data-demo-google]').forEach((boton) => {
    boton.addEventListener('click', () => {
      alert('Inicio de sesión con Google: pendiente de conectar.');
    });
  });
}

// ===== Animaciones al hacer scroll =====
function initScrollReveal() {
  const elementos = document.querySelectorAll('.reveal');
  if (!elementos.length) return;

  if ('IntersectionObserver' in window) {
    const observador = new IntersectionObserver((entradas) => {
      entradas.forEach((entrada) => {
        if (entrada.isIntersecting) {
          entrada.target.classList.add('is-visible');
          observador.unobserve(entrada.target);
        }
      });
    }, { threshold: 0.15 });

    elementos.forEach((elemento, indice) => {
      elemento.style.setProperty('--indice', indice % 6);
      observador.observe(elemento);
    });
  } else {
    elementos.forEach((elemento) => elemento.classList.add('is-visible'));
  }
}

// ===== Filtros rápidos del mapa =====
function initMapQuickFilters() {
  document.querySelectorAll('.map-quicktags button').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.map-quicktags button').forEach((b) => b.classList.remove('is-active'));
      chip.classList.add('is-active');
      const buscador = document.getElementById('mapa-buscador');
      if (buscador) buscador.value = chip.textContent.trim();
    });
  });
}

// ===== Navegación del panel administrativo =====
function initAdminNavigation() {
  document.querySelectorAll('.admin__nav a').forEach((link) => {
    link.addEventListener('click', (evento) => {
      if (link.getAttribute('href') !== '#') return;
      evento.preventDefault();
      document.querySelectorAll('.admin__nav a').forEach((a) => a.classList.remove('is-active'));
      link.classList.add('is-active');
    });
  });
}

// ===== Selector visual de ubicación en "Proponer punto" =====
function initMapPicker() {
  const mapaPicker = document.querySelector('[data-map-picker]');
  if (!mapaPicker) return;

  mapaPicker.addEventListener('click', (evento) => {
    const rect = mapaPicker.getBoundingClientRect();
    const x = evento.clientX - rect.left;
    const y = evento.clientY - rect.top;

    let marcador = mapaPicker.querySelector('.map-picker__pin');
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
