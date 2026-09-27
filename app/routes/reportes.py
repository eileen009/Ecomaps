"""Módulo 7 — Reportes de problemas en puntos (propuesta 3.11).

Endpoints:
    POST  /api/puntos/<id>/reportes   reportar un problema (usuario con sesión)
    GET   /api/reportes?estado=       listar reportes (admin; por defecto pendientes)
    PATCH /api/reportes/<id>          cambiar estado: revisado / resuelto (admin)
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db
from models.punto_reciclaje import PuntoReciclaje
from models.reporte import Reporte, TIPOS_REPORTE, ESTADOS_REPORTE
from utils.auth_helpers import requiere_rol

reportes_bp = Blueprint("reportes", __name__, url_prefix="/api")

MAX_COMENTARIO = 500


@reportes_bp.post("/puntos/<int:id_punto>/reportes")
@jwt_required()
def crear_reporte(id_punto):
    punto = PuntoReciclaje.query.get_or_404(id_punto)
    datos = request.get_json(silent=True) or {}

    tipo = datos.get("tipo")
    if tipo not in TIPOS_REPORTE:
        return jsonify({"error": "Elige qué problema encontraste."}), 400

    comentario = (datos.get("comentario") or "").strip()
    if len(comentario) > MAX_COMENTARIO:
        return jsonify({"error": f"La descripción no puede pasar de {MAX_COMENTARIO} caracteres."}), 400
    if tipo == "otro" and not comentario:
        return jsonify({"error": "Cuéntanos brevemente cuál es el problema."}), 400

    id_usuario = int(get_jwt_identity())
    # Evita duplicados: un mismo usuario no repite un reporte pendiente del mismo tipo.
    repetido = Reporte.query.filter_by(
        id_punto=punto.id, id_usuario=id_usuario, tipo=tipo, estado="pendiente"
    ).first()
    if repetido:
        return jsonify({"error": "Ya enviaste este reporte; está pendiente de revisión."}), 409

    reporte = Reporte(id_punto=punto.id, id_usuario=id_usuario, tipo=tipo, comentario=comentario or None)
    db.session.add(reporte)
    db.session.commit()
    return jsonify(reporte.to_dict()), 201


@reportes_bp.get("/reportes")
@requiere_rol("admin")
def listar_reportes():
    estado = request.args.get("estado", default="pendiente", type=str)
    if estado not in ESTADOS_REPORTE:
        return jsonify({"error": "Estado no válido."}), 400
    reportes = Reporte.query.filter_by(estado=estado).order_by(Reporte.fecha.desc()).all()
    return jsonify([r.to_dict() for r in reportes]), 200


@reportes_bp.patch("/reportes/<int:id_reporte>")
@requiere_rol("admin")
def cambiar_estado_reporte(id_reporte):
    reporte = Reporte.query.get_or_404(id_reporte)
    nuevo = (request.get_json(silent=True) or {}).get("estado")
    if nuevo not in ESTADOS_REPORTE:
        return jsonify({"error": "Estado no válido."}), 400
    reporte.estado = nuevo
    db.session.commit()
    return jsonify(reporte.to_dict()), 200
