// =========================================================
// EcoMaps · Clasificador de residuos por foto (RF-01 a RF-04)
// El modelo (MobileNetV2 entrenado en ml/entrenar_modelo.ipynb → TensorFlow.js) corre en el navegador:
// la foto no se sube a ningún servidor. Las librerías pesadas solo se
// descargan cuando la persona elige su primera foto (código verde).
// =========================================================

const CLF_BASE = '/static/modelo/v1/';
const CLF_UMBRAL = 0.7; // RF-04: por debajo se le pide elegir al usuario
const CLF_VERSION = 'v1'; // versión del modelo; se guarda con cada clasificación (RF-07)
const CLF_LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';

// Los nombres de clase deben coincidir con `labels` de metadata.json (los escribe el cuaderno).
const CLF_MATERIALES = {
  plastico:     { nombre: 'Plástico',       svg: 'plastico', tinte: '#E2EEEE', caneca: 'blanca', residuo: 'Plástico', guia: 'plastico',
                  consejo: 'Enjuágalo y aplástalo antes de llevarlo: así sí se aprovecha.' },
  vidrio:       { nombre: 'Vidrio',         svg: 'vidrio',   tinte: '#E5EDD6', caneca: 'blanca', residuo: 'Vidrio', guia: 'vidrio',
                  consejo: 'Llévalo entero y sin tapas; el vidrio roto puede herir a quien lo manipula.' },
  papel_carton: { nombre: 'Papel y cartón', svg: 'papel',    tinte: '#F3E7D3', caneca: 'blanca', residuo: 'Papel', guia: 'papel',
                  consejo: 'Debe estar seco y limpio: el papel mojado o con grasa ya no se procesa.' },
  metal:        { nombre: 'Metal',          svg: 'metal',    tinte: '#EBEDF0', caneca: 'blanca', residuo: 'Metal', guia: 'metal',
                  consejo: 'Enjuaga las latas y vacía por completo los aerosoles antes de entregarlos.' },
  organico:     { nombre: 'Orgánico',       svg: 'organico', tinte: '#F6E4D9', caneca: 'verde',  residuo: 'Orgánico', guia: 'organico',
                  consejo: 'Sepáralo de lo seco: sin bolsas plásticas ni mezclado con otros residuos, sirve para compostar.' },
  no_aprovechable: { nombre: 'No aprovechable', svg: 'no_aprovechable', tinte: '#E6E7EA', caneca: 'negra', residuo: null, guia: 'codigo-colores',
                  consejo: 'Va a la caneca negra: envolturas sucias, servilletas usadas, icopor. Ningún punto de reciclaje lo recibe.' }
};
const CLF_CANECAS = { blanca: 'Caneca blanca', verde: 'Caneca verde', negra: 'Caneca negra' };
const CLF_ESTADOS = ['inicio', 'cargando', 'resultado', 'duda', 'otro', 'gracias', 'error'];

let clfModelo = null;       // modelo de TensorFlow.js
let clfEtiquetas = null;   // nombres de clase, en el mismo orden que la salida del modelo
let clfPromesaModelo = null;
let clfCtx = null;          // última foto: { pred, conf, id } (id = fila en /api/clasificaciones)
let clfTurno = 0;           // descarta respuestas de una foto anterior (puntos cercanos)
let clfMapa = null;         // mapa Leaflet de los puntos cercanos

const clfEl = (id) => document.getElementById(id);

function clfMostrarEstado(nombre) {
  CLF_ESTADOS.forEach((e) => {
    const el = clfEl(`estado-${e}`);
    if (el) el.hidden = e !== nombre;   // si falta alguno en la página, no se rompe el resto
  });
}

function clfCargarScript(src) {
  return new Promise((ok, fallo) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = ok; s.onerror = () => fallo(new Error(`No se pudo cargar ${src}`));
    document.head.appendChild(s);
  });
}

// Carga TensorFlow.js y el modelo una sola vez; las siguientes fotos reutilizan el mismo.
function clfCargarModelo() {
  clfPromesaModelo ??= (async () => {
    if (!window.tf) {
      try { await clfCargarScript('/static/vendor/tf-4.22.0.min.js'); } catch (e) { /* se usa el CDN */ }
    }
    if (!window.tf) await clfCargarScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
    const [modelo, meta] = await Promise.all([
      tf.loadLayersModel(`${CLF_BASE}model.json`),
      fetch(`${CLF_BASE}metadata.json`).then((r) => { if (!r.ok) throw new Error('sin metadata'); return r.json(); })
    ]);
    clfEtiquetas = meta.labels;
    clfModelo = modelo;
    return modelo;
  })().catch((e) => { clfPromesaModelo = null; throw e; });
  return clfPromesaModelo;
}

// Mismo preprocesado del entrenamiento (MobileNetV2): 224x224 y píxeles en [-1, 1].
async function clasificarImagen(img) {
  const m = await clfCargarModelo();
  const probs = tf.tidy(() => {
    const x = tf.browser.fromPixels(img).resizeBilinear([224, 224]).toFloat().div(127.5).sub(1).expandDims(0);
    return m.predict(x);
  });
  const p = Array.from(await probs.data());
  probs.dispose();
  const pred = p.map((probability, i) => ({ className: clfEtiquetas[i], probability }))
                .sort((a, b) => b.probability - a.probability);
  return { clase: pred[0].className, confianza: pred[0].probability, alternativas: pred.slice(0, 2) };
}

function mostrarResultado(clase, confianza) {
  const info = CLF_MATERIALES[clase];
  if (!info) return clfMostrarError('Clase desconocida', `El modelo devolvió «${clase}», que no está en el catálogo.`);
  const pct = Math.round(confianza * 100);
  const base = '/static/assets/img/materiales/';

  clfEl('res-img').src = `${base}${info.svg}.svg`;
  clfEl('res-tinte').style.background = info.tinte;
  clfEl('res-nombre').textContent = info.nombre;
  clfEl('res-caneca').className = `clasif__caneca clasif__caneca--${info.caneca}`;
  clfEl('res-caneca').lastElementChild.textContent = CLF_CANECAS[info.caneca];
  clfEl('res-pct').textContent = `${pct} %`;
  clfEl('res-barra').style.width = `${pct}%`;
  clfEl('res-consejo').textContent = info.consejo;
  const btnMapa = clfEl('res-mapa');
  btnMapa.hidden = !info.residuo;
  if (info.residuo) btnMapa.href = `/mapa?residuo=${encodeURIComponent(info.residuo)}`;
  clfEl('res-guia').href = `/guia#${info.guia}`;
  clfMostrarEstado('resultado');
  clfCargarPuntos(clase);
}

// Muestra opciones para que la persona elija. `opciones` = [{ className, probability? }].
function clfMostrarOpciones(opciones, textoTitulo) {
  const cont = clfEl('duda-opciones');
  cont.replaceChildren();
  opciones.forEach((a) => {
    const info = CLF_MATERIALES[a.className];
    if (!info) return;
    const detalle = a.probability == null ? 'Elegir' : `${Math.round(a.probability * 100)} % de parecido`;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'clasif__opcion';
    b.innerHTML = `<span class="clasif__opcion-img" style="background:${info.tinte}"><img src="/static/assets/img/materiales/${info.svg}.svg" alt="" width="44" height="44"></span>
      <span><strong></strong><small>${detalle}</small></span>`;
    b.querySelector('strong').textContent = info.nombre;
    // Si la persona elige sin dato del modelo, queda confirmado por ella (100 %).
    b.addEventListener('click', () => clfElegir(a.className, a.probability));
    cont.appendChild(b);
  });
  clfEl('duda-titulo').textContent = textoTitulo;
  clfMostrarEstado('duda');
}

// RF-04: confianza baja -> las 2 clases más probables + «Ninguna de estas».
function pedirConfirmacion(r) {
  clfMostrarOpciones(r.alternativas.map((a) => ({ className: a.className, probability: a.probability })), '¿Cuál se parece más?');
}

// Desde un resultado: la persona dice que no era correcto -> todas las clases.
function pedirCorreccion() {
  clfMostrarOpciones(Object.keys(CLF_MATERIALES).map((c) => ({ className: c })), '¿Qué material es?');
}

// ---------- RF-07: guardar la clasificación y la corrección de la persona ----------
function clfCabeceras() {
  const h = { 'Content-Type': 'application/json' };
  try {
    const sesion = typeof obtenerSesion === 'function' ? obtenerSesion() : null;
    if (sesion && sesion.token) h.Authorization = `Bearer ${sesion.token}`;
  } catch (e) { /* sin sesión: se guarda como anónimo */ }
  return h;
}

// Guardar es secundario: si falla, la persona igual ve su resultado.
async function clfGuardar(extra) {
  if (!clfCtx) return;
  try {
    if (clfCtx.id) {
      await fetch(`/api/clasificaciones/${clfCtx.id}`, { method: 'PATCH', headers: clfCabeceras(), body: JSON.stringify(extra) });
    } else {
      const r = await fetch('/api/clasificaciones', {
        method: 'POST', headers: clfCabeceras(),
        body: JSON.stringify({ clase_predicha: clfCtx.pred, confianza: clfCtx.conf, version_modelo: CLF_VERSION, ...extra })
      });
      if (r.ok) clfCtx.id = (await r.json()).id;
    }
  } catch (e) { /* sin red: no se pierde nada importante */ }
}

// La persona elige una clase (confianza baja o «no era correcto»).
function clfElegir(clase, probabilidad) {
  clfGuardar({ clase_confirmada: clase });
  mostrarResultado(clase, probabilidad ?? 1);
}

// ---------- RF-05: los 3 puntos más cercanos que reciben el material ----------
function clfUbicacion() {
  return new Promise((ok) => {
    if (!navigator.geolocation) return ok(null);
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => ok(null),                       // sin permiso o sin señal: el servidor usa el centro de Montería
      { timeout: 8000, maximumAge: 300000 }
    );
  });
}

async function clfCargarLeaflet() {
  if (window.L) return;
  if (!document.querySelector('link[data-leaflet]')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = `${CLF_LEAFLET}leaflet.min.css`; css.dataset.leaflet = '1';
    document.head.appendChild(css);
  }
  await clfCargarScript(`${CLF_LEAFLET}leaflet.min.js`);
}

function clfDistancia(m) {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

async function clfPintarMapa(centro, puntos, conUbicacion) {
  try { await clfCargarLeaflet(); } catch (e) { return; }  // sin mapa, la lista basta
  const caja = clfEl('puntos-mapa');
  caja.hidden = false;
  if (clfMapa) { clfMapa.remove(); clfMapa = null; }
  clfMapa = L.map(caja, { scrollWheelZoom: false }).setView([centro.lat, centro.lng], 14);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(clfMapa);
  const limites = [[centro.lat, centro.lng]];
  if (conUbicacion) L.circleMarker([centro.lat, centro.lng], { radius: 8, color: '#2f6f9f', fillOpacity: 0.9 }).addTo(clfMapa).bindTooltip('Tú');
  puntos.forEach((p, i) => {
    const etiqueta = document.createElement('span');
    etiqueta.textContent = `${i + 1}. ${p.nombre}`;
    L.marker([p.latitud, p.longitud]).addTo(clfMapa).bindPopup(etiqueta);
    limites.push([p.latitud, p.longitud]);
  });
  if (limites.length > 1) clfMapa.fitBounds(limites, { padding: [30, 30], maxZoom: 16 });
  setTimeout(() => clfMapa && clfMapa.invalidateSize(), 150);
}

async function clfCargarPuntos(clase) {
  const turno = ++clfTurno;
  const bloque = clfEl('res-puntos');
  const lista = clfEl('puntos-lista');
  const aviso = clfEl('puntos-aviso');
  const info = CLF_MATERIALES[clase];
  lista.replaceChildren();
  clfEl('puntos-mapa').hidden = true;
  if (clfMapa) { clfMapa.remove(); clfMapa = null; }

  if (!info || !info.residuo) {            // «no aprovechable»: ningún punto lo recibe
    bloque.hidden = true;
    return;
  }
  bloque.hidden = false;
  aviso.textContent = 'Buscando los puntos más cercanos…';

  const pos = await clfUbicacion();
  if (turno !== clfTurno) return;
  const q = new URLSearchParams({ clase });
  if (pos) { q.set('lat', pos.lat); q.set('lng', pos.lng); }
  try {
    const r = await fetch(`/api/puntos-cercanos?${q}`);
    if (!r.ok) throw new Error('error');
    const datos = await r.json();
    if (turno !== clfTurno) return;

    if (!datos.puntos.length) {
      aviso.textContent = 'No hay puntos registrados para este material.';
      return;
    }
    aviso.textContent = datos.ubicacion_aproximada
      ? 'No tenemos tu ubicación: te mostramos los puntos más cercanos al centro de Montería.'
      : 'Los más cercanos a ti:';
    datos.puntos.forEach((p) => {
      const li = document.createElement('li');
      const nombre = document.createElement('strong'); nombre.textContent = p.nombre;
      const dir = document.createElement('span'); dir.textContent = p.direccion;
      const dist = document.createElement('small'); dist.textContent = `${clfDistancia(p.distancia_m)}${datos.ubicacion_aproximada ? ' del centro' : ''}`;
      li.append(nombre, dir, dist);
      lista.appendChild(li);
    });
    clfPintarMapa(datos.centro, datos.puntos, !datos.ubicacion_aproximada);
  } catch (e) {
    if (turno === clfTurno) aviso.textContent = 'No pudimos cargar los puntos cercanos. Puedes verlos en el mapa.';
  }
}

// «Ninguna de estas»: texto libre. Se guarda como corrección (RF-07).
function clfEnviarOtro(texto) {
  clfGuardar({ texto_otro: texto });
  clfEl('gracias-texto').textContent = `Anotamos «${texto}». Aún no reconocemos ese material; revisa la guía para saber cómo manejarlo.`;
  clfMostrarEstado('gracias');
}

function clfMostrarError(titulo, texto) {
  clfEl('err-titulo').textContent = titulo;
  clfEl('err-texto').textContent = texto;
  clfMostrarEstado('error');
}

function clfLimpiar() {
  clfTurno++; clfCtx = null;
  const vista = clfEl('vista');
  if (vista.src.startsWith('blob:')) URL.revokeObjectURL(vista.src);
  vista.hidden = true; vista.removeAttribute('src');
  clfEl('zona-vacia').hidden = false;
  clfEl('btn-limpiar').hidden = true;
  clfEl('txt-boton').textContent = 'Elegir foto';
  clfEl('foto').value = '';
  clfMostrarEstado('inicio');
}

async function clfProcesarArchivo(archivo) {
  if (!archivo || !archivo.type.startsWith('image/')) {
    return clfMostrarError('Archivo no válido', 'Elige una imagen (JPG, PNG o WebP).');
  }
  const vista = clfEl('vista');
  if (vista.src.startsWith('blob:')) URL.revokeObjectURL(vista.src);
  vista.src = URL.createObjectURL(archivo);
  vista.hidden = false;
  clfEl('zona-vacia').hidden = true;
  clfEl('btn-limpiar').hidden = false;
  clfEl('txt-boton').textContent = 'Cambiar foto';
  clfEl('txt-cargando').textContent = clfModelo ? 'Analizando tu foto…' : 'Cargando el modelo por primera vez…';
  clfMostrarEstado('cargando');
  clfEl('zona-foto').classList.add('is-analizando');

  try {
    await vista.decode();
    const r = await clasificarImagen(vista);
    clfCtx = { pred: r.clase, conf: r.confianza, id: null };
    if (r.confianza < CLF_UMBRAL) {
      pedirConfirmacion(r);
    } else {
      mostrarResultado(r.clase, r.confianza);
      clfGuardar({});                        // RF-07: queda registrada; si la persona corrige, se actualiza
    }
  } catch (e) {
    // Lo más probable: aún no se han copiado los archivos del modelo a static/modelo/v1/.
    console.error('[clasificador]', e);
    clfMostrarError('El modelo aún no está disponible', 'No pudimos cargar el modelo de clasificación. Intenta de nuevo en un momento.');
  } finally {
    clfEl('zona-foto').classList.remove('is-analizando');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const input = clfEl('foto');
  const zona = clfEl('zona-foto');
  if (!input || !zona) return;   // en /actividad solo se reutiliza clasificarImagen()

  input.addEventListener('change', (e) => clfProcesarArchivo(e.target.files[0]));
  const al = (id, evento, fn) => { const el = clfEl(id); if (el) el.addEventListener(evento, fn); };
  al('btn-limpiar', 'click', clfLimpiar);
  al('btn-otra-foto', 'click', clfLimpiar);
  al('btn-corregir', 'click', pedirCorreccion);
  al('btn-ninguna', 'click', () => { clfEl('txt-otro').value = ''; clfMostrarEstado('otro'); clfEl('txt-otro').focus(); });
  al('form-otro', 'submit', (e) => {
    e.preventDefault();
    const t = clfEl('txt-otro').value.trim();
    if (t) clfEnviarOtro(t);
  });

  // Arrastrar y soltar
  ['dragenter', 'dragover'].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.add('is-arrastrando'); }));
  ['dragleave', 'drop'].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.remove('is-arrastrando'); }));
  zona.addEventListener('drop', (e) => clfProcesarArchivo(e.dataTransfer.files[0]));
});
