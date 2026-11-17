// Звуки синтезуються WebAudio — без файлів. Працюють лише коли застосунок відкрито.
// Увага: на iPhone перемикач «Без звуку» вимикає й ці звуки; системні push-сповіщення використовують звук iOS.
export interface SoundDef { id: string; name: string; notes: { f: number; t: number; d: number; type?: OscillatorType; g?: number }[] }

export const SOUNDS: SoundDef[] = [
  { id: 'chime', name: 'Дзвіночок', notes: [{ f: 659.25, t: 0, d: 0.5 }, { f: 830.61, t: 0.14, d: 0.5 }, { f: 987.77, t: 0.28, d: 0.9 }] },
  { id: 'bell', name: 'Дзвін', notes: [{ f: 880, t: 0, d: 1.4, g: 0.8 }, { f: 1760, t: 0, d: 0.8, g: 0.25 }, { f: 2640, t: 0, d: 0.4, g: 0.1 }] },
  { id: 'pulse', name: 'Пульс', notes: [{ f: 740, t: 0, d: 0.14, type: 'triangle' }, { f: 740, t: 0.22, d: 0.14, type: 'triangle' }] },
  { id: 'soft', name: 'М’який', notes: [{ f: 523.25, t: 0, d: 1.2, g: 0.7 }, { f: 659.25, t: 0.3, d: 1.2, g: 0.5 }] },
  { id: 'digital', name: 'Цифровий', notes: [{ f: 1200, t: 0, d: 0.08, type: 'square', g: 0.3 }, { f: 1500, t: 0.12, d: 0.08, type: 'square', g: 0.3 }, { f: 1800, t: 0.24, d: 0.12, type: 'square', g: 0.3 }] },
  { id: 'done', name: 'Успіх', notes: [{ f: 523.25, t: 0, d: 0.2 }, { f: 783.99, t: 0.12, d: 0.5 }] },
  { id: 'none', name: 'Без звуку', notes: [] },
];

let ctx: AudioContext | null = null;
const getCtx = () => {
  if (ctx) return ctx;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
};

/** iOS вимагає жесту користувача, щоб розблокувати звук */
export const unlockAudio = () => {
  const c = getCtx();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
};
if (typeof window !== 'undefined') {
  const once = () => { unlockAudio(); window.removeEventListener('touchend', once); window.removeEventListener('click', once); };
  window.addEventListener('touchend', once, { passive: true });
  window.addEventListener('click', once);
}

export const playSound = (id: string, volume = 0.7) => {
  const def = SOUNDS.find((s) => s.id === id);
  const c = getCtx();
  if (!def || !c || !def.notes.length || volume <= 0) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  const t0 = c.currentTime + 0.02;
  const master = c.createGain();
  master.gain.value = Math.min(1, Math.max(0, volume)) * 0.5;
  master.connect(c.destination);
  for (const n of def.notes) {
    const o = c.createOscillator(); const g = c.createGain();
    o.type = n.type || 'sine'; o.frequency.value = n.f;
    const peak = n.g ?? 0.6;
    g.gain.setValueAtTime(0.0001, t0 + n.t);
    g.gain.exponentialRampToValueAtTime(peak, t0 + n.t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.t + n.d);
    o.connect(g); g.connect(master);
    o.start(t0 + n.t); o.stop(t0 + n.t + n.d + 0.05);
  }
};

/** Легкий «клік» для інтерфейсу (вимкнений за замовчуванням). */
export const tick = (volume = 0.3) => playSound('pulse', volume);
