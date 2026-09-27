// =========================================================
// EcoMaps · Proponer punto (módulo 2): mapa real + dirección
// Se carga solo en /proponer.
//   - Escribir dirección → "Ubicar" (geocodifica con Nominatim/OSM).
//   - Clic o arrastre en el mapa → rellena dirección y ciudad.
// Código verde / política de Nominatim: solo se consulta cuando el
// usuario lo pide (nada de autocompletar en cada tecla) y se cachea.
// =========================================================

const CENTRO_DEFECTO = [8.7479, -75.8814]; // Montería (igual que mapa.js)
const NOMINATIM = 'https://nominatim.openstreetmap.org';
const cacheGeo = new Map();

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-proponer');
  if (!form) return;

  construirTablaHorario();
  actualizarVistaHorario();

  if (!obtenerSesion()) document.getElementById('proponer-aviso-sesion').hidden = false;

  const ubicacion = initMapaSelector();
  form.addEventListener('submit', (e) => { e.preventDefault(); enviarPropuesta(form, ubicacion); });
});

// ----- Mapa -----
function initMapaSelector() {
  const estado = document.getElementById('proponer-mapa-estado');
  const inputDir = document.getElementById('p-direccion');
  const inputCiudad = document.getElementById('p-ciudad');
  const ubicacion = { lat: null, lng: null };

  if (typeof L === 'undefined') {
    estado.textContent = '⚠ No se pudo cargar el mapa. Revisa tu conexión y recarga la página.';
    return ubicacion;
  }

  const mapa = L.map('proponer-mapa', { scrollWheelZoom: false }).setView(CENTRO_DEFECTO, 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapa);

  const icono = L.divIcon({
    className: '',
    html: '<div class="map-marker map-marker--yo"><span>📍</span></div>',
    iconSize: [30, 30], iconAnchor: [15, 30],
  });
  let marcador = null;

  const mostrar = (texto) => { estado.textContent = texto; };

  const ponerMarcador = (lat, lng, { rellenar }) => {
    ubicacion.lat = +lat.toFixed(7);
    ubicacion.lng = +lng.toFixed(7);
    if (!marcador) {
      marcador = L.marker([lat, lng], { icon: icono, draggable: true }).addTo(mapa);
      marcador.on('dragend', () => {
        const p = marcador.getLatLng();
        ponerMarcador(p.lat, p.lng, { rellenar: true });
      });
    } else {
      marcador.setLatLng([lat, lng]);
    }
    mostrar(`✔ Ubicación marcada (${ubicacion.lat.toFixed(5)}, ${ubicacion.lng.toFixed(5)}). Arrastra el marcador para ajustarla.`);
    if (rellenar) rellenarDireccion(lat, lng);
  };

  // Clic en el mapa → punto + dirección aproximada
  mapa.on('click', (e) => ponerMarcador(e.latlng.lat, e.latlng.lng, { rellenar: true }));

  // Dirección escrita → mapa
  document.getElementById('btn-ubicar-direccion').addEventListener('click', async () => {
    const dir = inputDir.value.trim();
    const ciudad = inputCiudad.value.trim();
    if (!dir && !ciudad) {
      mostrar('Escribe primero la dirección y la ciudad.');
      inputDir.focus();
      return;
    }
    mostrar('Buscando dirección…');
    const r = await geocodificar(`${dir}, ${ciudad}, Colombia`);
    if (!r) {
      mostrar('No encontramos esa dirección. Revísala o marca el punto directamente en el mapa.');
      return;
    }
    mapa.setView([r.lat, r.lng], 17);
    ponerMarcador(r.lat, r.lng, { rellenar: false });
  });

  // Ubicación del navegador
  document.getElementById('btn-mi-ubicacion').addEventListener('click', () => {
    if (!navigator.geolocation) {
      mostrar('Tu navegador no permite obtener la ubicación.');
      return;
    }
    mostrar('Obteniendo tu ubicación…');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        mapa.setView([coords.latitude, coords.longitude], 17);
        ponerMarcador(coords.latitude, coords.longitude, { rellenar: true });
      },
      () => mostrar('No se pudo obtener tu ubicación (permiso denegado). Marca el punto en el mapa.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });

  // Coordenadas → texto de dirección y ciudad
  async function rellenarDireccion(lat, lng) {
    const d = await geocodificarInverso(lat, lng);
    if (!d) return;
    if (d.direccion) inputDir.value = d.direccion;
    if (d.ciudad) inputCiudad.value = d.ciudad;
  }

  // El mapa estaba oculto por la animación de entrada: recalcula tamaño.
  setTimeout(() => mapa.invalidateSize(), 300);
  return ubicacion;
}

// ----- Geocodificación (Nominatim, con caché en memoria) -----
async function consultarNominatim(url) {
  if (cacheGeo.has(url)) return cacheGeo.get(url);
  try {
    const r = await fetch(url, { headers: { 'Accept-Language': 'es' } });
    const datos = r.ok ? await r.json() : null;
    cacheGeo.set(url, datos);
    return datos;
  } catch (error) {
    return null;
  }
}

async function geocodificar(texto) {
  const q = encodeURIComponent(texto);
  const datos = await consultarNominatim(`${NOMINATIM}/search?format=jsonv2&limit=1&countrycodes=co&q=${q}`);
  if (!datos || !datos.length) return null;
  return { lat: parseFloat(datos[0].lat), lng: parseFloat(datos[0].lon) };
}

async function geocodificarInverso(lat, lng) {
  // Redondeo a ~11 m: clics muy cercanos reutilizan la misma consulta.
  const url = `${NOMINATIM}/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`;
  const datos = await consultarNominatim(url);
  if (!datos || !datos.address) return null;
  const a = datos.address;
  const calle = [a.road, a.house_number].filter(Boolean).join(' #');
  return {
    direccion: calle || a.neighbourhood || a.suburb || '',
    ciudad: a.city || a.town || a.village || a.municipality || '',
  };
}

// ----- Envío -----
async function enviarPropuesta(form, ubicacion) {
  const errorEl = form.querySelector('[data-form-error]');
  const error = (msg) => { errorEl.textContent = msg; errorEl.hidden = false; errorEl.scrollIntoView({ block: 'center' }); };
  errorEl.hidden = true;

  const sesion = obtenerSesion();
  if (!sesion) {
    window.location.href = '/login?next=/proponer';
    return;
  }

  const val = (id) => document.getElementById(id).value.trim();
  const materiales = [...form.querySelectorAll('input[name="materiales"]:checked')].map((c) => c.value);

  if (!val('p-nombre')) return error('Escribe el nombre del punto.');
  if (!val('p-direccion') || !val('p-ciudad')) return error('Escribe la dirección y la ciudad.');
  if (ubicacion.lat === null) return error('Marca la ubicación del punto en el mapa (o pulsa "Ubicar dirección en el mapa").');
  if (!materiales.length) return error('Selecciona al menos un material.');
  const diaMalo = diaHorarioInvalido();
  if (diaMalo) return error(`Revisa el horario del ${diaMalo}: la hora de cierre debe ser posterior a la de apertura.`);
  const correoEl = document.getElementById('p-correo');
  if (correoEl.value && !correoEl.checkValidity()) return error('El correo de contacto no es válido.');

  const boton = form.querySelector('button[type="submit"]');
  boton.disabled = true;
  try {
    const r = await fetch('/api/puntos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sesion.token}` },
      body: JSON.stringify({
        nombre: val('p-nombre'),
        direccion: val('p-direccion'),
        ciudad: val('p-ciudad'),
        latitud: ubicacion.lat,
        longitud: ubicacion.lng,
        materiales,
        horario: horarioATexto(),
        telefono_contacto: val('p-telefono'),
        email_contacto: val('p-correo'),
      }),
    });
    const datos = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(datos.error || 'No se pudo enviar la propuesta.');

    alert('¡Gracias! Tu propuesta quedó registrada. Un administrador la revisará antes de publicarla en el mapa.');
    window.location.href = sesion.usuario.rol === 'empresa' ? '/empresa' : '/mapa';
  } catch (e) {
    error(e.message);
  } finally {
    boton.disabled = false;
  }
}
