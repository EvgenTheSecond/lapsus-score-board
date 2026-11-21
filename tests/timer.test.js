import test from "node:test";
import assert from "node:assert/strict";
import { createRoundTimer, ROUND_DURATION_MS } from "../js/timer.js";

function setup() {
  let time = 1_000;
  const finishes = [];
  const timer = createRoundTimer({ now: () => time, onFinish: (snapshot) => finishes.push(snapshot) });
  return { timer, finishes, advance(ms) { time += ms; } };
}

test("start uses a sixty-second deadline and repeated starts cannot extend it", () => {
  const { timer, advance } = setup();
  assert.deepEqual(timer.getSnapshot(), { phase: "ready", remainingMs: ROUND_DURATION_MS, deadline: null, durationMs: ROUND_DURATION_MS });
  const started = timer.start();
  assert.equal(started.deadline, 61_000);
  advance(3_210);
  assert.equal(timer.tick().remainingMs, 56_790);
  assert.equal(timer.start().deadline, started.deadline);
  assert.equal(started.remainingMs, ROUND_DURATION_MS);
});

test("pause preserves precise remaining time while resume starts a new deadline", () => {
  const { timer, advance, finishes } = setup();
  timer.start();
  advance(12_345);
  assert.equal(timer.pause().remainingMs, 47_655);
  advance(100_000);
  assert.equal(timer.tick().remainingMs, 47_655);
  assert.equal(timer.getSnapshot().phase, "paused");
  timer.start();
  advance(47_654);
  assert.equal(timer.tick().remainingMs, 1);
  assert.equal(finishes.length, 0);
  advance(1);
  assert.equal(timer.tick().phase, "finished");
  assert.equal(finishes.length, 1);
});

test("delayed or simultaneous callbacks finish once, and a new timer can finish again", () => {
  const { timer, advance, finishes } = setup();
  timer.start();
  advance(120_000);
  timer.tick();
  timer.tick();
  timer.pause();
  assert.equal(finishes.length, 1);
  assert.equal(finishes[0].phase, "finished");
  assert.equal(finishes[0].remainingMs, 0);
  assert.throws(() => { finishes[0].phase = "running"; }, TypeError);
  timer.start();
  advance(60_000);
  timer.tick();
  assert.equal(finishes.length, 2);
});

test("reset cancels a running or paused deadline without announcing a finish", () => {
  const { timer, advance, finishes } = setup();
  timer.start();
  advance(10_000);
  timer.reset();
  advance(100_000);
  assert.equal(timer.tick().phase, "ready");
  assert.equal(timer.getSnapshot().remainingMs, ROUND_DURATION_MS);
  assert.equal(finishes.length, 0);
  timer.start();
  timer.pause();
  timer.reset();
  assert.equal(timer.getSnapshot().deadline, null);
});

test("pausing after the deadline finishes instead of preserving expired time", () => {
  const { timer, advance, finishes } = setup();
  timer.start();
  advance(60_001);
  assert.equal(timer.pause().phase, "finished");
  assert.equal(finishes.length, 1);
});
