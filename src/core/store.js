const STORAGE_KEY = "serenitype.state.v2";

const makeId = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const isoNow = () => new Date().toISOString();

export function createDefaultState() {
  return {
    version: 2,
    createdAt: isoNow(),
    updatedAt: isoNow(),
    profile: { name: "" },
    preferences: {
      reduceMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false,
      chimes: true,
      soundLevels: { ambient: 26, rain: 0, forest: 0 }
    },
    sessions: [],
    garden: { seed: Math.floor(Math.random() * 2_000_000_000) }
  };
}

function safeParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function sanitizeState(candidate) {
  const base = createDefaultState();
  if (!candidate || typeof candidate !== "object") return base;
  const sessions = Array.isArray(candidate.sessions)
    ? candidate.sessions.filter((item) => item && typeof item === "object" && typeof item.type === "string").slice(-1000)
    : [];
  return {
    ...base,
    ...candidate,
    version: 2,
    profile: { ...base.profile, ...(candidate.profile || {}) },
    preferences: {
      ...base.preferences,
      ...(candidate.preferences || {}),
      soundLevels: { ...base.preferences.soundLevels, ...(candidate.preferences?.soundLevels || {}) }
    },
    sessions,
    garden: { ...base.garden, ...(candidate.garden || {}) }
  };
}

function migrateLegacy(state) {
  if (localStorage.getItem("serenitype.legacyMigrated") === "true") return state;
  const next = structuredClone(state);
  const focusHistory = safeParse(localStorage.getItem("focusRoomHistory"));
  if (Array.isArray(focusHistory)) {
    focusHistory.slice().reverse().forEach((item) => next.sessions.push({
      id: item.id || makeId(), type: "focus", startedAt: item.endedAtISO || isoNow(), endedAt: item.endedAtISO || isoNow(),
      durationSeconds: item.lengthLabel === "Long" ? 2700 : item.lengthLabel === "Short" ? 1200 : 1800,
      label: item.intention || "Focus", detail: item.outcome || "Completed", meta: { imported: true, environment: item.environment }
    }));
  }
  const typingStats = safeParse(localStorage.getItem("lifetimeStats"));
  if (typingStats?.games > 0) {
    next.sessions.push({ id: makeId(), type: "typing", startedAt: isoNow(), endedAt: isoNow(), durationSeconds: 0,
      label: `${typingStats.games} earlier typing sessions`, detail: `Best ${typingStats.bestWPM || 0} WPM`,
      meta: { imported: true, aggregate: typingStats } });
  }
  try { localStorage.setItem("serenitype.legacyMigrated", "true"); } catch { /* Storage can be unavailable. */ }
  return next;
}

export class SerenityStore {
  #state;
  #listeners = new Set();
  #saveTimer = null;

  constructor() {
    let initial = null;
    try { initial = safeParse(localStorage.getItem(STORAGE_KEY)); } catch { /* Private mode. */ }
    this.#state = migrateLegacy(sanitizeState(initial));
    this.#persist();
  }

  get state() { return structuredClone(this.#state); }

  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  update(mutator, { immediate = false } = {}) {
    const draft = structuredClone(this.#state);
    const result = mutator(draft) || draft;
    result.updatedAt = isoNow();
    this.#state = sanitizeState(result);
    if (immediate) this.#persist(); else this.#schedulePersist();
    this.#listeners.forEach((listener) => listener(this.state));
    window.dispatchEvent(new CustomEvent("serenitype:changed"));
    return this.state;
  }

  addSession(session) {
    const endedAt = session.endedAt || isoNow();
    const record = {
      id: session.id || makeId(), type: session.type, startedAt: session.startedAt || endedAt, endedAt,
      durationSeconds: Math.max(0, Math.round(Number(session.durationSeconds) || 0)),
      label: String(session.label || "Quiet moment").slice(0, 160), detail: String(session.detail || "Completed").slice(0, 160),
      meta: session.meta && typeof session.meta === "object" ? session.meta : {}
    };
    this.update((draft) => { draft.sessions.push(record); draft.sessions = draft.sessions.slice(-1000); }, { immediate: true });
    return record;
  }

  import(candidate) {
    const normalized = sanitizeState(candidate);
    if (!Array.isArray(candidate?.sessions)) throw new Error("This backup does not contain Serenitype sessions.");
    this.#state = normalized;
    this.#persist();
    this.#listeners.forEach((listener) => listener(this.state));
  }

  merge(remote) {
    const incoming = sanitizeState(remote);
    const byId = new Map([...this.#state.sessions, ...incoming.sessions].map((item) => [item.id, item]));
    const remoteIsNewer = new Date(incoming.updatedAt || 0) > new Date(this.#state.updatedAt || 0);
    this.#state = sanitizeState({
      ...(remoteIsNewer ? this.#state : incoming), ...(remoteIsNewer ? incoming : this.#state),
      sessions: [...byId.values()].sort((a, b) => new Date(a.endedAt) - new Date(b.endedAt)).slice(-1000),
      garden: this.#state.garden
    });
    this.#persist();
    this.#listeners.forEach((listener) => listener(this.state));
    return this.state;
  }

  export() { return JSON.stringify(this.#state, null, 2); }

  #schedulePersist() {
    clearTimeout(this.#saveTimer);
    this.#saveTimer = setTimeout(() => this.#persist(), 180);
  }

  #persist() {
    clearTimeout(this.#saveTimer);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.#state)); } catch { /* Continue ephemerally. */ }
  }
}

export function summarize(state) {
  const realSessions = state.sessions.filter((item) => !item.meta?.aggregate);
  const totalSeconds = realSessions.reduce((sum, item) => sum + (item.durationSeconds || 0), 0);
  const dayKeys = new Set(realSessions.map((item) => localDay(item.endedAt)));
  let streak = 0;
  const cursor = new Date();
  if (!dayKeys.has(localDay(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (dayKeys.has(localDay(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
  return { moments: realSessions.length, minutes: Math.round(totalSeconds / 60), streak, totalSeconds, dayKeys };
}

export function localDay(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

