import { createSceneTransition } from "../core/transitions.js";

const PATTERNS = {
  coherent: { label: "Coherent", phases: [["Breathe in", 5, 0, 1], ["Breathe out", 5, 1, 0]] },
  box: { label: "Box", phases: [["Breathe in", 4, 0, 1], ["Hold softly", 4, 1, 1], ["Breathe out", 4, 1, 0], ["Rest", 4, 0, 0]] },
  unwind: { label: "Unwind", phases: [["Breathe in", 4, 0, 1], ["Breathe out", 6, 1, 0]] }
};

export function mountBreathe(root, ctx) {
  let raf = null; let committed = false; let starting = false; let ending = false; const scenes = createSceneTransition(root, ctx.reduceMotion);
  const devChoice = new URLSearchParams(location.search).get("dev") === "1" ? `<label class="choice-chip"><input type="radio" name="breath-duration" value="15"><span>Test · 15 sec</span></label>` : "";
  root.innerHTML = `<section class="room"><p class="room__eyebrow">Breath room</p><h1>Return to this breath.</h1><p class="room__lead">Choose a rhythm. Keep every breath comfortable—smaller and softer is always welcome.</p><div class="room__controls"><label class="choice-chip"><input type="radio" name="breath-pattern" value="coherent" checked><span>Coherent · 5/5</span></label><label class="choice-chip"><input type="radio" name="breath-pattern" value="box"><span>Box · 4/4/4/4</span></label><label class="choice-chip"><input type="radio" name="breath-pattern" value="unwind"><span>Unwind · 4/6</span></label></div><div class="room__controls"><label class="choice-chip"><input type="radio" name="breath-duration" value="60" checked><span>One minute</span></label><label class="choice-chip"><input type="radio" name="breath-duration" value="180"><span>Three minutes</span></label><label class="choice-chip"><input type="radio" name="breath-duration" value="300"><span>Five minutes</span></label>${devChoice}</div><button class="button button--primary" data-action="start">Begin breathing</button><p class="room-note">Stop if you feel uncomfortable or light-headed.</p></section>`;
  root.querySelector("[data-action=start]").addEventListener("click", start); root.querySelector("[data-action=start]").focus();

  async function start() {
    if (starting) return; starting = true;
    const patternKey = root.querySelector("[name=breath-pattern]:checked").value; const pattern = PATTERNS[patternKey]; const duration = Number(root.querySelector("[name=breath-duration]:checked").value);
    const scene = await scenes.swap(`<section class="room"><p class="room__eyebrow">${pattern.label} breathing</p><div class="breath-stage"><div class="breath-orb"><div><span class="breath-phase">Arrive</span><span class="breath-count"></span></div></div></div><button class="button button--quiet" data-action="finish">Finish gently</button></section>`);
    if (!scene) return; starting = false; const startedAt = performance.now(); const startedISO = new Date().toISOString();
    const orb = scene.querySelector(".breath-orb"); const phaseEl = scene.querySelector(".breath-phase"); const countEl = scene.querySelector(".breath-count"); const cycleDuration = pattern.phases.reduce((sum, phase) => sum + phase[1], 0); let completedCycles = 0;
    const ease = (value) => value < .5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
    const draw = (now) => { const elapsed = (now - startedAt) / 1000; if (elapsed >= duration) { finish(duration, completedCycles, patternKey, startedISO); return; } let within = elapsed % cycleDuration; let phase = pattern.phases[0]; for (const candidate of pattern.phases) { if (within <= candidate[1]) { phase = candidate; break; } within -= candidate[1]; } const progress = Math.min(1, within / phase[1]); const scaleValue = phase[2] + (phase[3] - phase[2]) * ease(progress); orb.style.transform = `scale(${.72 + scaleValue * .52})`; phaseEl.textContent = phase[0]; countEl.textContent = `${Math.max(1, Math.ceil(phase[1] - within))} · ${Math.ceil(duration - elapsed)} seconds remain`; completedCycles = Math.floor(elapsed / cycleDuration); raf = requestAnimationFrame(draw); };
    scene.querySelector("[data-action=finish]").addEventListener("click", () => finish(Math.max(1, Math.round((performance.now() - startedAt) / 1000)), completedCycles, patternKey, startedISO)); raf = requestAnimationFrame(draw);
  }

  async function finish(durationSeconds, cycles, patternKey, startedAt) {
    if (ending) return; ending = true;
    cancelAnimationFrame(raf); if (!committed) { committed = true; ctx.commit({ type: "breathe", startedAt, durationSeconds, label: `${PATTERNS[patternKey].label} breathing`, detail: `${Math.max(1, cycles)} gentle cycle${cycles === 1 ? "" : "s"}`, meta: { pattern: patternKey, cycles } }); ctx.chime(); }
    const scene = await scenes.swap(`<section class="room room-result"><div class="room-result__mark">◌</div><p class="room__eyebrow">Breath complete</p><h2>Carry the quiet forward.</h2><p class="room__lead">A few steady breaths have become new reeds in your garden.</p><div class="result-stats"><span class="result-stat"><strong>${durationSeconds < 60 ? durationSeconds + "s" : Math.round(durationSeconds / 60)}</strong><small>${durationSeconds < 60 ? "Time" : "Minutes"}</small></span><span class="result-stat"><strong>${Math.max(1, cycles)}</strong><small>Cycles</small></span></div><button class="button button--primary" data-action="done">${ctx.concludeLabel}</button></section>`);
    if (!scene) return; scene.querySelector("[data-action=done]").addEventListener("click", ctx.conclude); scene.querySelector("[data-action=done]").focus({ preventScroll: true });
  }
  return () => { scenes.cancel(); cancelAnimationFrame(raf); };
}
