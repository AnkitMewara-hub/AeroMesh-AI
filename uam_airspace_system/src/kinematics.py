"""
src/kinematics.py
Autonomous Flying Taxi Agent with Dynamic Throttle & 2.0s Minimum Avoidance Lock.
"""
import numpy as np
import math
from typing import Optional, Dict, Any
from src.coordinates import enu_to_geodetic

class AutonomousTaxi:
    def __init__(self, taxi_id: str, start_pos: list, target_dest: list, cruise_speed_kmh: float = 60.0):
        self.id: str = taxi_id
        self.pos: np.ndarray = np.array(start_pos, dtype=np.float64)
        self.target: np.ndarray = np.array(target_dest, dtype=np.float64)
        self.cruise_speed: float = cruise_speed_kmh / 3.6  # m/s
        self.current_speed: float = self.cruise_speed
        
        delta = self.target[:2] - self.pos[:2]
        self.heading: float = math.atan2(delta[0], delta[1])
        self.vertical_speed: float = 0.0
        
        self.arrived: bool = False
        self.status: str = "CRUISING"
        self.trail: list = []
        self.current_action: Optional[Dict[str, Any]] = None
        self.avoidance_timer: float = 0.0

    @property
    def vel(self) -> np.ndarray:
        vx = self.current_speed * math.sin(self.heading)
        vy = self.current_speed * math.cos(self.heading)
        return np.array([vx, vy, self.vertical_speed], dtype=np.float64)

    def navigate_towards_goal(self, dt: float):
        if self.arrived:
            return

        to_target = self.target - self.pos
        dist_to_goal = np.linalg.norm(to_target[:2])
        
        # Arrival check (15m radius buffer)
        if dist_to_goal < 15.0:
            self.arrived = True
            self.status = "ARRIVED"
            self.current_speed = 0.0
            self.vertical_speed = 0.0
            self.current_action = None
            return

        goal_heading = math.atan2(to_target[0], to_target[1])
        heading_diff = (goal_heading - self.heading + np.pi) % (2 * np.pi) - np.pi

        # If locked in avoidance timer, prevent instant flip back to cruising
        if self.avoidance_timer > 0:
            self.avoidance_timer -= dt
            self.status = "AVOIDING"
            self.heading += np.clip(heading_diff, -math.radians(18) * dt, math.radians(18) * dt)
        else:
            self.status = "CRUISING"
            self.current_action = None
            self.heading += np.clip(heading_diff, -math.radians(45) * dt, math.radians(45) * dt)
            
            # Altitude correction toward target
            alt_diff = self.target[2] - self.pos[2]
            self.vertical_speed = float(np.clip(alt_diff * 0.5, -2.0, 2.0))
            
            # Smoothly restore cruise speed
            if self.current_speed < self.cruise_speed:
                self.current_speed = min(self.cruise_speed, self.current_speed + 3.5 * dt)
            elif self.current_speed > self.cruise_speed:
                self.current_speed = max(self.cruise_speed, self.current_speed - 3.5 * dt)

    def trigger_avoidance(self, d_yaw_deg: float, d_spd_kmh: float, d_alt_m: float, action_dict: dict, dt: float):
        self.avoidance_timer = 2.0  # 2.0-second solid avoidance lock
        self.status = "AVOIDING"
        self.current_action = action_dict
        
        # 1. Dynamic Speed Throttling
        target_speed = (self.cruise_speed * 3.6) + d_spd_kmh
        target_speed_ms = np.clip(target_speed / 3.6, 4.0, 28.0)
        self.current_speed += (target_speed_ms - self.current_speed) * dt * 4.0

        # 2. Heading Offset (Gentle rate)
        self.heading += math.radians(d_yaw_deg) * dt * 1.2

        # 3. Vertical Step
        self.pos[2] += d_alt_m * dt * 0.4

    def step(self, dt: float):
        if not self.arrived:
            self.pos += self.vel * dt
            self.trail.append((float(self.pos[0]), float(self.pos[1])))
            if len(self.trail) > 16:
                self.trail.pop(0)

    def to_dict(self) -> Dict[str, Any]:
        lat, lon, alt = enu_to_geodetic(*self.pos)
        t_lat, t_lon, t_alt = enu_to_geodetic(*self.target)
        return {
            "id": self.id,
            "x": round(float(self.pos[0]), 2),
            "y": round(float(self.pos[1]), 2),
            "z": round(float(self.pos[2]), 2),
            "lat": lat,
            "lon": lon,
            "alt": alt,
            "target_lat": t_lat,
            "target_lon": t_lon,
            "speed_kmh": round(self.current_speed * 3.6, 1),
            "heading_deg": round(math.degrees(self.heading) % 360, 1),
            "status": self.status,
            "arrived": self.arrived,
            "action_details": self.current_action
        }

def calculate_cpa(pos1: np.ndarray, vel1: np.ndarray, pos2: np.ndarray, vel2: np.ndarray, lookahead: float = 12.0):
    dr = pos2 - pos1
    dv = vel2 - vel1
    dv_sq = np.dot(dv, dv)
    if dv_sq < 1e-6:
        return 0.0, float(np.linalg.norm(dr))
    
    t_cpa = -np.dot(dr, dv) / dv_sq
    if t_cpa < 0 or t_cpa > lookahead:
        return 0.0, float(np.linalg.norm(dr))
    
    d_min = float(np.linalg.norm(dr + dv * t_cpa))
    return float(t_cpa), d_min