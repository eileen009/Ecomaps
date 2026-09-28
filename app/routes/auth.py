"""Módulo 1 — Autenticación (propuesta 3.2).

Endpoints:
    POST /api/auth/registro
    POST /api/auth/login
    POST /api/auth/logout
    POST /api/auth/google     inicio de sesión / registro con Google
"""
import secrets

from flask import Blueprint, current_app, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt

from extensions import db
from models.usuario import Usuario
from utils.validaciones import correo_valido, password_valida
from utils.google_auth import verificar_token_google

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
        identity=str(usuario.id), additional_claims={"rol": usuario.rol}
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
    if not usuario.activo:
        return jsonify({"error": "Tu cuenta está suspendida. Escribe al equipo de EcoMaps."}), 403

    token = create_access_token(
        identity=str(usuario.id), additional_claims={"rol": usuario.rol}
    )
    return jsonify({"usuario": usuario.to_dict(), "access_token": token}), 200


@auth_bp.post("/logout")
@jwt_required()
def logout():
    # Con JWT sin estado, "cerrar sesión" es responsabilidad del
    # cliente (descartar el token). Este endpoint queda como punto
    # de extensión si más adelante se agrega una lista de revocación.
    return jsonify({"mensaje": "Sesión cerrada."}), 200


@auth_bp.post("/google")
def login_google():
    """Recibe el token (credential) que entrega el botón de Google.
    Si el correo ya tiene cuenta, inicia sesión; si no, la crea como ciudadano."""
    client_id = current_app.config.get("GOOGLE_CLIENT_ID")
    if not client_id:
        return jsonify({"error": "El inicio de sesión con Google no está configurado."}), 503

    token = (request.get_json(silent=True) or {}).get("credential", "")
    try:
        datos = verificar_token_google(token, client_id)
    except ValueError as error:
        return jsonify({"error": str(error)}), 401

    correo = datos["email"].strip().lower()
    usuario = Usuario.query.filter_by(correo=correo).first()
    codigo = 200

    if usuario is None:
        nombre = (datos.get("name") or correo.split("@")[0]).strip()[:120]
        usuario = Usuario(nombre=nombre, correo=correo, rol="ciudadano", foto_url=datos.get("picture"))
        # Contraseña aleatoria que nadie conoce: la cuenta entra con Google.
        # Si luego quiere entrar con correo y contraseña, un admin puede ponérsela.
        usuario.set_password(secrets.token_urlsafe(32))
        db.session.add(usuario)
        db.session.commit()
        codigo = 201
    elif not usuario.activo:
        return jsonify({"error": "Tu cuenta está suspendida. Escribe al equipo de EcoMaps."}), 403

    token_app = create_access_token(identity=str(usuario.id), additional_claims={"rol": usuario.rol})
    return jsonify({"usuario": usuario.to_dict(), "access_token": token_app}), codigo
