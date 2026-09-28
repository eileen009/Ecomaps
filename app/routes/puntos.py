"""Módulo 2 — Puntos de reciclaje (propuesta 3.3 y 3.10).

Endpoints:
    GET   /api/puntos              lista pública (filtros: lat, lng, radio, material, ciudad)
    GET   /api/puntos/<id>
    POST  /api/puntos              proponer un nuevo punto (queda "pendiente")
    PUT   /api/puntos/<id>         editar (admin)
    PATCH /api/puntos/<id>/estado  aprobar / rechazar / reportar (admin)
    GET   /api/puntos/mios         puntos de la empresa que inició sesión
    PUT   /api/puntos/mios/<id>    la empresa edita info de contacto y horario
    GET   /api/puntos/resumen      conteo por estado (admin)
    DELETE /api/puntos/<id>        eliminar un punto (admin)
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt, verify_jwt_in_request
from sqlalchemy import func

from extensions import db
from models.punto_reciclaje import PuntoReciclaje
from models.categoria_residuo import CategoriaResiduo
from utils.auth_helpers import requiere_rol
from utils.geo import distancia_km
from utils.validaciones import correo_valido

puntos_bp = Blueprint("puntos", __name__, url_prefix="/api/puntos")

ESTADOS_VALIDOS = {"pendiente", "activo", "rechazado", "reportado"}
# ~111 km por grado de latitud/longitud: suficiente para una caja
# delimitadora aproximada (no necesitamos precisión geodésica aquí).
KM_POR_GRADO = 111


def filtrar_puntos(ciudad=None, material=None, estado="activo", lat=None, lng=None, radio_km=5):
    """Consulta reutilizable de puntos con filtros.

    La usan tanto GET /api/puntos como GET /api/buscar (módulo 3), para
    no repetir la misma lógica de filtrado/distancia en dos sitios.
    Devuelve (resultado_dict, error) — error es None si todo salió bien.
    """
    if estado != "todos" and estado not in ESTADOS_VALIDOS:
        return None, "Estado no válido."

    # Usa el índice de "estado" en vez de traer toda la tabla y filtrar en Python.
    query = PuntoReciclaje.query
    if estado != "todos":
        query = query.filter_by(estado=estado)

    if ciudad:
        query = query.filter(PuntoReciclaje.ciudad.ilike(ciudad))

    if material:
        query = query.join(PuntoReciclaje.materiales).filter(
            CategoriaResiduo.nombre.ilike(material)
        )

    if lat is not None and lng is not None:
        # Caja delimitadora primero (aprovecha latitud/longitud indexadas
        # y descarta la mayoría de filas antes de calcular distancia real).
        delta = radio_km / KM_POR_GRADO
        query = query.filter(
            PuntoReciclaje.latitud.between(lat - delta, lat + delta),
            PuntoReciclaje.longitud.between(lng - delta, lng + delta),
        )

    puntos = query.all()
    resultado = [p.to_dict() for p in puntos]

    if lat is not None and lng is not None:
        for item, punto in zip(resultado, puntos):
            item["distancia_km"] = round(
                distancia_km(lat, lng, float(punto.latitud), float(punto.longitud)), 2
            )
        resultado = [r for r in resultado if r["distancia_km"] <= radio_km]
        resultado.sort(key=lambda r: r["distancia_km"])

    return resultado, None


@puntos_bp.get("")
def listar_puntos():
    estado = request.args.get("estado", default="activo", type=str)
    # Los puntos que no están publicados (pendientes, rechazados...) solo los ve el admin.
    if estado != "activo":
        verify_jwt_in_request(optional=True)
        if (get_jwt() or {}).get("rol") != "admin":
            return jsonify({"error": "No tienes permisos para ver esos puntos."}), 403

    resultado, error = filtrar_puntos(
        ciudad=request.args.get("ciudad", type=str),
        material=request.args.get("material", type=str),
        estado=estado,
        lat=request.args.get("lat", type=float),
        lng=request.args.get("lng", type=float),
        radio_km=request.args.get("radio", default=5, type=float),
    )
    if error:
        return jsonify({"error": error}), 400
    return jsonify(resultado), 200


@puntos_bp.get("/<int:id_punto>")
def obtener_punto(id_punto):
    punto = PuntoReciclaje.query.get_or_404(id_punto)
    return jsonify(punto.to_dict()), 200


@puntos_bp.post("")
@jwt_required()
def proponer_punto():
    datos = request.get_json(silent=True) or {}

    nombre = (datos.get("nombre") or "").strip()
    direccion = (datos.get("direccion") or "").strip()
    ciudad = (datos.get("ciudad") or "").strip()
    latitud = datos.get("latitud")
    longitud = datos.get("longitud")
    materiales_nombres = datos.get("materiales") or []

    if not nombre or not direccion or not ciudad:
        return jsonify({"error": "Nombre, dirección y ciudad son obligatorios."}), 400

    try:
        latitud = float(latitud)
        longitud = float(longitud)
    except (TypeError, ValueError):
        return jsonify({"error": "Ubicación no válida."}), 400

    if not (-90 <= latitud <= 90 and -180 <= longitud <= 180):
        return jsonify({"error": "Coordenadas fuera de rango."}), 400

    materiales = CategoriaResiduo.query.filter(
        CategoriaResiduo.nombre.in_(materiales_nombres)
    ).all()

    punto = PuntoReciclaje(
        nombre=nombre,
        direccion=direccion,
        ciudad=ciudad,
        latitud=latitud,
        longitud=longitud,
        horario=(datos.get("horario") or "").strip() or None,
        telefono_contacto=(datos.get("telefono_contacto") or "").strip() or None,
        email_contacto=(datos.get("email_contacto") or "").strip() or None,
        estado="pendiente",  # un admin debe revisarlo antes de publicarlo (3.10)
        creado_por=int(get_jwt_identity()),
        materiales=materiales,
    )

    db.session.add(punto)
    db.session.commit()

    return jsonify(punto.to_dict()), 201


@puntos_bp.put("/<int:id_punto>")
@requiere_rol("admin")
def actualizar_punto(id_punto):
    punto = PuntoReciclaje.query.get_or_404(id_punto)
    datos = request.get_json(silent=True) or {}

    campos_texto = ["nombre", "direccion", "ciudad", "horario", "telefono_contacto", "email_contacto"]
    for campo in campos_texto:
        if campo in datos:
            setattr(punto, campo, (datos[campo] or "").strip() or None)

    if "latitud" in datos:
        punto.latitud = datos["latitud"]
    if "longitud" in datos:
        punto.longitud = datos["longitud"]

    if "materiales" in datos:
        punto.materiales = CategoriaResiduo.query.filter(
            CategoriaResiduo.nombre.in_(datos["materiales"])
        ).all()

    db.session.commit()
    return jsonify(punto.to_dict()), 200


@puntos_bp.patch("/<int:id_punto>/estado")
@requiere_rol("admin")
def cambiar_estado(id_punto):
    punto = PuntoReciclaje.query.get_or_404(id_punto)
    datos = request.get_json(silent=True) or {}
    nuevo_estado = datos.get("estado")

    if nuevo_estado not in ESTADOS_VALIDOS:
        return jsonify({"error": "Estado no válido."}), 400

    punto.estado = nuevo_estado
    db.session.commit()
    return jsonify(punto.to_dict()), 200


# ----- Dashboard de empresa -----
# Sin tabla "empresa" nueva: el punto le pertenece al usuario que lo
# propuso (creado_por). Así no se toca el esquema de la BD.
CAMPOS_EDITABLES_EMPRESA = ("nombre", "horario", "telefono_contacto", "email_contacto")
MAX_HORARIO = 150  # mismo largo que la columna horario


@puntos_bp.get("/mios")
@requiere_rol("empresa")
def mis_puntos():
    # Filtra por creado_por en la consulta: no trae puntos de otros.
    puntos = (
        PuntoReciclaje.query.filter_by(creado_por=int(get_jwt_identity()))
        .order_by(PuntoReciclaje.nombre)
        .all()
    )
    return jsonify([p.to_dict() for p in puntos]), 200


@puntos_bp.put("/mios/<int:id_punto>")
@requiere_rol("empresa")
def editar_mi_punto(id_punto):
    punto = PuntoReciclaje.query.filter_by(
        id=id_punto, creado_por=int(get_jwt_identity())
    ).first()
    if not punto:
        return jsonify({"error": "Ese punto no existe o no es de tu empresa."}), 404

    datos = request.get_json(silent=True) or {}

    if "nombre" in datos and not (datos["nombre"] or "").strip():
        return jsonify({"error": "El nombre del punto no puede quedar vacío."}), 400
    if len((datos.get("horario") or "")) > MAX_HORARIO:
        return jsonify({"error": "El horario es demasiado largo."}), 400
    correo = (datos.get("email_contacto") or "").strip()
    if correo and not correo_valido(correo):
        return jsonify({"error": "Correo de contacto no válido."}), 400

    # Dirección, ciudad y coordenadas NO se editan aquí: cambiarían la
    # ubicación en el mapa sin revisión del admin.
    for campo in CAMPOS_EDITABLES_EMPRESA:
        if campo in datos:
            setattr(punto, campo, (datos[campo] or "").strip() or None)

    db.session.commit()
    return jsonify(punto.to_dict()), 200


# ----- Panel admin -----
@puntos_bp.get("/resumen")
@requiere_rol("admin")
def resumen_puntos():
    """Conteo por estado en UNA consulta (GROUP BY), para las tarjetas del panel."""
    conteo = dict(
        db.session.query(PuntoReciclaje.estado, func.count(PuntoReciclaje.id))
        .group_by(PuntoReciclaje.estado)
        .all()
    )
    return jsonify({
        "total": sum(conteo.values()),
        **{e: conteo.get(e, 0) for e in ESTADOS_VALIDOS},
    }), 200


@puntos_bp.delete("/<int:id_punto>")
@requiere_rol("admin")
def eliminar_punto(id_punto):
    punto = PuntoReciclaje.query.get_or_404(id_punto)
    db.session.delete(punto)
    db.session.commit()
    return jsonify({"mensaje": "Punto eliminado."}), 200
