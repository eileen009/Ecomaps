// =========================================================
// EcoMaps · Mapa interactivo (Leaflet + OpenStreetMap)
// Se carga solo en /mapa. Sin API key: OpenStreetMap es gratuito
// y no requiere facturación (código verde: una sola librería liviana).
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
  const contenedor = document.getElementById('mapa-leaflet');
  if (!contenedor || typeof L === 'undefined') return;

  // Centro por defecto: zona de Montería (donde están los puntos de ejemplo).
  const CENTRO_DEFECTO = [8.7479, -75.8814];

  const mapa = L.map(contenedor, { scrollWheelZoom: true }).setView(CENTRO_DEFECTO, 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapa);

  const capaPuntos = L.layerGroup().addTo(mapa);
  let marcadorUsuario = null;
  let ubicacionUsuario = null; // {lat, lng} si el navegador la concede

  const listaEl = document.getElementById('lista-puntos');
  const contadorEl = document.getElementById('contador-puntos');
  const buscadorEl = document.getElementById('mapa-buscador');
  const distanciaEl = document.getElementById('mapa-distancia');
  const sesion = typeof obtenerSesion === 'function' ? obtenerSesion() : null;

  function iconoPunto(esUsuario) {
    return L.divIcon({
      className: '',
      html: `<div class="map-marker${esUsuario ? ' map-marker--yo' : ''}"><span><svg width="15" height="15" style="color:#fff"><use href="/static/assets/img/iconos.svg#${esUsuario ? 'i-usuario' : 'i-reciclar'}"/></svg></span></div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -28],
    });
  }

  function popupPunto(punto) {
    const materiales = (punto.materiales || [])
      .map((m) => `<span class="tag">${m}</span>`)
      .join(' ');
    const accion = sesion
      ? `<a href="/actividad?punto=${punto.id}" class="btn btn--primary btn--block">Registrar que reciclé aquí</a>`
      : `<a href="/login?next=/mapa" class="btn btn--outline btn--block">Inicia sesión para registrar</a>`;

    return `
      <div style="min-width:200px;">
        <h3 style="margin:0 0 4px; font-size:0.95rem;">${punto.nombre}</h3>
        <p style="margin:0 0 8px; color:var(--texto-suave); font-size:0.82rem;">${punto.direccion}${punto.horario ? ' · ' + punto.horario : ''}</p>
        <div class="map-point__tags" style="margin-bottom:10px;">${materiales}</div>
        ${accion}
        <a href="/reportar?punto=${punto.id}" class="map-point__reportar">Reportar un problema con este punto</a>
      </div>`;
  }

  function tarjetaLista(punto) {
    const materiales = (punto.materiales || [])
      .map((m) => `<span class="tag">${m}</span>`)
      .join(' ');
    const distancia = typeof punto.distancia_km === 'number'
      ? `A ${punto.distancia_km} km`
      : `${punto.ciudad}`;

    const articulo = document.createElement('article');
    articulo.className = 'map-point';
    articulo.innerHTML = `
      <div class="map-point__top"><h3>${punto.nombre}</h3></div>
      <p class="map-point__meta">${distancia}${punto.horario ? ' · ' + punto.horario : ''}</p>
      <div class="map-point__tags">${materiales}</div>
      <div class="map-point__acciones">
        <button type="button" class="btn btn--outline" data-ver-mapa>Ver en el mapa</button>
        <a href="/reportar?punto=${punto.id}" class="btn btn--outline map-point__btn-reportar" title="Reportar un problema">Reportar</a>
      </div>
    `;
    articulo.querySelector('[data-ver-mapa]').addEventListener('click', () => {
      mapa.flyTo([punto.latitud, punto.longitud], 16);
      capaPuntos.eachLayer((marcador) => {
        if (marcador._puntoId === punto.id) marcador.openPopup();
      });
    });
    return articulo;
  }

  async function cargarPuntos() {
    const params = new URLSearchParams({ estado: 'activo' });

    const material = buscadorEl && buscadorEl.value.trim();
    if (material) params.set('material', material);

    const radio = distanciaEl && distanciaEl.value;
    if (radio) params.set('radio', radio);

    if (ubicacionUsuario) {
      params.set('lat', ubicacionUsuario.lat);
      params.set('lng', ubicacionUsuario.lng);
    }

    let puntos = [];
    try {
      const respuesta = await fetch(`/api/puntos?${params.toString()}`);
      if (respuesta.ok) puntos = await respuesta.json();
    } catch (error) {
      // Sin conexión con el backend: se muestra el mapa vacío en vez de romper la página.
    }

    capaPuntos.clearLayers();
    if (listaEl) listaEl.innerHTML = '';

    puntos.forEach((punto) => {
      const marcador = L.marker([punto.latitud, punto.longitud], { icon: iconoPunto(false) })
        .bindPopup(popupPunto(punto));
      marcador._puntoId = punto.id;
      marcador.addTo(capaPuntos);
      if (listaEl) listaEl.appendChild(tarjetaLista(punto));
    });

    if (contadorEl) {
      contadorEl.textContent = `${puntos.length} encontrado${puntos.length === 1 ? '' : 's'}`;
    }
    if (listaEl && puntos.length === 0) {
      listaEl.innerHTML = '<p class="map-layout__panel-vacio">No hay puntos activos con ese filtro todavía.</p>';
    }
  }

  // ===== Geolocalización del usuario (opcional, con permiso del navegador) =====
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        ubicacionUsuario = { lat: posicion.coords.latitude, lng: posicion.coords.longitude };
        if (marcadorUsuario) mapa.removeLayer(marcadorUsuario);
        marcadorUsuario = L.marker([ubicacionUsuario.lat, ubicacionUsuario.lng], { icon: iconoPunto(true) })
          .addTo(mapa)
          .bindPopup('Tu ubicación');
        mapa.setView([ubicacionUsuario.lat, ubicacionUsuario.lng], 14);
        cargarPuntos();
      },
      () => { /* permiso denegado o no disponible: se usa el centro por defecto */ },
      { timeout: 6000 }
    );
  }

  // ===== Eventos de los filtros (una sola barra, sin duplicados) =====
  const formBuscador = document.querySelector('.map-searchbar');
  if (formBuscador) {
    formBuscador.addEventListener('submit', (evento) => {
      evento.preventDefault();
      cargarPuntos();
    });
  }
  if (distanciaEl) distanciaEl.addEventListener('change', cargarPuntos);
  document.addEventListener('ecomaps:filtro-mapa', cargarPuntos);

  // Si se llega desde el buscador del inicio (/mapa?residuo=vidrio), se aplica ese filtro.
  const residuoInicial = new URLSearchParams(window.location.search).get('residuo');
  if (residuoInicial && buscadorEl) {
    buscadorEl.value = residuoInicial;
    document.querySelectorAll('.map-quicktags button').forEach((chip) => {
      chip.classList.toggle('is-active', chip.textContent.trim().toLowerCase() === residuoInicial.trim().toLowerCase());
    });
  }

  cargarPuntos();
});
