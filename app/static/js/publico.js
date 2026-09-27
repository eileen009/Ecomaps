// =========================================================
// EcoMaps · Interacciones de las páginas públicas
// (header al hacer scroll, apariciones, puntos reales en el inicio,
//  navegación de la guía). Sin librerías externas.
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
  initHeaderScroll();
  initAparecer();
  initPuntosInicio();
  initGuiaNav();
});

const reducirMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ICONOS = '/static/assets/img/iconos.svg';

// Escapa texto que viene de la base de datos antes de insertarlo como HTML.
function escaparHTML(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// "plástico, vidrio y papel"
function listaNatural(items) {
  const limpios = (items || []).filter(Boolean);
  if (limpios.length <= 1) return limpios.join('');
  return `${limpios.slice(0, -1).join(', ')} y ${limpios[limpios.length - 1]}`;
}

// ===== Sombra del header cuando la página ya no está arriba =====
function initHeaderScroll() {
  const header = document.querySelector('[data-header]');
  if (!header) return;
  const actualizar = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  actualizar();
  window.addEventListener('scroll', actualizar, { passive: true });
}

// ===== Grupos que aparecen una vez al entrar en pantalla =====
function initAparecer() {
  const grupos = document.querySelectorAll('[data-aparecer]');
  if (!grupos.length) return;

  if (reducirMovimiento || !('IntersectionObserver' in window)) {
    grupos.forEach((g) => g.classList.add('is-visible'));
    return;
  }
  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => {
      if (!entrada.isIntersecting) return;
      entrada.target.classList.add('is-visible');
      observador.unobserve(entrada.target);
    });
  }, { threshold: 0.25 });
  grupos.forEach((g) => observador.observe(g));
}

// ===== Inicio: puntos reales desde /api/puntos =====
async function initPuntosInicio() {
  const lista = document.querySelector('[data-puntos-inicio]');
  if (!lista) return;

  let puntos = [];
  try {
    const respuesta = await fetch('/api/puntos?estado=activo');
    if (respuesta.ok) puntos = await respuesta.json();
  } catch (error) {
    // Sin conexión con el servidor: se muestra el estado vacío.
  }

  if (!Array.isArray(puntos) || puntos.length === 0) {
    lista.innerHTML = `
      <div class="puntos-inicio__vacio">
        <p>Todavía no hay puntos publicados en el mapa. Si conoces un lugar que recibe material reciclable, envíalo para que el equipo lo revise.</p>
        <a href="/proponer" class="btn btn--primary">Proponer un punto</a>
      </div>`;
    return;
  }

  lista.innerHTML = puntos.slice(0, 3).map(tarjetaPunto).join('');
  mostrarTotalPuntos(puntos.length);
  destacarEnMapa(puntos[0]);
}

function tarjetaPunto(punto) {
  const materiales = (punto.materiales || [])
    .map((m) => `<span class="tag">${escaparHTML(m)}</span>`)
    .join('');
  const horario = punto.horario
    ? `<p class="punto__horario"><svg width="16" height="16" aria-hidden="true"><use href="${ICONOS}#i-reloj"/></svg>${escaparHTML(punto.horario)}</p>`
    : '';
  return `
    <article class="punto">
      <div class="punto__cabeza">
        <span class="punto__pin"><svg width="18" height="18" aria-hidden="true"><use href="${ICONOS}#i-reciclar"/></svg></span>
        <div>
          <h3>${escaparHTML(punto.nombre)}</h3>
          <p class="punto__dir">${escaparHTML(punto.direccion)}${punto.ciudad ? `, ${escaparHTML(punto.ciudad)}` : ''}</p>
        </div>
      </div>
      ${materiales ? `<div class="punto__materiales">${materiales}</div>` : ''}
      ${horario}
    </article>`;
}

// Cifra del hero: cuenta hasta el total real de puntos activos.
function mostrarTotalPuntos(total) {
  const contenedor = document.querySelector('[data-dato-puntos]');
  const numero = document.querySelector('[data-num-puntos]');
  if (!contenedor || !numero) return;
  contenedor.hidden = false;

  if (reducirMovimiento || total < 5) {
    numero.textContent = total.toLocaleString('es-CO');
    return;
  }
  const inicio = performance.now();
  const duracion = 900;
  const paso = (ahora) => {
    const t = Math.min((ahora - inicio) / duracion, 1);
    const suave = 1 - Math.pow(1 - t, 3);
    numero.textContent = Math.round(total * suave).toLocaleString('es-CO');
    if (t < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

// La tarjeta del mapa ilustrado muestra un punto real si existe.
function destacarEnMapa(punto) {
  const nombre = document.querySelector('[data-punto-nombre]');
  const materiales = document.querySelector('[data-punto-materiales]');
  if (!punto || !nombre) return;
  nombre.textContent = punto.nombre;
  if (materiales) {
    const texto = listaNatural((punto.materiales || []).slice(0, 3));
    materiales.textContent = texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : '';
  }
}

// ===== Guía: marca en la barra el material que se está leyendo =====
function initGuiaNav() {
  const enlaces = document.querySelectorAll('.guide-nav a[href^="#"]');
  if (!enlaces.length || !('IntersectionObserver' in window)) return;

  const porId = new Map([...enlaces].map((a) => [a.getAttribute('href').slice(1), a]));
  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => {
      if (!entrada.isIntersecting) return;
      enlaces.forEach((a) => a.classList.remove('is-activo'));
      const activo = porId.get(entrada.target.id);
      if (activo) {
        activo.classList.add('is-activo');
        activo.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reducirMovimiento ? 'auto' : 'smooth' });
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });

  porId.forEach((_, id) => {
    const seccion = document.getElementById(id);
    if (seccion) observador.observe(seccion);
  });
}
