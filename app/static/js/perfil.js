// =========================================================
// EcoMaps · Mi perfil (ciudadano): puntos, nivel y marcos.
// La foto, el marco del avatar y los datos de la cuenta los maneja
// cuenta.js, que avisa con el evento "usuario-actualizado".
// PUNTOS_POR_NIVEL, TOTAL_MARCOS y urlMarco vienen de main.js.
// Se carga solo en /perfil.
// =========================================================

let galeriaPintada = ''; // estado con el que se pintó la galería (evita repintar igual)

document.addEventListener('usuario-actualizado', ({ detail: usuario }) => {
  const $ = (clave) => document.querySelector(`[data-perfil="${clave}"]`);
  const puntos = usuario.puntos_totales ?? 0;
  const nivel = usuario.nivel ?? 1;
  const marco = Math.min(nivel, TOTAL_MARCOS);            // último marco desbloqueado
  const puesto = usuario.marco_avatar || marco;            // el que lleva en la foto
  const { avance, faltan } = progresoNivel(puntos);

  $('puntos').textContent = puntos.toLocaleString('es-CO');
  $('puntos-2').textContent = puntos.toLocaleString('es-CO');
  $('nivel').textContent = nivel;
  $('marco').textContent = `${marco}/${TOTAL_MARCOS}`;
  $('marco-badge').textContent = `🏅 Marco nivel ${puesto}`;

  $('progreso').setAttribute('aria-valuenow', avance);
  $('progreso-barra').style.width = `${avance}%`;
  $('progreso-texto').textContent = `Te faltan ${faltan} puntos para el nivel ${nivel + 1}.`;

  $('marco-siguiente').textContent = marco < TOTAL_MARCOS
    ? `Siguiente marco: nivel ${marco + 1} (te faltan ${faltan} puntos).`
    : '¡Desbloqueaste todos los marcos!';

  const clave = `${marco}-${puesto}`;
  if (galeriaPintada !== clave) pintarGaleria(marco, puesto);
});

// Galería: los desbloqueados son botones para elegir qué marco llevar en la foto.
function pintarGaleria(maximo, puesto) {
  const galeria = document.getElementById('marcos-galeria');
  if (!galeria) return;
  galeria.innerHTML = Array.from({ length: TOTAL_MARCOS }, (_, i) => {
    const n = i + 1;
    const estado = n === puesto ? 'is-actual' : (n <= maximo ? 'is-desbloqueado' : 'is-bloqueado');
    const texto = n === puesto ? 'Es el que llevas' : (n <= maximo ? 'Toca para usarlo' : 'Bloqueado');
    // loading="lazy": las miniaturas solo se descargan cuando se ven (código verde)
    const img = `<img src="${urlMarco(n, true)}" alt="Marco nivel ${n}" width="72" height="72" loading="lazy"><span>${n}</span>`;
    return n <= maximo
      ? `<li class="${estado}" title="Marco nivel ${n} · ${texto}"><button type="button" class="marco-opcion" data-marco="${n}" aria-pressed="${n === puesto}" aria-label="Usar el marco del nivel ${n}">${img}</button></li>`
      : `<li class="${estado}" title="Marco nivel ${n} · ${texto}">${img}</li>`;
  }).join('');
  galeriaPintada = `${maximo}-${puesto}`;
}

// Elegir el marco: se guarda en la cuenta y se repinta todo con la respuesta.
async function elegirMarco(marco) {
  const sesion = obtenerSesion();
  if (!sesion) return;
  const r = await fetch('/api/usuarios/me/marco', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion.token}` },
    body: JSON.stringify({ marco }),
  }).catch(() => null);
  const datos = r ? await r.json().catch(() => ({})) : {};
  if (r && r.ok) aplicarUsuario(datos);
  else mostrarAviso({ tipo: 'error', mensaje: datos.error || 'No se pudo cambiar el marco.' });
}

document.addEventListener('click', (e) => {
  const boton = e.target.closest('[data-marco]');
  if (boton) elegirMarco(Number(boton.dataset.marco));
  if (e.target.closest('[data-marco-automatico]')) elegirMarco(null);
});


// =========================================================
// Invitación "¿Tienes una empresa?" (solo ciudadanos)
//  - "Sí, soy una empresa": se guarda la marca y se avisa al equipo.
//  - "No soy una empresa": se oculta (se recuerda en este navegador).
//  - Si se oculta sin querer, el menú "¿Tienes una empresa?" (enlace a
//    /perfil#empresa) la vuelve a mostrar.
// =========================================================
const CLAVE_OCULTAR_EMPRESA = 'ecomaps_oculta_invitacion_empresa';

function invitacionOculta(idUsuario) {
  try { return localStorage.getItem(`${CLAVE_OCULTAR_EMPRESA}_${idUsuario}`) === '1'; } catch (e) { return false; }
}
function recordarInvitacion(idUsuario, oculta) {
  try {
    if (oculta) localStorage.setItem(`${CLAVE_OCULTAR_EMPRESA}_${idUsuario}`, '1');
    else localStorage.removeItem(`${CLAVE_OCULTAR_EMPRESA}_${idUsuario}`);
  } catch (e) { /* sin localStorage: se vuelve a mostrar cada vez */ }
}

function pintarInvitacionEmpresa(usuario) {
  const seccion = document.getElementById('empresa');
  if (!seccion) return;
  if (!usuario || usuario.rol !== 'ciudadano') { seccion.hidden = true; return; }

  // Entrar por el menú (#empresa) siempre la muestra y deja de recordarla como oculta.
  const pedidaPorMenu = window.location.hash === '#empresa';
  if (pedidaPorMenu) recordarInvitacion(usuario.id, false);
  seccion.hidden = !pedidaPorMenu && invitacionOculta(usuario.id);

  const enviada = !!usuario.solicitud_empresa;
  seccion.querySelector('[data-solicitud="texto"]').hidden = enviada;
  seccion.querySelector('[data-solicitud="enviada"]').hidden = !enviada;
  seccion.querySelector('[data-solicitud-accion="si"]').hidden = enviada;
  seccion.querySelector('[data-solicitud-accion="cancelar"]').hidden = !enviada;
  if (pedidaPorMenu && !seccion.hidden) seccion.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Se escucha desde ya: cuenta.js avisa cuando tiene al usuario (sesión o servidor).
document.addEventListener('usuario-actualizado', ({ detail: usuario }) => pintarInvitacionEmpresa(usuario));
window.addEventListener('hashchange', () => {
  const sesion = obtenerSesion();
  if (sesion) pintarInvitacionEmpresa(sesion.usuario);
});

document.addEventListener('DOMContentLoaded', () => {
  const seccion = document.getElementById('empresa');
  if (!seccion) return;

  seccion.addEventListener('click', async (evento) => {
    const boton = evento.target.closest('[data-solicitud-accion]');
    const sesion = obtenerSesion();
    if (!boton || !sesion) return;
    const accion = boton.dataset.solicitudAccion;

    if (accion === 'no') {
      recordarInvitacion(sesion.usuario.id, true);
      seccion.hidden = true;
      mostrarAviso({
        titulo: 'Listo, la ocultamos',
        mensaje: 'Si fue sin querer, la encuentras en el menú de la izquierda: "¿Tienes una empresa?".',
      });
      return;
    }

    boton.disabled = true;
    try {
      const respuesta = await fetch('/api/usuarios/me/solicitud-empresa', {
        method: accion === 'si' ? 'POST' : 'DELETE',
        headers: { Authorization: `Bearer ${sesion.token}` },
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(datos.error || 'No se pudo enviar la solicitud.');
      aplicarUsuario(datos); // guarda la sesión y repinta la invitación
      mostrarAviso(accion === 'si'
        ? { titulo: '¡Aviso enviado!', mensaje: 'El equipo de EcoMaps recibió tu solicitud y revisará tu cuenta.' }
        : { titulo: 'Solicitud retirada', mensaje: 'Quitamos tu marca de empresa.' });
    } catch (error) {
      mostrarAviso({ tipo: 'error', mensaje: error.message });
    } finally {
      boton.disabled = false;
    }
  });
});
