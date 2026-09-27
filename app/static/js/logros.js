// =========================================================
// EcoMaps · Mis logros (calculados con datos reales del usuario)
// Se carga solo en /logros.
// =========================================================

// Metas de cada logro. `valor` sale de los datos reales:
//   aportes = aportes confirmados, puntos = puntos_totales.
const LOGROS = [
  { icono: '♻', titulo: 'Primer reciclaje', texto: 'Registra tu primer aporte confirmado.', tipo: 'aportes', meta: 1 },
  { icono: '10', titulo: 'Reciclador frecuente', texto: 'Completa 10 aportes confirmados.', tipo: 'aportes', meta: 10 },
  { icono: '★', titulo: 'EcoHéroe', texto: 'Acumula 500 puntos.', tipo: 'puntos', meta: 500 },
  { icono: '🌱', titulo: 'Guardián del planeta', texto: 'Acumula 1.500 puntos.', tipo: 'puntos', meta: 1500 },
  { icono: '100', titulo: 'Constancia verde', texto: 'Completa 100 aportes confirmados.', tipo: 'aportes', meta: 100 },
];

document.addEventListener('DOMContentLoaded', async () => {
  const contenedor = document.getElementById('lista-logros');
  const sesion = obtenerSesion();
  if (!contenedor || !sesion) return;

  const [usuario, acciones] = await Promise.all([
    cargarUsuarioActual(),
    fetch('/api/acciones/mias', { headers: { Authorization: `Bearer ${sesion.token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
  ]);

  const valores = {
    puntos: usuario.puntos_totales ?? 0,
    aportes: acciones.filter((a) => a.estado === 'confirmada').length,
  };
  const fmt = (n) => n.toLocaleString('es-CO');

  // Banner
  document.querySelector('[data-logros="puntos"]').textContent = fmt(valores.puntos);
  document.querySelector('[data-logros="confirmadas"]').textContent =
    `${valores.aportes} aporte${valores.aportes === 1 ? '' : 's'} confirmado${valores.aportes === 1 ? '' : 's'}`;

  const proximo = LOGROS.find((l) => valores[l.tipo] < l.meta);
  if (proximo) {
    const actual = valores[proximo.tipo];
    const unidad = proximo.tipo === 'puntos' ? 'puntos' : 'aportes';
    document.querySelector('[data-logros="proximo"]').textContent = `Próximo logro: ${proximo.titulo}`;
    document.querySelector('[data-logros="barra"]').style.width = `${Math.min(100, (actual / proximo.meta) * 100)}%`;
    document.querySelector('[data-logros="proximo-detalle"]').textContent = `${fmt(actual)} / ${fmt(proximo.meta)} ${unidad}`;
  } else {
    document.querySelector('[data-logros="proximo"]').textContent = '¡Completaste todos los logros!';
    document.querySelector('[data-logros="barra"]').style.width = '100%';
  }

  // Tarjetas
  contenedor.innerHTML = LOGROS.map((l) => {
    const actual = valores[l.tipo];
    const hecho = actual >= l.meta;
    const estado = hecho ? 'Completado' : (actual > 0 ? 'En progreso' : 'Bloqueado');
    const barra = !hecho && actual > 0
      ? `<div class="mini-progress"><span style="width:${(actual / l.meta) * 100}%"></span></div>` : '';
    return `<article class="achievement-card ${hecho ? 'achievement-card--done' : ''}">
      <div class="achievement-card__icon">${l.icono}</div>
      <div><span class="achievement-card__state">${estado}</span><h3>${l.titulo}</h3><p>${l.texto}</p>${barra}</div></article>`;
  }).join('');
});
