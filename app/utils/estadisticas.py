"""Estadísticas reales de EcoMaps (módulo 6).

Código verde:
  - Todo se calcula con COUNT / SUM / GROUP BY en la base de datos,
    nunca trayendo filas a Python para contarlas.
  - Resultado cacheado en memoria 10 minutos: las cifras públicas no
    necesitan estar al segundo y así no se recalculan en cada visita.
"""
import time
from datetime import datetime, timezone

from sqlalchemy import func, extract

from extensions import db
from models.usuario import Usuario
from models.punto_reciclaje import PuntoReciclaje
from models.accion_reciclaje import AccionReciclaje
from models.categoria_residuo import CategoriaResiduo

DURACION_CACHE = 10 * 60  # segundos
MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
_cache = {"datos": None, "vence": 0.0}


def _inicio_mes(fecha, meses_atras=0):
    """Primer día del mes, `meses_atras` meses antes de `fecha` (sin zona, como en la BD)."""
    total = fecha.year * 12 + (fecha.month - 1) - meses_atras
    return datetime(total // 12, total % 12 + 1, 1)


def _porcentajes(filas, clave_valor="valor"):
    """Agrega 'pct' (alto de la barra) relativo al mayor valor."""
    maximo = max((f[clave_valor] for f in filas), default=0) or 1
    for f in filas:
        f["pct"] = round(f[clave_valor] * 100 / maximo)
    return filas


def calcular_generales():
    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    inicio_mes = _inicio_mes(ahora)
    confirmadas = AccionReciclaje.query.filter(AccionReciclaje.estado == "confirmada")

    usuarios = db.session.query(func.count(Usuario.id)).scalar() or 0
    usuarios_mes = db.session.query(func.count(Usuario.id)).filter(Usuario.fecha_registro >= inicio_mes).scalar() or 0
    puntos_activos = db.session.query(func.count(PuntoReciclaje.id)).filter(PuntoReciclaje.estado == "activo").scalar() or 0

    aportes = confirmadas.with_entities(func.count(AccionReciclaje.id)).scalar() or 0
    kg = confirmadas.filter(AccionReciclaje.unidad == "kg").with_entities(func.sum(AccionReciclaje.cantidad)).scalar() or 0

    del_mes = confirmadas.filter(AccionReciclaje.fecha >= inicio_mes)
    aportes_mes = del_mes.with_entities(func.count(AccionReciclaje.id)).scalar() or 0
    kg_mes = del_mes.filter(AccionReciclaje.unidad == "kg").with_entities(func.sum(AccionReciclaje.cantidad)).scalar() or 0
    recicladores_mes = del_mes.with_entities(func.count(func.distinct(AccionReciclaje.id_usuario))).scalar() or 0

    # Aportes confirmados por material (una consulta con GROUP BY)
    por_material = (
        db.session.query(CategoriaResiduo.nombre, func.count(AccionReciclaje.id))
        .join(AccionReciclaje, AccionReciclaje.id_categoria == CategoriaResiduo.id)
        .filter(AccionReciclaje.estado == "confirmada")
        .group_by(CategoriaResiduo.nombre)
        .order_by(func.count(AccionReciclaje.id).desc())
        .all()
    )

    # Aportes confirmados de los últimos 6 meses (incluye meses en cero)
    desde = _inicio_mes(ahora, 5)
    anio, mes = extract("year", AccionReciclaje.fecha), extract("month", AccionReciclaje.fecha)
    conteo = dict(
        ((int(a), int(m)), n)
        for a, m, n in confirmadas.filter(AccionReciclaje.fecha >= desde)
        .with_entities(anio, mes, func.count(AccionReciclaje.id))
        .group_by(anio, mes)
        .all()
    )
    por_mes = []
    for atras in range(5, -1, -1):
        inicio = _inicio_mes(ahora, atras)
        por_mes.append({"etiqueta": f"{MESES[inicio.month - 1]} {inicio.year % 100:02d}",
                        "valor": conteo.get((inicio.year, inicio.month), 0)})

    return {
        "usuarios": usuarios,
        "usuarios_mes": usuarios_mes,
        "puntos_activos": puntos_activos,
        "aportes": aportes,
        "kg": float(kg),
        "aportes_mes": aportes_mes,
        "kg_mes": float(kg_mes),
        "recicladores_mes": recicladores_mes,
        "mes_actual": f"{MESES[ahora.month - 1]} {ahora.year}",
        "por_material": _porcentajes([{"etiqueta": n, "valor": c} for n, c in por_material]),
        "por_mes": _porcentajes(por_mes),
    }


def obtener_generales():
    """Estadísticas públicas, cacheadas DURACION_CACHE segundos."""
    if _cache["datos"] is None or time.monotonic() > _cache["vence"]:
        _cache["datos"] = calcular_generales()
        _cache["vence"] = time.monotonic() + DURACION_CACHE
    return _cache["datos"]


def calcular_admin():
    """Cifras internas del panel admin (sin caché: son pocas y deben estar al día)."""
    from models.reporte import Reporte  # import local: evita ciclos al cargar modelos

    top = (
        Usuario.query.filter(Usuario.rol == "ciudadano", Usuario.puntos_totales > 0)
        .order_by(Usuario.puntos_totales.desc())
        .limit(5)
        .all()
    )
    ids = [u.id for u in top]
    aportes_por_usuario = dict(
        db.session.query(AccionReciclaje.id_usuario, func.count(AccionReciclaje.id))
        .filter(AccionReciclaje.estado == "confirmada", AccionReciclaje.id_usuario.in_(ids))
        .group_by(AccionReciclaje.id_usuario)
        .all()
    ) if ids else {}

    return {
        "generales": obtener_generales(),
        "puntos_pendientes": db.session.query(func.count(PuntoReciclaje.id)).filter(PuntoReciclaje.estado == "pendiente").scalar() or 0,
        "reportes_pendientes": db.session.query(func.count(Reporte.id)).filter(Reporte.estado == "pendiente").scalar() or 0,
        "aportes_pendientes": db.session.query(func.count(AccionReciclaje.id)).filter(AccionReciclaje.estado == "pendiente").scalar() or 0,
        "ranking": [
            {
                "nombre": u.nombre,
                "foto_url": u.foto_url,
                "nivel": u.nivel,
                "puntos": u.puntos_totales,
                "aportes": aportes_por_usuario.get(u.id, 0),
            }
            for u in top
        ],
    }
