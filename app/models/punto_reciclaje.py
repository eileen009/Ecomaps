"""Modelo de Punto de reciclaje — módulo 2.

Corresponde a las tablas `punto_reciclaje` y `punto_material`
definidas en claude/modulos-backend-ecomaps.md.
"""
from datetime import datetime, timezone

from extensions import db

# Tabla puente N:N entre puntos y categorías de residuos.
# Sin modelo propio porque no guarda datos adicionales, solo la relación.
punto_material = db.Table(
    "punto_material",
    db.Column(
        "id_punto", db.Integer,
        db.ForeignKey("punto_reciclaje.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    db.Column(
        "id_categoria", db.Integer,
        db.ForeignKey("categoria_residuo.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class PuntoReciclaje(db.Model):
    __tablename__ = "punto_reciclaje"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(150), nullable=False)
    direccion = db.Column(db.String(220), nullable=False)
    # index=True: el listado casi siempre se filtra/agrupa por ciudad.
    ciudad = db.Column(db.String(100), nullable=False, index=True)

    # Numeric en vez de Float: evita errores de redondeo en coordenadas.
    latitud = db.Column(db.Numeric(10, 7), nullable=False)
    longitud = db.Column(db.Numeric(10, 7), nullable=False)

    horario = db.Column(db.String(150), nullable=True)
    telefono_contacto = db.Column(db.String(30), nullable=True)
    email_contacto = db.Column(db.String(180), nullable=True)

    # index=True: el listado público siempre filtra WHERE estado = 'activo'.
    estado = db.Column(
        db.Enum("pendiente", "activo", "rechazado", "reportado", name="estado_punto"),
        nullable=False,
        default="pendiente",
        index=True,
    )

    # Quién propuso el punto. Si se borra el usuario, el punto no se
    # pierde (SET NULL) — solo pierde la referencia a quién lo creó.
    creado_por = db.Column(
        db.Integer, db.ForeignKey("usuario.id", ondelete="SET NULL"), nullable=True
    )

    fecha_creacion = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    materiales = db.relationship(
        "CategoriaResiduo", secondary=punto_material, backref="puntos", lazy="joined"
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "nombre": self.nombre,
            "direccion": self.direccion,
            "ciudad": self.ciudad,
            "latitud": float(self.latitud),
            "longitud": float(self.longitud),
            "horario": self.horario,
            "telefono_contacto": self.telefono_contacto,
            "email_contacto": self.email_contacto,
            "estado": self.estado,
            "materiales": [m.nombre for m in self.materiales],
            "fecha_creacion": self.fecha_creacion.isoformat(),
        }
