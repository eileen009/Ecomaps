"""Cálculo de distancia entre coordenadas (fórmula de Haversine).

Se usa solo sobre el conjunto ya filtrado por caja delimitadora
(bounding box) en la consulta SQL — así se evita calcular la
distancia exacta de puntos que ya sabemos que están lejos
(código verde: menos trabajo por request).
"""
from math import radians, sin, cos, sqrt, atan2

RADIO_TIERRA_KM = 6371


def distancia_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return RADIO_TIERRA_KM * 2 * atan2(sqrt(a), sqrt(1 - a))
