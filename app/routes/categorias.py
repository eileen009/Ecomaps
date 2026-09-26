"""Catálogo de categorías de residuos.

Por ahora solo lectura (la usan el formulario de "proponer punto" y
el buscador). El CRUD completo se agrega en el módulo de buscador /
panel admin.
"""
from flask import Blueprint, jsonify

from models.categoria_residuo import CategoriaResiduo

categorias_bp = Blueprint("categorias", __name__, url_prefix="/api/categorias")


@categorias_bp.get("")
def listar_categorias():
    categorias = CategoriaResiduo.query.order_by(CategoriaResiduo.nombre).all()
    return jsonify([c.to_dict() for c in categorias]), 200
