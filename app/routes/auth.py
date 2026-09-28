"""Módulo 1 — Autenticación (propuesta 3.2).

Endpoints:
    POST /api/auth/registro
    POST /api/auth/login
    POST /api/auth/logout
    POST /api/auth/google     inicio de sesión / registro con Google
    POST /api/auth/recuperar  envía el enlace para restablecer la contraseña
    POST /api/auth/restablecer  guarda la contraseña nueva usando ese enlace
"""
import secrets

from flask import Blueprint, current_app, request, jsonify, url_for
from markupsafe import escape
from flask_jwt_extended import create_access_token, jwt_required, get_jwt

from extensions import db
from models.usuario import Usuario
from utils.validaciones import correo_valido, password_valida
from utils.google_auth import verificar_token_google
from utils.correo import correo_configurado, enviar_correo
from utils.recuperacion import generar_token, usuario_desde_token, puede_enviar

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


# ===== Recuperar contraseña =====
MENSAJE_RECUPERAR = (
    "Si ese correo tiene una cuenta en EcoMaps, te enviamos un enlace para crear "
    "una contraseña nueva. Revisa también la carpeta de spam."
)


def _url_base() -> str:
    """Dirección pública del sitio para armar el enlace del correo.
    En producción se toma de APP_URL y NO de la petición: así nadie puede
    falsificar la cabecera Host para que el enlace apunte a otro sitio."""
    base = current_app.config.get("APP_URL")
    if not base and current_app.debug:
        base = request.host_url
    return (base or "").rstrip("/")


def _correo_recuperacion(usuario, enlace):
    nombre = escape(usuario.nombre.split(" ")[0])
    html = f"""
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:auto;color:#351903">
        <h2 style="color:#365004;margin:0 0 16px">Restablece tu contraseña</h2>
        <p>Hola, {nombre}:</p>
        <p>Recibimos una solicitud para cambiar la contraseña de tu cuenta en EcoMaps.
            Toca el botón para crear una nueva. El enlace vence en 30 minutos y solo sirve una vez.</p>
        <p style="margin:28px 0">
            <a href="{escape(enlace)}" style="background:#365004;color:#fff;padding:13px 24px;
            border-radius:999px;text-decoration:none;font-weight:bold">Crear contraseña nueva</a>
        </p>
        <p style="font-size:13px;color:#6b6358">Si el botón no funciona, copia este enlace en tu navegador:<br>
            {escape(enlace)}</p>
        <p style="font-size:13px;color:#6b6358">Si no pediste este cambio, ignora este correo: tu contraseña sigue igual.</p>
        </div>"""
    texto = (
        f"Hola, {usuario.nombre.split(' ')[0]}:\n\n"
        "Recibimos una solicitud para cambiar la contraseña de tu cuenta en EcoMaps.\n"
        f"Crea una nueva aquí (vence en 30 minutos): {enlace}\n\n"
        "Si no pediste este cambio, ignora este correo."
    )
    return html, texto


@auth_bp.post("/recuperar")
def recuperar_contrasena():
    correo = ((request.get_json(silent=True) or {}).get("correo") or "").strip().lower()
    if not correo_valido(correo):
        return jsonify({"error": "Escribe un correo electrónico válido."}), 400

    hay_correo = correo_configurado()
    if not hay_correo and not current_app.debug:
        return jsonify({"error": "La recuperación por correo no está disponible por ahora. "
                                 "Escribe al equipo de EcoMaps."}), 503

    # Mismo mensaje exista o no la cuenta: no se revela qué correos están registrados.
    if not puede_enviar(correo):
        return jsonify({"mensaje": MENSAJE_RECUPERAR}), 200

    usuario = Usuario.query.filter_by(correo=correo).first()
    if usuario and usuario.activo:
        enlace = f"{_url_base()}{url_for('paginas.restablecer', token=generar_token(usuario))}"
        if hay_correo:
            html, texto = _correo_recuperacion(usuario, enlace)
            enviar_correo(usuario.correo, usuario.nombre, "Restablece tu contraseña de EcoMaps", html, texto)
        else:
            # Solo en desarrollo local sin Brevo: el enlace sale en la terminal.
            print(f"\n[EcoMaps · desarrollo] Enlace para restablecer la contraseña de {correo}:\n{enlace}\n", flush=True)

    return jsonify({"mensaje": MENSAJE_RECUPERAR}), 200


@auth_bp.post("/restablecer")
def restablecer_contrasena():
    datos = request.get_json(silent=True) or {}
    password = datos.get("password") or ""
    if not password_valida(password):
        return jsonify({"error": "La contraseña debe tener al menos 8 caracteres."}), 400

    try:
        usuario = usuario_desde_token(datos.get("token") or "")
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    usuario.set_password(password)  # al cambiar, el enlace deja de servir
    db.session.commit()
    return jsonify({"mensaje": "Listo, tu contraseña se actualizó. Ya puedes iniciar sesión."}), 200
