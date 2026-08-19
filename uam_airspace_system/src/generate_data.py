"""
src/generate_data.py
Generates 100,000 synthetic multi-angle encounters for XGBoost model.
"""
import os
import numpy as np
import pandas as pd

def generate_encounters(n_samples: int = 100000, output_file: str = "data/dataset.csv"):
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    np.random.seed(42)
    rows = []

    for _ in range(n_samples):
        v1_kmh = np.random.uniform(40.0, 100.0)
        v1 = v1_kmh / 3.6
        psi1 = np.random.uniform(0, 2 * np.pi)
        vz1 = np.random.uniform(-2.0, 2.0)
        p1 = np.array([0.0, 0.0, np.random.uniform(80.0, 200.0)])
        vel1 = np.array([v1 * np.sin(psi1), v1 * np.cos(psi1), vz1])

        dist_2d = np.random.uniform(20.0, 450.0)
        bearing = np.random.uniform(0, 2 * np.pi)
        p2 = np.array([
            dist_2d * np.sin(bearing),
            dist_2d * np.cos(bearing),
            p1[2] + np.random.uniform(-35.0, 35.0)
        ])
        v2_kmh = np.random.uniform(40.0, 100.0)
        v2 = v2_kmh / 3.6
        psi2 = np.random.uniform(0, 2 * np.pi)
        vz2 = np.random.uniform(-2.0, 2.0)
        vel2 = np.array([v2 * np.sin(psi2), v2 * np.cos(psi2), vz2])

        dr = p2 - p1
        dv = vel2 - vel1
        dv_sq = np.dot(dv, dv)
        
        if dv_sq < 1e-6:
            t_cpa = 0.0
            d_min = np.linalg.norm(dr)
        else:
            t_cpa = float(np.clip(-np.dot(dr, dv) / dv_sq, 0.0, 20.0))
            d_min = float(np.linalg.norm(dr + dv * t_cpa))

        rel_speed = float(np.linalg.norm(dv))
        heading_diff = float(np.degrees(abs(psi1 - psi2)) % 360)
        if heading_diff > 180:
            heading_diff = 360 - heading_diff

        if t_cpa > 0 and t_cpa <= 10.0 and d_min < 35.0:
            label = 2
        elif t_cpa > 0 and t_cpa <= 15.0 and d_min < 60.0:
            label = 1
        else:
            label = 0

        rows.append({
            "rel_distance_2d": round(dist_2d, 2),
            "rel_alt": round(abs(p2[2] - p1[2]), 2),
            "rel_speed": round(rel_speed, 2),
            "heading_diff": round(heading_diff, 1),
            "time_to_cpa": round(t_cpa, 2),
            "d_min_predicted": round(d_min, 2),
            "alt_rate_diff": round(abs(vz1 - vz2), 2),
            "own_speed": round(v1_kmh, 1),
            "intruder_speed": round(v2_kmh, 1),
            "bearing_angle": round(float(np.degrees(bearing) % 360), 1),
            "collision_risk": label
        })

    df = pd.DataFrame(rows)
    df.to_csv(output_file, index=False)
    print(f"Generated dataset with {len(df)} samples.")

if __name__ == "__main__":
    generate_encounters()