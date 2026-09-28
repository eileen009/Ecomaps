"""Rutas que sirven las plantillas Jinja2 (vistas HTML).

Separado de los blueprints de la API (auth, usuarios, etc.): este
módulo solo renderiza páginas, no expone datos JSON.
"""
from flask import Blueprint, render_template

from utils.estadisticas import obtener_generales

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
    # Render en el servidor: una sola petición, sin JS extra para pintar cifras.
    return render_template("estadisticas.html", stats=obtener_generales())


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


@paginas_bp.get("/admin/acciones")
def admin_acciones():
    return render_template("admin_acciones.html", activo="acciones")


@paginas_bp.get("/actividad")
def actividad():
    return render_template("actividad.html", activo="actividad")


@paginas_bp.get("/logros")
def logros():
    return render_template("logros.html", activo="logros")


@paginas_bp.get("/ods12")
def ods12():
    return render_template("ods12.html")


@paginas_bp.get("/perfil")
def perfil():
    return render_template("perfil.html", activo="perfil")


@paginas_bp.get("/reportar")
def reportar():
    return render_template("reportar.html")


@paginas_bp.get("/empresa")
def empresa():
    return render_template("empresa.html", activo="empresa")


@paginas_bp.get("/admin/reportes")
def admin_reportes():
    return render_template("admin_reportes.html", activo="reportes")


@paginas_bp.app_template_filter("miles")
def formato_miles(numero):
    """1234567 -> 1.234.567 (formato colombiano)."""
    return f"{int(numero):,}".replace(",", ".")


@paginas_bp.app_template_filter("peso")
def formato_peso(kg):
    """Kilos legibles: 850 -> '850 kg', 1530 -> '1,5 t'."""
    if kg >= 1000:
        return f"{kg / 1000:.1f} t".replace(".", ",")
    return f"{kg:.0f} kg" if kg == int(kg) else f"{kg:.1f} kg".replace(".", ",")


@paginas_bp.get("/admin/usuarios")
def admin_usuarios():
    return render_template("admin_usuarios.html", activo="usuarios")
