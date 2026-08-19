"""
app.py
FastAPI WebServer streaming autonomous multi-agent simulation via WebSocket.
Configured for both Local development and Render Cloud deployment.
"""
import os
import sys
import asyncio
from pathlib import Path

# Add project root directory to Python Path
PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

# Auto-train ML model on first run if missing
model_file = os.path.join(PROJECT_ROOT, "models", "collision_model.pkl")
if not os.path.exists(model_file):
    print("Training XGBoost collision model...")
    from src.train_model import train_and_export
    train_and_export()

from src.simulator import AutonomousAirspaceSimulator

app = FastAPI(title="AeroMesh AI - Autonomous Airspace System")

# Mount Static and Templates
app.mount("/static", StaticFiles(directory=os.path.join(PROJECT_ROOT, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(PROJECT_ROOT, "templates"))

simulator = AutonomousAirspaceSimulator()

@app.get("/", response_class=HTMLResponse)
async def serve_dashboard(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")

@app.websocket("/ws")
async def websocket_stream(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            try:
                msg = await asyncio.wait_for(websocket.receive_json(), timeout=0.01)
                if msg.get("action") == "RESET":
                    simulator.reset()
            except asyncio.TimeoutError:
                pass

            payload = simulator.step(dt=0.05)
            await websocket.send_json(payload)
            await asyncio.sleep(0.05)
    except WebSocketDisconnect:
        pass

if __name__ == "__main__":
    import uvicorn
    # Dynamically pick PORT assigned by Render, defaults to 8000 for local testing
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)