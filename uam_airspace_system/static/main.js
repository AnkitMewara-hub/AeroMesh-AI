const canvas = document.getElementById("radarCanvas");
const ctx = canvas.getContext("2d");

const SCALE = 1.02;
let rotorAngle = 0;
let birdWingAngle = 0;

const COLOR_PALETTE = {
  Taxi_Alpha: "#10B981",    // Green
  Taxi_Bravo: "#0284C7",    // Blue
  Taxi_Charlie: "#8B5CF6",  // Violet
  Taxi_Delta: "#F59E0B"     // Amber
};

const DEST_NAMES = {
  Taxi_Alpha: "North Vertiport",
  Taxi_Bravo: "West Pier",
  Taxi_Charlie: "East Terminal",
  Taxi_Delta: "South Hub"
};

const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    if (data && data.aircraft) {
      drawRadar(data);
      updateUI(data);
    }
  } catch (err) {
    console.error("Parse error:", err);
  }
};

document.getElementById("btnReset").onclick = () => sendReset();
document.addEventListener("keydown", (e) => {
  if (e.key === "r" || e.key === "R") sendReset();
});

function sendReset() {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ action: "RESET" }));
  }
}

// ---------------- CANVAS RADAR RENDERER ----------------
function drawRadar(data) {
  if (!canvas || !ctx) return;

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  rotorAngle = (rotorAngle + 0.35) % (2 * Math.PI);
  birdWingAngle = (birdWingAngle + 0.25) % (2 * Math.PI);

  // 1. Distance Rings
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1.5;
  [100, 200].forEach((r) => {
    ctx.beginPath();
    ctx.arc(centerX, centerY, r * SCALE, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.fillStyle = "#94A3B8";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText(`${r}m`, centerX + 8, centerY - r * SCALE + 14);
  });

  // Crosshairs
  ctx.strokeStyle = "#F1F5F9";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX, 0); ctx.lineTo(centerX, canvas.height);
  ctx.moveTo(0, centerY); ctx.lineTo(canvas.width, centerY);
  ctx.stroke();

  // 2. Red Danger Line (Active conflict only)
  if (data.conflicts && data.conflicts.length > 0) {
    data.conflicts.forEach((c) => {
      const a = data.aircraft.find((t) => t.id === c.agent_a);
      let bx = 0, by = 0, foundB = false;

      const bDrone = data.aircraft.find((t) => t.id === c.agent_b);
      if (bDrone) {
        bx = centerX + bDrone.x * SCALE;
        by = centerY - bDrone.y * SCALE;
        foundB = true;
      } else if (data.birds) {
        const bBird = data.birds.find((b) => c.agent_b.includes(b.id));
        if (bBird) {
          bx = centerX + bBird.x * SCALE;
          by = centerY - bBird.y * SCALE;
          foundB = true;
        }
      }

      if (a && foundB) {
        const ax = centerX + a.x * SCALE;
        const ay = centerY - a.y * SCALE;

        ctx.strokeStyle = "#EF4444";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  }

  // 3. Draw Wildlife Birds
  if (data.birds) {
    data.birds.forEach((bird) => {
      const bx = centerX + bird.x * SCALE;
      const by = centerY - bird.y * SCALE;
      const wingY = Math.sin(birdWingAngle) * 5;

      ctx.strokeStyle = "#DC2626";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx - 9, by - wingY);
      ctx.quadraticCurveTo(bx - 3, by, bx, by + 2);
      ctx.quadraticCurveTo(bx + 3, by, bx + 9, by - wingY);
      ctx.stroke();

      ctx.fillStyle = "#DC2626";
      ctx.beginPath();
      ctx.arc(bx, by + 1, 2.5, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = "#B91C1C";
      ctx.font = "bold 9px sans-serif";
      ctx.fillText(`🦅 ${bird.id}`, bx + 10, by + 3);
    });
  }

  // 4. Draw Vertiports
  data.aircraft.forEach((craft) => {
    const color = COLOR_PALETTE[craft.id] || "#64748B";
    const tx = centerX + (craft.id === "Taxi_Alpha" ? 0 : craft.id === "Taxi_Bravo" ? -250 : craft.id === "Taxi_Charlie" ? 240 : -180) * SCALE;
    const ty = centerY - (craft.id === "Taxi_Alpha" ? 250 : craft.id === "Taxi_Bravo" ? 0 : craft.id === "Taxi_Charlie" ? 60 : -200) * SCALE;
    const sx = centerX + craft.x * SCALE;
    const sy = centerY - craft.y * SCALE;

    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "#CBD5E1";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = color;
    ctx.fillStyle = "#F8FAFC";
    ctx.lineWidth = 2;
    ctx.fillRect(tx - 12, ty - 12, 24, 24);
    ctx.strokeRect(tx - 12, ty - 12, 24, 24);
    
    ctx.fillStyle = color;
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("H", tx - 4.5, ty + 4.5);

    ctx.fillStyle = "#64748B";
    ctx.font = "bold 10px sans-serif";
    ctx.fillText(DEST_NAMES[craft.id], tx - 25, ty + 24);
  });

  // 5. Draw Drones
  data.aircraft.forEach((craft) => {
    const sx = centerX + craft.x * SCALE;
    const sy = centerY - craft.y * SCALE;
    const color = COLOR_PALETTE[craft.id] || "#0284C7";
    const isConflict = craft.status === "AVOIDING";
    const rad = (craft.heading_deg * Math.PI) / 180;

    const vx = Math.sin(rad) * (craft.speed_kmh / 3.6) * 5.0 * SCALE;
    const vy = -Math.cos(rad) * (craft.speed_kmh / 3.6) * 5.0 * SCALE;

    ctx.strokeStyle = isConflict ? "#EF4444" : color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + vx, sy + vy);
    ctx.stroke();

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(rad);

    ctx.fillStyle = isConflict ? "#EF4444" : color;
    ctx.beginPath();
    ctx.roundRect(-5, -12, 10, 24, [4, 4, 2, 2]);
    ctx.fill();

    ctx.strokeStyle = "#64748B";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-13, -8); ctx.lineTo(13, 8);
    ctx.moveTo(13, -8); ctx.lineTo(-13, 8);
    ctx.stroke();

    [[-13, -8], [13, -8], [-13, 8], [13, 8]].forEach(([rx, ry]) => {
      ctx.strokeStyle = isConflict ? "#F87171" : "#475569";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(rx, ry, 5, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(rx - 5 * Math.cos(rotorAngle), ry - 5 * Math.sin(rotorAngle));
      ctx.lineTo(rx + 5 * Math.cos(rotorAngle), ry + 5 * Math.sin(rotorAngle));
      ctx.stroke();
    });

    ctx.restore();

    ctx.fillStyle = isConflict ? "#DC2626" : "#0F172A";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(`${craft.id}`, sx + 18, sy - 3);
    
    ctx.font = "700 10px 'JetBrains Mono', monospace";
    ctx.fillStyle = isConflict ? "#DC2626" : "#0284C7";
    ctx.fillText(`${craft.speed_kmh} km/h`, sx + 18, sy + 11);
  });
}

// ---------------- STABLE NO-FUMBLE UI UPDATER ----------------
function updateUI(data) {
  const arrived = data.aircraft.filter((c) => c.arrived).length;
  const arrivedEl = document.getElementById("arrivedCount");
  if (arrivedEl && arrivedEl.innerText !== `${arrived} of ${data.aircraft.length} Landed`) {
    arrivedEl.innerText = `${arrived} of ${data.aircraft.length} Landed`;
  }

  const airspaceBadge = document.getElementById("airspaceBadge");
  const conflictsDiv = document.getElementById("conflictsList");

  const hasConflict = (data.conflicts && data.conflicts.length > 0) || data.aircraft.some(c => c.status === "AVOIDING");

  if (hasConflict) {
    if (airspaceBadge.dataset.state !== "conflict") {
      airspaceBadge.dataset.state = "conflict";
      airspaceBadge.className = "bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2";
      airspaceBadge.innerHTML = `<span class="h-2 w-2 rounded-full bg-rose-500 animate-ping"></span> AI Resolving Conflict`;
    }

    if (conflictsDiv && data.conflicts.length > 0) {
      conflictsDiv.innerHTML = data.conflicts.map((c) => `
        <div class="bg-rose-50 border border-rose-200 p-3 rounded-2xl text-xs space-y-1 shadow-sm">
          <div class="flex justify-between items-center font-bold text-rose-700">
            <span>⚠️ ${c.agent_a} ⟷ ${c.agent_b}</span>
            <span class="bg-rose-200 px-2 py-0.5 rounded text-rose-900 font-mono">${c.ttc}s</span>
          </div>
          <p class="text-slate-700 text-[11px] truncate">
            <strong>Action:</strong> ${c.maneuver}
          </p>
        </div>
      `).join("");
    }
  } else {
    if (airspaceBadge.dataset.state !== "safe") {
      airspaceBadge.dataset.state = "safe";
      airspaceBadge.className = "bg-emerald-50 border border-emerald-200 text-emerald-700 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2";
      airspaceBadge.innerHTML = `<span class="h-2 w-2 rounded-full bg-emerald-500"></span> Airspace Safe (No Conflict)`;
      
      if (conflictsDiv) {
        conflictsDiv.innerHTML = `
          <div class="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl text-xs shadow-sm flex items-center justify-between">
            <span class="font-bold text-emerald-800">✓ Airspace Clear</span>
            <span class="text-[10px] text-emerald-600 font-semibold">Corridors Nominal</span>
          </div>
        `;
      }
    }
  }

  // Render Fleet Telemetry Cards
  const fleetDiv = document.getElementById("fleetContainer");
  if (fleetDiv) {
    fleetDiv.innerHTML = data.aircraft.map((craft) => {
      const isConflict = craft.status === "AVOIDING";
      const statusBadge = craft.arrived
        ? '<span class="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-md">LANDED ✅</span>'
        : isConflict
        ? '<span class="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-md">AVOIDING ⚠️</span>'
        : '<span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md">CRUISING ✈️</span>';

      const action = craft.action_details;

      return `
        <div class="bg-white p-3 rounded-2xl border ${isConflict ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'} shadow-sm taxi-card">
          <div class="flex justify-between items-center mb-1.5">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full" style="background-color: ${COLOR_PALETTE[craft.id]}"></span>
              <span class="font-bold text-sm text-slate-900">${craft.id}</span>
            </div>
            ${statusBadge}
          </div>
          
          <div class="grid grid-cols-3 gap-1 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100 mb-1 font-mono">
            <div><span class="text-slate-400 font-sans">Spd:</span> <strong class="text-slate-900">${craft.speed_kmh}k</strong></div>
            <div><span class="text-slate-400 font-sans">Alt:</span> <strong class="text-slate-900">${craft.alt}m</strong></div>
            <div><span class="text-slate-400 font-sans">Hdg:</span> <strong class="text-slate-900">${craft.heading_deg}°</strong></div>
          </div>

          <div class="text-[11px] pt-1 flex justify-between items-center">
            ${isConflict && action ? `
              <span class="text-rose-700 font-bold truncate">⚡ ${action.turn} | ${action.speed}</span>
              <span class="text-[10px] text-rose-500 font-semibold font-mono">vs ${action.against}</span>
            ` : `
              <span class="text-slate-400">Target: ${DEST_NAMES[craft.id]}</span>
              <span class="text-emerald-600 font-bold text-[10px]">On Track</span>
            `}
          </div>
        </div>
      `;
    }).join("");
  }
}