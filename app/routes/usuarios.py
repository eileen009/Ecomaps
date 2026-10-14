"""Módulo 1 — Perfil de usuario (propuesta 3.13).

Endpoints:
    GET  /api/usuarios/me
    PUT  /api/usuarios/me
    POST  /api/usuarios/me/foto              (foto de perfil: usuarios, empresas y admin)
    POST  /api/usuarios/me/solicitud-empresa  marca "soy una empresa" y avisa al equipo (ciudadano)
    DELETE /api/usuarios/me/solicitud-empresa retira esa marca
    GET   /api/usuarios/empresas              empresas + nº de puntos (admin)
    PATCH /api/usuarios/<id>/verificada       dar/quitar sello "Empresa verificada" (admin)

  CRUD del panel admin (solo rol admin):
    GET    /api/usuarios?q=&rol=&estado=      listar / buscar
    POST   /api/usuarios                      crear
    PUT    /api/usuarios/<id>                 editar (nombre, correo, rol, contraseña)
    PATCH  /api/usuarios/<id>/activo          suspender / reactivar
    DELETE /api/usuarios/<id>                 eliminar
"""
import os

from flask import Blueprint, current_app, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from markupsafe import escape

from extensions import db
from sqlalchemy import func

from models.usuario import Usuario
from models.punto_reciclaje import PuntoReciclaje
from utils.auth_helpers import requiere_rol
from utils.validaciones import correo_valido, password_valida
from utils.archivos import extension_valida, guardar_foto, borrar_foto
from utils.correo import enviar_correo

usuarios_bp = Blueprint("usuarios", __name__, url_prefix="/api/usuarios")


@usuarios_bp.get("/me")
@jwt_required()
def obtener_perfil():
    usuario = Usuario.query.get_or_404(int(get_jwt_identity()))
    return jsonify(usuario.to_dict()), 200


@usuarios_bp.put("/me")
@jwt_required()
def actualizar_perfil():
    usuario = Usuario.query.get_or_404(int(get_jwt_identity()))
    datos = request.get_json(silent=True) or {}

    if "nombre" in datos:
        nombre = (datos["nombre"] or "").strip()
        if not nombre:
            return jsonify({"error": "El nombre no puede quedar vacío."}), 400
        usuario.nombre = nombre

    if "correo" in datos:
        correo_nuevo = (datos["correo"] or "").strip().lower()
        if not correo_valido(correo_nuevo):
            return jsonify({"error": "Correo electrónico no válido."}), 400
        if correo_nuevo != usuario.correo and Usuario.query.filter_by(correo=correo_nuevo).first():
            return jsonify({"error": "Ese correo ya está en uso."}), 409
        usuario.correo = correo_nuevo

    db.session.commit()
    return jsonify(usuario.to_dict()), 200


@usuarios_bp.post("/me/foto")
@jwt_required()
def subir_foto_perfil():
    usuario = Usuario.query.get_or_404(int(get_jwt_identity()))
    foto = request.files.get("foto")

    if not foto or foto.filename == "":
        return jsonify({"error": "No se recibió ninguna foto."}), 400
    if not extension_valida(foto.filename):
        return jsonify({"error": "La foto debe ser JPG, PNG o WEBP."}), 400

    # Borra la foto anterior (Cloudinary o disco) para no acumular archivos huérfanos.
    borrar_foto(usuario.foto_url, current_app.static_folder)

    carpeta = os.path.join(current_app.static_folder, "uploads", "perfiles")
    usuario.foto_url = guardar_foto(foto, carpeta)

    db.session.commit()
    return jsonify(usuario.to_dict()), 200


@usuarios_bp.post("/me/solicitud-empresa")
@jwt_required()
def solicitar_ser_empresa():
    """El ciudadano marca "soy una empresa": queda guardado (el admin lo ve en
    /admin/usuarios) y se avisa por correo al equipo, una sola vez."""
    usuario = Usuario.query.get_or_404(int(get_jwt_identity()))
    if usuario.rol != "ciudadano":
        return jsonify({"error": "Tu cuenta ya no es de ciudadano."}), 400

    ya_enviada = usuario.solicitud_empresa
    usuario.solicitud_empresa = True
    db.session.commit()

    if not ya_enviada:
        nombre, correo = escape(usuario.nombre), escape(usuario.correo)
        enviar_correo(
            current_app.config["CORREO_EQUIPO"], "Equipo EcoMaps",
            "Nueva solicitud de cuenta de empresa en EcoMaps",
            f"<p><b>{nombre}</b> ({correo}) marcó que es una empresa o centro de reciclaje.</p>"
            "<p>Revisa su cuenta en el panel admin &gt; Usuarios y, si corresponde, cámbiale el rol a empresa.</p>",
            f"{usuario.nombre} ({usuario.correo}) marcó que es una empresa. "
            "Revisa su cuenta en el panel admin > Usuarios.",
        )
    return jsonify(usuario.to_dict()), 200


@usuarios_bp.delete("/me/solicitud-empresa")
@jwt_required()
def retirar_solicitud_empresa():
    usuario = Usuario.query.get_or_404(int(get_jwt_identity()))
    usuario.solicitud_empresa = False
    db.session.commit()
    return jsonify(usuario.to_dict()), 200


@usuarios_bp.get("/empresas")
@requiere_rol("admin")
def listar_empresas():
    # Cuenta los puntos con un LEFT JOIN + GROUP BY en la BD (una sola
    # consulta) en vez de una consulta por empresa.
    filas = (
        db.session.query(Usuario, func.count(PuntoReciclaje.id))
        .outerjoin(PuntoReciclaje, PuntoReciclaje.creado_por == Usuario.id)
        .filter(Usuario.rol == "empresa")
        .group_by(Usuario.id)
        .order_by(Usuario.nombre)
        .all()
    )
    return jsonify([{**u.to_dict(), "num_puntos": n} for u, n in filas]), 200


@usuarios_bp.patch("/<int:id_usuario>/verificada")
@requiere_rol("admin")
def cambiar_verificada(id_usuario):
    usuario = Usuario.query.get_or_404(id_usuario)
    if usuario.rol != "empresa":
        return jsonify({"error": "Solo las empresas pueden tener el sello."}), 400

    datos = request.get_json(silent=True) or {}
    usuario.verificada = bool(datos.get("verificada"))
    db.session.commit()
    return jsonify(usuario.to_dict()), 200


# =========================================================
# CRUD de usuarios (panel admin)
# =========================================================
ROLES = ("ciudadano", "empresa", "admin")
MAX_RESULTADOS = 100


def _es_ultimo_admin(usuario):
    """True si `usuario` es el único admin activo: no se le puede quitar el
    rol, suspender ni eliminar (el sistema se quedaría sin administrador)."""
    if usuario.rol != "admin" or not usuario.activo:
        return False
    admins = db.session.query(func.count(Usuario.id)).filter(
        Usuario.rol == "admin", Usuario.activo.is_(True)
    ).scalar()
    return admins <= 1


def _datos_validos(datos, parcial):
    """Valida nombre / correo / rol / password. Devuelve (limpios, error)."""
    limpios = {}
    if "nombre" in datos or not parcial:
        nombre = (datos.get("nombre") or "").strip()
        if not nombre:
            return None, "El nombre es obligatorio."
        limpios["nombre"] = nombre[:120]
    if "correo" in datos or not parcial:
        correo = (datos.get("correo") or "").strip().lower()
        if not correo_valido(correo):
            return None, "Correo electrónico no válido."
        limpios["correo"] = correo
    if "rol" in datos or not parcial:
        rol = datos.get("rol") or "ciudadano"
        if rol not in ROLES:
            return None, "Rol no válido."
        limpios["rol"] = rol
    password = datos.get("password") or ""
    if password or not parcial:
        if not password_valida(password):
            return None, "La contraseña debe tener al menos 8 caracteres."
        limpios["password"] = password
    return limpios, None


@usuarios_bp.get("")
@requiere_rol("admin")
def listar_usuarios():
    q = (request.args.get("q") or "").strip()
    rol = request.args.get("rol")
    estado = request.args.get("estado")  # "activo" | "suspendido"

    consulta = Usuario.query
    if q:
        patron = f"%{q}%"
        consulta = consulta.filter(Usuario.nombre.ilike(patron) | Usuario.correo.ilike(patron))
    if rol in ROLES:
        consulta = consulta.filter(Usuario.rol == rol)
    if estado in ("activo", "suspendido"):
        consulta = consulta.filter(Usuario.activo.is_(estado == "activo"))

    # Límite fijo: nunca se trae la tabla completa (código verde).
    usuarios = consulta.order_by(Usuario.fecha_registro.desc()).limit(MAX_RESULTADOS).all()
    return jsonify([u.to_dict() for u in usuarios]), 200


@usuarios_bp.post("")
@requiere_rol("admin")
def crear_usuario():
    limpios, error = _datos_validos(request.get_json(silent=True) or {}, parcial=False)
    if error:
        return jsonify({"error": error}), 400
    if Usuario.query.filter_by(correo=limpios["correo"]).first():
        return jsonify({"error": "Ya existe una cuenta con ese correo."}), 409

    usuario = Usuario(nombre=limpios["nombre"], correo=limpios["correo"], rol=limpios["rol"])
    usuario.set_password(limpios["password"])
    db.session.add(usuario)
    db.session.commit()
    return jsonify(usuario.to_dict()), 201


@usuarios_bp.put("/<int:id_usuario>")
@requiere_rol("admin")
def editar_usuario(id_usuario):
    usuario = Usuario.query.get_or_404(id_usuario)
    limpios, error = _datos_validos(request.get_json(silent=True) or {}, parcial=True)
    if error:
        return jsonify({"error": error}), 400

    es_yo = usuario.id == int(get_jwt_identity())
    if "rol" in limpios and limpios["rol"] != usuario.rol:
        if es_yo:
            return jsonify({"error": "No puedes cambiar tu propio rol."}), 400
        if _es_ultimo_admin(usuario):
            return jsonify({"error": "Es el único administrador activo; no se le puede quitar el rol."}), 400
    if "correo" in limpios and limpios["correo"] != usuario.correo:
        if Usuario.query.filter_by(correo=limpios["correo"]).first():
            return jsonify({"error": "Ese correo ya está en uso."}), 409

    for campo in ("nombre", "correo", "rol"):
        if campo in limpios:
            setattr(usuario, campo, limpios[campo])
    if "password" in limpios:
        usuario.set_password(limpios["password"])
    if usuario.rol == "empresa":
        usuario.solicitud_empresa = False  # ya se atendió la solicitud
    db.session.commit()
    return jsonify(usuario.to_dict()), 200


@usuarios_bp.patch("/<int:id_usuario>/activo")
@requiere_rol("admin")
def cambiar_activo(id_usuario):
    usuario = Usuario.query.get_or_404(id_usuario)
    activo = bool((request.get_json(silent=True) or {}).get("activo"))

    if not activo:
        if usuario.id == int(get_jwt_identity()):
            return jsonify({"error": "No puedes suspender tu propia cuenta."}), 400
        if _es_ultimo_admin(usuario):
            return jsonify({"error": "Es el único administrador activo; no se puede suspender."}), 400

    usuario.activo = activo
    db.session.commit()
    return jsonify(usuario.to_dict()), 200


@usuarios_bp.delete("/<int:id_usuario>")
@requiere_rol("admin")
def eliminar_usuario(id_usuario):
    usuario = Usuario.query.get_or_404(id_usuario)
    if usuario.id == int(get_jwt_identity()):
        return jsonify({"error": "No puedes eliminar tu propia cuenta."}), 400
    if _es_ultimo_admin(usuario):
        return jsonify({"error": "Es el único administrador activo; no se puede eliminar."}), 400

    # Borra también su foto de perfil para no dejar archivos huérfanos.
    borrar_foto(usuario.foto_url, current_app.static_folder)

    # En la BD: sus aportes se borran (ON DELETE CASCADE); los puntos que
    # propuso y sus reportes se conservan sin autor (ON DELETE SET NULL).
    db.session.delete(usuario)
    db.session.commit()
    return jsonify({"mensaje": "Usuario eliminado."}), 200
