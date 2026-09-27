// =========================================================
// EcoMaps · Panel admin - empresas y sello "Empresa verificada"
// Se carga solo en /admin/empresas.
// =========================================================

document.addEventListener('DOMContentLoaded', async () => {
  const lista = document.getElementById('lista-empresas');
  const buscador = document.getElementById('buscar-empresa');
  const sesion = obtenerSesion();
  if (!lista || !sesion) return;

  const headers = { Authorization: `Bearer ${sesion.token}` };
  let empresas = [];

  try {
    const r = await fetch('/api/usuarios/empresas', { headers });
    empresas = r.ok ? await r.json() : [];
  } catch (error) {
    lista.innerHTML = '<p class="map-layout__panel-vacio">No se pudo cargar la lista.</p>';
    return;
  }

  const tarjeta = (e) => `
    <article class="company-card" data-id="${e.id}">
      <div class="company-card__logo">${e.foto_url ? `<img src="/static/${e.foto_url}" alt="">` : '🏢'}</div>
      <div class="company-card__body">
        ${e.verificada ? '<span class="badge badge--verificada">✔ Verificada</span>' : '<span class="badge">Sin verificar</span>'}
        <h3>${e.nombre}</h3>
        <p>${e.correo} · ${e.num_puntos} punto${e.num_puntos === 1 ? '' : 's'}</p>
        <div class="company-card__acciones">
          <button type="button" class="btn ${e.verificada ? 'btn--outline' : 'btn--primary'}" data-verificar>
            ${e.verificada ? 'Quitar sello' : '✔ Verificar empresa'}
          </button>
        </div>
      </div>
    </article>`;

  // Filtra en memoria: la lista ya está cargada, no hace falta volver a pedirla.
  const pintar = () => {
    const q = (buscador.value || '').trim().toLowerCase();
    const visibles = empresas.filter((e) => !q || `${e.nombre} ${e.correo}`.toLowerCase().includes(q));
    lista.innerHTML = visibles.length
      ? visibles.map(tarjeta).join('')
      : '<p class="map-layout__panel-vacio">No hay empresas registradas con ese criterio.</p>';
  };

  lista.addEventListener('click', async (evento) => {
    const boton = evento.target.closest('[data-verificar]');
    if (!boton) return;
    const id = Number(boton.closest('[data-id]').dataset.id);
    const empresa = empresas.find((e) => e.id === id);
    boton.disabled = true;
    try {
      const r = await fetch(`/api/usuarios/${id}/verificada`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificada: !empresa.verificada }),
      });
      const datos = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(datos.error || 'No se pudo actualizar.');
      empresa.verificada = datos.verificada;
      pintar();
    } catch (error) {
      alert(error.message);
      boton.disabled = false;
    }
  });

  buscador.addEventListener('input', pintar);
  pintar();
});
