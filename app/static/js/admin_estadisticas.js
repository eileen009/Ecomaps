// =========================================================
// EcoMaps · Panel admin - estadísticas reales y ranking
// Se carga solo en /admin/estadisticas. Una sola petición a la API.
// =========================================================

document.addEventListener('DOMContentLoaded', async () => {
  const ranking = document.getElementById('ranking');
  const sesion = obtenerSesion();
  if (!ranking || !sesion) return;

  const fmt = (n) => Number(n || 0).toLocaleString('es-CO');
  const poner = (clave, texto) => {
    const el = document.querySelector(`[data-est="${clave}"]`);
    if (el) el.textContent = texto;
  };

  let datos;
  try {
    const r = await fetch('/api/estadisticas/admin', { headers: { Authorization: `Bearer ${sesion.token}` } });
    if (!r.ok) throw new Error();
    datos = await r.json();
  } catch (e) {
    ranking.innerHTML = '<p class="map-layout__panel-vacio">No se pudieron cargar las estadísticas.</p>';
    return;
  }

  const g = datos.generales;
  poner('usuarios', fmt(g.usuarios));
  poner('usuarios_mes', g.usuarios_mes ? `+${fmt(g.usuarios_mes)} este mes` : '');
  poner('puntos_pendientes', fmt(datos.puntos_pendientes));
  poner('reportes_pendientes', fmt(datos.reportes_pendientes));
  poner('aportes_pendientes', fmt(datos.aportes_pendientes));
  poner('recicladores_mes', fmt(g.recicladores_mes));

  if (!datos.ranking.length) {
    ranking.innerHTML = '<p class="map-layout__panel-vacio">Aún no hay ciudadanos con puntos.</p>';
    return;
  }

  // Se construye con textContent (no innerHTML) porque los nombres los escriben los usuarios.
  const maximo = datos.ranking[0].puntos || 1;
  ranking.innerHTML = '';
  datos.ranking.forEach((u, i) => {
    const fila = document.createElement('div');
    fila.className = 'leaderboard__row';
    fila.innerHTML = `
      <span class="leaderboard__rank">${i + 1}</span>
      <img class="leaderboard__avatar leaderboard__avatar--img" alt="" width="36" height="36">
      <div class="leaderboard__info"><div class="leaderboard__name"></div><div class="leaderboard__city"></div></div>
      <div class="leaderboard__score"><strong></strong> puntos
        <div class="leaderboard__bar"><span style="width:${Math.round((u.puntos * 100) / maximo)}%"></span></div>
      </div>`;
    const img = fila.querySelector('img');
    img.onerror = () => { img.onerror = null; img.src = '/static/assets/img/avatar-default.svg'; };
    img.src = !u.foto_url ? '/static/assets/img/avatar-default.svg'
      : (u.foto_url.startsWith('http') ? u.foto_url : `/static/${u.foto_url}`);
    fila.querySelector('.leaderboard__name').textContent = u.nombre;
    fila.querySelector('.leaderboard__city').textContent = `Nivel ${u.nivel} · ${fmt(u.aportes)} aportes confirmados`;
    fila.querySelector('strong').textContent = fmt(u.puntos);
    ranking.appendChild(fila);
  });
});
