export const ROUND_DURATION_MS = 60_000;

export function createRoundTimer({ now = Date.now, onFinish = () => {} } = {}) {
  let phase = "ready";
  let remainingMs = ROUND_DURATION_MS;
  let deadline = null;

  function getSnapshot() {
    return Object.freeze({ phase, remainingMs, deadline, durationMs: ROUND_DURATION_MS });
  }

  function tick() {
    if (phase !== "running") return getSnapshot();
    remainingMs = Math.max(0, deadline - now());
    if (remainingMs === 0) {
      phase = "finished";
      deadline = null;
      onFinish(getSnapshot());
    }
    return getSnapshot();
  }

  function start() {
    if (phase === "running") return getSnapshot();
    if (phase !== "paused") remainingMs = ROUND_DURATION_MS;
    deadline = now() + remainingMs;
    phase = "running";
    return getSnapshot();
  }

  function pause() {
    if (phase !== "running") return getSnapshot();
    tick();
    if (phase === "running") {
      phase = "paused";
      deadline = null;
    }
    return getSnapshot();
  }

  function reset() {
    phase = "ready";
    remainingMs = ROUND_DURATION_MS;
    deadline = null;
    return getSnapshot();
  }

  return Object.freeze({ getSnapshot, start, pause, reset, tick });
}
