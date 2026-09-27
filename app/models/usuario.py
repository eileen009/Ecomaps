"""Modelo de Usuario — módulo de Autenticación y usuarios.

Corresponde a la tabla `usuario` definida en
claude/modulos-backend-ecomaps.md (módulo 1).
"""
from datetime import datetime, timezone

from werkzeug.security import generate_password_hash, check_password_hash

from extensions import db


class Usuario(db.Model):
    __tablename__ = "usuario"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(120), nullable=False)
    # index=True + unique=True: las búsquedas por correo (login) quedan
    # indexadas, evitando un full table scan en cada intento de acceso.
    correo = db.Column(db.String(180), nullable=False, unique=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)

    nivel = db.Column(db.Integer, nullable=False, default=1)
    puntos_totales = db.Column(db.Integer, nullable=False, default=0)
    # Ruta pública (relativa a /static) de la foto de perfil; None = usa las iniciales.
    foto_url = db.Column(db.String(255), nullable=True)
    # Sello "Empresa verificada": solo lo activa un admin (rol empresa).
    verificada = db.Column(db.Boolean, nullable=False, default=False, server_default=db.false())

    rol = db.Column(
        db.Enum("ciudadano", "empresa", "admin", name="rol_usuario"),
        nullable=False,
        default="ciudadano",
    )

    fecha_registro = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    # ----- Contraseña -----
    def set_password(self, password_plano: str) -> None:
        """Genera el hash de la contraseña. Nunca se guarda en texto plano."""
        self.password_hash = generate_password_hash(password_plano)

    def check_password(self, password_plano: str) -> bool:
        return check_password_hash(self.password_hash, password_plano)

    # ----- Gamificación: marco del avatar según el nivel -----
    # Nada de tablas ni consultas extra para esto: es una regla fija y
    # barata de calcular (código verde), no un dato que haya que guardar.
    NIVELES_MARCO = (
        (7, "oro"),
        (5, "plata"),
        (3, "bronce"),
    )

    @property
    def marco_avatar(self) -> str:
        for nivel_minimo, marco in self.NIVELES_MARCO:
            if self.nivel >= nivel_minimo:
                return marco
        return "ninguno"

    # ----- Serialización -----
    def to_dict(self) -> dict:
        """Representación pública del usuario (sin password_hash)."""
        return {
            "id": self.id,
            "nombre": self.nombre,
            "correo": self.correo,
            "nivel": self.nivel,
            "puntos_totales": self.puntos_totales,
            "rol": self.rol,
            "foto_url": self.foto_url,
            "marco_avatar": self.marco_avatar,
            "verificada": bool(self.verificada),
            "fecha_registro": self.fecha_registro.isoformat(),
        }
