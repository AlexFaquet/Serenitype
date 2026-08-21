import { createSceneTransition } from "../core/transitions.js";

const PROMPTS = ["What can you set down for now?", "What felt quietly meaningful today?", "Where did your attention feel most at home?", "What are you carrying that deserves a kinder voice?", "What would make tomorrow feel a little lighter?", "Name one thing that does not need to be solved tonight."];

export function mountReflect(root, ctx) {
  let mood = ""; let saving = false; const scenes = createSceneTransition(root, ctx.reduceMotion); const prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)]; const startedAt = performance.now();
  root.innerHTML = `<section class="room reflection-room"><p class="room__eyebrow">Private reflection</p><h1>A page with no audience.</h1><p class="reflection-prompt">${prompt}</p><textarea class="reflection-textarea" maxlength="5000" placeholder="Let the words arrive without editing them…" aria-label="Private reflection"></textarea><div class="reflection-bottom"><div class="mood-picker" aria-label="How do you feel?"><button class="mood-button" data-mood="Light" aria-label="Feeling light">☼</button><button class="mood-button" data-mood="Calm" aria-label="Feeling calm">~</button><button class="mood-button" data-mood="Tender" aria-label="Feeling tender">◡</button><button class="mood-button" data-mood="Heavy" aria-label="Feeling heavy">◒</button></div><button class="button button--primary" data-action="save">Close the page</button></div><p class="room-note">Stored privately in this browser unless you enable sync.</p></section>`;
  const textarea = root.querySelector("textarea"); textarea.focus(); root.querySelectorAll("[data-mood]").forEach((button) => button.addEventListener("click", () => { mood = button.dataset.mood; root.querySelectorAll("[data-mood]").forEach((item) => item.classList.toggle("is-selected", item === button)); })); root.querySelector("[data-action=save]").addEventListener("click", save);
  async function save() {
    if (saving) return; saving = true;
    const text = textarea.value.trim(); const durationSeconds = Math.max(1, Math.round((performance.now() - startedAt) / 1000));
    ctx.commit({ type: "reflect", durationSeconds, label: prompt, detail: mood || "A private reflection", meta: { prompt, mood, text } }); ctx.chime();
    const scene = await scenes.swap(`<section class="room room-result"><div class="room-result__mark">☾</div><p class="room__eyebrow">The page is closed</p><h2>Your words can rest here.</h2><p class="room__lead">A small light has appeared in your garden. You do not have to carry everything at once.</p><button class="button button--primary" data-action="done">${ctx.concludeLabel}</button></section>`);
    if (!scene) return; scene.querySelector("[data-action=done]").addEventListener("click", ctx.conclude); scene.querySelector("[data-action=done]").focus({ preventScroll: true });
  }
  return () => scenes.cancel();
}
