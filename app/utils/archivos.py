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
    """Guarda el archivo y devuelve la ruta pública (relativa a /static)."""
    extension = secure_filename(archivo.filename).rsplit(".", 1)[1].lower()
    nombre_unico = f"{uuid.uuid4().hex}.{extension}"

    os.makedirs(carpeta_destino, exist_ok=True)
    archivo.save(os.path.join(carpeta_destino, nombre_unico))

    return f"uploads/acciones/{nombre_unico}"
