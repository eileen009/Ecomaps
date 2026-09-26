"""Punto de entrada del backend de EcoMaps.

Application factory: crea y configura la app Flask, registra
extensiones y blueprints. Sirve tanto la API (/api/...) como las
vistas HTML en templates/ (blueprint "paginas"). Los siguientes
módulos se agregan aquí mismo a medida que se construyen.
"""
from flask import Flask, jsonify

from config import Config
from extensions import db, jwt, cors


def crear_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # ----- Extensiones -----
    db.init_app(app)
    jwt.init_app(app)
    cors.init_app(app)  # permite que el frontend (otro origen) consuma la API

    # ----- Modelos (deben importarse antes de usarse en las rutas) -----
    from models.usuario import Usuario  # noqa: F401
    from models.categoria_residuo import CategoriaResiduo  # noqa: F401
    from models.punto_reciclaje import PuntoReciclaje  # noqa: F401

    # ----- Blueprints -----
    from routes.auth import auth_bp
    from routes.usuarios import usuarios_bp
    from routes.categorias import categorias_bp
    from routes.puntos import puntos_bp
    from routes.paginas import paginas_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(usuarios_bp)
    app.register_blueprint(categorias_bp)
    app.register_blueprint(puntos_bp)
    app.register_blueprint(paginas_bp)  # vistas HTML (templates/)

    @app.get("/api/salud")
    def salud():
        """Endpoint simple para verificar que el servidor responde."""
        return jsonify({"estado": "ok"}), 200

    # ----- Manejo de errores comunes en JSON (en vez de HTML) -----
    @app.errorhandler(404)
    def no_encontrado(_error):
        return jsonify({"error": "Recurso no encontrado."}), 404

    @app.errorhandler(500)
    def error_interno(_error):
        return jsonify({"error": "Error interno del servidor."}), 500

    return app


if __name__ == "__main__":
    app = crear_app()
    app.run(debug=app.config.get("FLASK_DEBUG", True))
