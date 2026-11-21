import test from "node:test";
import assert from "node:assert/strict";
import { createGame, MAX_SCORE } from "../js/game.js";

test("only the Translator can change scores, including after roles alternate", () => {
  const game = createGame();
  assert.equal(game.setScore(1, 12), false);
  assert.equal(game.adjustScore(1, 1), false);
  assert.equal(game.setScore(2, "4"), true);
  game.setPlayerName(1, "Alice");
  game.setPlayerName(2, "Богдан");
  game.nextRound();
  assert.deepEqual(game.getSnapshot(), {
    round: 2,
    speakerId: 2,
    translatorId: 1,
    players: [
      { id: 1, customName: "Alice", score: 0, role: "translator", canEditScore: true },
      { id: 2, customName: "Богдан", score: 4, role: "speaker", canEditScore: false },
    ],
  });
  assert.equal(game.setScore(2, 99), false);
  assert.equal(game.adjustScore(2, -1), false);
  game.adjustScore(1, 1);
  game.nextRound();
  assert.equal(game.getSnapshot().speakerId, 1);
  assert.deepEqual(game.getSnapshot().players.map(({ score }) => score), [1, 4]);
});

test("custom names stay exact and default-like names remain custom", () => {
  const game = createGame();
  assert.equal(game.getSnapshot().players[0].customName, null);
  for (const name of ["Player 1", "Игрок 1", "Гравець 1", "  Alice  ", "<b>Name</b>"]) {
    game.setPlayerName(1, name);
    assert.equal(game.getSnapshot().players[0].customName, name);
  }
  game.setPlayerName(1, " \t ");
  assert.equal(game.getSnapshot().players[0].customName, null);
});

test("scores stay nonnegative safe integers at manual-entry boundaries", () => {
  const game = createGame();
  for (const [value, expected] of [["7.9", 7], [-4, 0], ["", 0], ["invalid", 0], [Infinity, 0], [MAX_SCORE + 1, MAX_SCORE]]) {
    game.setScore(2, value);
    assert.equal(game.getSnapshot().players[1].score, expected);
  }
  game.adjustScore(2, 1);
  assert.equal(game.getSnapshot().players[1].score, MAX_SCORE);
  game.setScore(2, 0);
  game.adjustScore(2, -1);
  assert.equal(game.getSnapshot().players[1].score, 0);
});

test("invalid score adjustments are rejected without changing a total", () => {
  const game = createGame();
  game.setScore(2, 3);
  for (const amount of ["1", null, undefined, NaN, Infinity, 0.5]) {
    assert.throws(() => game.adjustScore(2, amount), TypeError);
    assert.equal(game.getSnapshot().players[1].score, 3);
  }
  game.adjustScore(2, -1);
  assert.equal(game.getSnapshot().players[1].score, 2);
});

test("snapshots cannot expose or mutate private player and round state", () => {
  const game = createGame();
  const snapshot = game.getSnapshot();
  assert.throws(() => { snapshot.players[1].score = 999; }, TypeError);
  assert.throws(() => snapshot.players.push({}), TypeError);
  assert.throws(() => { snapshot.speakerId = 2; }, TypeError);
  game.setScore(2, 2);
  game.nextRound();
  assert.equal(snapshot.round, 1);
  assert.equal(snapshot.players[1].score, 0);
  assert.equal(game.getSnapshot().players[1].score, 2);
});
