"""Instancias compartidas de extensiones de Flask.

Se crean aquí (sin la app) para evitar imports circulares entre
app.py, models y routes.
"""
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_cors import CORS

db = SQLAlchemy()
jwt = JWTManager()
cors = CORS()
