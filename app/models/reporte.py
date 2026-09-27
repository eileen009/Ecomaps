"""Modelo de Reporte de problemas — módulo 7 (propuesta 3.11).

Un usuario reporta que un punto está cerrado, mal ubicado, etc. El
reporte queda "pendiente" hasta que un admin lo revisa; el punto NO se
oculta del mapa automáticamente (un solo reporte podría ser un error).
"""
from datetime import datetime, timezone

from extensions import db

TIPOS_REPORTE = (
    "cerrado", "no_existe", "direccion_incorrecta",
    "horario_cambio", "material_no_recibido", "otro",
)
ESTADOS_REPORTE = ("pendiente", "revisado", "resuelto")


class Reporte(db.Model):
    __tablename__ = "reporte"

    id = db.Column(db.Integer, primary_key=True)
    id_punto = db.Column(db.Integer, db.ForeignKey("punto_reciclaje.id", ondelete="CASCADE"), nullable=False, index=True)
    id_usuario = db.Column(db.Integer, db.ForeignKey("usuario.id", ondelete="SET NULL"), nullable=True)
    tipo = db.Column(db.Enum(*TIPOS_REPORTE, name="tipo_reporte"), nullable=False)
    comentario = db.Column(db.String(500), nullable=True)
    # index=True: el admin siempre lista filtrando por estado.
    estado = db.Column(db.Enum(*ESTADOS_REPORTE, name="estado_reporte"), nullable=False, default="pendiente", index=True)
    fecha = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    punto = db.relationship("PuntoReciclaje", lazy="joined")
    usuario = db.relationship("Usuario", lazy="joined")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "id_punto": self.id_punto,
            "punto": self.punto.nombre if self.punto else None,
            "direccion": self.punto.direccion if self.punto else None,
            "ciudad": self.punto.ciudad if self.punto else None,
            "usuario": self.usuario.nombre if self.usuario else "Usuario eliminado",
            "tipo": self.tipo,
            "comentario": self.comentario,
            "estado": self.estado,
            "fecha": self.fecha.isoformat(),
        }
