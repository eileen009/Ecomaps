"""Validaciones simples reutilizadas por varios módulos.

Sin librerías externas de validación: funciones cortas y explícitas
(código verde: menos dependencias, menos peso).
"""
import re

PATRON_CORREO = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def correo_valido(correo: str) -> bool:
    return bool(correo) and bool(PATRON_CORREO.match(correo))


def password_valida(password: str) -> bool:
    """Mínimo 8 caracteres. Se puede endurecer más adelante si el
    equipo lo define (mayúsculas, números, símbolos, etc.)."""
    return bool(password) and len(password) >= 8
