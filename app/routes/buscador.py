"""Módulo 3 — Buscador de puntos por tipo de residuo (propuesta 3.4).

No agrega tablas nuevas: reutiliza el filtrado de puntos (routes/puntos.py)
y el catálogo de categorías, en vez de duplicar la lógica de consulta.
"""
from flask import Blueprint, request, jsonify

from routes.puntos import filtrar_puntos

buscador_bp = Blueprint("buscador", __name__, url_prefix="/api/buscar")


@buscador_bp.get("")
def buscar_por_residuo():
    residuo = request.args.get("residuo", type=str)
    if not residuo:
        return jsonify({"error": "Debes indicar el residuo a buscar (?residuo=Plástico)."}), 400

    resultado, error = filtrar_puntos(
        ciudad=request.args.get("ciudad", type=str),
        material=residuo,
        estado="activo",  # el buscador público solo muestra puntos ya aprobados
        lat=request.args.get("lat", type=float),
        lng=request.args.get("lng", type=float),
        radio_km=request.args.get("radio", default=5, type=float),
    )
    if error:
        return jsonify({"error": error}), 400
    return jsonify(resultado), 200
