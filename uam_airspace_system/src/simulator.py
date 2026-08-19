"""
src/simulator.py
Coordinates multi-agent flight paths with straight-line bird passing and cooperative V2V.
"""
from src.kinematics import AutonomousTaxi
from src.obstacles import BirdObstacle
from src.advisor import CooperativeAvoidanceSystem
import numpy as np

class AutonomousAirspaceSimulator:
    def __init__(self):
        self.advisor = CooperativeAvoidanceSystem()
        self.reset()

    def reset(self):
        self.fleet = [
            AutonomousTaxi("Taxi_Alpha", start_pos=[0, -220, 120], target_dest=[0, 250, 120], cruise_speed_kmh=55),
            AutonomousTaxi("Taxi_Bravo", start_pos=[220, 0, 120], target_dest=[-250, 0, 120], cruise_speed_kmh=50),
            AutonomousTaxi("Taxi_Charlie", start_pos=[-240, 60, 120], target_dest=[240, 60, 120], cruise_speed_kmh=52),
            AutonomousTaxi("Taxi_Delta", start_pos=[180, 200, 130], target_dest=[-180, -200, 130], cruise_speed_kmh=48),
        ]
        self.birds = [
            BirdObstacle("Hawk_1", start_pos=[-80, -90, 120], speed_kmh=24),
            BirdObstacle("Flock_2", start_pos=[90, 80, 125], speed_kmh=26),
        ]
        self.active_conflicts = []

    def step(self, dt: float = 0.05):
        self.active_conflicts = []

        # 1. Update birds
        for bird in self.birds:
            bird.step(dt)

        # 2. Update aircraft goals
        for taxi in self.fleet:
            taxi.navigate_towards_goal(dt)

        engaged_agents = set()

        # 3. Bird Avoidance: NO CIRCLES. Only Decelerate + Climb over
        for taxi in self.fleet:
            if taxi.arrived:
                continue
            for bird in self.birds:
                dr = bird.pos - taxi.pos
                dist_3d = float(np.linalg.norm(dr))
                if dist_3d < 45.0:
                    self.active_conflicts.append({
                        "agent_a": taxi.id,
                        "agent_b": f"🦅 {bird.id}",
                        "maneuver": "Brake Throttle + Climb +18m (Bird Clearance)",
                        "ttc": round(dist_3d / max(1.5, taxi.current_speed), 1),
                        "clearance": round(dist_3d, 1)
                    })
                    engaged_agents.add(taxi.id)
                    action_bird = {
                        "turn": "Maintain Heading",
                        "speed": "-25 km/h (Decelerate)",
                        "alt": "+18m (Climb Step)",
                        "against": bird.id
                    }
                    taxi.trigger_avoidance(0.0, -25.0, +18.0, action_bird, dt)

        # 4. Pairwise V2V Taxi-to-Taxi Cooperative Deconfliction
        n = len(self.fleet)
        for i in range(n):
            taxi_a = self.fleet[i]
            if taxi_a.arrived or taxi_a.id in engaged_agents:
                continue

            for j in range(i + 1, n):
                taxi_b = self.fleet[j]
                if taxi_b.arrived or taxi_b.id in engaged_agents:
                    continue

                res = self.advisor.evaluate_pair(taxi_a, taxi_b)

                if res["risk_level"] == 2 and res["action"]:
                    act = res["action"]
                    self.active_conflicts.append({
                        "agent_a": taxi_a.id,
                        "agent_b": taxi_b.id,
                        "maneuver": act["description"],
                        "ttc": act["time_to_cpa"],
                        "clearance": act["projected_clearance"]
                    })

                    engaged_agents.add(taxi_a.id)
                    engaged_agents.add(taxi_b.id)

                    action_a = {
                        "turn": f"+{act['delta_yaw_deg']}° RIGHT" if act['delta_yaw_deg'] > 0 else f"{act['delta_yaw_deg']}° LEFT" if act['delta_yaw_deg'] < 0 else "Maintain",
                        "speed": f"{act['delta_spd_kmh']} km/h (Slow Down)",
                        "alt": f"+{act['delta_alt_m']}m" if act['delta_alt_m'] != 0 else "Level",
                        "against": taxi_b.id
                    }
                    action_b = {
                        "turn": f"-{act['delta_yaw_deg']*0.5:.0f}° OPPOSITE" if act['delta_yaw_deg'] != 0 else "Maintain",
                        "speed": "+15 km/h (Pass Ahead)",
                        "alt": f"-{act['delta_alt_m']*0.5:.0f}m" if act['delta_alt_m'] != 0 else "Level",
                        "against": taxi_a.id
                    }

                    taxi_a.trigger_avoidance(act['delta_yaw_deg'], act['delta_spd_kmh'], act['delta_alt_m'], action_a, dt)
                    taxi_b.trigger_avoidance(-act['delta_yaw_deg'] * 0.5, +15.0, -act['delta_alt_m'] * 0.5, action_b, dt)

        # 5. Position integration
        for taxi in self.fleet:
            if taxi.id not in engaged_agents and taxi.status != "ARRIVED":
                if taxi.avoidance_timer <= 0:
                    taxi.status = "CRUISING"
                    taxi.current_action = None
            taxi.step(dt)

        return {
            "aircraft": [t.to_dict() for t in self.fleet],
            "birds": [b.to_dict() for b in self.birds],
            "conflicts": self.active_conflicts,
            "all_arrived": all(t.arrived for t in self.fleet)
        }