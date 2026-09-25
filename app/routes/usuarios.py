"""Módulo 1 — Perfil de usuario (propuesta 3.13).

Endpoints:
    GET /api/usuarios/me
    PUT /api/usuarios/me
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db
from models.usuario import Usuario
from utils.validaciones import correo_valido

usuarios_bp = Blueprint("usuarios", __name__, url_prefix="/api/usuarios")


@usuarios_bp.get("/me")
@jwt_required()
def obtener_perfil():
    usuario = Usuario.query.get_or_404(get_jwt_identity())
    return jsonify(usuario.to_dict()), 200


@usuarios_bp.put("/me")
@jwt_required()
def actualizar_perfil():
    usuario = Usuario.query.get_or_404(get_jwt_identity())
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
