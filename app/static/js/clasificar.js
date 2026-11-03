// =========================================================
// EcoMaps · Clasificador de residuos por foto (RF-01 a RF-04)
// El modelo (MobileNetV2 entrenado en ml/entrenar_modelo.ipynb → TensorFlow.js) corre en el navegador:
// la foto no se sube a ningún servidor. Las librerías pesadas solo se
// descargan cuando la persona elige su primera foto (código verde).
// =========================================================

const CLF_BASE = '/static/modelo/v1/';
const CLF_UMBRAL = 0.7; // RF-04: por debajo se le pide elegir al usuario

// Los nombres de clase deben coincidir con `labels` de metadata.json (los escribe el cuaderno).
const CLF_MATERIALES = {
  plastico:     { nombre: 'Plástico',       svg: 'plastico', tinte: '#E2EEEE', caneca: 'blanca', residuo: 'Plástico', guia: 'plastico',
                  consejo: 'Enjuágalo y aplástalo antes de llevarlo: así sí se aprovecha.' },
  vidrio:       { nombre: 'Vidrio',         svg: 'vidrio',   tinte: '#E5EDD6', caneca: 'blanca', residuo: 'Vidrio', guia: 'vidrio',
                  consejo: 'Llévalo entero y sin tapas; el vidrio roto puede herir a quien lo manipula.' },
  papel_carton: { nombre: 'Papel y cartón', svg: 'papel',    tinte: '#F3E7D3', caneca: 'blanca', residuo: 'Papel', guia: 'papel',
                  consejo: 'Debe estar seco y limpio: el papel mojado o con grasa ya no se procesa.' },
  metal:        { nombre: 'Metal',          svg: 'metal',    tinte: '#EBEDF0', caneca: 'blanca', residuo: 'Metal', guia: 'metal',
                  consejo: 'Enjuaga las latas y vacía por completo los aerosoles antes de entregarlos.' }
};
const CLF_CANECAS = { blanca: 'Caneca blanca', verde: 'Caneca verde', negra: 'Caneca negra' };
const CLF_ESTADOS = ['inicio', 'cargando', 'resultado', 'duda', 'otro', 'gracias', 'error'];

let clfModelo = null;       // modelo de TensorFlow.js
let clfEtiquetas = null;   // nombres de clase, en el mismo orden que la salida del modelo
let clfPromesaModelo = null;

const clfEl = (id) => document.getElementById(id);

function clfMostrarEstado(nombre) {
  CLF_ESTADOS.forEach((e) => { clfEl(`estado-${e}`).hidden = e !== nombre; });
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
    await clfCargarScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
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
  clfEl('res-mapa').href = `/mapa?residuo=${encodeURIComponent(info.residuo)}`;
  clfEl('res-guia').href = `/guia#${info.guia}`;
  clfMostrarEstado('resultado');
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
    b.addEventListener('click', () => mostrarResultado(a.className, a.probability ?? 1));
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

// «Ninguna de estas»: texto libre. RF-07 (guardar la corrección en MySQL) se conecta aquí
// cuando exista el endpoint /api/clasificaciones.
function clfEnviarOtro(texto) {
  clfEl('gracias-texto').textContent = `Anotamos «${texto}». Aún no reconocemos ese material; revisa la guía para saber cómo manejarlo.`;
  clfMostrarEstado('gracias');
}

function clfMostrarError(titulo, texto) {
  clfEl('err-titulo').textContent = titulo;
  clfEl('err-texto').textContent = texto;
  clfMostrarEstado('error');
}

function clfLimpiar() {
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
    if (r.confianza < CLF_UMBRAL) pedirConfirmacion(r);
    else mostrarResultado(r.clase, r.confianza);
  } catch (e) {
    // Lo más probable: aún no se han copiado los archivos del modelo a static/modelo/v1/.
    clfMostrarError('El modelo aún no está disponible', 'No pudimos cargar el modelo de clasificación. Intenta de nuevo en un momento.');
  } finally {
    clfEl('zona-foto').classList.remove('is-analizando');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const input = clfEl('foto');
  const zona = clfEl('zona-foto');
  if (!input) return;

  input.addEventListener('change', (e) => clfProcesarArchivo(e.target.files[0]));
  clfEl('btn-limpiar').addEventListener('click', clfLimpiar);
  clfEl('btn-otra-foto').addEventListener('click', clfLimpiar);
  clfEl('btn-corregir').addEventListener('click', pedirCorreccion);
  clfEl('btn-ninguna').addEventListener('click', () => { clfEl('txt-otro').value = ''; clfMostrarEstado('otro'); clfEl('txt-otro').focus(); });
  clfEl('form-otro').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = clfEl('txt-otro').value.trim();
    if (t) clfEnviarOtro(t);
  });

  // Arrastrar y soltar
  ['dragenter', 'dragover'].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.add('is-arrastrando'); }));
  ['dragleave', 'drop'].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.remove('is-arrastrando'); }));
  zona.addEventListener('drop', (e) => clfProcesarArchivo(e.dataTransfer.files[0]));
});
