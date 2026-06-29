export let audioCtx = null;

export const playTone = (freq, duration = 0.1, type = "sine", delay = 0, soundOn = true) => {
  if (!soundOn) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.001, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.02);
  } catch {
    // Silent fail if AudioContext is blocked
  }
};

export const playMoveSound = (symbol, soundOn = true) => 
  playTone(symbol === "X" || symbol === "P1" ? 520 : 380, 0.08, "triangle", 0, soundOn);

export const playDropSound = (soundOn = true) =>
  playTone(200, 0.1, "sine", 0, soundOn);

export const playWinSound = (soundOn = true) => {
  [523, 659, 784].forEach((f, i) => playTone(f, 0.18, "sine", i * 0.12, soundOn));
};

export const playDrawSound = (soundOn = true) => playTone(300, 0.3, "sawtooth", 0, soundOn);
