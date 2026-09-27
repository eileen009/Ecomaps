"""Guardado de imágenes subidas por usuarios (evidencia de reciclaje).

Nombres de archivo aleatorios (uuid4) para no confiar en el nombre que
envía el navegador, y validación de extensión antes de tocar el disco.
"""
import os
import uuid

from werkzeug.utils import secure_filename

EXTENSIONES_PERMITIDAS = {"jpg", "jpeg", "png", "webp"}


def extension_valida(nombre_archivo: str) -> bool:
    return (
        "." in nombre_archivo
        and nombre_archivo.rsplit(".", 1)[1].lower() in EXTENSIONES_PERMITIDAS
    )


def guardar_foto(archivo, carpeta_destino: str) -> str:
    """Guarda el archivo y devuelve la ruta pública (relativa a /static).

    `carpeta_destino` es la ruta absoluta en disco (ej. static_folder +
    "uploads/acciones"); la ruta pública se deriva de ahí en vez de
    quedar fija, para poder reutilizar esta función con distintas
    subcarpetas (acciones, perfiles, etc.) sin duplicar código.
    """
    extension = secure_filename(archivo.filename).rsplit(".", 1)[1].lower()
    nombre_unico = f"{uuid.uuid4().hex}.{extension}"

    os.makedirs(carpeta_destino, exist_ok=True)
    archivo.save(os.path.join(carpeta_destino, nombre_unico))

    carpeta_publica = os.path.basename(carpeta_destino.rstrip(os.sep))
    return f"uploads/{carpeta_publica}/{nombre_unico}"
