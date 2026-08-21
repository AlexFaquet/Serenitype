const CHANNELS = {
  ambient: { label: "Warm hum", url: "/ambient.mp3" },
  rain: { label: "Soft rain", url: "/FocusRoom/assets/rain.mp3" },
  forest: { label: "Forest", url: "/FocusRoom/assets/forest.mp3" }
};
let chimeContext = null;

export class AudioMixer {
  constructor(levels = {}) {
    this.levels = { ambient: 26, rain: 0, forest: 0, ...levels };
    this.players = new Map(); this.playing = false; this.fadeFrame = null;
  }
  get channels() { return CHANNELS; }
  #player(key) {
    if (!this.players.has(key)) {
      const audio = new Audio(CHANNELS[key].url); audio.loop = true; audio.preload = "none"; audio.volume = 0;
      this.players.set(key, audio);
    }
    return this.players.get(key);
  }
  setLevel(key, value) { if (!(key in CHANNELS)) return; this.levels[key] = Math.max(0, Math.min(100, Number(value) || 0)); if (this.playing) this.#player(key).volume = this.levels[key] / 100; }
  async play() {
    this.playing = true;
    const tasks = Object.keys(CHANNELS).filter((key) => this.levels[key] > 0).map(async (key) => { const player = this.#player(key); player.volume = this.levels[key] / 100; try { await player.play(); } catch { /* User gesture may be required. */ } });
    await Promise.all(tasks);
  }
  pause() { this.playing = false; this.players.forEach((audio) => audio.pause()); }
  async toggle() { if (this.playing) this.pause(); else await this.play(); return this.playing; }
  fadeOut(duration = 700) {
    const start = performance.now(); const initial = [...this.players].map(([key, audio]) => [key, audio, audio.volume]);
    cancelAnimationFrame(this.fadeFrame);
    const step = (now) => { const progress = Math.min(1, (now - start) / duration); initial.forEach(([, audio, volume]) => { audio.volume = volume * (1 - progress); }); if (progress < 1) this.fadeFrame = requestAnimationFrame(step); else this.pause(); };
    this.fadeFrame = requestAnimationFrame(step);
  }
}

export function unlockChime() {
  try {
    if (!chimeContext) chimeContext = new AudioContext();
    if (chimeContext.state === "suspended") chimeContext.resume().catch(() => {});
    return chimeContext;
  } catch { return null; }
}

export function playChime(enabled = true) {
  if (!enabled) return;
  try {
    const context = unlockChime(); if (!context) return; const now = context.currentTime; const gain = context.createGain(); const osc = context.createOscillator();
    osc.type = "sine"; osc.frequency.setValueAtTime(523.25, now); osc.frequency.exponentialRampToValueAtTime(659.25, now + .7);
    gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.025, now + .04); gain.gain.exponentialRampToValueAtTime(.0001, now + 1.2);
    osc.connect(gain).connect(context.destination); osc.start(); osc.stop(now + 1.25); osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  } catch { /* Chimes are decorative. */ }
}
