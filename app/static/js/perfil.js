// =========================================================
// EcoMaps · Mi perfil (ciudadano): puntos, nivel y marcos.
// La foto, el marco del avatar y los datos de la cuenta los maneja
// cuenta.js, que avisa con el evento "usuario-actualizado".
// PUNTOS_POR_NIVEL, TOTAL_MARCOS y urlMarco vienen de main.js.
// Se carga solo en /perfil.
// =========================================================

let galeriaPintada = 0; // nivel con el que se pintó la galería (evita repintar igual)

document.addEventListener('usuario-actualizado', ({ detail: usuario }) => {
  const $ = (clave) => document.querySelector(`[data-perfil="${clave}"]`);
  const puntos = usuario.puntos_totales ?? 0;
  const nivel = usuario.nivel ?? 1;
  const marco = Math.min(nivel, TOTAL_MARCOS);
  const { avance, faltan } = progresoNivel(puntos);

  $('puntos').textContent = puntos.toLocaleString('es-CO');
  $('puntos-2').textContent = puntos.toLocaleString('es-CO');
  $('nivel').textContent = nivel;
  $('marco').textContent = `${marco}/${TOTAL_MARCOS}`;
  $('marco-badge').textContent = `🏅 Marco nivel ${marco}`;

  $('progreso').setAttribute('aria-valuenow', avance);
  $('progreso-barra').style.width = `${avance}%`;
  $('progreso-texto').textContent = `Te faltan ${faltan} puntos para el nivel ${nivel + 1}.`;

  $('marco-siguiente').textContent = marco < TOTAL_MARCOS
    ? `Siguiente marco: nivel ${marco + 1} (te faltan ${faltan} puntos).`
    : '¡Desbloqueaste todos los marcos!';

  if (galeriaPintada !== marco) pintarGaleria(marco);
});

function pintarGaleria(marcoActual) {
  const galeria = document.getElementById('marcos-galeria');
  if (!galeria) return;
  galeria.innerHTML = Array.from({ length: TOTAL_MARCOS }, (_, i) => {
    const n = i + 1;
    const estado = n === marcoActual ? 'is-actual' : (n < marcoActual ? 'is-desbloqueado' : 'is-bloqueado');
    const texto = n === marcoActual ? 'Tu marco' : (n < marcoActual ? 'Desbloqueado' : 'Bloqueado');
    // loading="lazy": las miniaturas solo se descargan cuando se ven (código verde)
    return `<li class="${estado}" title="Marco nivel ${n} · ${texto}">
      <img src="${urlMarco(n, true)}" alt="Marco nivel ${n}" width="72" height="72" loading="lazy">
      <span>${n}</span></li>`;
  }).join('');
  galeriaPintada = marcoActual;
}
