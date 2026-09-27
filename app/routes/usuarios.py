"""Módulo 1 — Perfil de usuario (propuesta 3.13).

Endpoints:
    GET  /api/usuarios/me
    PUT  /api/usuarios/me
    POST  /api/usuarios/me/foto              (foto de perfil: usuarios, empresas y admin)
    GET   /api/usuarios/empresas              empresas + nº de puntos (admin)
    PATCH /api/usuarios/<id>/verificada       dar/quitar sello "Empresa verificada" (admin)
"""
import os

from flask import Blueprint, current_app, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db
from sqlalchemy import func

from models.usuario import Usuario
from models.punto_reciclaje import PuntoReciclaje
from utils.auth_helpers import requiere_rol
from utils.validaciones import correo_valido
from utils.archivos import extension_valida, guardar_foto

usuarios_bp = Blueprint("usuarios", __name__, url_prefix="/api/usuarios")


@usuarios_bp.get("/me")
@jwt_required()
def obtener_perfil():
    usuario = Usuario.query.get_or_404(int(get_jwt_identity()))
    return jsonify(usuario.to_dict()), 200


@usuarios_bp.put("/me")
@jwt_required()
def actualizar_perfil():
    usuario = Usuario.query.get_or_404(int(get_jwt_identity()))
    datos = request.get_json(silent=True) or {}

    if "nombre" in datos:
        nombre = (datos["nombre"] or "").strip()
        if not nombre:
            return jsonify({"error": "El nombre no puede quedar vacío."}), 400
        usuario.nombre = nombre

    if "correo" in datos:
        correo_nuevo = (datos["correo"] or "").strip().lower()
        if not correo_valido(correo_nuevo):
            return jsonify({"error": "Correo electrónico no válido."}), 400
        if correo_nuevo != usuario.correo and Usuario.query.filter_by(correo=correo_nuevo).first():
            return jsonify({"error": "Ese correo ya está en uso."}), 409
        usuario.correo = correo_nuevo

    db.session.commit()
    return jsonify(usuario.to_dict()), 200


@usuarios_bp.post("/me/foto")
@jwt_required()
def subir_foto_perfil():
    usuario = Usuario.query.get_or_404(int(get_jwt_identity()))
    foto = request.files.get("foto")

    if not foto or foto.filename == "":
        return jsonify({"error": "No se recibió ninguna foto."}), 400
    if not extension_valida(foto.filename):
        return jsonify({"error": "La foto debe ser JPG, PNG o WEBP."}), 400

    # Borra la foto anterior para no ir acumulando archivos huérfanos.
    if usuario.foto_url:
        ruta_anterior = os.path.join(current_app.static_folder, usuario.foto_url)
        if os.path.isfile(ruta_anterior):
            os.remove(ruta_anterior)

    carpeta = os.path.join(current_app.static_folder, "uploads", "perfiles")
    usuario.foto_url = guardar_foto(foto, carpeta)

    db.session.commit()
    return jsonify(usuario.to_dict()), 200


@usuarios_bp.get("/empresas")
@requiere_rol("admin")
def listar_empresas():
    # Cuenta los puntos con un LEFT JOIN + GROUP BY en la BD (una sola
    # consulta) en vez de una consulta por empresa.
    filas = (
        db.session.query(Usuario, func.count(PuntoReciclaje.id))
        .outerjoin(PuntoReciclaje, PuntoReciclaje.creado_por == Usuario.id)
        .filter(Usuario.rol == "empresa")
        .group_by(Usuario.id)
        .order_by(Usuario.nombre)
        .all()
    )
    return jsonify([{**u.to_dict(), "num_puntos": n} for u, n in filas]), 200


@usuarios_bp.patch("/<int:id_usuario>/verificada")
@requiere_rol("admin")
def cambiar_verificada(id_usuario):
    usuario = Usuario.query.get_or_404(id_usuario)
    if usuario.rol != "empresa":
        return jsonify({"error": "Solo las empresas pueden tener el sello."}), 400

    datos = request.get_json(silent=True) or {}
    usuario.verificada = bool(datos.get("verificada"))
    db.session.commit()
    return jsonify(usuario.to_dict()), 200
