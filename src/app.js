import { SerenityStore, summarize, localDay } from "./core/store.js";
import { SerenityAPI } from "./core/api.js";
import { AudioMixer, playChime, unlockChime } from "./core/audio.js";
import { drawGarden, observeGarden, gardenLevel } from "./core/garden.js";
import { mountTyping } from "./experiences/typing.js";
import { mountFocus } from "./experiences/focus.js";
import { mountBreathe } from "./experiences/breathe.js";
import { mountReflect } from "./experiences/reflect.js";

const store = new SerenityStore();
const api = new SerenityAPI();
const audio = new AudioMixer(store.state.preferences.soundLevels);
const experiences = { typing: mountTyping, focus: mountFocus, breathe: mountBreathe, reflect: mountReflect };
const experienceNames = { typing: "Mindful Typing", focus: "Focus Room", breathe: "Breath Room", reflect: "Reflection" };

const shell = document.querySelector("#experience-shell");
const experienceRoot = document.querySelector("#experience-root");
const shellClose = document.querySelector("#experience-close");
const ritualProgress = document.querySelector("#ritual-progress");
let activeCleanup = null; let lastTrigger = null; let ritual = null; let syncTimer = null; let toastTimer = null;
let navigationTimer = null; let navigationToken = 0; let roomTransitionTimer = null; let roomTransitionToken = 0;

function toast(message) {
  const region = document.querySelector("#toast-region"); region.textContent = message; region.classList.add("is-visible");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => region.classList.remove("is-visible"), 2600);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function currentRoute() {
  const route = location.hash.replace(/^#/, "").split("?")[0]; return ["today", "garden", "journey", "sound"].includes(route) ? route : "today";
}

function navigate(route, { updateHash = true, initial = false } = {}) {
  const next = document.querySelector(`[data-view="${route}"]`) || document.querySelector("[data-view=today]");
  const current = document.querySelector("[data-view].is-active:not([hidden])"); const token = ++navigationToken; clearTimeout(navigationTimer);
  document.querySelectorAll("[data-route]").forEach((link) => { if (link.dataset.route === route) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current"); });
  if (updateHash && location.hash !== `#${route}`) history.pushState(null, "", `#${route}`);
  if (current === next && !initial) { current.classList.remove("is-leaving"); window.scrollTo({ top: 0, behavior: store.state.preferences.reduceMotion ? "auto" : "smooth" }); return; }
  if (route !== "sound" && audio.playing) { audio.fadeOut(); document.querySelector("#sound-master").textContent = "Play soundscape"; document.querySelector("#sound-orb").classList.remove("is-playing"); }
  const revealNext = () => {
    if (token !== navigationToken) return;
    document.querySelectorAll("[data-view]").forEach((view) => { const active = view === next; view.hidden = !active; view.classList.toggle("is-active", active); view.classList.remove("is-leaving", "is-entering"); });
    if (route === "garden") renderGardenPage(); if (route === "journey") renderJourney();
    window.scrollTo({ top: 0, behavior: "auto" });
    void next.offsetWidth; next.classList.add("is-entering");
    setTimeout(() => next.classList.remove("is-entering"), store.state.preferences.reduceMotion ? 0 : 950);
    navigationTimer = null;
  };
  if (current && current !== next && !store.state.preferences.reduceMotion) {
    current.classList.remove("is-entering"); current.classList.add("is-leaving");
    navigationTimer = setTimeout(revealNext, 400);
  } else revealNext();
}

function updateRitualProgress() {
  if (!ritual) { ritualProgress.hidden = true; ritualProgress.replaceChildren(); return; }
  ritualProgress.hidden = false; ritualProgress.replaceChildren(...ritual.steps.map((_, index) => { const marker = document.createElement("i"); marker.className = index < ritual.index ? "is-complete" : index === ritual.index ? "is-current" : ""; return marker; }));
}

function mountExperience(name, defaults) {
  experienceRoot.replaceChildren(); updateRitualProgress();
  const isLastRitualStep = ritual && ritual.index === ritual.steps.length - 1;
  const ctx = {
    audio, defaults, reduceMotion: store.state.preferences.reduceMotion,
    commit: (session) => { const record = store.addSession(session); renderAll(); scheduleSync(); return record; },
    chime: () => playChime(store.state.preferences.chimes),
    toast,
    concludeLabel: ritual ? (isLastRitualStep ? "Complete ritual" : "Continue ritual") : "Return to today",
    conclude: () => {
      if (ritual && ritual.index < ritual.steps.length - 1) { ritual.index += 1; const next = ritual.steps[ritual.index]; openExperience(next.name, { defaults: next.defaults }); }
      else {
        const completedRitual = Boolean(ritual); ritual = null;
        closeExperience({ onClosed: () => { if (completedRitual) { navigate("garden"); toast("Your ritual has taken root in the garden."); } } });
      }
    }
  };
  activeCleanup = experiences[name](experienceRoot, ctx) || null;
}

function openExperience(name, { trigger = document.activeElement, defaults = {} } = {}) {
  if (!experiences[name]) return;
  const wasOpen = !shell.hidden; const token = ++roomTransitionToken; clearTimeout(roomTransitionTimer);
  activeCleanup?.(); activeCleanup = null; audio.fadeOut(250);
  if (!wasOpen) {
    lastTrigger = trigger; shell.hidden = false; shell.setAttribute("aria-hidden", "false"); shell.classList.remove("is-closing");
    document.body.classList.add("has-overlay"); setBackgroundInert(true); mountExperience(name, defaults);
    shell.classList.remove("is-opening"); void shell.offsetWidth; shell.classList.add("is-opening");
    setTimeout(() => shell.classList.remove("is-opening"), store.state.preferences.reduceMotion ? 0 : 720);
    return;
  }
  experienceRoot.classList.remove("is-switching-in"); experienceRoot.classList.add("is-switching-out");
  roomTransitionTimer = setTimeout(() => {
    if (token !== roomTransitionToken) return;
    experienceRoot.classList.remove("is-switching-out"); mountExperience(name, defaults);
    experienceRoot.classList.add("is-switching-in");
    setTimeout(() => experienceRoot.classList.remove("is-switching-in"), store.state.preferences.reduceMotion ? 0 : 720);
    roomTransitionTimer = null;
  }, store.state.preferences.reduceMotion ? 0 : 380);
}

function closeExperience({ onClosed } = {}) {
  ++roomTransitionToken; clearTimeout(roomTransitionTimer); activeCleanup?.(); activeCleanup = null; ritual = null; audio.fadeOut(500); resetMixerLevels();
  experienceRoot.classList.remove("is-switching-in", "is-switching-out"); shell.classList.remove("is-opening"); shell.classList.add("is-closing");
  setTimeout(() => {
    shell.hidden = true; shell.setAttribute("aria-hidden", "true"); shell.classList.remove("is-closing"); experienceRoot.replaceChildren(); updateRitualProgress();
    document.body.classList.remove("has-overlay"); setBackgroundInert(false); lastTrigger?.focus?.(); onClosed?.();
  }, store.state.preferences.reduceMotion ? 0 : 460);
}

function setBackgroundInert(inert) {
  [document.querySelector("#site-header"), document.querySelector("#main"), document.querySelector(".site-footer")].forEach((region) => { region.inert = inert; if (inert) region.setAttribute("aria-hidden", "true"); else region.removeAttribute("aria-hidden"); });
}

function startRitual() {
  ritual = { index: 0, steps: [{ name: "breathe", defaults: { duration: 60 } }, { name: "typing", defaults: { length: "short" } }, { name: "focus", defaults: { duration: 900 } }] };
  openExperience("breathe", { trigger: document.querySelector("#begin-ritual"), defaults: ritual.steps[0].defaults });
}

function resetMixerLevels() { const saved = store.state.preferences.soundLevels; Object.entries(saved).forEach(([key, level]) => audio.setLevel(key, level)); }

function renderToday() {
  const state = store.state; const summary = summarize(state); const hour = new Date().getHours(); const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  document.querySelector("#day-label").textContent = state.profile.name ? `${greeting}, ${state.profile.name}` : `${greeting} · Your quiet corner`;
  document.querySelector("#stat-moments").textContent = summary.moments; document.querySelector("#stat-minutes").textContent = summary.minutes; document.querySelector("#stat-streak").textContent = summary.streak;
  document.querySelector("#garden-level-label").textContent = gardenLevel(summary.moments);
  const whispers = summary.moments === 0 ? "Your first quiet moment is waiting." : summary.streak >= 3 ? `You have returned ${summary.streak} days in a row—gently, not perfectly.` : summary.minutes >= 60 ? "You have made more than an hour of room for what matters." : "Showing up once is enough to change the shape of a day.";
  document.querySelector("#daily-whisper").textContent = whispers;
  drawGarden(document.querySelector("#garden-preview-canvas"), state, { preview: true });
}

function renderGardenPage() {
  const state = store.state; const sessions = state.sessions.filter((item) => !item.meta?.aggregate); const summary = summarize(state); const empty = document.querySelector("#garden-empty"); empty.hidden = sessions.length > 0;
  drawGarden(document.querySelector("#garden-canvas"), state);
  const created = new Date(state.createdAt); const ageDays = Math.max(1, Math.ceil((Date.now() - created) / 86400000)); document.querySelector("#garden-age").textContent = ageDays === 1 ? "Today" : `${ageDays} days`;
  document.querySelector("#garden-growth").textContent = gardenLevel(summary.moments); document.querySelector("#garden-last").textContent = sessions.length ? relativeTime(sessions.at(-1).endedAt) : "Not yet";
}

function relativeTime(value) {
  const seconds = Math.max(0, (Date.now() - new Date(value)) / 1000); if (seconds < 60) return "Just now"; if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`; if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`; const days = Math.floor(seconds / 86400); return days === 1 ? "Yesterday" : `${days} days ago`;
}

function renderJourney() {
  const state = store.state; const sessions = state.sessions.filter((item) => !item.meta?.aggregate); const counts = new Map(); sessions.forEach((item) => counts.set(localDay(item.endedAt), (counts.get(localDay(item.endedAt)) || 0) + 1));
  const grid = document.querySelector("#rhythm-grid"); grid.replaceChildren(); const start = new Date(); start.setHours(12, 0, 0, 0); start.setDate(start.getDate() - 83);
  for (let i = 0; i < 84; i++) { const date = new Date(start); date.setDate(start.getDate() + i); const count = counts.get(localDay(date)) || 0; const day = document.createElement("span"); day.className = "rhythm-day"; day.dataset.level = Math.min(4, count); day.title = `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}: ${count} moment${count === 1 ? "" : "s"}`; day.setAttribute("aria-label", day.title); grid.append(day); }
  document.querySelector("#journey-total").textContent = `${sessions.length} moment${sessions.length === 1 ? "" : "s"}`;
  const types = sessions.reduce((map, item) => map.set(item.type, (map.get(item.type) || 0) + 1), new Map()); const favorite = [...types].sort((a, b) => b[1] - a[1])[0];
  document.querySelector("#insight-title").textContent = sessions.length < 3 ? "“A rhythm begins with one return.”" : favorite ? `“You return most often through ${experienceNames[favorite[0]].toLowerCase()}.”` : "“Your attention has its own seasons.”";
  document.querySelector("#insight-copy").textContent = sessions.length < 3 ? "Let this record grow at the pace your life allows." : "This is an observation, never a target. Follow what feels restorative.";
  const list = document.querySelector("#history-list"); list.replaceChildren();
  if (!sessions.length) { list.innerHTML = `<p class="history-empty">Your completed moments will rest here.</p>`; return; }
  sessions.slice(-12).reverse().forEach((item) => { const row = document.createElement("article"); row.className = "history-item"; const glyph = { focus: "○", typing: "Aa", breathe: "◌", reflect: "☾" }[item.type] || "·"; row.innerHTML = `<span class="history-icon" aria-hidden="true">${glyph}</span><span class="history-copy"><strong>${escapeHTML(item.label)}</strong><small>${escapeHTML(experienceNames[item.type] || item.type)} · ${escapeHTML(item.detail)}</small></span><time class="history-time" datetime="${escapeHTML(item.endedAt)}">${relativeTime(item.endedAt)}</time>`; if (item.type === "reflect" && item.meta?.text) { row.classList.add("is-openable"); row.tabIndex = 0; row.setAttribute("role", "button"); row.setAttribute("aria-label", `Read reflection: ${item.label}`); const open = () => openReflection(item); row.addEventListener("click", open); row.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } }); } list.append(row); });
}

function openReflection(item) {
  const dialog = document.querySelector("#entry-dialog"); document.querySelector("#entry-title").textContent = item.label; document.querySelector("#entry-body").textContent = item.meta.text; document.querySelector("#entry-date").textContent = new Date(item.endedAt).toLocaleDateString(undefined, { weekday:"long", month:"long", day:"numeric" }); dialog.showModal();
}

function renderSoundMixer() {
  const mixer = document.querySelector("#sound-mixer"); mixer.replaceChildren();
  Object.entries(audio.channels).forEach(([key, channel]) => { const row = document.createElement("div"); row.className = "sound-channel"; row.innerHTML = `<label for="sound-${key}">${channel.label}</label><input id="sound-${key}" type="range" min="0" max="65" value="${audio.levels[key]}" aria-label="${channel.label} volume"><output>${audio.levels[key]}%</output>`; const input = row.querySelector("input"); const output = row.querySelector("output"); input.addEventListener("input", () => { audio.setLevel(key, input.value); output.value = `${input.value}%`; store.update((draft) => { draft.preferences.soundLevels[key] = Number(input.value); }); if (audio.playing && Number(input.value) > 0) audio.play(); }); mixer.append(row); });
}

function renderAll() { applyPreferences(); renderToday(); if (!document.querySelector("#view-garden").hidden) renderGardenPage(); if (!document.querySelector("#view-journey").hidden) renderJourney(); }
function applyPreferences() { const { reduceMotion, chimes } = store.state.preferences; document.body.classList.toggle("reduce-motion", reduceMotion); document.querySelector("#reduce-motion-setting").checked = reduceMotion; document.querySelector("#chime-setting").checked = chimes; document.querySelector("#name-setting").value = store.state.profile.name || ""; }

function download(name, contents, type = "application/json") { const blob = contents instanceof Blob ? contents : new Blob([contents], { type }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function exportData() { download(`serenitype-backup-${localDay(new Date())}.json`, store.export()); toast("A private backup has been downloaded."); }

async function scheduleSync() { if (!api.user) return; clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 900); }
async function syncNow() {
  if (!api.user) return; const dot = document.querySelector("#sync-status-dot"); dot.className = "status-dot is-syncing";
  try { await api.save(store.state); dot.className = "status-dot is-synced"; document.querySelector("#last-sync-label").textContent = "Your garden is synced just now."; }
  catch (error) {
    if (error.status === 409 && error.payload?.data) {
      try { api.revision = error.payload.revision; store.merge(error.payload.data); await api.save(store.state); renderAll(); dot.className = "status-dot is-synced"; toast("Changes from both gardens were gently merged."); return; } catch { /* Fall through to the original error. */ }
    }
    dot.className = "status-dot"; toast(error.message);
  }
}

function renderAccount() {
  const guest = document.querySelector("#auth-guest"); const account = document.querySelector("#auth-account"); guest.hidden = Boolean(api.user); account.hidden = !api.user;
  document.querySelector("#sync-status-dot").className = `status-dot${api.user ? " is-synced" : ""}`;
  if (api.user) { document.querySelector("#account-name").textContent = api.user.displayName || "Serenitype member"; document.querySelector("#account-email").textContent = api.user.email; document.querySelector("#account-avatar").textContent = (api.user.displayName || api.user.email || "S")[0].toUpperCase(); }
}

async function authenticate(event) {
  event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const message = document.querySelector("#auth-message"); const mode = form.dataset.mode || "login"; const submit = form.querySelector("[type=submit]"); submit.disabled = true; message.textContent = "";
  try { if (mode === "register") await api.register(data.get("email"), data.get("password"), data.get("displayName")); else await api.login(data.get("email"), data.get("password")); const remote = await api.load(); if (remote) store.merge(remote); await api.save(store.state); renderAccount(); renderAll(); toast("Your garden is now synced."); }
  catch (error) { message.textContent = error.message; }
  finally { submit.disabled = false; }
}

function bindDialogs() {
  const settings = document.querySelector("#settings-dialog"); document.querySelector("#settings-button").addEventListener("click", () => { applyPreferences(); settings.showModal(); });
  settings.addEventListener("close", () => { if (settings.returnValue !== "default") return; store.update((draft) => { draft.profile.name = document.querySelector("#name-setting").value.trim(); draft.preferences.reduceMotion = document.querySelector("#reduce-motion-setting").checked; draft.preferences.chimes = document.querySelector("#chime-setting").checked; }, { immediate: true }); renderAll(); scheduleSync(); toast("Your space has been updated."); });
  document.querySelector("#import-data").addEventListener("click", (event) => { event.preventDefault(); document.querySelector("#import-file").click(); });
  document.querySelector("#import-file").addEventListener("change", async (event) => { const file = event.target.files[0]; if (!file) return; try { store.import(JSON.parse(await file.text())); renderAll(); toast("Your backup has been restored."); settings.close(); } catch (error) { toast(error.message); } event.target.value = ""; });
  const auth = document.querySelector("#auth-dialog"); document.querySelector("#sync-button").addEventListener("click", () => { renderAccount(); auth.showModal(); }); document.querySelector("#auth-close").addEventListener("click", () => auth.close());
  document.querySelectorAll("[data-auth-mode]").forEach((tab) => tab.addEventListener("click", () => { const mode = tab.dataset.authMode; document.querySelectorAll("[data-auth-mode]").forEach((item) => { item.classList.toggle("is-active", item === tab); item.setAttribute("aria-selected", item === tab); }); const form = document.querySelector("#auth-form"); form.dataset.mode = mode; form.querySelector("[type=submit]").textContent = mode === "register" ? "Create account" : "Sign in"; form.querySelector("[name=password]").autocomplete = mode === "register" ? "new-password" : "current-password"; document.querySelector("#display-name-field").hidden = mode !== "register"; }));
  document.querySelector("#auth-form").addEventListener("submit", authenticate); document.querySelector("#sync-now").addEventListener("click", syncNow); document.querySelector("#logout-button").addEventListener("click", async () => { try { await api.logout(); renderAccount(); auth.close(); toast("Signed out. Your local garden remains here."); } catch (error) { toast(error.message); } });
  const privacy = document.querySelector("#privacy-dialog"); document.querySelector("#privacy-button").addEventListener("click", () => privacy.showModal()); document.querySelector("#privacy-close").addEventListener("click", () => privacy.close());
  document.querySelector("#entry-close").addEventListener("click", () => document.querySelector("#entry-dialog").close());
}

function bindEvents() {
  const unlock = () => unlockChime(); document.addEventListener("pointerdown", unlock, { once: true }); document.addEventListener("keydown", unlock, { once: true });
  document.querySelectorAll("[data-route]").forEach((link) => link.addEventListener("click", (event) => { event.preventDefault(); navigate(link.dataset.route); })); document.querySelectorAll("[data-route-button]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.routeButton)));
  document.querySelectorAll("[data-open-experience]").forEach((button) => button.addEventListener("click", () => openExperience(button.dataset.openExperience, { trigger: button })));
  document.querySelector("#begin-ritual").addEventListener("click", startRitual); shellClose.addEventListener("click", closeExperience);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !shell.hidden && !document.querySelector("dialog[open]")) closeExperience(); });
  window.addEventListener("popstate", () => navigate(currentRoute(), { updateHash: false })); window.addEventListener("hashchange", () => navigate(currentRoute(), { updateHash: false }));
  document.querySelector("#export-data").addEventListener("click", exportData); document.querySelector("#export-garden").addEventListener("click", () => { const canvas = document.querySelector("#garden-canvas"); canvas.toBlob((blob) => blob && download(`serenitype-garden-${localDay(new Date())}.png`, blob, "image/png")); });
  const master = document.querySelector("#sound-master"); master.addEventListener("click", async () => { const playing = await audio.toggle(); master.textContent = playing ? "Pause soundscape" : "Play soundscape"; document.querySelector("#sound-orb").classList.toggle("is-playing", playing); if (!playing) resetMixerLevels(); });
}

async function initialize() {
  bindEvents(); bindDialogs(); renderSoundMixer(); renderAll(); navigate(currentRoute(), { updateHash: false, initial: true });
  observeGarden(document.querySelector("#garden-preview-canvas"), () => store.state, { preview: true });
  try { const user = await api.checkSession(); if (user) { const remote = await api.load(); if (remote) store.merge(remote); renderAccount(); renderAll(); } } catch { /* Local-only operation is a complete experience. */ }
  const requested = new URLSearchParams(location.search).get("experience"); if (experiences[requested]) openExperience(requested);
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("/sw.js").catch(() => {});
}

initialize();
