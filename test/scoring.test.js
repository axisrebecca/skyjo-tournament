const assert = require("node:assert/strict");
const test = require("node:test");

const { calculateGameResults } = require("../docs/scoring.js");

test("awards points by score order", () => {
  assert.deepEqual(calculateGameResults({ ada: 5, bo: 8, cy: 12 }), [
    { playerId: "ada", score: 5, place: 1, points: 10 },
    { playerId: "bo", score: 8, place: 2, points: 5 },
    { playerId: "cy", score: 12, place: 3, points: 2 },
  ]);
});

test("shares tied places and skips following places", () => {
  assert.deepEqual(calculateGameResults({ ada: 4, bo: 4, cy: 8, di: 12 }), [
    { playerId: "ada", score: 4, place: 1, points: 10 },
    { playerId: "bo", score: 4, place: 1, points: 10 },
    { playerId: "cy", score: 8, place: 3, points: 2 },
    { playerId: "di", score: 12, place: 4, points: 0 },
  ]);
});