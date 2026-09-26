"""Helpers de autorización reutilizables entre módulos.

`requiere_rol` se usará en puntos, reportes, empresas y el panel
admin: evita repetir la misma verificación de rol en cada endpoint.
"""
from functools import wraps

from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt


def requiere_rol(*roles_permitidos):
    """Decorador: exige un JWT válido Y que el rol del usuario esté
    entre los permitidos. Uso: @requiere_rol("admin")."""

    def decorador(func):
        @wraps(func)
        def envoltura(*args, **kwargs):
            verify_jwt_in_request()
            rol_actual = get_jwt().get("rol")
            if rol_actual not in roles_permitidos:
                return jsonify({"error": "No tienes permisos para esta acción."}), 403
            return func(*args, **kwargs)

        return envoltura

    return decorador
