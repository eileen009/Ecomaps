"""Envío de correos con la API de Brevo (plan gratis: 300 correos al día).

Se usa la API por HTTPS y no SMTP porque Render gratis bloquea los puertos
de SMTP. No necesita librerías nuevas: usa urllib, que viene con Python.

Variables de entorno (.env y Render):
    BREVO_API_KEY      clave de la API (Brevo > SMTP & API > API Keys)
    CORREO_REMITENTE   correo verificado en Brevo (Brevo > Senders)
"""
import json
import urllib.error
import urllib.request

from flask import current_app

URL_BREVO = "https://api.brevo.com/v3/smtp/email"


def correo_configurado() -> bool:
    return bool(current_app.config.get("BREVO_API_KEY") and current_app.config.get("CORREO_REMITENTE"))


def enviar_correo(destinatario: str, nombre: str, asunto: str, html: str, texto: str) -> bool:
    """Envía un correo. Devuelve True si Brevo lo aceptó.
    Nunca lanza excepción: si falla, lo deja en el log y devuelve False."""
    if not correo_configurado():
        return False

    cuerpo = {
        "sender": {"name": "EcoMaps", "email": current_app.config["CORREO_REMITENTE"]},
        "to": [{"email": destinatario, "name": nombre or destinatario}],
        "subject": asunto,
        "htmlContent": html,
        "textContent": texto,
    }
    peticion = urllib.request.Request(
        URL_BREVO,
        data=json.dumps(cuerpo).encode("utf-8"),
        headers={
            "api-key": current_app.config["BREVO_API_KEY"],
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(peticion, timeout=10) as respuesta:
            return 200 <= respuesta.status < 300
    except urllib.error.HTTPError as error:
        # Brevo explica el motivo en el cuerpo (p. ej. remitente sin verificar).
        detalle = error.read().decode("utf-8", "replace")[:300]
        current_app.logger.error("Brevo rechazó el correo (%s): %s", error.code, detalle)
    except (urllib.error.URLError, TimeoutError) as error:
        current_app.logger.error("No se pudo conectar con Brevo: %s", error)
    return False
