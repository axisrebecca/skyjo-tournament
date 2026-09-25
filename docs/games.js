function loadGames() {
  return db.collection("games").onSnapshot(
    (snapshot) => {
      games = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderGameHistory();
      renderUnfinishedGames();
    },
    (err) => {
      gameHistoryEl.replaceChildren();
      const item = document.createElement("li");
      item.textContent = "Could not load game history.";
      item.className = "empty-state";
      gameHistoryEl.appendChild(item);
      console.error(err);
    },
  );
}

unfinishedGameListEl.addEventListener("click", async (event) => {
  const resumeButton = event.target.closest("button[data-resume-game-id]");
  if (resumeButton) {
    const game = games.find(
      ({ id }) => id === resumeButton.dataset.resumeGameId,
    );
    if (!game || game.status !== "in-progress") return;

    currentGameId = game.id;
    seatedPlayerIds = [...game.seatedIds];
    currentGameRevision = numberValue(game.revision);
    newGameSection.hidden = false;
    newGameControls.hidden = true;
    seatingEl.hidden = false;
    renderUnfinishedGames();
    renderSeating();
    seatingEl.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const discardButton = event.target.closest("button[data-discard-game-id]");
  if (!discardButton || !window.confirm("Discard this unfinished game?")) {
    return;
  }

  const gameId = discardButton.dataset.discardGameId;
  const expectedRevision = Number(discardButton.dataset.gameRevision);
  discardButton.disabled = true;
  unfinishedGamesStatusEl.textContent = "Discarding game...";

  try {
    await db.runTransaction(async (transaction) => {
      const gameRef = db.collection("games").doc(gameId);
      const snapshot = await transaction.get(gameRef);
      const game = snapshot.data();
      if (
        !snapshot.exists ||
        game.status !== "in-progress" ||
        numberValue(game.revision) !== expectedRevision
      ) {
        throw new Error("game-conflict");
      }
      transaction.delete(gameRef);
    });
    unfinishedGamesStatusEl.textContent = "";
  } catch (err) {
    discardButton.disabled = false;
    unfinishedGamesEl.hidden = false;
    unfinishedGamesStatusEl.textContent =
      err.message === "game-conflict"
        ? "Conflict: this game changed and was not discarded."
        : "Could not discard the game. Try again.";
    console.error(err);
  }
});

gamePlayerListEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-game-player-id]");
  if (!button) return;

  const playerId = button.dataset.gamePlayerId;
  if (selectedPlayerIds.has(playerId)) {
    selectedPlayerIds.delete(playerId);
  } else if (selectedPlayerIds.size < MAX_SEATS) {
    selectedPlayerIds.add(playerId);
  }
  gameSetupStatusEl.textContent = "";
  renderGameSetup();
});

addAllPlayersButton.addEventListener("click", () => {
  selectedPlayerIds.clear();
  for (const playerId of suggestedPlayerIds.slice(0, MAX_SEATS)) {
    selectedPlayerIds.add(playerId);
  }
  gameSetupStatusEl.textContent =
    suggestedPlayerIds.length > MAX_SEATS
      ? "Selected the 8 players with the fewest games."
      : "All active players selected.";
  renderGameSetup();
});

scoreEntryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  reviewedScores = Object.fromEntries(
    seatedPlayerIds.map((playerId) => [
      playerId,
      scoreEntryForm.elements.namedItem(playerId).valueAsNumber,
    ]),
  );
  renderScoreReview(calculateGameResults(reviewedScores));
});

editScoresButton.addEventListener("click", () => {
  scoreEntryHeading.hidden = false;
  scoreEntryForm.hidden = false;
  scoreReviewEl.hidden = true;
});

saveScoresButton.addEventListener("click", async () => {
  if (!currentGameId || currentGameRevision === null || !reviewedScores) return;
  if (!navigator.onLine) {
    scoreReviewStatusEl.textContent = "You are offline. Scores were not saved.";
    return;
  }

  saveScoresButton.disabled = true;
  scoreReviewStatusEl.textContent = "Saving scores...";

  try {
    await db.runTransaction(async (transaction) => {
      const gameRef = db.collection("games").doc(currentGameId);
      const gameSnapshot = await transaction.get(gameRef);
      const game = gameSnapshot.data();
      const seatingUnchanged =
        game?.seatedIds?.length === seatedPlayerIds.length &&
        game.seatedIds.every(
          (playerId, index) => playerId === seatedPlayerIds[index],
        );

      if (
        !gameSnapshot.exists ||
        game.status !== "in-progress" ||
        numberValue(game.revision) !== currentGameRevision ||
        !seatingUnchanged
      ) {
        throw new Error("game-conflict");
      }

      const playerRefs = seatedPlayerIds.map((playerId) =>
        db.collection("players").doc(playerId),
      );
      const playerSnapshots = await Promise.all(
        playerRefs.map((playerRef) => transaction.get(playerRef)),
      );
      if (
        playerSnapshots.some(
          (playerSnapshot) =>
            !playerSnapshot.exists || playerSnapshot.data().active === false,
        )
      ) {
        throw new Error("player-conflict");
      }

      const results = calculateGameResults(reviewedScores).map((result) => ({
        playerId: result.playerId,
        rawScore: result.score,
        place: result.place,
        pointsAwarded: result.points,
        doubled: false,
      }));

      for (const [index, playerSnapshot] of playerSnapshots.entries()) {
        const player = playerSnapshot.data();
        const result = results[index];
        transaction.update(playerRefs[index], {
          gamesPlayed: numberValue(player.gamesPlayed) + 1,
          totalPoints: numberValue(player.totalPoints) + result.pointsAwarded,
          firstPlaceCount:
            numberValue(player.firstPlaceCount) + (result.place === 1 ? 1 : 0),
          secondPlaceCount:
            numberValue(player.secondPlaceCount) + (result.place === 2 ? 1 : 0),
        });
      }

      transaction.update(gameRef, {
        status: "completed",
        revision: currentGameRevision + 1,
        results,
        completedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
    resetCompletedGame();
  } catch (err) {
    scoreReviewStatusEl.textContent =
      err.message === "game-conflict" || err.message === "player-conflict"
        ? "Conflict: the game or a player changed. Scores were not saved."
        : err.code === "unavailable"
          ? "You are offline. Scores were not saved."
          : "Could not save scores. Try again.";
    console.error(err);
  } finally {
    saveScoresButton.disabled = false;
  }
});

generateSeatingButton.addEventListener("click", async () => {
  const nextSeatedPlayerIds = shuffle([...selectedPlayerIds]);
  gameSetupStatusEl.textContent = "Starting game...";

  try {
    const gameRef = await db.collection("games").add({
      status: "in-progress",
      revision: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      seatedIds: nextSeatedPlayerIds,
      waitingIds: suggestedPlayerIds.filter(
        (playerId) => !selectedPlayerIds.has(playerId),
      ),
    });
    currentGameId = gameRef.id;
    seatedPlayerIds = nextSeatedPlayerIds;
    currentGameRevision = 0;
    gameNotificationEl.textContent = "";
    gameNotificationEl.hidden = true;
    newGameControls.hidden = true;
    seatingEl.hidden = false;
    renderUnfinishedGames();
    renderSeating();
    seatingEl.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    gameSetupStatusEl.textContent = "Could not start the game. Try again.";
    console.error(err);
  }
});

gameFinishedButton.addEventListener("click", () => {
  renderScoreEntry();
  newGameSection.hidden = true;
  scoreEntrySection.hidden = false;
  scoreEntrySection.scrollIntoView({ behavior: "smooth", block: "start" });
});
