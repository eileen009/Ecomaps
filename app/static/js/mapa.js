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

  // Escapa textos que escriben los usuarios (nombre, dirección...) antes de meterlos en HTML.
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // "Cómo llegar": abre Google Maps con la ruta hasta el punto (en el celular abre la app).
  // Si el navegador dio la ubicación, se usa como origen; si no, Google Maps la pide.
  function urlComoLlegar(punto) {
    const params = new URLSearchParams({ api: '1', destination: `${punto.latitud},${punto.longitud}` });
    if (ubicacionUsuario) params.set('origin', `${ubicacionUsuario.lat},${ubicacionUsuario.lng}`);
    return `https://www.google.com/maps/dir/?${params}`;
  }

  function popupPunto(punto) {
    const materiales = (punto.materiales || [])
      .map((m) => `<span class="tag">${esc(m)}</span>`)
      .join(' ');
    const accion = sesion
      ? `<a href="/actividad?punto=${punto.id}" class="btn btn--primary">Registrar aporte</a>`
      : `<a href="/login?next=/mapa" class="btn btn--outline">Inicia sesión para registrar</a>`;

    return `
      <div class="map-popup">
        <h3 class="map-popup__nombre">${esc(punto.nombre)}</h3>
        <p class="map-popup__meta">${esc(punto.direccion)}${punto.horario ? '<br>' + esc(punto.horario) : ''}</p>
        <div class="map-point__tags">${materiales}</div>
        <div class="map-popup__acciones">
          ${accion}
          <a href="${urlComoLlegar(punto)}" class="btn btn--outline" target="_blank" rel="noopener">Cómo llegar</a>
        </div>
        <a href="/reportar?punto=${punto.id}" class="map-point__reportar">Reportar un problema con este punto</a>
      </div>`;
  }

  // Deja espacio arriba (para que no se corte el nombre) y abajo (botones del mapa).
  const OPCIONES_POPUP = {
    maxWidth: 290,
    minWidth: 220,
    autoPanPaddingTopLeft: L.point(16, 16),
    autoPanPaddingBottomRight: L.point(16, 80),
  };

  function tarjetaLista(punto) {
    const materiales = (punto.materiales || [])
      .map((m) => `<span class="tag">${esc(m)}</span>`)
      .join(' ');
    const distancia = typeof punto.distancia_km === 'number'
      ? `A ${punto.distancia_km} km`
      : `${punto.ciudad}`;

    const articulo = document.createElement('article');
    articulo.className = 'map-point';
    articulo.innerHTML = `
      <div class="map-point__top"><h3>${esc(punto.nombre)}</h3></div>
      <p class="map-point__meta">${esc(distancia)}${punto.horario ? ' · ' + esc(punto.horario) : ''}</p>
      <div class="map-point__tags">${materiales}</div>
      <div class="map-point__acciones">
        <button type="button" class="btn btn--outline" data-ver-mapa>Ver en el mapa</button>
        <a href="/reportar?punto=${punto.id}" class="btn btn--outline map-point__btn-reportar" title="Reportar un problema">Reportar</a>
      </div>
    `;
    articulo.querySelector('[data-ver-mapa]').addEventListener('click', () => {
      // En el celular la lista queda arriba: primero se lleva la vista al mapa.
      const rect = contenedor.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        contenedor.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      // El popup se abre cuando termina el movimiento: así puede reacomodarse
      // y no queda cortado por arriba (antes se abría a mitad de la animación).
      mapa.once('moveend', () => {
        capaPuntos.eachLayer((marcador) => {
          if (marcador._puntoId === punto.id) marcador.openPopup();
        });
      });
      mapa.flyTo([punto.latitud, punto.longitud], 16, { duration: 0.6 });
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
        .bindPopup(popupPunto(punto), OPCIONES_POPUP);
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
  // ===== Ubicación del usuario =====
  // Antes se pedía sola al cargar la página: en el teléfono el navegador a
  // veces no mostraba el permiso y fallaba en silencio. Ahora:
  //  - si el permiso YA está concedido, se usa al entrar;
  //  - si no, se pide al tocar "Mi ubicación" y se explica cualquier error.
  const botonUbicarme = document.querySelector('[data-ubicarme]');
  const msgUbicacion = document.querySelector('[data-ubicacion-msg]');
  let temporizadorMsg;

  function avisar(texto, esError = false, duracion = 6000) {
    if (!msgUbicacion) return;
    clearTimeout(temporizadorMsg);
    msgUbicacion.textContent = texto;
    msgUbicacion.classList.toggle('is-error', esError);
    msgUbicacion.hidden = !texto;
    if (texto && duracion) temporizadorMsg = setTimeout(() => { msgUbicacion.hidden = true; }, duracion);
  }

  function explicarError(error) {
    const esIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (error.code === 1) {
      return esIOS
        ? 'Permiso de ubicación bloqueado. En el iPhone: Ajustes › Privacidad › Localización › Safari → "Al usar la app". Luego recarga la página.'
        : 'Permiso de ubicación bloqueado. Toca el candado junto a la dirección de la página › Permisos › Ubicación → Permitir, y recarga.';
    }
    if (error.code === 3) return 'Tu ubicación tardó demasiado. Revisa que el GPS esté encendido e inténtalo otra vez.';
    return 'No se pudo obtener tu ubicación. Revisa que la localización del teléfono esté activada.';
  }

  function ubicarme({ silencioso = false } = {}) {
    if (!('geolocation' in navigator)) {
      if (!silencioso) avisar('Tu navegador no permite obtener la ubicación.', true);
      return;
    }
    if (!window.isSecureContext) {
      if (!silencioso) avisar('La ubicación solo funciona en una página segura (https). Usa ecomaps.onrender.com.', true, 0);
      return;
    }
    if (!silencioso) {
      avisar('Buscando tu ubicación…', false, 0);
      if (botonUbicarme) botonUbicarme.disabled = true;
    }
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        ubicacionUsuario = { lat: posicion.coords.latitude, lng: posicion.coords.longitude };
        if (marcadorUsuario) mapa.removeLayer(marcadorUsuario);
        marcadorUsuario = L.marker([ubicacionUsuario.lat, ubicacionUsuario.lng], { icon: iconoPunto(true) })
          .addTo(mapa)
          .bindPopup('Tu ubicación');
        mapa.setView([ubicacionUsuario.lat, ubicacionUsuario.lng], 14);
        if (!silencioso) avisar('Listo: puntos ordenados por cercanía.', false, 3000);
        if (botonUbicarme) botonUbicarme.disabled = false;
        cargarPuntos();
      },
      (error) => {
        if (botonUbicarme) botonUbicarme.disabled = false;
        if (!silencioso) avisar(explicarError(error), true, 0);
      },
      // El GPS del teléfono puede tardar: 15 s de margen; una posición de
      // hace menos de 1 minuto sirve (evita encender el GPS otra vez).
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  if (botonUbicarme) botonUbicarme.addEventListener('click', () => ubicarme());
  if (msgUbicacion) msgUbicacion.addEventListener('click', () => { msgUbicacion.hidden = true; });

  // Al entrar: solo se usa sola si el permiso ya estaba concedido.
  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'geolocation' })
      .then((estado) => { if (estado.state === 'granted') ubicarme({ silencioso: true }); })
      .catch(() => { /* navegador sin Permissions API para ubicación: se espera al botón */ });
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
