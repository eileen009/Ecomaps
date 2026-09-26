"""Cambia el rol de un usuario ya registrado (ciudadano, empresa o admin).

Uso (desde la carpeta app):
    python cambiar_rol.py correo@ejemplo.com admin
"""
import os
import sys

import pymysql
from dotenv import load_dotenv

BASE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE, ".env"))
ROLES = ("ciudadano", "empresa", "admin")


def main():
    if len(sys.argv) != 3 or sys.argv[2] not in ROLES:
        raise SystemExit(f"Uso: python cambiar_rol.py <correo> <{'|'.join(ROLES)}>")
    correo, rol = sys.argv[1].strip().lower(), sys.argv[2]

    ca = os.getenv("MYSQL_SSL_CA")
    conn = pymysql.connect(
        host=os.getenv("MYSQL_HOST", "localhost"), port=int(os.getenv("MYSQL_PORT", "3306")),
        user=os.getenv("MYSQL_USER", "root"), password=os.getenv("MYSQL_PASSWORD", ""),
        database=os.getenv("MYSQL_DB"), ssl={"ca": os.path.join(BASE, ca)} if ca else None,
        charset="utf8mb4", autocommit=True,
    )
    with conn, conn.cursor() as cur:
        # Una sola consulta indexada (uk_usuario_correo)
        cambiados = cur.execute("UPDATE usuario SET rol=%s WHERE correo=%s", (rol, correo))
    print(f"Listo: {correo} ahora es {rol}." if cambiados
          else f"No hubo cambios: {correo} no existe o ya era {rol}.")


if __name__ == "__main__":
    main()
