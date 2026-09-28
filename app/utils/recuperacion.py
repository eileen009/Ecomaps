"""Enlaces para restablecer la contraseña.

El enlace lleva un token firmado (itsdangerous, ya viene con Flask), así que
no hace falta una tabla nueva en la base de datos:
- Vence a los 30 minutos.
- Sirve una sola vez: incluye una "huella" de la contraseña actual. Cuando la
  contraseña cambia, la huella deja de coincidir y el enlace queda inválido.
"""
import hashlib
import time

from flask import current_app
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from extensions import db
from models.usuario import Usuario

VIGENCIA_SEGUNDOS = 30 * 60
ESPERA_ENTRE_ENVIOS = 60  # segundos: evita que alguien llene de correos a otra persona
_ultimo_envio: dict[str, float] = {}


def _serializador() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(current_app.config["JWT_SECRET_KEY"], salt="ecomaps-restablecer-contrasena")


def _huella(usuario: Usuario) -> str:
    return hashlib.sha256(usuario.password_hash.encode("utf-8")).hexdigest()[:16]


def generar_token(usuario: Usuario) -> str:
    return _serializador().dumps({"id": usuario.id, "h": _huella(usuario)})


def usuario_desde_token(token: str) -> Usuario:
    """Devuelve el usuario del enlace o lanza ValueError con un mensaje claro."""
    try:
        datos = _serializador().loads(token, max_age=VIGENCIA_SEGUNDOS)
    except SignatureExpired:
        raise ValueError("Este enlace venció. Pide uno nuevo.")
    except BadSignature:
        raise ValueError("Este enlace no es válido. Pide uno nuevo.")

    usuario = db.session.get(Usuario, datos.get("id"))
    if usuario is None or not usuario.activo or datos.get("h") != _huella(usuario):
        raise ValueError("Este enlace ya se usó o no es válido. Pide uno nuevo.")
    return usuario


def puede_enviar(correo: str) -> bool:
    """Máximo un correo por minuto para la misma dirección."""
    ahora = time.monotonic()
    if ahora - _ultimo_envio.get(correo, 0) < ESPERA_ENTRE_ENVIOS:
        return False
    _ultimo_envio[correo] = ahora
    return True
