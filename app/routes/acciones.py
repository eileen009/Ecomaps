"""Módulo 5 — Sistema de puntos (núcleo mínimo): registrar aportes con
foto de evidencia y confirmarlos desde el panel admin.

Endpoints:
    POST  /api/acciones                  registrar un aporte (queda "pendiente")
    GET   /api/usuarios/me/acciones       historial propio
    GET   /api/acciones?estado=pendiente  listar para revisión (admin)
    PATCH /api/acciones/<id>/estado       confirmar (con cantidad recibida y recibo) o rechazar (con motivo)
                                          — admin, o la empresa dueña del punto
    GET   /api/acciones/mi-punto          aportes pendientes en los puntos de la empresa
"""
import os
import secrets
from datetime import datetime, timezone

from flask import Blueprint, current_app, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt

from extensions import db
from models.accion_reciclaje import AccionReciclaje
from models.categoria_residuo import CategoriaResiduo
from models.punto_reciclaje import PuntoReciclaje
from models.usuario import Usuario
from utils.auth_helpers import requiere_rol
from utils.archivos import extension_valida, guardar_foto

acciones_bp = Blueprint("acciones", __name__, url_prefix="/api/acciones")

PUNTOS_POR_UNIDAD = 10  # código verde: fórmula simple, nada de cálculos pesados
PUNTOS_MINIMOS = 5


@acciones_bp.post("")
@jwt_required()
def registrar_accion():
    categoria_nombre = (request.form.get("categoria") or "").strip()
    cantidad = request.form.get("cantidad")
    unidad = (request.form.get("unidad") or "kg").strip()
    id_punto = request.form.get("id_punto", type=int)
    foto = request.files.get("foto")

    if not categoria_nombre:
        return jsonify({"error": "Indica qué material reciclaste."}), 400

    try:
        cantidad = float(cantidad)
        if cantidad <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"error": "La cantidad no es válida."}), 400

    if not foto or foto.filename == "":
        return jsonify({"error": "Sube una foto de lo que reciclaste para poder confirmarlo."}), 400
    if not extension_valida(foto.filename):
        return jsonify({"error": "La foto debe ser JPG, PNG o WEBP."}), 400

    categoria = CategoriaResiduo.query.filter(
        CategoriaResiduo.nombre.ilike(categoria_nombre)
    ).first()
    if not categoria:
        return jsonify({"error": "Ese material no existe en el catálogo."}), 400

    carpeta = os.path.join(current_app.static_folder, "uploads", "acciones")
    foto_url = guardar_foto(foto, carpeta)

    accion = AccionReciclaje(
        id_usuario=int(get_jwt_identity()),
        id_categoria=categoria.id,
        id_punto=id_punto,
        cantidad=cantidad,
        unidad=unidad,
        foto_url=foto_url,
        estado="pendiente",
    )
    db.session.add(accion)
    db.session.commit()

    return jsonify(accion.to_dict()), 201


@acciones_bp.get("")
@requiere_rol("admin")
def listar_acciones():
    estado = request.args.get("estado", default="pendiente", type=str)
    # Índice en "estado": solo trae lo que el admin va a revisar, no toda la tabla.
    acciones = AccionReciclaje.query.filter_by(estado=estado).order_by(AccionReciclaje.fecha.desc()).all()
    return jsonify([a.to_dict() for a in acciones]), 200


@acciones_bp.patch("/<int:id_accion>/estado")
@requiere_rol("admin", "empresa")
def revisar_accion(id_accion):
    accion = AccionReciclaje.query.get_or_404(id_accion)

    # La empresa solo revisa aportes hechos en sus propios puntos, y
    # nunca los suyos (no puede darse puntos a sí misma).
    if get_jwt().get("rol") == "empresa":
        id_empresa = int(get_jwt_identity())
        es_su_punto = accion.punto is not None and accion.punto.creado_por == id_empresa
        if not es_su_punto or accion.id_usuario == id_empresa:
            return jsonify({"error": "Solo puedes revisar aportes hechos en tus puntos."}), 403
    datos = request.get_json(silent=True) or {}
    nuevo_estado = datos.get("estado")

    if nuevo_estado not in {"confirmada", "rechazada"}:
        return jsonify({"error": "Estado no válido."}), 400
    if accion.estado != "pendiente":
        return jsonify({"error": "Esta acción ya fue revisada."}), 409

    # ----- Se valida TODO antes de modificar nada -----
    if nuevo_estado == "rechazada":
        # Al rechazar es obligatorio explicar por qué (el usuario lo verá).
        motivo = " ".join((datos.get("motivo") or "").split())
        if len(motivo) < 5:
            return jsonify({"error": "Escribe el motivo del rechazo (mínimo 5 caracteres)."}), 400
        if len(motivo) > 255:
            return jsonify({"error": "El motivo es muy largo (máximo 255 caracteres)."}), 400
    else:
        # Al confirmar, quien revisa indica lo que realmente recibió; si no lo
        # cambia, se asume la cantidad declarada.
        recibida = datos.get("cantidad_recibida")
        if recibida in (None, ""):
            recibida = float(accion.cantidad)
        try:
            recibida = round(float(recibida), 2)
            if not 0 < recibida <= 99999:
                raise ValueError
        except (TypeError, ValueError):
            return jsonify({"error": "La cantidad recibida no es válida."}), 400

    ahora = datetime.now(timezone.utc)
    accion.estado = nuevo_estado
    accion.id_revisor = int(get_jwt_identity())
    accion.fecha_revision = ahora.replace(tzinfo=None)  # la BD guarda UTC sin zona

    if nuevo_estado == "rechazada":
        accion.motivo_rechazo = motivo
    else:
        accion.cantidad_recibida = recibida
        # Los puntos se calculan sobre lo recibido, no sobre lo declarado.
        puntos = max(PUNTOS_MINIMOS, round(recibida * PUNTOS_POR_UNIDAD))
        accion.puntos_otorgados = puntos
        # Código del recibo: año-mes, id del aporte y 4 caracteres al azar (no se puede adivinar).
        accion.recibo_codigo = f"ECO-{ahora:%y%m}-{accion.id:05d}-{secrets.token_hex(2).upper()}"
        usuario = Usuario.query.get(accion.id_usuario)
        if usuario:
            usuario.puntos_totales += puntos
            # Un nivel cada 100 puntos: barato de calcular, no hace falta
            # una tabla de logros aparte solo para esto (código verde).
            usuario.nivel = 1 + usuario.puntos_totales // 100

    db.session.commit()
    return jsonify(accion.to_dict()), 200


@acciones_bp.get("/mias")
@jwt_required()
def mis_acciones():
    id_usuario = int(get_jwt_identity())
    acciones = (
        AccionReciclaje.query.filter_by(id_usuario=id_usuario)
        .order_by(AccionReciclaje.fecha.desc())
        .all()
    )
    return jsonify([a.to_dict() for a in acciones]), 200


@acciones_bp.get("/mi-punto")
@requiere_rol("empresa")
def acciones_de_mis_puntos():
    """Aportes pendientes registrados en los puntos de la empresa.

    Un solo JOIN filtrado por estado (indexado) y dueño del punto: no se
    traen todas las acciones para filtrarlas en Python.
    """
    id_empresa = int(get_jwt_identity())
    acciones = (
        AccionReciclaje.query.join(PuntoReciclaje, AccionReciclaje.id_punto == PuntoReciclaje.id)
        .filter(
            PuntoReciclaje.creado_por == id_empresa,
            AccionReciclaje.estado == "pendiente",
            AccionReciclaje.id_usuario != id_empresa,
        )
        .order_by(AccionReciclaje.fecha.desc())
        .all()
    )
    return jsonify([a.to_dict() for a in acciones]), 200
