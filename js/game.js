export const MAX_SCORE = Number.MAX_SAFE_INTEGER;

function normalizeScore(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(MAX_SCORE, Math.max(0, Math.floor(number))) : 0;
}

export function createGame() {
  const players = [1, 2].map((id) => ({ id, customName: null, score: 0 }));
  let round = 1;
  let speakerId = 1;

  function playerById(id) {
    const player = players.find((entry) => entry.id === id);
    if (!player) throw new RangeError(`Unknown player: ${id}`);
    return player;
  }

  function getSnapshot() {
    return Object.freeze({
      round,
      speakerId,
      translatorId: 3 - speakerId,
      players: Object.freeze(players.map((player) => Object.freeze({
        ...player,
        role: player.id === speakerId ? "speaker" : "translator",
        canEditScore: player.id !== speakerId,
      }))),
    });
  }

  function setPlayerName(id, value) {
    if (typeof value !== "string") throw new TypeError("Player names must be strings.");
    playerById(id).customName = value.trim() ? value : null;
  }

  function setScore(id, value) {
    const player = playerById(id);
    if (id === speakerId) return false;
    player.score = normalizeScore(value);
    return true;
  }

  function adjustScore(id, amount) {
    if (typeof amount !== "number" || !Number.isFinite(amount) || !Number.isInteger(amount)) {
      throw new TypeError("Score adjustments must be finite integers.");
    }
    return setScore(id, playerById(id).score + amount);
  }

  function nextRound() {
    round += 1;
    speakerId = 3 - speakerId;
  }

  return Object.freeze({ getSnapshot, setPlayerName, setScore, adjustScore, nextRound });
}
