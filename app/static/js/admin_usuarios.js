// =========================================================
// EcoMaps · Panel admin - CRUD de usuarios
// Se carga solo en /admin/usuarios.
// =========================================================

const ROL_TEXTO = { ciudadano: 'Ciudadano', empresa: 'Empresa', admin: 'Administrador' };
const AVATAR_POR_DEFECTO = '/static/assets/img/avatar-default.svg';
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

document.addEventListener('DOMContentLoaded', () => {
  const tabla = document.getElementById('tabla-usuarios');
  const sesion = obtenerSesion();
  if (!tabla || !sesion) return;

  const headers = { Authorization: `Bearer ${sesion.token}` };
  const buscador = document.getElementById('buscar-usuario');
  const filtroRol = document.getElementById('filtro-rol');
  const filtroActivo = document.getElementById('filtro-activo');
  const totalEl = document.getElementById('total-usuarios');
  const miId = sesion.usuario.id;
  let usuarios = [];

  // ----- Listar (la búsqueda va al servidor, con espera de 300 ms entre teclas) -----
  async function cargar() {
    const params = new URLSearchParams();
    if (buscador.value.trim()) params.set('q', buscador.value.trim());
    if (filtroRol.value) params.set('rol', filtroRol.value);
    if (filtroActivo.value) params.set('estado', filtroActivo.value);
    try {
      const r = await fetch(`/api/usuarios?${params}`, { headers });
      usuarios = r.ok ? await r.json() : [];
    } catch (e) { usuarios = []; }
    pintar();
  }

  function pintar() {
    totalEl.textContent = usuarios.length >= 100
      ? 'Mostrando los 100 más recientes: usa la búsqueda para encontrar otros.'
      : `${usuarios.length} usuario${usuarios.length === 1 ? '' : 's'}`;
    if (!usuarios.length) {
      tabla.innerHTML = '<tr><td colspan="6" class="admin-table__vacio">No hay usuarios con ese filtro.</td></tr>';
      return;
    }
    tabla.innerHTML = usuarios.map((u) => {
      const soyYo = u.id === miId;
      const fecha = new Date(u.fecha_registro).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
      const botonActivo = u.activo
        ? '<button type="button" class="admin-btn admin-btn--rechazar" data-suspender>Suspender</button>'
        : '<button type="button" class="admin-btn admin-btn--aprobar" data-reactivar>Reactivar</button>';
      return `<tr data-id="${u.id}" class="${u.activo ? '' : 'is-suspendido'}">
        <td><div class="admin-usuario">
          <img src="${esc(urlFoto(u.foto_url))}" alt="" width="34" height="34" onerror="this.onerror=null;this.src='${AVATAR_POR_DEFECTO}'">
          <div><span class="admin-table__point">${esc(u.nombre)}${soyYo ? ' <small>(tú)</small>' : ''}${u.verificada ? ' <span title="Empresa verificada">✔</span>' : ''}${u.solicitud_empresa ? ' <span class="chip-solicitud" title="Marcó que es una empresa: revisa su cuenta y cámbiale el rol">Quiere ser empresa</span>' : ''}</span>
          <span class="admin-table__id">${esc(u.correo)}</span></div></div></td>
        <td><span class="rol-chip rol-chip--${u.rol}">${ROL_TEXTO[u.rol] || u.rol}</span></td>
        <td><span class="status-dot ${u.activo ? 'status-dot--activo' : 'status-dot--reportado'}">${u.activo ? 'Activo' : 'Suspendido'}</span></td>
        <td>${Number(u.puntos_totales || 0).toLocaleString('es-CO')}<span class="admin-table__id">Nivel ${u.nivel}</span></td>
        <td>${fecha}</td>
        <td><div class="admin-table__actions">
          <button type="button" class="admin-btn" data-editar>Editar</button>
          ${soyYo ? '' : botonActivo + '<button type="button" class="admin-btn admin-btn--peligro" data-eliminar>Eliminar</button>'}
        </div></td>
      </tr>`;
    }).join('');
  }

  // ----- Acciones de fila -----
  tabla.addEventListener('click', async (e) => {
    const boton = e.target.closest('button');
    if (!boton) return;
    const u = usuarios.find((x) => x.id === Number(boton.closest('[data-id]').dataset.id));

    if (boton.dataset.editar !== undefined) { abrirFormulario(u); return; }

    let peticion;
    if (boton.dataset.suspender !== undefined || boton.dataset.reactivar !== undefined) {
      const activar = boton.dataset.reactivar !== undefined;
      if (!activar && !(await confirmarAccion({
        titulo: '¿Suspender esta cuenta?',
        mensaje: `${u.nombre} no podrá iniciar sesión hasta que la reactives.`,
        boton: 'Suspender',
        icono: 'pausa',
      }))) return;
      peticion = fetch(`/api/usuarios/${u.id}/activo`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: activar }),
      });
    } else if (boton.dataset.eliminar !== undefined) {
      if (!(await confirmarAccion({
        titulo: '¿Eliminar esta cuenta?',
        mensaje: `Se eliminará la cuenta de ${u.nombre} y todos sus aportes. Esta acción no se puede deshacer.`,
        boton: 'Eliminar cuenta',
      }))) return;
      peticion = fetch(`/api/usuarios/${u.id}`, { method: 'DELETE', headers });
    } else return;

    boton.disabled = true;
    const r = await peticion;
    if (!r.ok) {
      const datos = await r.json().catch(() => ({}));
      mostrarAviso({ tipo: 'error', mensaje: datos.error || 'No se pudo completar la acción.' });
      boton.disabled = false;
      return;
    }
    cargar();
  });

  // ----- Crear / editar -----
  const dialogo = document.getElementById('dialogo-usuario');
  const form = document.getElementById('form-usuario');
  const campo = (id) => document.getElementById(id);

  function abrirFormulario(u) {
    form.dataset.id = u ? u.id : '';
    form.querySelector('[data-titulo]').textContent = u ? `Editar a ${u.nombre}` : 'Nuevo usuario';
    campo('eu-nombre').value = u ? u.nombre : '';
    campo('eu-correo').value = u ? u.correo : '';
    campo('eu-rol').value = u ? u.rol : 'ciudadano';
    campo('eu-rol').disabled = !!u && u.id === miId; // no puedes cambiar tu propio rol
    campo('eu-password').value = '';
    form.querySelector('[data-label-password]').textContent = u
      ? 'Nueva contraseña (déjala vacía para no cambiarla)'
      : 'Contraseña * (mínimo 8 caracteres)';
    form.querySelector('[data-form-error]').hidden = true;
    dialogo.showModal();
  }

  document.getElementById('btn-nuevo-usuario').addEventListener('click', () => abrirFormulario(null));
  dialogo.querySelector('[data-cerrar-dialogo]').addEventListener('click', () => dialogo.close());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = form.querySelector('[data-form-error]');
    const error = (msg) => { errorEl.textContent = msg; errorEl.hidden = false; };
    const id = form.dataset.id;
    const cuerpo = {
      nombre: campo('eu-nombre').value.trim(),
      correo: campo('eu-correo').value.trim(),
    };
    if (!campo('eu-rol').disabled) cuerpo.rol = campo('eu-rol').value;
    const password = campo('eu-password').value;
    if (password || !id) cuerpo.password = password;

    if (!cuerpo.nombre) return error('El nombre es obligatorio.');
    if (!cuerpo.correo || !campo('eu-correo').checkValidity()) return error('Escribe un correo válido.');
    if ((password || !id) && password.length < 8) return error('La contraseña debe tener al menos 8 caracteres.');

    const r = await fetch(id ? `/api/usuarios/${id}` : '/api/usuarios', {
      method: id ? 'PUT' : 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    const datos = await r.json().catch(() => ({}));
    if (!r.ok) return error(datos.error || 'No se pudo guardar.');
    dialogo.close();
    cargar();
  });

  let espera;
  buscador.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(cargar, 300); });
  filtroRol.addEventListener('change', cargar);
  filtroActivo.addEventListener('change', cargar);
  cargar();
});
