"""
src/coordinates.py
Converts between WGS-84 Geodetic Coordinates (Lat, Lon, Alt) and Flat-Earth ENU.
"""
import numpy as np

REF_LAT = 28.6139
REF_LON = 77.2090
REF_ALT = 100.0
EARTH_RADIUS = 6378137.0  # WGS-84 Earth Radius in meters

def geodetic_to_enu(lat: float, lon: float, alt: float) -> np.ndarray:
    d_lat = np.radians(lat - REF_LAT)
    d_lon = np.radians(lon - REF_LON)
    x = EARTH_RADIUS * d_lon * np.cos(np.radians(REF_LAT))
    y = EARTH_RADIUS * d_lat
    z = alt - REF_ALT
    return np.array([x, y, z], dtype=np.float64)

def enu_to_geodetic(x: float, y: float, z: float) -> tuple[float, float, float]:
    lat = REF_LAT + np.degrees(y / EARTH_RADIUS)
    lon = REF_LON + np.degrees(x / (EARTH_RADIUS * np.cos(np.radians(REF_LAT))))
    alt = REF_ALT + z
    return round(float(lat), 6), round(float(lon), 6), round(float(alt), 1)