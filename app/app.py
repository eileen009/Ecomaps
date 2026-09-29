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
    from models.accion_reciclaje import AccionReciclaje  # noqa: F401
    from models.reporte import Reporte  # noqa: F401

    # ----- Blueprints -----
    from routes.auth import auth_bp
    from routes.usuarios import usuarios_bp
    from routes.categorias import categorias_bp
    from routes.puntos import puntos_bp
    from routes.buscador import buscador_bp
    from routes.acciones import acciones_bp
    from routes.reportes import reportes_bp
    from routes.estadisticas import estadisticas_bp
    from routes.paginas import paginas_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(usuarios_bp)
    app.register_blueprint(categorias_bp)
    app.register_blueprint(puntos_bp)
    app.register_blueprint(buscador_bp)
    app.register_blueprint(acciones_bp)
    app.register_blueprint(reportes_bp)
    app.register_blueprint(estadisticas_bp)
    app.register_blueprint(paginas_bp)  # vistas HTML (templates/)

    @app.get("/api/salud")
    def salud():
        """Endpoint simple para verificar que el servidor responde."""
        return jsonify({"estado": "ok"}), 200

    # ----- Sesiones: un token deja de valer si la cuenta se suspendió, se
    # eliminó o le cambiaron el rol (así el cambio aplica de inmediato).
    # db.session.get usa la caché de la sesión: si la ruta vuelve a pedir
    # el mismo usuario, no hay una segunda consulta.
    @jwt.token_in_blocklist_loader
    def token_revocado(_cabecera, datos_jwt):
        usuario = db.session.get(Usuario, int(datos_jwt["sub"]))
        return usuario is None or not usuario.activo or usuario.rol != datos_jwt.get("rol")

    @jwt.revoked_token_loader
    def token_revocado_respuesta(_cabecera, _datos_jwt):
        return jsonify({"error": "Tu sesión ya no es válida. Inicia sesión de nuevo."}), 401

    # ----- Manejo de errores comunes en JSON (en vez de HTML) -----
    @app.errorhandler(404)
    def no_encontrado(_error):
        return jsonify({"error": "Recurso no encontrado."}), 404

    @app.errorhandler(500)
    def error_interno(_error):
        return jsonify({"error": "Error interno del servidor."}), 500

    
    @app.errorhandler(413)
    def archivo_muy_grande(_error):
        # Si una foto supera MAX_CONTENT_LENGTH, se responde en JSON (no en HTML)
        # para que la página muestre un mensaje claro.
        return jsonify({"error": "La foto pesa más de 5 MB. Elige otra o tómala con menor resolución."}), 413

    return app


if __name__ == "__main__":
    app = crear_app()
    app.run(debug=app.config.get("FLASK_DEBUG", True))
