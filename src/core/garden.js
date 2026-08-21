function hash(value) { let h = 2166136261; for (const char of String(value)) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let value = seed || 1; return () => { value |= 0; value = value + 0x6D2B79F5 | 0; let t = Math.imul(value ^ value >>> 15, 1 | value); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function fitCanvas(canvas) {
  const rect = canvas.getBoundingClientRect(); const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * dpr)); canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return { ctx, width: rect.width, height: rect.height };
}
function stem(ctx, x, ground, height, sway, color) { ctx.beginPath(); ctx.moveTo(x, ground); ctx.quadraticCurveTo(x + sway, ground - height * .55, x + sway * .35, ground - height); ctx.strokeStyle = color; ctx.lineWidth = 1.1; ctx.stroke(); return { x: x + sway * .35, y: ground - height }; }
function leaf(ctx, x, y, size, side, color) { ctx.save(); ctx.translate(x, y); ctx.rotate(side * .55); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(side * size, -size * .55, side * size * 1.25, -size * 1.7); ctx.quadraticCurveTo(side * size * .15, -size * 1.25, 0, 0); ctx.fillStyle = color; ctx.fill(); ctx.restore(); }
function flower(ctx, x, y, size, random) { const colors = ["#91bba9", "#d2b984", "#c2948c", "#9bb6b0"]; const color = colors[Math.floor(random() * colors.length)]; for (let i = 0; i < 6; i++) { ctx.save(); ctx.translate(x, y); ctx.rotate(i * Math.PI / 3); ctx.beginPath(); ctx.ellipse(0, -size * .55, size * .24, size * .63, 0, 0, Math.PI * 2); ctx.fillStyle = `${color}bb`; ctx.fill(); ctx.restore(); } ctx.beginPath(); ctx.arc(x, y, size * .19, 0, Math.PI * 2); ctx.fillStyle = "#dac691"; ctx.fill(); }
function firefly(ctx, x, y, size) { const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 5); glow.addColorStop(0, "rgba(225,199,139,.85)"); glow.addColorStop(1, "rgba(225,199,139,0)"); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, size * 5, 0, Math.PI * 2); ctx.fill(); }

export function gardenLevel(count) { if (count === 0) return "A quiet seed"; if (count < 4) return "First shoots"; if (count < 10) return "Tender clearing"; if (count < 24) return "Growing grove"; if (count < 50) return "Serene garden"; return "A living sanctuary"; }

export function drawGarden(canvas, state, { preview = false } = {}) {
  if (!canvas?.isConnected) return;
  const { ctx, width, height } = fitCanvas(canvas); if (!width || !height) return;
  const sessions = state.sessions.filter((item) => !item.meta?.aggregate).slice(preview ? -24 : -80); const random = rng(state.garden.seed);
  ctx.clearRect(0, 0, width, height);
  const sky = ctx.createLinearGradient(0, 0, 0, height); sky.addColorStop(0, "rgba(78,116,103,.08)"); sky.addColorStop(1, "rgba(3,9,8,.1)"); ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 32; i++) { ctx.globalAlpha = random() * .22; ctx.fillStyle = "#dce8df"; ctx.beginPath(); ctx.arc(random() * width, random() * height * .68, random() * 1.2, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1;
  const ground = height * (preview ? .78 : .82); ctx.beginPath(); ctx.moveTo(0, ground); ctx.quadraticCurveTo(width * .45, ground - 18, width, ground + 3); ctx.strokeStyle = "rgba(149,184,160,.16)"; ctx.stroke();
  if (!sessions.length) { const top = stem(ctx, width / 2, ground, Math.min(80, height * .2), 5, "rgba(149,184,160,.55)"); leaf(ctx, top.x, top.y + 25, 8, -1, "rgba(149,184,160,.45)"); return; }
  sessions.forEach((session, index) => {
    const local = rng(hash(session.id) ^ state.garden.seed); const lane = (index + .5) / sessions.length; const jitter = (local() - .5) * Math.min(55, width / sessions.length);
    const x = width * (.08 + lane * .84) + jitter; const baseHeight = Math.min(height * .37, 70 + (session.durationSeconds || 30) / 15) * (.7 + local() * .55); const sway = (local() - .5) * 38;
    if (session.type === "reflect") { firefly(ctx, x, ground - baseHeight * (1 + local()), 1.4 + local()); return; }
    if (session.type === "breathe") { for (let j = -1; j <= 1; j++) { const top = stem(ctx, x + j * 4, ground, baseHeight * (.7 + local() * .45), sway * .25, "rgba(143,207,192,.48)"); ctx.beginPath(); ctx.arc(top.x, top.y, 1.8, 0, Math.PI * 2); ctx.fillStyle = "rgba(143,207,192,.75)"; ctx.fill(); } return; }
    const top = stem(ctx, x, ground, baseHeight, sway, "rgba(120,158,137,.55)"); const leafCount = session.type === "typing" ? 3 + Math.floor(local() * 4) : 2;
    for (let j = 0; j < leafCount; j++) leaf(ctx, x + sway * (j / leafCount) * .3, ground - baseHeight * (.28 + j * .12), 5 + local() * 5, j % 2 ? 1 : -1, session.type === "typing" ? "rgba(216,189,137,.55)" : "rgba(119,164,141,.55)");
    if (session.type === "focus") flower(ctx, top.x, top.y, 7 + Math.min(8, (session.durationSeconds || 0) / 300), local);
  });
}

export function observeGarden(canvas, getState, options) {
  const render = () => drawGarden(canvas, getState(), options); const observer = new ResizeObserver(render); observer.observe(canvas); render(); return () => observer.disconnect();
}

