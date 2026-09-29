// =========================================================
// EcoMaps · JavaScript del frontend
// =========================================================

const CLAVE_SESION = 'ecomaps_sesion';

// Ruta de una foto subida: las de Cloudinary ya son URL completas (https://...);
// las locales son relativas a /static. Sin foto -> avatar por defecto.
// Marco de avatar del nivel (1..20). `mini` = versión pequeña para galerías.
const TOTAL_MARCOS = 20;
function urlMarco(nivel, mini = false) {
  const n = Math.min(Math.max(Number(nivel) || 1, 1), TOTAL_MARCOS);
  return `/static/assets/img/marcos/nivel-${String(n).padStart(2, '0')}${mini ? '-mini' : ''}.webp`;
}

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
  initGoogleLogin();
  initScrollReveal();
  initMapQuickFilters();
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
    const etiqueta = etiquetas[sesion.usuario.rol] || `👤 ${escaparHTML(nombre)}`;
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

      entrarConSesion(datos);
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


// Guarda la sesión y lleva a cada rol a su inicio. Si venía de una página
// protegida vuelve ahí; el admin siempre entra a su panel (salvo que viniera
// de otra página admin). Lo usan el login normal y el de Google.
function entrarConSesion(datos) {
  guardarSesion(datos.usuario, datos.access_token);
  const siguiente = new URLSearchParams(window.location.search).get('next');
  if (datos.usuario.rol === 'admin') {
    window.location.href = siguiente && siguiente.startsWith('/admin') ? siguiente : '/admin';
  } else {
    window.location.href = siguiente || inicioPorRol(datos.usuario.rol);
  }
}

// ===== Inicio de sesión con Google (Google Identity Services, gratis) =====
// La librería de Google se carga solo en /login y solo si hay GOOGLE_CLIENT_ID.
// Google entrega un token firmado; el backend lo verifica en /api/auth/google.
function initGoogleLogin() {
  const contenedores = document.querySelectorAll('[data-google-boton]');
  if (!contenedores.length || !window.GOOGLE_CLIENT_ID) return;

  const mostrarError = (mensaje) => {
    document.querySelectorAll('[data-auth-form] [data-form-error]').forEach((el) => {
      el.textContent = mensaje;
      el.hidden = false;
    });
  };

  const alRecibirCredencial = async ({ credential }) => {
    try {
      const r = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const datos = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(datos.error || 'No se pudo iniciar sesión con Google.');
      entrarConSesion(datos);
    } catch (error) {
      mostrarError(error.message);
    }
  };

  // Ancho del botón = ancho real de la tarjeta del formulario (Google acepta
  // entre 200 y 400 px). Se mide la tarjeta visible porque la pestaña oculta
  // mide 0; antes quedaba en 360-400 px y en teléfonos angostos empujaba
  // todo el formulario fuera de la pantalla.
  const anchoBoton = () => {
    const tarjeta = document.querySelector('.auth__card') || document.body;
    return Math.max(200, Math.min(400, Math.floor(tarjeta.clientWidth)));
  };
  const dibujar = () => {
    const ancho = anchoBoton();
    contenedores.forEach((el) => {
      el.innerHTML = '';
      google.accounts.id.renderButton(el, {
        type: 'standard', theme: 'outline', size: 'large', shape: 'pill',
        text: 'continue_with', locale: 'es', width: ancho,
      });
    });
  };
  const iniciar = () => {
    google.accounts.id.initialize({ client_id: window.GOOGLE_CLIENT_ID, callback: alRecibirCredencial });
    dibujar();
    // Si se gira el teléfono o cambia el tamaño, se ajusta (con espera para no redibujar de más).
    let espera;
    let anchoAnterior = anchoBoton();
    window.addEventListener('resize', () => {
      clearTimeout(espera);
      espera = setTimeout(() => {
        const nuevo = anchoBoton();
        if (nuevo !== anchoAnterior) { anchoAnterior = nuevo; dibujar(); }
      }, 250);
    });
  };

  // El script de Google carga con async: se espera a que esté listo.
  if (window.google && google.accounts) iniciar();
  else window.addEventListener('load', () => { if (window.google && google.accounts) iniciar(); });
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

// Convierte los caracteres especiales de HTML en texto seguro.
// Úsala con TODO dato que venga de la API o del usuario antes de meterlo
// en un innerHTML o en un template string con etiquetas HTML.
// Ejemplo: `<h3>${escaparHTML(punto.nombre)}</h3>`
function escaparHTML(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}


/* avisos con el diseño de EcoMaps (reemplazan alert y confirm) === */
// mostrarAviso({ tipo, titulo, mensaje, boton })
//   tipo: 'exito' | 'error'. Devuelve una promesa que se cumple al cerrar el aviso,
//   así se puede esperar antes de redirigir:  await mostrarAviso({...});
// confirmarAccion({ titulo, mensaje, boton, icono })   icono: 'peligro' (papelera) o 'pausa'
//   Pregunta con "Cancelar" y el botón de acción. Devuelve true o false, como confirm().
// Los textos se insertan con textContent: nunca se interpretan como HTML.
const ICONOS_AVISO = {
  exito: '<svg viewBox="0 0 52 52" aria-hidden="true"><circle class="aviso__circulo" cx="26" cy="26" r="23" pathLength="1"/><path class="aviso__trazo" d="M15 27l7.5 7.5L37.5 19" pathLength="1"/></svg>',
  error: '<svg viewBox="0 0 52 52" aria-hidden="true"><circle class="aviso__circulo" cx="26" cy="26" r="23" pathLength="1"/><path class="aviso__trazo" d="M26 15v14" pathLength="1"/><circle cx="26" cy="37" r="2.6" fill="currentColor" stroke="none"/></svg>',
  pausa: '<svg viewBox="0 0 52 52" aria-hidden="true"><circle class="aviso__circulo" cx="26" cy="26" r="23" pathLength="1"/><path class="aviso__trazo" d="M21 17v18M31 17v18" pathLength="1"/></svg>',
  peligro: '<svg viewBox="0 0 52 52" aria-hidden="true"><circle class="aviso__circulo" cx="26" cy="26" r="23" pathLength="1"/><path class="aviso__trazo" d="M18 19h16M23 19v-3h6v3M20 19l1.5 17h9L32 19M24.5 23.5v8M27.5 23.5v8" pathLength="1"/></svg>',
};

function abrirAviso({ tipo, icono, titulo, mensaje, botones }) {
  return new Promise((resolver) => {
    const dialogo = document.createElement('dialog');
    dialogo.className = `aviso aviso--${tipo}`;
    dialogo.innerHTML = `
      <div class="aviso__icono">${ICONOS_AVISO[icono || tipo] || ICONOS_AVISO.exito}</div>
      <h2 class="aviso__titulo"></h2>
      <p class="aviso__mensaje"></p>
      <div class="aviso__botones"></div>`;
    dialogo.querySelector('.aviso__titulo').textContent = titulo;
    dialogo.querySelector('.aviso__mensaje').textContent = mensaje || '';

    const zonaBotones = dialogo.querySelector('.aviso__botones');
    botones.forEach(({ texto, valor, clase }) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn ${clase}`;
      b.textContent = texto;
      b.addEventListener('click', () => dialogo.close(valor));
      zonaBotones.appendChild(b);
    });

    // Clic fuera de la tarjeta = cerrar sin confirmar.
    dialogo.addEventListener('click', (e) => { if (e.target === dialogo) dialogo.close(''); });
    dialogo.addEventListener('close', () => {
      resolver(dialogo.returnValue);
      dialogo.remove();
    });

    document.body.appendChild(dialogo);
    dialogo.showModal();
    zonaBotones.lastElementChild.focus();
  });
}

function mostrarAviso({ tipo = 'exito', titulo, mensaje, boton = 'Entendido' } = {}) {
  if (typeof HTMLDialogElement !== 'function') { alert(mensaje || titulo); return Promise.resolve(); }
  return abrirAviso({
    tipo,
    titulo: titulo || (tipo === 'error' ? 'No se pudo completar' : '¡Listo!'),
    mensaje,
    botones: [{ texto: boton, valor: 'ok', clase: 'btn--primary' }],
  }).then(() => undefined);
}

function confirmarAccion({ titulo, mensaje, boton = 'Confirmar', icono = 'peligro' } = {}) {
  if (typeof HTMLDialogElement !== 'function') return Promise.resolve(confirm(mensaje || titulo));
  return abrirAviso({
    tipo: 'peligro',
    icono,
    titulo,
    mensaje,
    botones: [
      { texto: 'Cancelar', valor: '', clase: 'btn--outline' },
      { texto: boton, valor: 'si', clase: 'aviso__peligro' },
    ],
  }).then((valor) => valor === 'si');
}


/* === Sarith: reducir fotos antes de subirlas === */
// Las fotos de la cámara del teléfono pesan 3-10 MB y el servidor acepta máximo 5 MB.
// Esta función las reduce en el navegador (lado mayor de 1600 px, JPG al 82 %):
// quedan en ~300-500 KB, se suben rápido con datos móviles y siguen viéndose nítidas.
// Si algo falla (formato raro, navegador viejo), devuelve la foto original sin cambios.
const LADO_MAXIMO_FOTO = 1600;

async function reducirFoto(archivo) {
  if (!archivo || !['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type)) return archivo;
  if (archivo.size <= 900 * 1024) return archivo; // ya es liviana

  try {
    const url = URL.createObjectURL(archivo);
    const img = await new Promise((ok, error) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = error;
      i.src = url;
    });
    URL.revokeObjectURL(url);

    const escala = Math.min(1, LADO_MAXIMO_FOTO / Math.max(img.naturalWidth, img.naturalHeight));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(img.naturalWidth * escala);
    lienzo.height = Math.round(img.naturalHeight * escala);
    const ctx = lienzo.getContext('2d');
    ctx.fillStyle = '#fff'; // fondo blanco para PNG con transparencia
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);

    const blob = await new Promise((ok) => lienzo.toBlob(ok, 'image/jpeg', 0.82));
    if (!blob || blob.size >= archivo.size) return archivo;
    const nombre = (archivo.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], nombre, { type: 'image/jpeg' });
  } catch (error) {
    return archivo;
  }
}
/* === Fin Sarith === */
