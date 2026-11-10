// =========================================================
// EcoMaps · Admin: evaluar el modelo
// Clasifica las fotos de prueba en el navegador con el MISMO modelo y el
// MISMO preprocesado que usa /clasificar (224x224, píxeles en [-1, 1]) y
// calcula exactitud, matriz de confusión, precisión y exhaustividad.
// Las fotos no se suben a ningún servidor.
// =========================================================
(() => {
  const BASE = '/static/modelo/v1/';
  const TFJS_LOCAL = '/static/vendor/tf-4.22.0.min.js';
  const TFJS_CDN = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';
  const IMG_MAT = '/static/assets/img/materiales/';
  const MAX_ERRORES_VISIBLES = 60;

  // Nombre de clase del modelo -> cómo se muestra en pantalla.
  const MATERIALES = {
    metal:           { nombre: 'Metal',           svg: 'metal',           tinte: '#EBEDF0' },
    no_aprovechable: { nombre: 'No aprovechable', svg: 'no_aprovechable', tinte: '#E6E7EA' },
    organico:        { nombre: 'Orgánico',        svg: 'organico',        tinte: '#F6E4D9' },
    papel_carton:    { nombre: 'Papel y cartón',  svg: 'papel',           tinte: '#F3E7D3' },
    plastico:        { nombre: 'Plástico',        svg: 'plastico',        tinte: '#E2EEEE' },
    vidrio:          { nombre: 'Vidrio',          svg: 'vidrio',          tinte: '#E5EDD6' }
  };
  const info = (c) => MATERIALES[c] || { nombre: c, svg: 'plastico', tinte: '#EEE' };

  // Nombres con que TrashNet llama a las carpetas -> clase del modelo.
  const ALIAS = { papel: 'papel_carton', carton: 'papel_carton', cardboard: 'papel_carton', paper: 'papel_carton',
                  plastic: 'plastico', glass: 'vidrio', trash: 'no_aprovechable', organic: 'organico' };

  const $ = (id) => document.getElementById(id);
  const el = {
    carpeta: $('ev-carpeta'), evaluar: $('ev-evaluar'), modeloInfo: $('ev-modelo-info'),
    conteo: $('ev-conteo'), chips: $('ev-chips'), conteoAviso: $('ev-conteo-aviso'),
    progreso: $('ev-progreso'), barra: $('ev-barra'), progresoTxt: $('ev-progreso-txt'),
    error: $('ev-error'), resultados: $('ev-resultados')
  };

  let modelo = null, meta = null, promesaModelo = null;
  let porClase = {};      // clase normalizada -> [File]
  let ignoradas = {};     // nombre de carpeta no reconocido -> cantidad
  let ultimo = null;      // último informe calculado
  let miniaturas = [];    // URLs de las fotos mal clasificadas (se liberan al repetir)

  // ---------- Carga de TensorFlow.js y del modelo ----------
  function cargarScript(src) {
    return new Promise((ok, fallo) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = ok; s.onerror = () => fallo(new Error(`No se pudo cargar ${src}`));
      document.head.appendChild(s);
    });
  }

  function cargarModelo() {
    promesaModelo ??= (async () => {
      if (!window.tf) {
        try { await cargarScript(TFJS_LOCAL); } catch { await cargarScript(TFJS_CDN); }
      }
      const [m, md] = await Promise.all([
        tf.loadLayersModel(`${BASE}model.json`),
        fetch(`${BASE}metadata.json`).then((r) => { if (!r.ok) throw new Error('No se encontró metadata.json'); return r.json(); })
      ]);
      modelo = m; meta = md;
      el.modeloInfo.textContent = `Modelo ${md.version || 'v1'}`;
      return m;
    })().catch((e) => { promesaModelo = null; throw e; });
    return promesaModelo;
  }

  // ---------- Selección de carpeta ----------
  function normalizar(nombre) {
    const n = nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[\s-]+/g, '_');
    return ALIAS[n] || n;
  }

  function mostrarError(texto) {
    el.error.textContent = texto;
    el.error.hidden = !texto;
  }

  async function alElegirCarpeta() {
    mostrarError('');
    el.resultados.hidden = true;
    ultimo = null;
    try { await cargarModelo(); } catch (e) {
      console.error('[evaluar-modelo]', e);
      return mostrarError(`No se pudo cargar el modelo: ${e.message}`);
    }
    const etiquetas = meta.labels;
    porClase = Object.fromEntries(etiquetas.map((c) => [c, []]));
    ignoradas = {};
    Array.from(el.carpeta.files).forEach((f) => {
      if (!/^image\/(jpeg|png|webp)$/.test(f.type) && !/\.(jpe?g|png|webp)$/i.test(f.name)) return;
      const partes = (f.webkitRelativePath || f.name).split('/');
      const carpeta = partes.length >= 2 ? partes[partes.length - 2] : '';
      const clase = normalizar(carpeta);
      if (porClase[clase]) porClase[clase].push(f);
      else { const k = carpeta || '(sin carpeta)'; ignoradas[k] = (ignoradas[k] || 0) + 1; }
    });
    pintarConteo(etiquetas);
  }

  function pintarConteo(etiquetas) {
    const total = etiquetas.reduce((s, c) => s + porClase[c].length, 0);
    el.chips.replaceChildren();
    etiquetas.forEach((c) => {
      const m = info(c);
      const d = document.createElement('div');
      d.className = 'ev-chip' + (porClase[c].length ? '' : ' ev-chip--vacio');
      const img = document.createElement('span'); img.className = 'ev-chip__img'; img.style.background = m.tinte;
      const i = document.createElement('img'); i.src = `${IMG_MAT}${m.svg}.svg`; i.alt = ''; img.appendChild(i);
      const txt = document.createElement('div');
      const n = document.createElement('strong'); n.textContent = porClase[c].length;
      const l = document.createElement('span'); l.textContent = m.nombre;
      txt.append(n, l);
      d.append(img, txt);
      el.chips.appendChild(d);
    });
    const avisos = [];
    const vacias = etiquetas.filter((c) => porClase[c].length === 0).map((c) => info(c).nombre);
    if (total === 0) avisos.push('No encontré fotos en carpetas con el nombre de un material. Elige la carpeta que contiene las carpetas de cada material.');
    else if (vacias.length) avisos.push(`Sin fotos de: ${vacias.join(', ')}.`);
    const ign = Object.entries(ignoradas);
    if (ign.length) avisos.push(`Se ignoraron las carpetas ${ign.map(([k, v]) => `«${k}» (${v})`).join(', ')}.`);
    el.conteoAviso.hidden = avisos.length === 0;
    el.conteoAviso.textContent = avisos.join(' ');
    el.conteo.hidden = false;
    el.evaluar.disabled = total === 0;
  }

  // ---------- Clasificación (igual que clasificarImagen() de clasificar.js) ----------
  async function clasificarArchivo(file) {
    const bmp = await createImageBitmap(file);
    try {
      const t0 = performance.now();
      const probs = tf.tidy(() => {
        const x = tf.browser.fromPixels(bmp).resizeBilinear([224, 224]).toFloat().div(127.5).sub(1).expandDims(0);
        return modelo.predict(x);
      });
      const p = Array.from(await probs.data());
      probs.dispose();
      const ms = performance.now() - t0;
      let mejor = 0;
      p.forEach((v, i) => { if (v > p[mejor]) mejor = i; });
      return { indice: mejor, confianza: p[mejor], ms };
    } finally { bmp.close?.(); }
  }

  async function evaluar() {
    mostrarError('');
    el.evaluar.disabled = true; el.carpeta.disabled = true;
    el.resultados.hidden = true;
    el.progreso.hidden = false;
    el.barra.style.width = '0%';
    el.progresoTxt.textContent = 'Preparando el modelo…';
    try {
      await cargarModelo();
      const etiquetas = meta.labels;
      const umbral = meta.umbral ?? 0.7;
      const tareas = [];
      etiquetas.forEach((c, i) => porClase[c].forEach((f) => tareas.push({ f, real: i })));
      const n = etiquetas.length;
      const matriz = Array.from({ length: n }, () => Array(n).fill(0));
      const errores = [];
      const tiempos = [];
      let dudosas = 0, fallidas = 0, hechas = 0;

      for (const t of tareas) {
        try {
          const r = await clasificarArchivo(t.f);
          matriz[t.real][r.indice] += 1;
          tiempos.push(r.ms);
          if (r.confianza < umbral) dudosas += 1;
          if (r.indice !== t.real) errores.push({ archivo: t.f.name, file: t.f, real: etiquetas[t.real], predicha: etiquetas[r.indice], confianza: r.confianza });
        } catch (e) { fallidas += 1; console.warn('[evaluar-modelo] no se pudo leer', t.f.name, e); }
        hechas += 1;
        el.barra.style.width = `${Math.round((hechas / tareas.length) * 100)}%`;
        el.progresoTxt.textContent = `Clasificando… ${hechas} de ${tareas.length} fotos`;
        if (hechas % 4 === 0) await tf.nextFrame();   // deja respirar a la página
      }
      ultimo = calcular(etiquetas, matriz, errores, tiempos, dudosas, fallidas, umbral);
      pintar(ultimo);
    } catch (e) {
      console.error('[evaluar-modelo]', e);
      mostrarError(`No se pudo terminar la evaluación: ${e.message}`);
    } finally {
      el.progreso.hidden = true;
      el.carpeta.disabled = false;
      el.evaluar.disabled = false;
    }
  }

  // ---------- Métricas ----------
  function calcular(etiquetas, matriz, errores, tiempos, dudosas, fallidas, umbral) {
    const n = etiquetas.length;
    const total = matriz.flat().reduce((a, b) => a + b, 0);
    const aciertos = matriz.reduce((s, fila, i) => s + fila[i], 0);
    const clases = etiquetas.map((nombre, i) => {
      const soporte = matriz[i].reduce((a, b) => a + b, 0);
      const predichas = matriz.reduce((s, fila) => s + fila[i], 0);
      const precision = predichas ? matriz[i][i] / predichas : null;
      const exhaustividad = soporte ? matriz[i][i] / soporte : null;
      const f1 = precision != null && exhaustividad != null && (precision + exhaustividad) > 0
        ? 2 * precision * exhaustividad / (precision + exhaustividad) : null;
      return { clase: nombre, precision, exhaustividad, f1, imagenes: soporte };
    });
    const confusiones = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j && matriz[i][j] > 0) confusiones.push({ real: etiquetas[i], predicha: etiquetas[j], cantidad: matriz[i][j] });
    confusiones.sort((a, b) => b.cantidad - a.cantidad);
    const media = tiempos.length ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : null;
    errores.sort((a, b) => b.confianza - a.confianza);
    return {
      version_modelo: meta.version || 'v1', fecha: new Date().toISOString(),
      exactitud: total ? aciertos / total : 0, imagenes_prueba: total, aciertos, no_leidas: fallidas,
      clases: etiquetas, matriz_confusion: matriz, por_clase: clases,
      confusiones_top: confusiones.slice(0, 5), pct_bajo_umbral: total ? dudosas / total : 0, umbral,
      ms_por_imagen_media: media, errores
    };
  }

  const pct = (v, d = 1) => (v == null ? '—' : `${(v * 100).toFixed(d).replace('.', ',')} %`);

  // ---------- Pintar resultados ----------
  function conIcono(clase, claseCss) {
    const m = info(clase);
    const s = document.createElement('span'); s.className = claseCss;
    const i = document.createElement('img'); i.src = `${IMG_MAT}${m.svg}.svg`; i.alt = '';
    const t = document.createElement('span'); t.textContent = m.nombre;
    s.append(i, t);
    return s;
  }

  function pintar(r) {
    // Resumen
    $('ev-exactitud').textContent = pct(r.exactitud, r.exactitud === 1 ? 0 : 1);
    $('ev-exactitud-txt').textContent = `${r.aciertos} de ${r.imagenes_prueba} fotos clasificadas correctamente`
      + (r.no_leidas ? ` (${r.no_leidas} no se pudieron leer)` : '') + '.';
    const circ = 2 * Math.PI * 52;
    const anillo = $('ev-anillo');
    anillo.style.strokeDasharray = `0 ${circ}`;
    requestAnimationFrame(() => requestAnimationFrame(() => { anillo.style.strokeDasharray = `${(circ * r.exactitud).toFixed(1)} ${circ}`; }));
    $('ev-total').textContent = r.imagenes_prueba;
    $('ev-dudosas').textContent = pct(r.pct_bajo_umbral, 0);
    $('ev-tiempo').textContent = r.ms_por_imagen_media == null ? '—' : `${Math.round(r.ms_por_imagen_media)} ms`;

    // Matriz
    const tabla = $('ev-matriz');
    tabla.replaceChildren();
    const maxFuera = Math.max(1, ...r.matriz_confusion.flatMap((f, i) => f.filter((_, j) => j !== i)));
    const thead = document.createElement('thead');
    const encabezado = document.createElement('tr');
    encabezado.appendChild(document.createElement('th'));
    r.clases.forEach((c) => { const th = document.createElement('th'); th.scope = 'col'; th.appendChild(conIcono(c, 'ev-th')); encabezado.appendChild(th); });
    thead.appendChild(encabezado); tabla.appendChild(thead);
    const tbody = document.createElement('tbody');
    r.matriz_confusion.forEach((fila, i) => {
      const tr = document.createElement('tr');
      const th = document.createElement('th'); th.scope = 'row'; th.className = 'ev-fila'; th.appendChild(conIcono(r.clases[i], 'ev-th'));
      tr.appendChild(th);
      const sumaFila = fila.reduce((a, b) => a + b, 0) || 1;
      fila.forEach((v, j) => {
        const td = document.createElement('td');
        td.textContent = v;
        const col = colorCelda(i === j, v, sumaFila, maxFuera);
        td.style.background = col.bg; td.style.color = col.fg;
        td.title = `Real: ${info(r.clases[i]).nombre} · Respondió: ${info(r.clases[j]).nombre} · ${v}`;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    tabla.appendChild(tbody);
    $('ev-confusiones').textContent = r.confusiones_top.length
      ? 'Se confundió más: ' + r.confusiones_top.map((c) => `${info(c.real).nombre} como ${info(c.predicha).nombre} (${c.cantidad})`).join(', ') + '.'
      : 'No hubo confusiones.';

    // Por material
    const cont = $('ev-clases');
    cont.replaceChildren();
    r.por_clase.forEach((c) => {
      const m = info(c.clase);
      const card = document.createElement('div'); card.className = 'ev-clase';
      const img = document.createElement('span'); img.className = 'ev-clase__img'; img.style.background = m.tinte;
      const i = document.createElement('img'); i.src = `${IMG_MAT}${m.svg}.svg`; i.alt = ''; img.appendChild(i);
      const cuerpo = document.createElement('div');
      const h = document.createElement('h3'); h.textContent = m.nombre;
      const sm = document.createElement('small'); sm.textContent = `${c.imagenes} fotos`; h.appendChild(sm);
      cuerpo.appendChild(h);
      [['Precisión', c.precision, ''], ['Exhaustividad', c.exhaustividad, ' ev-medida--b']].forEach(([nombre, v, extra]) => {
        const fila = document.createElement('div'); fila.className = 'ev-medida' + extra;
        const a = document.createElement('span'); a.textContent = nombre;
        const barra = document.createElement('i'); barra.style.setProperty('--v', v == null ? '0%' : `${(v * 100).toFixed(0)}%`);
        const b = document.createElement('b'); b.textContent = pct(v, 0);
        fila.append(a, barra, b); cuerpo.appendChild(fila);
      });
      card.append(img, cuerpo);
      cont.appendChild(card);
    });

    // Fotos mal clasificadas (con miniatura)
    miniaturas.forEach((u) => URL.revokeObjectURL(u)); miniaturas = [];
    const lista = $('ev-errores');
    lista.replaceChildren();
    r.errores.slice(0, MAX_ERRORES_VISIBLES).forEach((e) => {
      const li = document.createElement('li'); li.className = 'ev-error-item';
      const im = document.createElement('img'); im.loading = 'lazy'; im.alt = '';
      const url = URL.createObjectURL(e.file); miniaturas.push(url); im.src = url;
      const cuerpo = document.createElement('div');
      const nom = document.createElement('strong'); nom.textContent = e.archivo; nom.title = e.archivo;
      const l1 = document.createElement('span'); l1.textContent = `Era ${info(e.real).nombre.toLowerCase()}`;
      const l2 = document.createElement('span'); l2.textContent = `Respondió ${info(e.predicha).nombre.toLowerCase()} (${pct(e.confianza, 0)})`;
      cuerpo.append(nom, l1, l2);
      li.append(im, cuerpo);
      lista.appendChild(li);
    });
    $('ev-errores-titulo').textContent = r.errores.length ? `Fotos mal clasificadas (${r.errores.length})` : 'Fotos mal clasificadas';
    $('ev-detalle').open = false;
    $('ev-errores-nota').textContent = r.errores.length
      ? (r.errores.length > MAX_ERRORES_VISIBLES ? `Se muestran las ${MAX_ERRORES_VISIBLES} en las que el modelo estaba más seguro de su error. ` : '')
        + 'Sirven para entender en qué se equivoca.'
      : 'No hubo errores.';

    el.resultados.hidden = false;
    el.resultados.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function colorCelda(diagonal, v, sumaFila, maxFuera) {
    if (v === 0) return { bg: '#F4F6EE', fg: '#A3A995' };
    if (diagonal) {
      const a = 0.22 + 0.78 * (v / sumaFila);
      return { bg: `rgba(54, 80, 4, ${a.toFixed(2)})`, fg: a > 0.5 ? '#FFFFFF' : '#351903' };
    }
    const a = 0.2 + 0.7 * (v / maxFuera);
    return { bg: `rgba(191, 139, 46, ${a.toFixed(2)})`, fg: a > 0.65 ? '#FFFFFF' : '#351903' };
  }

  // ---------- Descargas ----------
  function descargar(nombre, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function bajarJson() {
    if (!ultimo) return;
    const { errores, ...resto } = ultimo;
    const lista = errores.slice(0, 200).map(({ file, ...e }) => e);
    descargar('informe_evaluacion.json', new Blob([JSON.stringify({ ...resto, errores_mostrados: lista }, null, 2)], { type: 'application/json' }));
  }

  function bajarCsv() {
    if (!ultimo) return;
    const filas = [['real \\ predicha', ...ultimo.clases], ...ultimo.matriz_confusion.map((f, i) => [ultimo.clases[i], ...f])];
    descargar('matriz_confusion.csv', new Blob([filas.map((f) => f.join(',')).join('\n')], { type: 'text/csv' }));
  }

  function bajarPng() {
    if (!ultimo) return;
    const r = ultimo, n = r.clases.length;
    const celda = 92, izq = 170, arriba = 120, pie = 40;
    const ancho = izq + n * celda + 30, alto = arriba + n * celda + pie;
    const c = document.createElement('canvas');
    c.width = ancho * 2; c.height = alto * 2;
    const g = c.getContext('2d');
    g.scale(2, 2);
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, ancho, alto);
    g.fillStyle = '#365004'; g.font = '700 20px "Segoe UI", Arial, sans-serif';
    g.fillText(`Matriz de confusión · exactitud ${pct(r.exactitud)}`, 20, 34);
    g.fillStyle = '#5C5245'; g.font = '13px "Segoe UI", Arial, sans-serif';
    g.fillText(`${r.imagenes_prueba} fotos de prueba · modelo ${r.version_modelo}`, 20, 56);
    g.fillText('Lo que respondió el modelo →', izq, 84);
    g.save(); g.translate(18, arriba + (n * celda) / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText('Material real →', 0, 0); g.restore();
    const sumas = r.matriz_confusion.map((f) => f.reduce((a, b) => a + b, 0) || 1);
    const maxFuera = Math.max(1, ...r.matriz_confusion.flatMap((f, i) => f.filter((_, j) => j !== i)));
    g.font = '600 12px "Segoe UI", Arial, sans-serif';
    r.clases.forEach((nombre, j) => {
      g.fillStyle = '#5C5245'; g.textAlign = 'center';
      g.fillText(info(nombre).nombre, izq + j * celda + celda / 2, arriba - 10);
    });
    r.matriz_confusion.forEach((fila, i) => {
      g.fillStyle = '#5C5245'; g.textAlign = 'right';
      g.fillText(info(r.clases[i]).nombre, izq - 10, arriba + i * celda + celda / 2 + 4);
      fila.forEach((v, j) => {
        const col = colorCelda(i === j, v, sumas[i], maxFuera);
        g.fillStyle = col.bg; g.fillRect(izq + j * celda + 3, arriba + i * celda + 3, celda - 6, celda - 6);
        g.fillStyle = col.fg; g.font = '700 18px "Segoe UI", Arial, sans-serif'; g.textAlign = 'center';
        g.fillText(String(v), izq + j * celda + celda / 2, arriba + i * celda + celda / 2 + 6);
        g.font = '600 12px "Segoe UI", Arial, sans-serif';
      });
    });
    c.toBlob((b) => b && descargar('matriz_confusion.png', b), 'image/png');
  }

  // ---------- Eventos ----------
  el.carpeta.addEventListener('change', alElegirCarpeta);
  el.evaluar.addEventListener('click', evaluar);
  $('ev-bajar-png').addEventListener('click', bajarPng);
  $('ev-bajar-json').addEventListener('click', bajarJson);
  $('ev-bajar-csv').addEventListener('click', bajarCsv);
})();
