"""Catálogo de categorías de residuos (módulo 3).

Solo lectura por ahora (lo usan el buscador, la guía, el formulario de
"proponer punto" y el panel admin). El CRUD completo se agrega junto al
panel admin.
"""
from flask import Blueprint, jsonify

from models.categoria_residuo import CategoriaResiduo

categorias_bp = Blueprint("categorias", __name__, url_prefix="/api/categorias")


@categorias_bp.get("")
def listar_categorias():
    categorias = CategoriaResiduo.query.order_by(CategoriaResiduo.nombre).all()
    return jsonify([c.to_dict() for c in categorias]), 200


@categorias_bp.get("/<string:nombre>")
def obtener_categoria(nombre):
    categoria = CategoriaResiduo.query.filter(
        CategoriaResiduo.nombre.ilike(nombre)
    ).first_or_404()
    return jsonify(categoria.to_dict()), 200
