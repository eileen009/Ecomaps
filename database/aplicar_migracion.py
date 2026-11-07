"""Aplica database/migracion_clasificador.sql a la base de datos configurada en app/.env.

Uso (desde la raíz del proyecto, con el entorno de la app activo):
    python database/aplicar_migracion.py

Usa la misma conexión (y el certificado SSL de Aiven) que la app, así que no hay
que escribir la contraseña en ningún lado. Si la migración ya se aplicó, no hace nada.
"""
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, "app"))
os.chdir(os.path.join(RAIZ, "app"))  # config.py busca ca.pem y .env junto a la app

from sqlalchemy import create_engine, text  # noqa: E402

from config import Config  # noqa: E402

ARCHIVO = os.path.join(RAIZ, "database", "migracion_clasificador.sql")


def sentencias(ruta):
    """Separa el archivo en sentencias, sin las líneas de comentario."""
    with open(ruta, encoding="utf-8") as f:
        lineas = [l for l in f.read().splitlines() if not l.strip().startswith("--")]
    return [s.strip() for s in "\n".join(lineas).split(";") if s.strip()]


def main():
    engine = create_engine(Config.SQLALCHEMY_DATABASE_URI, **Config.SQLALCHEMY_ENGINE_OPTIONS)
    with engine.connect() as con:
        base = con.execute(text("SELECT DATABASE()")).scalar()
        ya = con.execute(text(
            "SELECT COUNT(*) FROM information_schema.columns "
            "WHERE table_schema = DATABASE() AND table_name = 'categoria_residuo' AND column_name = 'clase_modelo'"
        )).scalar()
        if ya:
            print(f"La migración ya estaba aplicada en «{base}». No se hizo nada.")
        else:
            print(f"Aplicando la migración en «{base}»…")
            for i, sql in enumerate(sentencias(ARCHIVO), 1):
                con.exec_driver_sql(sql)
                print(f"  {i}. {sql.splitlines()[0][:70]}")
            con.commit()
            print("Listo.")

        print("\nCategorías (nombre, clase del modelo, caneca):")
        for fila in con.execute(text("SELECT nombre, clase_modelo, caneca FROM categoria_residuo ORDER BY id")):
            print(f"  {fila[0]:<14} {str(fila[1]):<14} {fila[2]}")


if __name__ == "__main__":
    main()
