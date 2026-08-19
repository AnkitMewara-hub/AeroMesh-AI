const canvas = document.getElementById("radarCanvas");
const wrapper = document.getElementById("canvasWrapper");
const ctx = canvas.getContext("2d");

let SCALE = 1.0;
let rotorAngle = 0;
let birdWingAngle = 0;

function resizeCanvas() {
  if (!wrapper || !canvas) return;
  const rect = wrapper.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  
  // Calculate dynamic scale based on screen size (250m radius fit)
  const minDim = Math.min(rect.width, rect.height);
  SCALE = (minDim / 2) / 270; 
}

window.addEventListener("resize", resizeCanvas);
setTimeout(resizeCanvas, 50);

const COLOR_PALETTE = {
  Taxi_Alpha: "#10B981",    // Green
  Taxi_Bravo: "#0284C7",    // Blue
  Taxi_Charlie: "#8B5CF6",  // Violet
  Taxi_Delta: "#F59E0B"     // Amber
};

const DEST_NAMES = {
  Taxi_Alpha: "North Port",
  Taxi_Bravo: "West Pier",
  Taxi_Charlie: "East Term",
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

// ---------------- RESPONSIVE RADAR RENDERER ----------------
function drawRadar(data) {
  if (!canvas || !ctx || !wrapper) return;

  const rect = wrapper.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const centerX = width / 2;
  const centerY = height / 2;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);

  rotorAngle = (rotorAngle + 0.35) % (2 * Math.PI);
  birdWingAngle = (birdWingAngle + 0.25) % (2 * Math.PI);

  // 1. Distance Rings
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1.2;
  [100, 200].forEach((r) => {
    ctx.beginPath();
    ctx.arc(centerX, centerY, r * SCALE, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.fillStyle = "#94A3B8";
    ctx.font = "bold 9px sans-serif";
    ctx.fillText(`${r}m`, centerX + 4, centerY - r * SCALE + 11);
  });

  // Crosshairs
  ctx.strokeStyle = "#F1F5F9";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(centerX, 0); ctx.lineTo(centerX, height);
  ctx.moveTo(0, centerY); ctx.lineTo(width, centerY);
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
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
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
      const wingY = Math.sin(birdWingAngle) * 4;

      ctx.strokeStyle = "#DC2626";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(bx - 7, by - wingY);
      ctx.quadraticCurveTo(bx - 2, by, bx, by + 2);
      ctx.quadraticCurveTo(bx + 2, by, bx + 7, by - wingY);
      ctx.stroke();

      ctx.fillStyle = "#DC2626";
      ctx.beginPath();
      ctx.arc(bx, by + 1, 2, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = "#B91C1C";
      ctx.font = "bold 8px sans-serif";
      ctx.fillText(`🦅 ${bird.id}`, bx + 8, by + 3);
    });
  }

  // 4. Draw Vertiports
  data.aircraft.forEach((craft) => {
    const color = COLOR_PALETTE[craft.id] || "#64748B";
    const tx = centerX + (craft.id === "Taxi_Alpha" ? 0 : craft.id === "Taxi_Bravo" ? -250 : craft.id === "Taxi_Charlie" ? 240 : -180) * SCALE;
    const ty = centerY - (craft.id === "Taxi_Alpha" ? 250 : craft.id === "Taxi_Bravo" ? 0 : craft.id === "Taxi_Charlie" ? 60 : -200) * SCALE;
    const sx = centerX + craft.x * SCALE;
    const sy = centerY - craft.y * SCALE;

    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "#CBD5E1";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = color;
    ctx.fillStyle = "#F8FAFC";
    ctx.lineWidth = 1.5;
    ctx.fillRect(tx - 10, ty - 10, 20, 20);
    ctx.strokeRect(tx - 10, ty - 10, 20, 20);
    
    ctx.fillStyle = color;
    ctx.font = "bold 10px sans-serif";
    ctx.fillText("H", tx - 4, ty + 3.5);

    ctx.fillStyle = "#64748B";
    ctx.font = "bold 8px sans-serif";
    ctx.fillText(DEST_NAMES[craft.id], tx - 18, ty + 18);
  });

  // 5. Draw Drones
  data.aircraft.forEach((craft) => {
    const sx = centerX + craft.x * SCALE;
    const sy = centerY - craft.y * SCALE;
    const color = COLOR_PALETTE[craft.id] || "#0284C7";
    const isConflict = craft.status === "AVOIDING";
    const rad = (craft.heading_deg * Math.PI) / 180;

    const vx = Math.sin(rad) * (craft.speed_kmh / 3.6) * 4.0 * SCALE;
    const vy = -Math.cos(rad) * (craft.speed_kmh / 3.6) * 4.0 * SCALE;

    ctx.strokeStyle = isConflict ? "#EF4444" : color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + vx, sy + vy);
    ctx.stroke();

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(rad);

    ctx.fillStyle = isConflict ? "#EF4444" : color;
    ctx.beginPath();
    ctx.roundRect(-4, -10, 8, 20, [3, 3, 2, 2]);
    ctx.fill();

    ctx.strokeStyle = "#64748B";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-11, -7); ctx.lineTo(11, 7);
    ctx.moveTo(11, -7); ctx.lineTo(-11, 7);
    ctx.stroke();

    [[-11, -7], [11, -7], [-11, 7], [11, 7]].forEach(([rx, ry]) => {
      ctx.strokeStyle = isConflict ? "#F87171" : "#475569";
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.arc(rx, ry, 4, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(rx - 4 * Math.cos(rotorAngle), ry - 4 * Math.sin(rotorAngle));
      ctx.lineTo(rx + 4 * Math.cos(rotorAngle), ry + 4 * Math.sin(rotorAngle));
      ctx.stroke();
    });

    ctx.restore();

    ctx.fillStyle = isConflict ? "#DC2626" : "#0F172A";
    ctx.font = "bold 10px sans-serif";
    ctx.fillText(`${craft.id.replace('Taxi_', 'T_')}`, sx + 14, sy - 2);
    
    ctx.font = "700 9px 'JetBrains Mono', monospace";
    ctx.fillStyle = isConflict ? "#DC2626" : "#0284C7";
    ctx.fillText(`${craft.speed_kmh}k`, sx + 14, sy + 9);
  });
}

// ---------------- MOBILE COMPACT UI UPDATER ----------------
function updateUI(data) {
  const arrived = data.aircraft.filter((c) => c.arrived).length;
  const arrivedEl = document.getElementById("arrivedCount");
  if (arrivedEl && arrivedEl.innerText !== `${arrived} of ${data.aircraft.length} Landed`) {
    arrivedEl.innerText = `${arrived} of ${data.aircraft.length} Landed`;
  }

  const airspaceBadge = document.getElementById("airspaceBadge");
  const badgeText = document.getElementById("badgeText");
  const conflictsDiv = document.getElementById("conflictsList");

  const hasConflict = (data.conflicts && data.conflicts.length > 0) || data.aircraft.some(c => c.status === "AVOIDING");

  if (hasConflict) {
    if (airspaceBadge && airspaceBadge.dataset.state !== "conflict") {
      airspaceBadge.dataset.state = "conflict";
      airspaceBadge.className = "bg-rose-50 border border-rose-200 text-rose-700 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1.5";
      if (badgeText) badgeText.innerText = "Conflict Active";
    }

    if (conflictsDiv && data.conflicts.length > 0) {
      conflictsDiv.innerHTML = data.conflicts.map((c) => `
        <div class="bg-rose-50 border border-rose-200 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl text-[11px] space-y-1 shadow-sm">
          <div class="flex justify-between items-center font-bold text-rose-700">
            <span>⚠️ ${c.agent_a} ⟷ ${c.agent_b}</span>
            <span class="bg-rose-200 px-1.5 py-0.5 rounded text-rose-900 font-mono font-bold text-[10px]">${c.ttc}s</span>
          </div>
          <p class="text-slate-700 text-[10px] sm:text-[11px] truncate">
            <strong>Action:</strong> ${c.maneuver}
          </p>
        </div>
      `).join("");
    }
  } else {
    if (airspaceBadge && airspaceBadge.dataset.state !== "safe") {
      airspaceBadge.dataset.state = "safe";
      airspaceBadge.className = "bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1.5";
      if (badgeText) badgeText.innerText = "Safe";
      
      if (conflictsDiv) {
        conflictsDiv.innerHTML = `
          <div class="bg-emerald-50 border border-emerald-200 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl text-xs shadow-sm flex items-center justify-between">
            <span class="font-bold text-emerald-800 text-[11px] sm:text-xs">✓ Airspace Clear</span>
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
        ? '<span class="bg-indigo-100 text-indigo-800 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md">LANDED ✅</span>'
        : isConflict
        ? '<span class="bg-rose-100 text-rose-800 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md">AVOIDING ⚠️</span>'
        : '<span class="bg-emerald-100 text-emerald-800 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md">CRUISING ✈️</span>';

      const action = craft.action_details;

      return `
        <div class="bg-white p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border ${isConflict ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'} shadow-sm taxi-card">
          <div class="flex justify-between items-center mb-1">
            <div class="flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${COLOR_PALETTE[craft.id]}"></span>
              <span class="font-bold text-xs sm:text-sm text-slate-900">${craft.id}</span>
            </div>
            ${statusBadge}
          </div>
          
          <div class="grid grid-cols-3 gap-1 text-[10px] sm:text-[11px] text-slate-600 bg-slate-50 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-slate-100 mb-1 font-mono">
            <div><span class="text-slate-400 font-sans">Spd:</span> <strong class="text-slate-900">${craft.speed_kmh}k</strong></div>
            <div><span class="text-slate-400 font-sans">Alt:</span> <strong class="text-slate-900">${craft.alt}m</strong></div>
            <div><span class="text-slate-400 font-sans">Hdg:</span> <strong class="text-slate-900">${craft.heading_deg}°</strong></div>
          </div>

          <div class="text-[10px] sm:text-[11px] pt-0.5 flex justify-between items-center">
            ${isConflict && action ? `
              <span class="text-rose-700 font-bold truncate">⚡ ${action.turn} | ${action.speed}</span>
            ` : `
              <span class="text-slate-400 text-[10px]">Dest: ${DEST_NAMES[craft.id]}</span>
              <span class="text-emerald-600 font-bold text-[9px]">On Track</span>
            `}
          </div>
        </div>
      `;
    }).join("");
  }
}