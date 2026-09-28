"""Guardado de imágenes subidas por usuarios (fotos de perfil y evidencias).

- En producción (Render) las fotos van a Cloudinary: el disco de Render
  gratis se borra en cada reinicio, así que guardarlas ahí las perdería.
- En desarrollo local, si no hay CLOUDINARY_URL, se guardan en
  static/uploads/ como siempre.

Nombres aleatorios (uuid4) para no confiar en el nombre que envía el
navegador, y validación de extensión antes de subir nada.
"""
import os
import re
import uuid

from werkzeug.utils import secure_filename

EXTENSIONES_PERMITIDAS = {"jpg", "jpeg", "png", "webp"}

# Código verde:
#  - al subir, Cloudinary guarda la foto ya reducida (máx. 1000 px de lado);
#  - al mostrarla, la URL lleva f_auto,q_auto: cada navegador recibe el
#    formato y la calidad más livianos (WebP/AVIF cuando los soporta).
TRANSFORMACION_SUBIDA = {"width": 1000, "height": 1000, "crop": "limit"}
OPTIMIZACION_ENTREGA = "f_auto,q_auto"


def extension_valida(nombre_archivo: str) -> bool:
    return (
        "." in nombre_archivo
        and nombre_archivo.rsplit(".", 1)[1].lower() in EXTENSIONES_PERMITIDAS
    )


def _usa_cloudinary() -> bool:
    return bool(os.getenv("CLOUDINARY_URL"))


def guardar_foto(archivo, carpeta_destino: str) -> str:
    """Guarda la foto y devuelve su ruta.

    - Con Cloudinary: la URL completa (https://res.cloudinary.com/...).
    - En local: la ruta relativa a /static (uploads/<carpeta>/<archivo>).

    `carpeta_destino` es la ruta absoluta en disco (static_folder +
    "uploads/acciones", etc.); su último nombre se usa también como
    carpeta dentro de Cloudinary (ecomaps/acciones, ecomaps/perfiles).
    """
    carpeta_publica = os.path.basename(carpeta_destino.rstrip(os.sep))
    nombre = uuid.uuid4().hex

    if _usa_cloudinary():
        # Import aquí: la librería solo se carga si de verdad se usa.
        import cloudinary.uploader

        resultado = cloudinary.uploader.upload(
            archivo,
            folder=f"ecomaps/{carpeta_publica}",
            public_id=nombre,
            resource_type="image",
            transformation=TRANSFORMACION_SUBIDA,
        )
        return resultado["secure_url"].replace("/upload/", f"/upload/{OPTIMIZACION_ENTREGA}/", 1)

    extension = secure_filename(archivo.filename).rsplit(".", 1)[1].lower()
    os.makedirs(carpeta_destino, exist_ok=True)
    archivo.save(os.path.join(carpeta_destino, f"{nombre}.{extension}"))
    return f"uploads/{carpeta_publica}/{nombre}.{extension}"


def _public_id_de_url(url: str):
    """https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto/v123/ecomaps/perfiles/abc.jpg
    -> 'ecomaps/perfiles/abc' (lo que pide Cloudinary para borrar).
    Se saltan los segmentos de transformación (f_auto,q_auto) y la versión (v123)."""
    coincidencia = re.search(r"/upload/(?:[a-z]{1,2}_[^/]+/)*(?:v\d+/)?(.+?)(?:\.[a-z0-9]+)?$", url)
    return coincidencia.group(1) if coincidencia else None


def borrar_foto(foto_url, static_folder: str) -> None:
    """Borra una foto anterior (Cloudinary o disco) para no dejar archivos huérfanos.
    Nunca lanza error: si no se puede borrar, la operación principal sigue."""
    if not foto_url:
        return
    try:
        if foto_url.startswith("http"):
            if "res.cloudinary.com" in foto_url and _usa_cloudinary():
                import cloudinary.uploader

                public_id = _public_id_de_url(foto_url)
                if public_id:
                    cloudinary.uploader.destroy(public_id, resource_type="image")
        else:
            ruta = os.path.join(static_folder, foto_url)
            if os.path.isfile(ruta):
                os.remove(ruta)
    except Exception:  # noqa: BLE001 — borrar la foto vieja no debe romper la petición
        pass
