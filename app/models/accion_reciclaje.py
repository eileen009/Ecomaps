"""Modelo de Acción de reciclaje — módulo 5 (Sistema de puntos y logros).

Cada vez que un usuario registra un aporte queda en estado "pendiente"
con una foto de evidencia; un administrador la revisa y, si la
confirma, recién ahí se otorgan los puntos (evita que cualquiera se
autoasigne puntos sin comprobar nada).
"""
from datetime import datetime, timezone

from extensions import db


class AccionReciclaje(db.Model):
    __tablename__ = "accion_reciclaje"

    id = db.Column(db.Integer, primary_key=True)
    id_usuario = db.Column(db.Integer, db.ForeignKey("usuario.id", ondelete="CASCADE"), nullable=False, index=True)
    id_categoria = db.Column(db.Integer, db.ForeignKey("categoria_residuo.id", ondelete="RESTRICT"), nullable=False)
    id_punto = db.Column(db.Integer, db.ForeignKey("punto_reciclaje.id", ondelete="SET NULL"), nullable=True)

    cantidad = db.Column(db.Numeric(8, 2), nullable=False)
    unidad = db.Column(db.String(20), nullable=False, default="kg")
    foto_url = db.Column(db.String(255), nullable=False)

    estado = db.Column(
        db.Enum("pendiente", "confirmada", "rechazada", name="estado_accion"),
        nullable=False, default="pendiente", index=True,
    )
    puntos_otorgados = db.Column(db.Integer, nullable=False, default=0)

    fecha = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    categoria = db.relationship("CategoriaResiduo", lazy="joined")
    punto = db.relationship("PuntoReciclaje", lazy="joined")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "id_usuario": self.id_usuario,
            "categoria": self.categoria.nombre if self.categoria else None,
            "punto": self.punto.nombre if self.punto else None,
            "cantidad": float(self.cantidad),
            "unidad": self.unidad,
            "foto_url": self.foto_url,
            "estado": self.estado,
            "puntos_otorgados": self.puntos_otorgados,
            "fecha": self.fecha.isoformat(),
        }
