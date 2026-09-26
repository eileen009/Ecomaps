"""Catálogo de categorías de residuos (usado por puntos y, más
adelante, por el buscador — módulo 3). Tabla pequeña y de baja
frecuencia de cambio: no necesita paginación ni filtros complejos.
"""
from extensions import db


class CategoriaResiduo(db.Model):
    __tablename__ = "categoria_residuo"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(60), nullable=False, unique=True, index=True)
    icono = db.Column(db.String(10), nullable=True)  # emoji o clase de ícono
    descripcion_corta = db.Column(db.String(160), nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "nombre": self.nombre,
            "icono": self.icono,
            "descripcion_corta": self.descripcion_corta,
        }
