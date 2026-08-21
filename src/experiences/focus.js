import { createSceneTransition } from "../core/transitions.js";

const formatTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export function mountFocus(root, ctx) {
  let raf = null; let stopActive = null; let committed = false; let starting = false; const scenes = createSceneTransition(root, ctx.reduceMotion);
  const devChoice = new URLSearchParams(location.search).get("dev") === "1" ? `<label class="choice-chip"><input type="radio" name="focus-duration" value="10"><span>Test · 10 sec</span></label>` : "";
  root.innerHTML = `<section class="room"><p class="room__eyebrow">Focus room</p><h1>Hold one clear intention.</h1><p class="room__lead">Choose a gentle boundary. The room will keep time so you do not have to.</p><input class="field intention-field" id="focus-intention" maxlength="120" placeholder="What are you giving attention to?" aria-label="Focus intention"><div class="room__controls"><label class="choice-chip"><input type="radio" name="focus-duration" value="900" ${ctx.defaults?.duration === 900 ? "checked" : ""}><span>Soft · 15 min</span></label><label class="choice-chip"><input type="radio" name="focus-duration" value="1500" ${ctx.defaults?.duration !== 900 ? "checked" : ""}><span>Deep · 25 min</span></label><label class="choice-chip"><input type="radio" name="focus-duration" value="3000"><span>Immersive · 50 min</span></label>${devChoice}</div><div class="room__controls"><label class="choice-chip"><input type="radio" name="focus-sound" value="silence" checked><span>Silence</span></label><label class="choice-chip"><input type="radio" name="focus-sound" value="ambient"><span>Warm hum</span></label><label class="choice-chip"><input type="radio" name="focus-sound" value="rain"><span>Rain</span></label><label class="choice-chip"><input type="radio" name="focus-sound" value="forest"><span>Forest</span></label></div><label class="choice-chip"><input type="checkbox" id="hide-clock"><span>Hide the clock</span></label><div class="room-spacer"></div><button class="button button--primary" data-action="start">Enter focus</button><p class="room-note">Space pauses · M cycles sound · Escape leaves the room</p></section>`;
  const intentionInput = root.querySelector("#focus-intention"); intentionInput.value = ctx.defaults?.intention || ""; intentionInput.focus();
  root.querySelector("[data-action=start]").addEventListener("click", start);
  intentionInput.addEventListener("keydown", (event) => { if (event.key === "Enter") start(); });

  async function start() {
    if (starting) return; starting = true;
    const intention = intentionInput.value.trim() || "Be here now"; const total = Number(root.querySelector("[name=focus-duration]:checked")?.value || 1500); const hideClock = root.querySelector("#hide-clock").checked;
    const sound = root.querySelector("[name=focus-sound]:checked")?.value || "silence"; Object.keys(ctx.audio.channels).forEach((key) => ctx.audio.setLevel(key, key === sound ? (key === "ambient" ? 24 : 35) : 0)); if (sound !== "silence") ctx.audio.play();
    const scene = await scenes.swap(`<section class="focus-active"><p class="focus-intention"></p><div class="focus-visual" aria-hidden="true"><svg class="focus-visual__line" viewBox="0 0 1000 230" preserveAspectRatio="none"><path></path></svg></div><div class="focus-time ${hideClock ? "is-hidden" : ""}" aria-live="polite"></div><div class="focus-actions"><button class="button button--quiet" data-action="pause">Pause</button><button class="button button--quiet" data-action="end">Finish early</button></div></section>`);
    if (!scene) return; starting = false; let elapsed = 0; let last = performance.now(); let paused = false; let ending = false; const startedISO = new Date().toISOString();
    scene.querySelector(".focus-intention").textContent = intention; const timeEl = scene.querySelector(".focus-time"); const path = scene.querySelector("path"); const pauseButton = scene.querySelector("[data-action=pause]");
    const draw = (now) => { if (!paused) elapsed += Math.max(0, (now - last) / 1000); last = now; const progress = Math.min(1, elapsed / total); const amplitude = 26 * (1 - progress) + 2; let d = "M 0 115"; for (let x = 0; x <= 1000; x += 25) { const y = 115 + Math.sin(x / 95 + now / 1400) * amplitude * Math.sin(Math.PI * x / 1000); d += ` L ${x} ${y.toFixed(1)}`; } path.setAttribute("d", d); timeEl.textContent = hideClock ? `${Math.round(progress * 100)}% settled` : formatTime(Math.max(0, total - elapsed)); if (progress >= 1 && !ending) { ending = true; finish("Complete"); return; } raf = requestAnimationFrame(draw); };
    const togglePause = () => { paused = !paused; last = performance.now(); pauseButton.textContent = paused ? "Resume" : "Pause"; timeEl.textContent = paused ? "Paused" : timeEl.textContent; if (paused) ctx.audio.pause(); else if (sound !== "silence") ctx.audio.play(); };
    const keydown = (event) => { if (event.code === "Space") { event.preventDefault(); togglePause(); } if (event.key.toLowerCase() === "m") ctx.audio.toggle(); };
    pauseButton.addEventListener("click", togglePause); scene.querySelector("[data-action=end]").addEventListener("click", () => finish("Ended gently")); document.addEventListener("keydown", keydown);
    const onVisibility = () => { if (document.hidden && !paused) togglePause(); }; document.addEventListener("visibilitychange", onVisibility);
    stopActive = () => { cancelAnimationFrame(raf); document.removeEventListener("keydown", keydown); document.removeEventListener("visibilitychange", onVisibility); };
    raf = requestAnimationFrame(draw);

    async function finish(reason) {
      if (ending && reason !== "Complete") return; ending = true; stopActive?.(); const actual = Math.max(1, Math.round(elapsed));
      const resultScene = await scenes.swap(`<section class="room room-result"><div class="room-result__mark">○</div><p class="room__eyebrow">${reason}</p><h2>How did this moment feel?</h2><p class="room__lead">There is no wrong answer. This is only a small note to your future self.</p><div class="focus-ended-options"><button class="button button--quiet" data-feeling="Focused">Focused</button><button class="button button--quiet" data-feeling="Present">Present</button><button class="button button--quiet" data-feeling="Restless">Restless</button></div></section>`);
      if (!resultScene) return;
      resultScene.querySelectorAll("[data-feeling]").forEach((button) => button.addEventListener("click", () => saveResult(button.dataset.feeling, actual, intention, startedISO, reason)));
      resultScene.querySelector("[data-feeling]").focus({ preventScroll: true });
    }
  }

  async function saveResult(feeling, durationSeconds, intention, startedAt, reason) {
    if (!committed) { committed = true; ctx.commit({ type: "focus", startedAt, durationSeconds, label: intention, detail: feeling, meta: { feeling, reason } }); ctx.chime(); }
    const timeGiven = durationSeconds < 60 ? `${durationSeconds} quiet seconds` : `${Math.round(durationSeconds / 60)} quiet minute${durationSeconds >= 90 ? "s" : ""}`;
    const scene = await scenes.swap(`<section class="room room-result"><div class="room-result__mark">✦</div><p class="room__eyebrow">A new bloom</p><h2>You gave ${timeGiven}.</h2><p class="room__lead">The garden remembers the showing up, not the outcome.</p><button class="button button--primary" data-action="done">${ctx.concludeLabel}</button></section>`);
    if (!scene) return; scene.querySelector("[data-action=done]").addEventListener("click", ctx.conclude); scene.querySelector("[data-action=done]").focus({ preventScroll: true });
  }
  return () => { scenes.cancel(); cancelAnimationFrame(raf); stopActive?.(); ctx.audio.fadeOut(); };
}
