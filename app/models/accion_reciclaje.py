"""Modelo de Acción de reciclaje — módulo 5 (Sistema de puntos y logros).

Cada vez que un usuario registra un aporte queda en estado "pendiente"
con una foto de evidencia. Quien lo revisa (un administrador o la empresa
dueña del punto) lo confirma o lo rechaza:

- Si lo confirma, indica la cantidad que REALMENTE recibió y se otorgan los
  puntos sobre esa cantidad. Para que la confirmación no dependa solo de la
  foto (que podría ser sacada de internet), quien aporta puede adjuntar la
  foto del recibo o factura que le entregó el punto (campo opcional).
- Si lo rechaza, debe escribir el motivo, que el usuario verá en su historial.
"""
from datetime import datetime, timezone

from extensions import db


class AccionReciclaje(db.Model):
    __tablename__ = "accion_reciclaje"

    id = db.Column(db.Integer, primary_key=True)
    id_usuario = db.Column(db.Integer, db.ForeignKey("usuario.id", ondelete="CASCADE"), nullable=False, index=True)
    id_categoria = db.Column(db.Integer, db.ForeignKey("categoria_residuo.id", ondelete="RESTRICT"), nullable=False)
    id_punto = db.Column(db.Integer, db.ForeignKey("punto_reciclaje.id", ondelete="SET NULL"), nullable=True)

    cantidad = db.Column(db.Numeric(8, 2), nullable=False)  # lo que declara el usuario
    unidad = db.Column(db.String(20), nullable=False, default="kg")
    foto_url = db.Column(db.String(255), nullable=False)

    estado = db.Column(
        db.Enum("pendiente", "confirmada", "rechazada", name="estado_accion"),
        nullable=False, default="pendiente", index=True,
    )
    puntos_otorgados = db.Column(db.Integer, nullable=False, default=0)

    # ----- Revisión (se llenan al confirmar o rechazar) -----
    motivo_rechazo = db.Column(db.String(255), nullable=True)
    cantidad_recibida = db.Column(db.Numeric(8, 2), nullable=True)  # lo que el punto recibió de verdad
    foto_recibo_url = db.Column(db.String(255), nullable=True)  # recibo/factura que le dio el punto (la sube quien aporta)
    fecha_revision = db.Column(db.DateTime, nullable=True)
    id_revisor = db.Column(db.Integer, db.ForeignKey("usuario.id", ondelete="SET NULL"), nullable=True)

    fecha = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    categoria = db.relationship("CategoriaResiduo", lazy="joined")
    punto = db.relationship("PuntoReciclaje", lazy="joined")
    # Hay dos llaves a usuario (quien aporta y quien revisa): se indica cuál usa esta relación.
    revisor = db.relationship("Usuario", foreign_keys=[id_revisor], lazy="joined")

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
            "motivo_rechazo": self.motivo_rechazo,
            "cantidad_recibida": float(self.cantidad_recibida) if self.cantidad_recibida is not None else None,
            "foto_recibo_url": self.foto_recibo_url,
            "fecha": self.fecha.isoformat(),
        }
