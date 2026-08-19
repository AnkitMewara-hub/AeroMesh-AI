# 🛸 AeroMesh AI: Autonomous Urban Air Mobility (UAM) Airspace Deconfliction

> **Real-Time Cooperative Multi-Agent Collision Avoidance & Dynamic Wildlife Obstacle Evasion using Machine Learning (XGBoost) and 3D Kinematics.**

![AeroMesh AI Preview](https://raw.githubusercontent.com/your-username/aeromesh-ai/main/preview.gif)

## 📌 Overview
As the skies become crowded with electric vertical takeoff and landing (**eVTOL**) aircraft and autonomous air taxis, traditional Air Traffic Control (ATC) cannot scale to handle high-density 3D corridor routing. 

**AeroMesh AI** is an autonomous mission control engine that coordinates multi-agent airspace traffic, predicts potential near-mid-air collisions (NMAC) via **XGBoost ML**, and resolves conflicts cooperatively using asymmetric speed throttling, altitude stepping, and horizontal vectoring.

---

## 🚀 Key Features

- **⚡ Cooperative V2V Deconfliction:** Multi-agent pairwise trajectory sensing with Closest Point of Approach (CPA) calculation at 20 Hz.
- **🦅 Dynamic Wildlife & Obstacle Handling:** Non-cooperative wildlife (bird flock) detection with zero-spin altitude clearance maneuvers.
- **🏎️ Dynamic Speed Modulation:** Resolves bottleneck intersections via throttle control (yielding deceleration + acceleration clearance).
- **🛰️ Geodetic-to-ENU Conversion:** Accurate flat-earth WGS-84 coordinate projection anchored around urban vertiports.
- **📊 Enterprise Mission Control UI:** Built with TailwindCSS and HTML5 Canvas with zero-fumble debounced status tracking.

---

## 🛠️ Tech Stack

- **Backend:** Python 3.10+, FastAPI, WebSockets, NumPy, Pandas, Scikit-learn, XGBoost
- **Frontend:** Vanilla JS, HTML5 2D Canvas Engine, TailwindCSS
- **ML Pipeline:** Synthetic Multi-Angle 3D Encounter Generator (100,000 samples) + XGBoost Classifier

---

## ⚡ Quick Start

```bash
# 1. Clone the repository
git clone [https://github.com/your-username/aeromesh-ai.git](https://github.com/your-username/aeromesh-ai.git)
cd aeromesh-ai

# 2. Install dependencies
pip install -r requirements.txt

# 3. Launch Mission Control Server
python app.py
