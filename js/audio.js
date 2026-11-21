const CHIME_NOTES = [[659.25, 0], [880, 0.5], [1108.73, 1], [880, 1.5], [659.25, 2], [880, 2.5]];

export function createTimerAudio() {
  let context = null;
  const activeTones = new Set();

  function prepare() {
    try {
      const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContext) return;
      if (!context || context.state === "closed") context = new AudioContext();
      // The controller calls this synchronously inside Start/Resume activation.
      if (context.state !== "running") context.resume().catch(() => {});
    } catch {
      // Optional sound must never prevent starting the timer.
    }
  }

  function disconnect(tone) {
    if (!activeTones.delete(tone)) return;
    tone.oscillator.onended = null;
    tone.oscillator.disconnect();
    tone.gain.disconnect();
  }

  function play() {
    if (!context || context.state !== "running") return;
    const start = context.currentTime;
    for (const [frequency, offset] of CHIME_NOTES) {
      let oscillator;
      let gain;
      let tone;
      try {
        oscillator = context.createOscillator();
        gain = context.createGain();
        const when = start + offset;
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, when);
        gain.gain.setValueAtTime(0, when);
        gain.gain.linearRampToValueAtTime(0.1, when + 0.025);
        gain.gain.linearRampToValueAtTime(0.06, when + 0.55);
        gain.gain.linearRampToValueAtTime(0, when + 0.7);
        oscillator.connect(gain);
        gain.connect(context.destination);
        tone = { oscillator, gain };
        activeTones.add(tone);
        oscillator.onended = () => disconnect(tone);
        oscillator.start(when);
        oscillator.stop(when + 0.7);
      } catch {
        if (tone) disconnect(tone);
        else {
          oscillator?.disconnect();
          gain?.disconnect();
        }
      }
    }
  }

  function stop() {
    for (const tone of [...activeTones]) {
      try {
        tone.oscillator.stop();
      } catch {
        // Already-ended tones are safe to discard as well.
      }
      disconnect(tone);
    }
  }

  return Object.freeze({ prepare, play, stop });
}
