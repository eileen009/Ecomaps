"""Registro de cada clasificación por foto y de la corrección del usuario (RF-07).

Sirve para medir el modelo en uso real y reentrenarlo después. La foto NO se
guarda: solo la clase, la confianza y lo que la persona confirmó.
"""
from datetime import datetime, timezone

from extensions import db


class Clasificacion(db.Model):
    __tablename__ = "clasificaciones"

    id = db.Column(db.BigInteger().with_variant(db.Integer, "sqlite"), primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey("usuario.id", ondelete="SET NULL"), nullable=True, index=True)
    clase_predicha = db.Column(db.String(30), nullable=False)
    confianza = db.Column(db.Numeric(5, 4), nullable=False)
    clase_confirmada = db.Column(db.String(30), nullable=True)   # lo que eligió o corrigió el usuario
    texto_otro = db.Column(db.String(120), nullable=True)        # «Ninguna de estas»
    categoria_predicha_id = db.Column(db.Integer, db.ForeignKey("categoria_residuo.id", ondelete="SET NULL"), nullable=True)
    categoria_confirmada_id = db.Column(db.Integer, db.ForeignKey("categoria_residuo.id", ondelete="SET NULL"), nullable=True)
    imagen_url = db.Column(db.String(300), nullable=True)        # solo si el usuario acepta compartirla
    version_modelo = db.Column(db.String(20), nullable=False)
    creado_en = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
