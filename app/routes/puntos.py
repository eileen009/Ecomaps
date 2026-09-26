"""Módulo 2 — Puntos de reciclaje (propuesta 3.3 y 3.10).

Endpoints:
    GET   /api/puntos              lista pública (filtros: lat, lng, radio, material, ciudad)
    GET   /api/puntos/<id>
    POST  /api/puntos              proponer un nuevo punto (queda "pendiente")
    PUT   /api/puntos/<id>         editar (admin)
    PATCH /api/puntos/<id>/estado  aprobar / rechazar / reportar (admin)
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db
from models.punto_reciclaje import PuntoReciclaje
from models.categoria_residuo import CategoriaResiduo
from utils.auth_helpers import requiere_rol
from utils.geo import distancia_km

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
    if estado not in ESTADOS_VALIDOS:
        return None, "Estado no válido."

    # Usa el índice de "estado" en vez de traer toda la tabla y filtrar en Python.
    query = PuntoReciclaje.query.filter_by(estado=estado)

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
    resultado, error = filtrar_puntos(
        ciudad=request.args.get("ciudad", type=str),
        material=request.args.get("material", type=str),
        estado=request.args.get("estado", default="activo", type=str),
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
