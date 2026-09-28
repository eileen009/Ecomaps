"""Verificación del token de "Iniciar sesión con Google".

Sin librerías nuevas: usa PyJWT (ya viene con Flask-JWT-Extended) y
cryptography (ya está en requirements) para comprobar la firma del token
con las llaves públicas de Google.

Código verde: PyJWKClient guarda las llaves en memoria, así que no se
descargan en cada inicio de sesión.
"""
import jwt
from jwt import PyJWKClient

URL_LLAVES_GOOGLE = "https://www.googleapis.com/oauth2/v3/certs"
EMISORES_GOOGLE = ("accounts.google.com", "https://accounts.google.com")

_cliente_llaves = PyJWKClient(URL_LLAVES_GOOGLE, cache_keys=True, lifespan=6 * 60 * 60)


def verificar_token_google(token: str, client_id: str) -> dict:
    """Devuelve los datos del usuario de Google si el token es válido.
    Lanza ValueError con un mensaje claro si no lo es."""
    if not token or not client_id:
        raise ValueError("Falta el token de Google.")
    try:
        llave = _cliente_llaves.get_signing_key_from_jwt(token)
        datos = jwt.decode(
            token,
            llave.key,
            algorithms=["RS256"],
            audience=client_id,          # el token debe ser para ESTA app
            options={"require": ["exp", "iat", "iss", "aud", "sub"]},
        )
    except jwt.PyJWTError as error:
        raise ValueError("No se pudo verificar tu cuenta de Google.") from error

    if datos.get("iss") not in EMISORES_GOOGLE:
        raise ValueError("El token no viene de Google.")
    if not datos.get("email") or not datos.get("email_verified"):
        raise ValueError("Tu correo de Google no está verificado.")
    return datos
