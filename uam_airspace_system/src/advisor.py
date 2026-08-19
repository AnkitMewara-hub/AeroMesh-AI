"""
src/advisor.py
ML-Driven Cooperative Avoidance Engine with Hysteresis Stability.
"""
import os
import joblib
import math
import numpy as np
import pandas as pd
from typing import Dict, Any
from src.kinematics import AutonomousTaxi, calculate_cpa

class CooperativeAvoidanceSystem:
    def __init__(self, model_path: str = "models/collision_model.pkl"):
        if os.path.exists(model_path):
            self.model = joblib.load(model_path)
        else:
            self.model = None

        self.resolutions = [
            (-20.0, 0.0, 0.0, "Decelerate -20 km/h (Yield Right-of-Way)"),
            (-15.0, +20.0, 0.0, "Brake -15 km/h + Turn Right 20°"),
            (-15.0, -20.0, 0.0, "Brake -15 km/h + Turn Left 20°"),
            (+15.0, 0.0, 0.0, "Accelerate +15 km/h (Clear Ahead)"),
            (0.0, +25.0, 0.0, "Maintain Speed + Turn Right 25°"),
            (0.0, -25.0, 0.0, "Maintain Speed + Turn Left 25°"),
            (-10.0, 0.0, +20.0, "Brake -10 km/h + Climb +20m"),
            (-10.0, 0.0, -20.0, "Brake -10 km/h + Descend -20m"),
        ]

    def evaluate_pair(self, own: AutonomousTaxi, intruder: AutonomousTaxi) -> Dict[str, Any]:
        if own.arrived or intruder.arrived:
            return {"risk_level": 0, "action": None}

        dr = intruder.pos - own.pos
        dv = intruder.vel - own.vel
        dist_3d = float(np.linalg.norm(dr))
        dist_2d = float(np.linalg.norm(dr[:2]))
        alt_diff = float(abs(intruder.pos[2] - own.pos[2]))
        rel_speed = float(np.linalg.norm(dv))

        # Strict Divergence Filtering: If moving away and past 45m, CLEAR
        if np.dot(dr, dv) > 0 and dist_3d > 45.0:
            return {"risk_level": 0, "action": None}

        heading_diff = float(np.degrees(abs(own.heading - intruder.heading)) % 360)
        if heading_diff > 180:
            heading_diff = 360 - heading_diff

        t_cpa, d_min = calculate_cpa(own.pos, own.vel, intruder.pos, intruder.vel, lookahead=10.0)
        bearing = float(np.degrees(math.atan2(dr[0], dr[1])) % 360)

        if self.model:
            feat_df = pd.DataFrame([{
                "rel_distance_2d": dist_2d,
                "rel_alt": alt_diff,
                "rel_speed": rel_speed,
                "heading_diff": heading_diff,
                "time_to_cpa": t_cpa,
                "d_min_predicted": d_min,
                "alt_rate_diff": abs(own.vertical_speed - intruder.vertical_speed),
                "own_speed": own.current_speed * 3.6,
                "intruder_speed": intruder.current_speed * 3.6,
                "bearing_angle": bearing
            }])
            risk = int(self.model.predict(feat_df)[0])
        else:
            risk = 2 if (0 < t_cpa <= 8.0 and d_min < 35.0) else 0

        if t_cpa <= 0 or d_min >= 40.0:
            risk = 0

        if risk == 2:
            best_action = None
            best_clearance = -1.0

            for d_spd, d_yaw, d_alt, desc in self.resolutions:
                cand_speed = np.clip(own.current_speed + (d_spd / 3.6), 5.0, 30.0)
                cand_heading = own.heading + math.radians(d_yaw)
                cand_vz = own.vertical_speed + (d_alt / 4.0)
                cand_vel = np.array([cand_speed * math.sin(cand_heading), cand_speed * math.cos(cand_heading), cand_vz])

                cand_dv = intruder.vel - cand_vel
                cand_dv_sq = np.dot(cand_dv, cand_dv)
                cand_t = np.clip(-np.dot(dr, cand_dv) / (cand_dv_sq + 1e-6), 0.0, 10.0)
                cand_sep = np.linalg.norm(dr + cand_dv * cand_t)

                if cand_sep > best_clearance:
                    best_clearance = cand_sep
                    best_action = {
                        "delta_spd_kmh": d_spd,
                        "delta_yaw_deg": d_yaw,
                        "delta_alt_m": d_alt,
                        "description": desc,
                        "projected_clearance": round(cand_sep, 1),
                        "time_to_cpa": round(t_cpa, 1),
                        "intruder_id": intruder.id
                    }

            return {"risk_level": 2, "action": best_action}
        
        return {"risk_level": 0, "action": None}