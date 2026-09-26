"""Rutas que sirven las plantillas Jinja2 (vistas HTML).

Separado de los blueprints de la API (auth, usuarios, etc.): este
módulo solo renderiza páginas, no expone datos JSON.
"""
from flask import Blueprint, render_template

paginas_bp = Blueprint("paginas", __name__)


@paginas_bp.get("/")
def inicio():
    return render_template("index.html")


@paginas_bp.get("/login")
def login():
    return render_template("login.html")


@paginas_bp.get("/mapa")
def mapa():
    return render_template("mapa.html")


@paginas_bp.get("/estadisticas")
def estadisticas():
    return render_template("estadisticas.html")


@paginas_bp.get("/guia")
def guia():
    return render_template("guia.html")


@paginas_bp.get("/proponer")
def proponer():
    return render_template("proponer.html")


@paginas_bp.get("/admin")
def admin():
    return render_template("admin.html", activo="puntos")


@paginas_bp.get("/admin/empresas")
def admin_empresas():
    return render_template("admin_empresas.html", activo="empresas")


@paginas_bp.get("/admin/estadisticas")
def admin_estadisticas():
    return render_template("admin_estadisticas.html", activo="estadisticas")


@paginas_bp.get("/actividad")
def actividad():
    return render_template("actividad.html")


@paginas_bp.get("/logros")
def logros():
    return render_template("logros.html")


@paginas_bp.get("/ods12")
def ods12():
    return render_template("ods12.html")


@paginas_bp.get("/perfil")
def perfil():
    return render_template("perfil.html")


@paginas_bp.get("/reportar")
def reportar():
    return render_template("reportar.html")
