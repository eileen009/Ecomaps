"""Módulo 1 — Autenticación (propuesta 3.2).

Endpoints:
    POST /api/auth/registro
    POST /api/auth/login
    POST /api/auth/logout
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt

from extensions import db
from models.usuario import Usuario
from utils.validaciones import correo_valido, password_valida

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.post("/registro")
def registro():
    datos = request.get_json(silent=True) or {}
    nombre = (datos.get("nombre") or "").strip()
    correo = (datos.get("correo") or "").strip().lower()
    password = datos.get("password") or ""

    # ----- Validación de entrada -----
    if not nombre:
        return jsonify({"error": "El nombre es obligatorio."}), 400
    if not correo_valido(correo):
        return jsonify({"error": "Correo electrónico no válido."}), 400
    if not password_valida(password):
        return jsonify({"error": "La contraseña debe tener al menos 8 caracteres."}), 400

    # La columna correo ya es UNIQUE + index, pero validamos antes
    # para devolver un mensaje claro en vez de un error de la BD.
    if Usuario.query.filter_by(correo=correo).first():
        return jsonify({"error": "Ya existe una cuenta con ese correo."}), 409

    usuario = Usuario(nombre=nombre, correo=correo, rol="ciudadano")
    usuario.set_password(password)

    db.session.add(usuario)
    db.session.commit()

    token = create_access_token(
        identity=usuario.id, additional_claims={"rol": usuario.rol}
    )
    return jsonify({"usuario": usuario.to_dict(), "access_token": token}), 201


@auth_bp.post("/login")
def login():
    datos = request.get_json(silent=True) or {}
    correo = (datos.get("correo") or "").strip().lower()
    password = datos.get("password") or ""

    if not correo or not password:
        return jsonify({"error": "Correo y contraseña son obligatorios."}), 400

    usuario = Usuario.query.filter_by(correo=correo).first()

    # Mismo mensaje genérico si el correo no existe o la contraseña
    # es incorrecta: evita revelar qué correos están registrados.
    if not usuario or not usuario.check_password(password):
        return jsonify({"error": "Correo o contraseña incorrectos."}), 401

    token = create_access_token(
        identity=usuario.id, additional_claims={"rol": usuario.rol}
    )
    return jsonify({"usuario": usuario.to_dict(), "access_token": token}), 200


@auth_bp.post("/logout")
@jwt_required()
def logout():
    # Con JWT sin estado, "cerrar sesión" es responsabilidad del
    # cliente (descartar el token). Este endpoint queda como punto
    # de extensión si más adelante se agrega una lista de revocación.
    return jsonify({"mensaje": "Sesión cerrada."}), 200
