"""Clasificador de residuos por foto (RF-05 y RF-07).

La foto se clasifica en el navegador (TensorFlow.js): el servidor nunca la recibe.
Aquí solo se atienden dos cosas:

    GET  /api/puntos-cercanos?clase=&lat=&lng=   los 3 puntos activos más cercanos que reciben ese material
    POST /api/clasificaciones                    guarda lo que predijo el modelo y lo que confirmó la persona
    PATCH /api/clasificaciones/<id>              la persona corrige su resultado (hasta 30 min después)
"""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from sqlalchemy import text

from extensions import db
from models.categoria_residuo import CategoriaResiduo
from models.clasificacion import Clasificacion

clasificador_bp = Blueprint("clasificador", __name__, url_prefix="/api")

# Clases que entiende el modelo (deben coincidir con `labels` de metadata.json).
CLASES_VALIDAS = {"plastico", "vidrio", "papel_carton", "metal", "organico", "no_aprovechable"}
# Si la persona no comparte su ubicación se usa el centro de Montería (y se le avisa).
CENTRO_MONTERIA = (8.7479, -75.8814)
LIMITE_PUNTOS = 3


def _primera_categoria(clase):
    """Primera categoría del catálogo que usa esa clase (Papel y Cartón comparten «papel_carton»)."""
    if not clase:
        return None
    return CategoriaResiduo.query.filter_by(clase_modelo=clase).order_by(CategoriaResiduo.id).first()


@clasificador_bp.get("/puntos-cercanos")
def puntos_cercanos():
    clase = (request.args.get("clase") or "").strip()
    if clase not in CLASES_VALIDAS:
        return jsonify({"error": "Clase no válida."}), 400

    lat = request.args.get("lat", type=float)
    lng = request.args.get("lng", type=float)
    ubicacion_aproximada = lat is None or lng is None
    if ubicacion_aproximada:
        lat, lng = CENTRO_MONTERIA
    elif not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return jsonify({"error": "Ubicación no válida."}), 400

    # POINT recibe primero la longitud y luego la latitud. «DISTINCT» porque Papel y
    # Cartón comparten clase y un mismo punto puede recibir las dos.
    filas = db.session.execute(text("""
        SELECT p.id, p.nombre, p.direccion, p.latitud, p.longitud, p.horario,
               MIN(ST_Distance_Sphere(POINT(p.longitud, p.latitud), POINT(:lng, :lat))) AS distancia_m
        FROM punto_reciclaje p
        JOIN punto_material pm ON pm.id_punto = p.id
        JOIN categoria_residuo c ON c.id = pm.id_categoria
        WHERE c.clase_modelo = :clase AND p.estado = 'activo'
        GROUP BY p.id, p.nombre, p.direccion, p.latitud, p.longitud, p.horario
        ORDER BY distancia_m
        LIMIT :limite
    """), {"lat": lat, "lng": lng, "clase": clase, "limite": LIMITE_PUNTOS}).mappings().all()

    puntos = []
    for f in filas:
        d = dict(f)
        for k in ("latitud", "longitud", "distancia_m"):
            if isinstance(d[k], Decimal):
                d[k] = float(d[k])
        d["distancia_m"] = round(float(d["distancia_m"]))
        puntos.append(d)

    return jsonify({
        "puntos": puntos,
        "ubicacion_aproximada": ubicacion_aproximada,   # True = se usó el centro de Montería
        "centro": {"lat": lat, "lng": lng},
    }), 200


@clasificador_bp.post("/clasificaciones")
def registrar_clasificacion():
    """Guarda una clasificación. No exige sesión: si hay una, se asocia al usuario."""
    datos = request.get_json(silent=True) or {}

    predicha = datos.get("clase_predicha")
    if predicha not in CLASES_VALIDAS:
        return jsonify({"error": "Clase no válida."}), 400
    try:
        confianza = float(datos.get("confianza"))
        if not 0 <= confianza <= 1:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"error": "La confianza debe estar entre 0 y 1."}), 400

    confirmada = datos.get("clase_confirmada") or None
    if confirmada is not None and confirmada not in CLASES_VALIDAS:
        return jsonify({"error": "Clase confirmada no válida."}), 400
    texto_otro = " ".join(str(datos.get("texto_otro") or "").split())[:120] or None

    usuario_id = None
    try:
        verify_jwt_in_request(optional=True)
        identidad = get_jwt_identity()
        usuario_id = int(identidad) if identidad else None
    except Exception:
        usuario_id = None  # token vencido o inválido: se guarda como anónimo

    cat_pred = _primera_categoria(predicha)
    cat_conf = _primera_categoria(confirmada)
    registro = Clasificacion(
        usuario_id=usuario_id,
        clase_predicha=predicha,
        confianza=round(confianza, 4),
        clase_confirmada=confirmada,
        texto_otro=texto_otro,
        categoria_predicha_id=cat_pred.id if cat_pred else None,
        categoria_confirmada_id=cat_conf.id if cat_conf else None,
        version_modelo=str(datos.get("version_modelo") or "v1")[:20],
    )
    db.session.add(registro)
    db.session.commit()
    return jsonify({"id": registro.id}), 201


VENTANA_CORRECCION = timedelta(minutes=30)


@clasificador_bp.patch("/clasificaciones/<int:id_clasificacion>")
def corregir_clasificacion(id_clasificacion):
    """La persona dice «no era correcto» o escribe lo que era (se llama desde el resultado).

    Solo se puede corregir poco después de crearla, y si la clasificación tenía
    dueño, únicamente ese usuario. Es información para mejorar el modelo, no un dato crítico.
    """
    registro = db.session.get(Clasificacion, id_clasificacion)
    if registro is None:
        return jsonify({"error": "Recurso no encontrado."}), 404

    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    if ahora - registro.creado_en > VENTANA_CORRECCION:
        return jsonify({"error": "Ya no se puede corregir esta clasificación."}), 409

    usuario_id = None
    try:
        verify_jwt_in_request(optional=True)
        identidad = get_jwt_identity()
        usuario_id = int(identidad) if identidad else None
    except Exception:
        usuario_id = None
    if registro.usuario_id is not None and registro.usuario_id != usuario_id:
        return jsonify({"error": "No puedes corregir esta clasificación."}), 403

    datos = request.get_json(silent=True) or {}
    confirmada = datos.get("clase_confirmada")
    if confirmada is not None:
        if confirmada not in CLASES_VALIDAS:
            return jsonify({"error": "Clase confirmada no válida."}), 400
        cat = _primera_categoria(confirmada)
        registro.clase_confirmada = confirmada
        registro.categoria_confirmada_id = cat.id if cat else None
    texto = " ".join(str(datos.get("texto_otro") or "").split())[:120]
    if texto:
        registro.texto_otro = texto
    db.session.commit()
    return jsonify({"id": registro.id}), 200
