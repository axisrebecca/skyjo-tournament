const POINTS_BY_PLACE = { 1: 10, 2: 5, 3: 2 };

function calculateGameResults(scores) {
  const sortedScores = Object.values(scores).sort(
    (left, right) => left - right,
  );

  return Object.entries(scores).map(([playerId, score]) => {
    const place = sortedScores.indexOf(score) + 1;
    return {
      playerId,
      score,
      place,
      points: POINTS_BY_PLACE[place] || 0,
    };
  });
}

if (typeof module !== "undefined") module.exports = { calculateGameResults };