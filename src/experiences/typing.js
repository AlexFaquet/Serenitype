import { createSceneTransition } from "../core/transitions.js";

const PASSAGES = [
  "In the lavender fields at dawn, a solitary traveler walked along a mist-kissed path. Each breath hung like a soft whisper, and the dew-laden petals reflected the pastel sky.",
  "Beneath the ancient oak’s wide embrace, golden leaves drifted down like silent blessings. The forest floor seemed to pulse with the gentle heartbeat of centuries past.",
  "Along a tranquil mountain lake, the water mirrored snow-capped peaks and drifting clouds. A lone canoe glided in silence, its gentle ripple carrying the song of the wind.",
  "On a quiet city street at twilight, lanterns flickered awake. The cobblestones glistened from an earlier rain, and the air held stories behind each narrow doorway.",
  "In a seaside cove, waves whispered secrets to the shore. Foamy lace dissolved at the feet of weathered rocks while gulls wheeled overhead in sunlit arcs.",
  "Within an old library, dust motes floated through shafts of golden light. The scent of parchment and leather-bound books invited a quiet reverence for every story.",
  "Atop a rolling hill blanketed in wildflowers, bees hummed a gentle chorus. Each blossom swayed in time to an unseen breeze, as if the meadow itself breathed.",
  "Under a star-strewn sky, a small sailboat drifted on glassy water. The Milky Way arched overhead, and the hush of night wrapped the traveler in serene infinity.",
  "In a hidden garden behind ivy-covered gates, fountains murmured in secret rhythms. Lanterns hung like suspended dreams along winding stone paths.",
  "Inside a winter cabin warmed by a quiet hearth, snow softened the world outside. Each log’s glow cast dancing shadows that wove stories into the night.",
  "Attention is not a force to hold tightly. It is a place to return, kindly and as often as necessary, one clear movement following another.",
  "A lantern beside the path offered only enough light for the next few steps. The traveler smiled, breathed in the cool evening air, and found that it was plenty."
];

const THEMES = ["dawn", "forest", "ocean", "night", "dusk"];
const THEME_LABELS = { dawn: "Dawn", forest: "Forest", ocean: "Ocean", night: "Night", dusk: "Dusk" };
const THEME_BACKGROUNDS = {
  dawn: "linear-gradient(135deg,#6b4436 0%,#251f23 52%,#07131c 100%)",
  forest: "linear-gradient(135deg,#153f3b 0%,#285143 45%,#101b21 100%)",
  ocean: "linear-gradient(135deg,#1c5b68 0%,#254957 48%,#101925 100%)",
  night: "linear-gradient(135deg,#121e2c 0%,#172e3a 48%,#080c14 100%)",
  dusk: "linear-gradient(135deg,#554052 0%,#513836 48%,#181923 100%)"
};
const normalize = (value) => String(value).replaceAll("'", "’");

export function mountTyping(root, ctx) {
  let committed = false; let starting = false; let disposeStage = null; let disposeParticles = null; let themeFade = null; let transitionTimer = null; let themeIndex = 0;
  const scenes = createSceneTransition(root, ctx.reduceMotion);
  root.classList.add("typing-theme");
  applyTheme("dawn", false);
  showIntro({ initial: true });

  function applyTheme(theme, animate = true) {
    const currentTheme = THEMES[themeIndex] || "dawn";
    if (theme === currentTheme && root.classList.contains(`typing-theme--${theme}`)) return;
    themeFade?.remove();
    if (animate && !ctx.reduceMotion && root.childElementCount) {
      const fade = document.createElement("div");
      fade.className = "typing-theme-fade"; fade.style.background = THEME_BACKGROUNDS[currentTheme]; root.append(fade); themeFade = fade;
      requestAnimationFrame(() => fade.classList.add("is-fading"));
      fade.addEventListener("transitionend", () => { fade.remove(); if (themeFade === fade) themeFade = null; }, { once: true });
    }
    THEMES.forEach((name) => root.classList.remove(`typing-theme--${name}`));
    root.classList.add(`typing-theme--${theme}`); themeIndex = THEMES.indexOf(theme);
  }

  async function showIntro({ initial = false } = {}) {
    clearTimeout(transitionTimer); transitionTimer = null; disposeStage?.(); disposeStage = null; starting = false;
    const markup = `<section class="room typing-intro-room"><p class="room__eyebrow">Serenitype typing</p><h1>Let the words flow.</h1><p class="room__lead">A continuous line, a quiet atmosphere, and nothing to chase but the next character.</p><div class="typing-theme-picker" role="group" aria-label="Typing atmosphere">${THEMES.map((theme, index) => `<button class="typing-theme-choice${index === themeIndex ? " is-active" : ""}" data-theme="${theme}" type="button"><i aria-hidden="true"></i>${THEME_LABELS[theme]}</button>`).join("")}</div><div class="room__controls"><label class="choice-chip"><input type="radio" name="typing-length" value="short" checked><span>One passage</span></label><label class="choice-chip"><input type="radio" name="typing-length" value="long"><span>Two passages</span></label><label class="choice-chip"><input type="checkbox" id="typing-sound" checked><span>Ambient sound</span></label></div><button class="button button--primary" data-action="start">Enter the flow</button><p class="room-note">Space changes the atmosphere · Enter begins</p></section>`;
    let intro;
    if (initial || !root.querySelector(".typing-particles")) {
      scenes.cancel(); disposeParticles?.(); root.innerHTML = `<canvas class="typing-particles" aria-hidden="true"></canvas>${markup}`;
      disposeParticles = createParticles(root.querySelector(".typing-particles"), ctx.reduceMotion); intro = root.querySelector(".typing-intro-room");
    } else intro = await scenes.swap(markup);
    if (!intro) return;
    intro.querySelectorAll("[data-theme]").forEach((button) => button.addEventListener("click", () => { applyTheme(button.dataset.theme); intro.querySelectorAll("[data-theme]").forEach((item) => item.classList.toggle("is-active", item === button)); }));
    const startButton = intro.querySelector("[data-action=start]"); startButton.addEventListener("click", start); startButton.focus({ preventScroll: true });
    const onIntroKey = (event) => {
      if (event.code === "Space") { event.preventDefault(); themeIndex = (themeIndex + 1) % THEMES.length; applyTheme(THEMES[themeIndex]); intro.querySelectorAll("[data-theme]").forEach((item) => item.classList.toggle("is-active", item.dataset.theme === THEMES[themeIndex])); }
      if (event.key === "Enter" && event.target.tagName !== "BUTTON") start();
    };
    document.addEventListener("keydown", onIntroKey);
    disposeStage = () => document.removeEventListener("keydown", onIntroKey);
  }

  async function start() {
    if (starting) return; starting = true;
    const isLong = root.querySelector("[name=typing-length]:checked")?.value === "long";
    const soundOn = root.querySelector("#typing-sound")?.checked;
    disposeStage?.(); disposeStage = null;
    let passage = PASSAGES[Math.floor(Math.random() * PASSAGES.length)];
    if (isLong) { let second = passage; while (second === passage) second = PASSAGES[Math.floor(Math.random() * PASSAGES.length)]; passage = `${passage} ${second}`; }
    if (soundOn) { Object.keys(ctx.audio.channels).forEach((key) => ctx.audio.setLevel(key, key === "ambient" ? 24 : 0)); ctx.audio.play(); }

    const scene = await scenes.swap(`<section class="typing-flow-room"><div class="typing-flow-hud"><span>${THEME_LABELS[THEMES[themeIndex]]}</span><span>Keep a gentle rhythm</span></div><div class="typing-flow-window" title="Tap to restore keyboard focus"><div class="typing-flow-track"><div class="typing-flow-passage" aria-label="Typing passage"></div></div></div><label><span class="sr-only">Type the flowing passage</span><textarea class="typing-input" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Type the displayed passage"></textarea></label><div class="typing-flow-live" aria-live="polite"><span><b data-wpm>—</b><small>WPM</small></span><span><b data-accuracy>100</b><small>Accuracy</small></span><span><b data-progress>0%</b><small>Flow</small></span></div></section>`);
    if (!scene) return; starting = false;
    const track = scene.querySelector(".typing-flow-track"); const passageEl = scene.querySelector(".typing-flow-passage"); const input = scene.querySelector(".typing-input");
    const wpmEl = scene.querySelector("[data-wpm]"); const accuracyEl = scene.querySelector("[data-accuracy]"); const progressEl = scene.querySelector("[data-progress]");
    const chars = [...passage].map((char) => { const span = document.createElement("span"); span.textContent = char; passageEl.append(span); return span; });
    let index = 0; let attempts = 0; let correctAttempts = 0; let startedAt = null; let wrongTimer = null; let finished = false;

    const chase = () => {
      const current = chars[Math.min(index, chars.length - 1)]; if (!current) return;
      const offset = Math.max(current.offsetLeft - innerWidth * .25, 0); track.style.transform = `translate3d(${-offset}px,0,0)`;
    };
    const paint = () => {
      chars.forEach((span, charIndex) => { span.classList.toggle("is-correct", charIndex < index); span.classList.toggle("is-current", charIndex === index); });
      chase();
    };
    const updateStats = () => {
      const seconds = startedAt ? (performance.now() - startedAt) / 1000 : 0; const accuracy = attempts ? Math.round(correctAttempts / attempts * 100) : 100;
      const wpm = seconds >= 2.1 && index >= 8 ? Math.round((index / 5) / (seconds / 60)) : null;
      wpmEl.textContent = wpm ?? "—"; accuracyEl.textContent = accuracy; progressEl.textContent = `${Math.round(index / passage.length * 100)}%`;
      return { accuracy, wpm: wpm || 0 };
    };
    const flashWrong = () => { const current = chars[index]; if (!current) return; clearTimeout(wrongTimer); current.classList.add("is-wrong"); wrongTimer = setTimeout(() => current.classList.remove("is-wrong"), 180); };
    const onInput = () => {
      if (finished) return; const incoming = normalize(input.value); const accepted = normalize(passage.slice(0, index));
      if (incoming.length < index) { index = incoming.length; paint(); updateStats(); return; }
      const inserted = incoming.slice(index); if (!inserted) return;
      if (!startedAt) startedAt = performance.now();
      let acceptedCount = 0;
      for (const char of inserted) { attempts += 1; if (normalize(char) !== normalize(passage[index + acceptedCount])) break; correctAttempts += 1; acceptedCount += 1; }
      if (acceptedCount !== inserted.length) { flashWrong(); input.value = passage.slice(0, index); input.setSelectionRange(input.value.length, input.value.length); updateStats(); return; }
      index += acceptedCount; paint(); const stats = updateStats();
      if (index >= passage.length) { finished = true; finish({ passage, accuracy: stats.accuracy, startedAt }); }
    };
    const restoreFocus = () => input.focus({ preventScroll: true });
    const preventPaste = (event) => event.preventDefault();
    input.addEventListener("input", onInput); input.addEventListener("paste", preventPaste); scene.querySelector(".typing-flow-window").addEventListener("click", restoreFocus);
    addEventListener("resize", chase); input.focus({ preventScroll: true }); requestAnimationFrame(() => { track.classList.add("is-ready"); paint(); });
    disposeStage = () => { clearTimeout(wrongTimer); input.removeEventListener("input", onInput); input.removeEventListener("paste", preventPaste); removeEventListener("resize", chase); };
  }

  function finish(result) {
    disposeStage?.(); disposeStage = null; const durationSeconds = Math.max(1, Math.round((performance.now() - result.startedAt) / 1000));
    const finalWpm = Math.round((result.passage.length / 5) / (durationSeconds / 60));
    if (!committed) { committed = true; ctx.commit({ type: "typing", durationSeconds, label: "Flowing typing", detail: `${finalWpm} WPM · ${result.accuracy}% accuracy`, meta: { wpm: finalWpm, accuracy: result.accuracy, characters: result.passage.length } }); ctx.chime(); }
    const flow = root.querySelector(".typing-flow-room"); flow?.classList.add("is-leaving");
    transitionTimer = setTimeout(() => {
      const resultView = document.createElement("section");
      resultView.className = "room room-result typing-result";
      resultView.innerHTML = `<div class="room-result__mark">Aa</div><p class="room__eyebrow">Flow complete</p><h2>You moved with the words.</h2><p class="room__lead">This moment has opened a new leaf in your garden.</p><div class="result-stats"><span class="result-stat"><strong>${finalWpm}</strong><small>WPM</small></span><span class="result-stat"><strong>${result.accuracy}%</strong><small>Accuracy</small></span><span class="result-stat"><strong>${durationSeconds}s</strong><small>Time</small></span></div><button class="button button--primary" data-action="done">${ctx.concludeLabel}</button><button class="button button--quiet" data-action="again">Flow again</button>`;
      if (flow?.isConnected) flow.replaceWith(resultView); else root.append(resultView);
      requestAnimationFrame(() => requestAnimationFrame(() => resultView.classList.add("is-visible")));
      resultView.querySelector("[data-action=done]").addEventListener("click", ctx.conclude);
      resultView.querySelector("[data-action=again]").addEventListener("click", () => { committed = false; showIntro(); });
      resultView.querySelector("[data-action=done]").focus({ preventScroll: true });
      transitionTimer = null;
    }, ctx.reduceMotion ? 0 : 680);
  }

  return () => {
    scenes.cancel(); clearTimeout(transitionTimer); themeFade?.remove(); disposeStage?.(); disposeParticles?.(); ctx.audio.fadeOut();
    root.classList.remove("typing-theme", ...THEMES.map((theme) => `typing-theme--${theme}`));
  };
}

function createParticles(canvas, reducedMotion) {
  if (!canvas) return () => {};
  const context = canvas.getContext("2d"); let frame = null; let particles = []; let active = true;
  const resize = () => {
    const rect = canvas.getBoundingClientRect(); const dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = Math.max(1, rect.width * dpr); canvas.height = Math.max(1, rect.height * dpr); context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = reducedMotion ? 35 : Math.min(125, Math.round(rect.width * rect.height / 10500));
    particles = Array.from({ length: count }, () => ({ x: Math.random() * rect.width, y: Math.random() * rect.height, radius: .5 + Math.random() * 2.2, speed: .08 + Math.random() * .32, alpha: .05 + Math.random() * .18 }));
  };
  const draw = () => {
    const rect = canvas.getBoundingClientRect(); context.clearRect(0, 0, rect.width, rect.height);
    particles.forEach((particle) => { context.beginPath(); context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2); context.fillStyle = `rgba(238,245,238,${particle.alpha})`; context.fill(); if (!reducedMotion) { particle.y -= particle.speed; if (particle.y < -4) { particle.y = rect.height + 4; particle.x = Math.random() * rect.width; } } });
    if (!reducedMotion && active) frame = requestAnimationFrame(draw);
  };
  resize(); draw(); addEventListener("resize", resize);
  return () => { active = false; cancelAnimationFrame(frame); removeEventListener("resize", resize); };
}
