"""Módulo 6 — Estadísticas (propuesta 3.8 y 3.9).

Endpoints:
    GET /api/estadisticas/generales   cifras públicas (cacheadas 10 min)
    GET /api/estadisticas/admin       cifras internas + ranking (admin)
"""
from flask import Blueprint, jsonify

from utils.auth_helpers import requiere_rol
from utils.estadisticas import obtener_generales, calcular_admin

estadisticas_bp = Blueprint("estadisticas", __name__, url_prefix="/api/estadisticas")


@estadisticas_bp.get("/generales")
def generales():
    return jsonify(obtener_generales()), 200


@estadisticas_bp.get("/admin")
@requiere_rol("admin")
def admin():
    return jsonify(calcular_admin()), 200
