let audioContext = null;
let unlocked = false;
let unlockBound = false;
let lastPlayedAt = 0;

function cleanupUnlockListeners() {
  if (!unlockBound) return;
  unlockBound = false;
  window.removeEventListener("pointerdown", unlockAudioContext, true);
  window.removeEventListener("keydown", unlockAudioContext, true);
}

async function unlockAudioContext() {
  const context = getAudioContext();
  if (!context || unlocked) {
    cleanupUnlockListeners();
    return;
  }
  try {
    if (context.state === "suspended") await context.resume();
    unlocked = context.state === "running";
  } catch {
    unlocked = false;
  }
  if (unlocked) cleanupUnlockListeners();
}

function bindUnlockListeners() {
  if (unlockBound || typeof window === "undefined") return;
  unlockBound = true;
  window.addEventListener("pointerdown", unlockAudioContext, true);
  window.addEventListener("keydown", unlockAudioContext, true);
}

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) audioContext = new AudioContextClass();
  if (audioContext.state !== "running") bindUnlockListeners();
  return audioContext;
}

function playTone(context, { frequency, startAt, duration, gain }) {
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(gain, startAt + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

export async function playNotificationSound() {
  const now = Date.now();
  if (now - lastPlayedAt < 1200) return false;
  lastPlayedAt = now;
  const context = getAudioContext();
  if (!context) return false;
  try {
    if (context.state === "suspended") await context.resume();
    if (context.state !== "running") return false;
    unlocked = true;
    cleanupUnlockListeners();
    const startAt = context.currentTime + 0.01;
    playTone(context, { frequency: 880, startAt, duration: 0.12, gain: 0.06 });
    playTone(context, { frequency: 1174, startAt: startAt + 0.09, duration: 0.16, gain: 0.05 });
    return true;
  } catch {
    return false;
  }
}
