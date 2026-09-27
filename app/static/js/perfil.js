// =========================================================
// EcoMaps · Mi perfil (ciudadano): puntos, nivel y ganancias.
// La foto y los datos de la cuenta los maneja cuenta.js, que avisa
// con el evento "usuario-actualizado". Se carga solo en /perfil.
// =========================================================

const MARCOS = {
  ninguno: { nombre: '—', badge: '♻ Reciclador activo' },
  bronce: { nombre: 'Bronce', badge: '🥉 Marco bronce' },
  plata: { nombre: 'Plata', badge: '🥈 Marco plata' },
  oro: { nombre: 'Oro', badge: '🥇 Marco oro' },
};
// Misma regla que Usuario.NIVELES_MARCO (backend). PUNTOS_POR_NIVEL viene de main.js.
const NIVEL_MARCO = { bronce: 3, plata: 5, oro: 7 };

document.addEventListener('usuario-actualizado', ({ detail: usuario }) => {
  const $ = (clave) => document.querySelector(`[data-perfil="${clave}"]`);
  const puntos = usuario.puntos_totales ?? 0;
  const nivel = usuario.nivel ?? 1;
  const marco = MARCOS[usuario.marco_avatar] ? usuario.marco_avatar : 'ninguno';
  const { avance, faltan } = progresoNivel(puntos);

  $('puntos').textContent = puntos.toLocaleString('es-CO');
  $('puntos-2').textContent = puntos.toLocaleString('es-CO');
  $('nivel').textContent = nivel;
  $('marco').textContent = MARCOS[marco].nombre;
  $('marco-badge').textContent = MARCOS[marco].badge;

  $('progreso').setAttribute('aria-valuenow', avance);
  $('progreso-barra').style.width = `${avance}%`;
  $('progreso-texto').textContent = `Te faltan ${faltan} puntos para el nivel ${nivel + 1}.`;

  document.querySelectorAll('[data-ganancia]').forEach((li) => {
    li.classList.toggle('is-desbloqueado', nivel >= NIVEL_MARCO[li.dataset.ganancia]);
  });
});
