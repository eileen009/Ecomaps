"""Configuración de la aplicación Flask.

Lee todo desde variables de entorno (.env) para no dejar credenciales
en el código fuente.
"""
import os
from urllib.parse import quote_plus

from dotenv import load_dotenv

load_dotenv()


class Config:
    # ----- Base de datos MySQL -----
    MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
    MYSQL_PORT = os.getenv("MYSQL_PORT", "3306")
    MYSQL_USER = os.getenv("MYSQL_USER", "root")
    MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
    MYSQL_DB = os.getenv("MYSQL_DB", "ecomapsBD")

    SQLALCHEMY_DATABASE_URI = (
        f"mysql+pymysql://{MYSQL_USER}:{quote_plus(MYSQL_PASSWORD)}"
        f"@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DB}"
    )
    # Código verde: no rastrear cambios que no usamos (ahorra memoria/CPU)
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # Reutiliza conexiones en vez de abrir una nueva por request
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True, "pool_recycle": 280}

    # Conexión segura (SSL) para la base en la nube (Aiven).
    # En local se deja MYSQL_SSL_CA vacío y no se usa.
    MYSQL_SSL_CA = os.getenv("MYSQL_SSL_CA", "").strip()
    if MYSQL_SSL_CA:
        # Busca el certificado en: la ruta tal cual, junto a este archivo
        # (desarrollo local) y en /etc/secrets (Secret Files de Render).
        _nombre = os.path.basename(MYSQL_SSL_CA)
        _candidatos = [
            MYSQL_SSL_CA,
            os.path.join(os.path.dirname(os.path.abspath(__file__)), MYSQL_SSL_CA),
            os.path.join("/etc/secrets", _nombre),
        ]
        _ruta_ca = next((r for r in _candidatos if os.path.isfile(r)), None)
        if _ruta_ca:
            SQLALCHEMY_ENGINE_OPTIONS["connect_args"] = {"ssl": {"ca": _ruta_ca}}
        else:
            # Aviso claro en los logs en vez de un FileNotFoundError confuso.
            _en_secrets = os.listdir("/etc/secrets") if os.path.isdir("/etc/secrets") else "no existe"
            print(f"[config] No se encontró el certificado SSL. Probé: {_candidatos}. "
                  f"Contenido de /etc/secrets: {_en_secrets}", flush=True)

    # ----- Autenticación -----
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "clave-de-desarrollo-no-usar-en-produccion")
    JWT_ACCESS_TOKEN_EXPIRES = 60 * 60 * 24  # 24 horas

    # ----- Subida de fotos (evidencia de reciclaje) -----
    # Límite de tamaño de subida: evita imágenes pesadas (código verde) y abuso.
    MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5 MB
