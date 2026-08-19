"""
src/obstacles.py
Non-cooperative dynamic obstacles (Wildlife Birds).
"""
import numpy as np
from src.coordinates import enu_to_geodetic

class BirdObstacle:
    def __init__(self, bird_id: str, start_pos: list, speed_kmh: float = 24.0):
        self.id = bird_id
        self.pos = np.array(start_pos, dtype=np.float64)
        self.speed = speed_kmh / 3.6  # m/s
        self.heading = np.random.uniform(0, 2 * np.pi)
        self.vertical_speed = 0.0
        self.status = "WILDLIFE"

    @property
    def vel(self) -> np.ndarray:
        vx = self.speed * np.sin(self.heading)
        vy = self.speed * np.cos(self.heading)
        return np.array([vx, vy, self.vertical_speed], dtype=np.float64)

    def step(self, dt: float):
        # Soft drift without erratic rapid spins
        self.heading += np.random.uniform(-0.06, 0.06)
        self.pos += self.vel * dt

        # Wrap-around boundary
        if np.linalg.norm(self.pos[:2]) > 280.0:
            self.heading += np.pi

    def to_dict(self):
        lat, lon, alt = enu_to_geodetic(*self.pos)
        return {
            "id": self.id,
            "x": round(float(self.pos[0]), 2),
            "y": round(float(self.pos[1]), 2),
            "z": round(float(self.pos[2]), 2),
            "lat": lat,
            "lon": lon,
            "alt": alt,
            "speed_kmh": round(self.speed * 3.6, 1),
            "status": self.status
        }