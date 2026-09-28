// =========================================================
// EcoMaps · JavaScript del frontend
// =========================================================

const CLAVE_SESION = 'ecomaps_sesion';

// Ruta de una foto subida: las de Cloudinary ya son URL completas (https://...);
// las locales son relativas a /static. Sin foto -> avatar por defecto.
function urlFoto(ruta, porDefecto = '/static/assets/img/avatar-default.svg') {
  if (!ruta) return porDefecto;
  return /^https?:\/\//.test(ruta) ? ruta : `/static/${ruta}`;
}

// Página de inicio de cada rol (un solo lugar para no cruzar rutas).
const INICIO_POR_ROL = { admin: '/admin', empresa: '/empresa', ciudadano: '/perfil' };
function inicioPorRol(rol) {
  return INICIO_POR_ROL[rol] || '/perfil';
}

document.addEventListener('DOMContentLoaded', () => {
  initProteccionPagina();
  initMobileMenu();
  initEstadoSesion();
  initSidebarCuenta();
  initSidebarColapsable();
  initLoginTabs();
  initPasswordToggle();
  initAuthForms();
  initDemoForms();
  initGoogleDemo();
  initScrollReveal();
  initMapQuickFilters();
  initAdminNavigation();
});

// ===== Sesión (JWT guardado en localStorage tras iniciar sesión) =====
function obtenerSesion() {
  try {
    const bruto = localStorage.getItem(CLAVE_SESION);
    return bruto ? JSON.parse(bruto) : null;
  } catch (error) {
    return null;
  }
}

function guardarSesion(usuario, token) {
  try {
    localStorage.setItem(CLAVE_SESION, JSON.stringify({ usuario, token }));
  } catch (error) {
    // localStorage no disponible (modo privado, etc.): la sesión no persiste.
  }
}

function cerrarSesion() {
  try {
    localStorage.removeItem(CLAVE_SESION);
  } catch (error) { /* nada que limpiar */ }
  window.location.href = '/login';
}

// Páginas privadas (perfil, actividades, logros, panel admin): si no hay
// sesión (o no tiene el rol requerido), se redirige a login antes de
// mostrar nada. Se marca en <body data-requiere-sesion="true"> o
// <body data-requiere-rol="admin">.
function initProteccionPagina() {
  const body = document.body;
  const requiereSesion = body.dataset.requiereSesion === 'true';
  const requiereRol = body.dataset.requiereRol;
  if (!requiereSesion && !requiereRol) return;

  const sesion = obtenerSesion();
  const rolValido = !requiereRol || (sesion && sesion.usuario.rol === requiereRol);

  if (!sesion || !rolValido) {
    const siguiente = encodeURIComponent(window.location.pathname);
    window.location.href = `/login?next=${siguiente}`;
  }
}

// ===== Datos del usuario (compartido por perfil, actividad y logros) =====
// Pide el usuario actualizado (los puntos cambian cuando el admin confirma
// un aporte) y refresca la sesión. Una sola petición por página.
async function cargarUsuarioActual() {
  const sesion = obtenerSesion();
  if (!sesion) return null;
  try {
    const r = await fetch('/api/usuarios/me', { headers: { Authorization: `Bearer ${sesion.token}` } });
    if (!r.ok) return sesion.usuario;
    const usuario = await r.json();
    guardarSesion(usuario, sesion.token);
    return usuario;
  } catch (error) {
    return sesion.usuario; // sin conexión: lo último guardado
  }
}

// Misma regla que el backend (acciones.py): 1 nivel cada 100 puntos.
const PUNTOS_POR_NIVEL = 100;
function progresoNivel(puntos) {
  const avance = puntos % PUNTOS_POR_NIVEL;
  return { avance, faltan: PUNTOS_POR_NIVEL - avance };
}

// Sidebar de cuenta/admin: nombre y foto reales + enlaces que dependen del rol.
function initSidebarCuenta() {
  const sesion = obtenerSesion();
  if (!sesion) return;
  const { usuario } = sesion;

  document.querySelectorAll('[data-perfil="nombre-mini"]').forEach((el) => {
    el.textContent = usuario.nombre || 'Mi cuenta';
  });
  if (usuario.foto_url) {
    document.querySelectorAll('[data-perfil="foto-mini"]').forEach((img) => {
      img.onerror = () => { img.onerror = null; img.src = '/static/assets/img/avatar-default.svg'; };
      img.src = urlFoto(usuario.foto_url);
    });
  }
  document.querySelectorAll('[data-solo-rol]').forEach((el) => {
    el.hidden = el.dataset.soloRol !== usuario.rol;
  });
}

// Cambia "Iniciar sesión / Crear cuenta" del header por el usuario activo.
function initEstadoSesion() {
  const sesion = obtenerSesion();
  if (!sesion) return;

  document.querySelectorAll('.header__actions').forEach((contenedor) => {
    const nombre = (sesion.usuario.nombre || 'Mi cuenta').split(' ')[0];
    // El admin vuelve a su panel; el resto, a su perfil.
    const etiquetas = { admin: '🛠 Panel admin', empresa: '🏢 Mi empresa' };
    const etiqueta = etiquetas[sesion.usuario.rol] || `👤 ${nombre}`;
    contenedor.innerHTML = `
      <a href="${inicioPorRol(sesion.usuario.rol)}" class="btn btn--ghost">${etiqueta}</a>
      <button type="button" class="btn btn--primary" data-cerrar-sesion>Cerrar sesión</button>
    `;
  });

  document.querySelectorAll('[data-cerrar-sesion]').forEach((boton) => {
    boton.addEventListener('click', cerrarSesion);
  });
}

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

// ===== Login / registro reales (conectados al backend) =====
function initAuthForms() {
  const formLogin = document.querySelector('[data-auth-form="login"]');
  const formRegistro = document.querySelector('[data-auth-form="registro"]');
  if (!formLogin && !formRegistro) return;

  const enviar = async (form, endpoint, cuerpo) => {
    const errorEl = form.querySelector('[data-form-error]');
    if (errorEl) { errorEl.hidden = true; errorEl.textContent = ''; }
    const boton = form.querySelector('button[type="submit"]');
    if (boton) boton.disabled = true;

    try {
      const respuesta = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo completar la solicitud.');

      guardarSesion(datos.usuario, datos.access_token);
      // Si venía de una página protegida vuelve ahí; si no, cada rol a su inicio.
      // El admin siempre entra a su panel (salvo que viniera de otra página admin).
      const siguiente = new URLSearchParams(window.location.search).get('next');
      if (datos.usuario.rol === 'admin') {
        window.location.href = siguiente && siguiente.startsWith('/admin') ? siguiente : '/admin';
      } else {
        window.location.href = siguiente || inicioPorRol(datos.usuario.rol);
      }
    } catch (error) {
      if (errorEl) {
        errorEl.textContent = error.message;
        errorEl.hidden = false;
      }
    } finally {
      if (boton) boton.disabled = false;
    }
  };

  if (formLogin) {
    formLogin.addEventListener('submit', (evento) => {
      evento.preventDefault();
      enviar(formLogin, '/api/auth/login', {
        correo: formLogin.querySelector('#login-email').value.trim(),
        password: formLogin.querySelector('#login-password').value,
      });
    });
  }

  if (formRegistro) {
    formRegistro.addEventListener('submit', (evento) => {
      evento.preventDefault();
      enviar(formRegistro, '/api/auth/registro', {
        nombre: formRegistro.querySelector('#registro-nombre').value.trim(),
        correo: formRegistro.querySelector('#registro-email').value.trim(),
        password: formRegistro.querySelector('#registro-password').value,
      });
    });
  }
}

// ===== Formularios de demostración que aún no tienen backend propio =====
function initDemoForms() {
  const mensajes = {
    perfil: 'Cambios guardados como demostración. Más adelante se conectarán con tu cuenta.',
    reporte: 'Reporte enviado como demostración. Más adelante será almacenado para revisión.',
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
          observador.unobserve(entrada.target); // deja de observar: ahorra recursos
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

// ===== Filtros rápidos del mapa (chips de tipo de residuo) =====
// La lógica de carga de puntos reales vive en mapa.js (solo se usa en /mapa);
// aquí solo se sincroniza el texto del buscador con el chip elegido.
function initMapQuickFilters() {
  document.querySelectorAll('.map-quicktags button').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.map-quicktags button').forEach((b) => b.classList.remove('is-active'));
      chip.classList.add('is-active');
      const buscador = document.getElementById('mapa-buscador');
      if (buscador) buscador.value = chip.textContent.trim();
      document.dispatchEvent(new CustomEvent('ecomaps:filtro-mapa'));
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



// ===== Menú lateral colapsable (admin, cuenta, empresa) =====
// Escritorio: alterna "solo iconos" y lo recuerda. Tablet: empieza en
// iconos. Teléfono: el menú es un cajón que se abre y se cierra.
const CLAVE_SIDEBAR = 'ecomaps_sidebar_colapsado';

function initSidebarColapsable() {
  const layout = document.querySelector('.admin');
  const boton = document.querySelector('[data-toggle-sidebar]');
  if (!layout || !boton) return;

  const backdrop = document.querySelector('[data-cerrar-sidebar]');
  const esTelefono = window.matchMedia('(max-width: 640px)');
  const esTablet = window.matchMedia('(max-width: 1024px)');

  const leerPreferencia = () => {
    try { return localStorage.getItem(CLAVE_SIDEBAR); } catch (e) { return null; }
  };
  const guardarPreferencia = (valor) => {
    try { localStorage.setItem(CLAVE_SIDEBAR, valor); } catch (e) { /* sin almacenamiento */ }
  };

  const abrirCajon = (abrir) => {
    layout.classList.toggle('is-abierto', abrir);
    if (backdrop) backdrop.hidden = !abrir;
    boton.setAttribute('aria-expanded', String(abrir));
    document.body.style.overflow = abrir ? 'hidden' : '';
  };

  const aplicarEstado = () => {
    abrirCajon(false);
    if (esTelefono.matches) {
      boton.setAttribute('aria-expanded', 'false');
      return;
    }
    const pref = leerPreferencia();
    const colapsado = pref !== null ? pref === '1' : esTablet.matches;
    layout.classList.toggle('is-colapsado', colapsado);
    boton.setAttribute('aria-expanded', String(!colapsado));
  };

  boton.addEventListener('click', () => {
    if (esTelefono.matches) {
      abrirCajon(!layout.classList.contains('is-abierto'));
      return;
    }
    const colapsado = layout.classList.toggle('is-colapsado');
    boton.setAttribute('aria-expanded', String(!colapsado));
    guardarPreferencia(colapsado ? '1' : '0');
  });

  if (backdrop) backdrop.addEventListener('click', () => abrirCajon(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && layout.classList.contains('is-abierto')) abrirCajon(false);
  });
  // En el cajón, al tocar un enlace se cierra (útil con los #anclas).
  layout.querySelector('.admin__sidebar').addEventListener('click', (e) => {
    if (esTelefono.matches && e.target.closest('a')) abrirCajon(false);
  });

  esTelefono.addEventListener('change', aplicarEstado);
  esTablet.addEventListener('change', aplicarEstado);
  aplicarEstado();
}
