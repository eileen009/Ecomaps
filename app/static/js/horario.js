// =========================================================
// EcoMaps · Editor de horarios (tabla de 7 días)
// Lo usan /empresa y /proponer. Necesita en la página:
//   #horario-tabla, botones [data-atajo] y [data-horario="preview"].
// =========================================================

// El horario se guarda en la columna `horario` (VARCHAR 150) con un
// formato corto y fijo, p. ej. "Lun-Vie 08:00-18:00; Sáb 09:00-13:00".
// Así se lee bien en el mapa y se puede volver a cargar en esta tabla
// sin cambiar el esquema de la BD.
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// ----- Horarios: tabla de 7 días -----
function construirTablaHorario() {
  const tabla = document.getElementById('horario-tabla');
  tabla.innerHTML = DIAS.map((dia, i) => `
    <div class="horario-fila" data-dia="${i}">
      <strong>${dia}</strong>
      <label class="horario-abierto"><input type="checkbox" data-campo="abierto"> Abierto</label>
      <input type="time" data-campo="desde" value="08:00" aria-label="${dia} abre">
      <span>a</span>
      <input type="time" data-campo="hasta" value="17:00" aria-label="${dia} cierra">
    </div>`).join('');

  tabla.addEventListener('input', actualizarVistaHorario);

  document.querySelectorAll('[data-atajo]').forEach((boton) => {
    boton.addEventListener('click', () => {
      const lunes = leerDia(0);
      const hasta = boton.dataset.atajo === 'lv' ? 5 : 7;
      for (let i = 1; i < hasta; i++) escribirDia(i, lunes);
      actualizarVistaHorario();
    });
  });
}

function fila(i) {
  return document.querySelector(`.horario-fila[data-dia="${i}"]`);
}

function leerDia(i) {
  const f = fila(i);
  return {
    abierto: f.querySelector('[data-campo="abierto"]').checked,
    desde: f.querySelector('[data-campo="desde"]').value,
    hasta: f.querySelector('[data-campo="hasta"]').value,
  };
}

function escribirDia(i, { abierto, desde, hasta }) {
  const f = fila(i);
  f.querySelector('[data-campo="abierto"]').checked = abierto;
  if (desde) f.querySelector('[data-campo="desde"]').value = desde;
  if (hasta) f.querySelector('[data-campo="hasta"]').value = hasta;
  f.classList.toggle('is-cerrado', !abierto);
}

// Tabla -> texto corto, agrupando días seguidos con el mismo horario.
function horarioATexto() {
  const grupos = [];
  DIAS.forEach((dia, i) => {
    const d = leerDia(i);
    const rango = d.abierto ? `${d.desde}-${d.hasta}` : null;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.rango === rango && ultimo.fin === i - 1) {
      ultimo.fin = i;
    } else {
      grupos.push({ inicio: i, fin: i, rango });
    }
  });
  return grupos
    .filter((g) => g.rango)
    .map((g) => `${DIAS[g.inicio]}${g.fin > g.inicio ? `-${DIAS[g.fin]}` : ''} ${g.rango}`)
    .join('; ');
}

// Texto -> tabla. Devuelve false si el texto no tiene nuestro formato
// (horarios viejos escritos a mano), para no perderlos en silencio.
function textoAHorario(texto) {
  DIAS.forEach((_, i) => escribirDia(i, { abierto: false }));
  if (!texto) return true;

  const patron = /^(\S+?)(?:-(\S+))? (\d{2}:\d{2})-(\d{2}:\d{2})$/;
  const partes = texto.split(';').map((p) => p.trim()).filter(Boolean);
  const leidos = [];
  for (const parte of partes) {
    const m = parte.match(patron);
    if (!m) return false;
    const inicio = DIAS.indexOf(m[1]);
    const fin = m[2] ? DIAS.indexOf(m[2]) : inicio;
    if (inicio < 0 || fin < inicio) return false;
    leidos.push({ inicio, fin, desde: m[3], hasta: m[4] });
  }
  leidos.forEach(({ inicio, fin, desde, hasta }) => {
    for (let i = inicio; i <= fin; i++) escribirDia(i, { abierto: true, desde, hasta });
  });
  return true;
}

function actualizarVistaHorario() {
  DIAS.forEach((_, i) => fila(i).classList.toggle('is-cerrado', !leerDia(i).abierto));
  document.querySelector('[data-horario="preview"]').textContent = horarioATexto() || 'Sin horario (cerrado todos los días)';
}


// Devuelve el nombre del primer día con horas incoherentes, o undefined.
function diaHorarioInvalido() {
  return DIAS.find((_, i) => {
    const d = leerDia(i);
    return d.abierto && (!d.desde || !d.hasta || d.desde >= d.hasta);
  });
}
