firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

const statusEl = document.getElementById("status");
const playerListEl = document.getElementById("player-list");
const authTestForm = document.getElementById("auth-test-form");
const organizerPinInput = document.getElementById("organizer-pin");
const authStatusEl = document.getElementById("auth-status");
const signOutButton = document.getElementById("sign-out");
const addPlayerForm = document.getElementById("add-player-form");
const playerNameInput = document.getElementById("player-name");
const rosterStatusEl = document.getElementById("roster-status");
const leaderboardListEl = document.getElementById("leaderboard-list");
const leaderboardViewButtons = document.querySelectorAll(
  "button[data-leaderboard-view]",
);
const gameHistoryEl = document.getElementById("game-history");
const gameNotificationEl = document.getElementById("game-notification");
const newGameSection = document.getElementById("new-game");
const unfinishedGamesEl = document.getElementById("unfinished-games");
const unfinishedGamesStatusEl = document.getElementById(
  "unfinished-games-status",
);
const unfinishedGameListEl = document.getElementById("unfinished-game-list");
const newGameControls = document.getElementById("new-game-controls");
const newGameLockedEl = document.getElementById("new-game-locked");
const selectionCountEl = document.getElementById("selection-count");
const addAllPlayersButton = document.getElementById("add-all-players");
const gameSetupStatusEl = document.getElementById("game-setup-status");
const gamePlayerListEl = document.getElementById("game-player-list");
const generateSeatingButton = document.getElementById("generate-seating");
const seatingEl = document.getElementById("seating");
const seatingListEl = document.getElementById("seating-list");
const gameFinishedButton = document.getElementById("game-finished");
const scoreEntrySection = document.getElementById("score-entry");
const scoreEntryHeading = document.getElementById("score-entry-heading");
const scoreEntryForm = document.getElementById("score-entry-form");
const scoreReviewEl = document.getElementById("score-review");
const scoreReviewListEl = document.getElementById("score-review-list");
const editScoresButton = document.getElementById("edit-scores");
const saveScoresButton = document.getElementById("save-scores");
const scoreReviewStatusEl = document.getElementById("score-review-status");
let players = [];
let games = [];
let leaderboardView = "leaders";
let suggestedPlayerIds = [];
const selectedPlayerIds = new Set();
let seatedPlayerIds = [];
let currentGameId = null;
let currentGameRevision = null;
let reviewedScores = null;

const MAX_SEATS = 8;

function numberValue(value) {
  return Number.isFinite(value) ? value : 0;
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

function refreshSuggestions() {
  const activePlayers = shuffle(
    players.filter((player) => player.active !== false),
  ).sort(
    (left, right) =>
      numberValue(left.gamesPlayed) - numberValue(right.gamesPlayed),
  );
  suggestedPlayerIds = activePlayers.map(({ id }) => id);

  const activeIds = new Set(suggestedPlayerIds);
  for (const id of selectedPlayerIds) {
    if (!activeIds.has(id)) selectedPlayerIds.delete(id);
  }
}

function renderGameSetup() {
  const suggestedPlayers = suggestedPlayerIds
    .map((id) => players.find((player) => player.id === id))
    .filter(Boolean);

  selectionCountEl.textContent = `${selectedPlayerIds.size} of ${MAX_SEATS} players selected`;
  addAllPlayersButton.disabled =
    suggestedPlayers.length === 0 ||
    selectedPlayerIds.size === Math.min(suggestedPlayers.length, MAX_SEATS);
  generateSeatingButton.disabled = selectedPlayerIds.size < 2;
  gamePlayerListEl.replaceChildren();

  for (const player of suggestedPlayers) {
    const item = document.createElement("li");
    const details = document.createElement("span");
    const button = document.createElement("button");
    const isSelected = selectedPlayerIds.has(player.id);
    const gamesPlayed = numberValue(player.gamesPlayed);

    details.textContent = `${player.name} · ${gamesPlayed} game${gamesPlayed === 1 ? "" : "s"}`;
    button.type = "button";
    button.dataset.gamePlayerId = player.id;
    button.textContent = isSelected ? "Remove" : "Add";
    button.disabled = !isSelected && selectedPlayerIds.size >= MAX_SEATS;
    item.className = isSelected ? "selected" : "";
    item.append(details, button);
    gamePlayerListEl.appendChild(item);
  }

  if (suggestedPlayers.length === 0) {
    const item = document.createElement("li");
    item.textContent = "Add an active player before starting a game.";
    item.className = "empty-state";
    gamePlayerListEl.appendChild(item);
  }
}

function renderSeating() {
  seatingListEl.replaceChildren();
  for (const playerId of seatedPlayerIds) {
    const player = players.find(({ id }) => id === playerId);
    const item = document.createElement("li");
    item.textContent = player?.name || "Unknown player";
    seatingListEl.appendChild(item);
  }
}

function renderScoreEntry() {
  scoreEntryForm.replaceChildren();
  scoreEntryHeading.hidden = false;
  scoreEntryForm.hidden = false;
  scoreReviewEl.hidden = true;
  scoreReviewStatusEl.textContent = "";

  for (const playerId of seatedPlayerIds) {
    const player = players.find(({ id }) => id === playerId);
    const label = document.createElement("label");
    const input = document.createElement("input");
    label.textContent = player?.name || "Unknown player";
    input.type = "number";
    input.inputMode = "numeric";
    input.name = playerId;
    input.required = true;
    label.appendChild(input);
    scoreEntryForm.appendChild(label);
  }

  const reviewButton = document.createElement("button");
  reviewButton.type = "submit";
  reviewButton.textContent = "Review scores";
  scoreEntryForm.appendChild(reviewButton);
}

function renderScoreReview(results) {
  const sortedResults = [...results].sort(
    (left, right) => left.place - right.place,
  );
  scoreReviewListEl.replaceChildren();

  for (const result of sortedResults) {
    const player = players.find(({ id }) => id === result.playerId);
    const row = document.createElement("tr");
    const values = [
      result.place,
      player?.name || "Unknown player",
      result.score,
      result.points,
    ];
    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    }
    scoreReviewListEl.appendChild(row);
  }

  scoreEntryHeading.hidden = true;
  scoreEntryForm.hidden = true;
  scoreReviewEl.hidden = false;
}

function resetCompletedGame() {
  currentGameId = null;
  currentGameRevision = null;
  reviewedScores = null;
  seatedPlayerIds = [];
  selectedPlayerIds.clear();
  scoreEntryForm.replaceChildren();
  scoreEntrySection.hidden = true;
  seatingEl.hidden = true;
  newGameSection.hidden = false;
  newGameControls.hidden = !auth.currentUser;
  gameSetupStatusEl.textContent = "";
  gameNotificationEl.textContent = "Scores saved.";
  gameNotificationEl.hidden = false;
  renderGameSetup();
}

function renderLeaderboard() {
  const sortedPlayers = [...players].sort((left, right) => {
    if (leaderboardView === "least-games") {
      return (
        numberValue(left.gamesPlayed) - numberValue(right.gamesPlayed) ||
        left.name.localeCompare(right.name)
      );
    }

    return (
      numberValue(right.totalPoints) - numberValue(left.totalPoints) ||
      numberValue(right.firstPlaceCount) - numberValue(left.firstPlaceCount) ||
      numberValue(right.secondPlaceCount) -
        numberValue(left.secondPlaceCount) ||
      left.name.localeCompare(right.name)
    );
  });

  leaderboardListEl.replaceChildren();
  for (const player of sortedPlayers) {
    const row = document.createElement("tr");
    const values = [
      player.name,
      numberValue(player.totalPoints),
      numberValue(player.gamesPlayed),
      numberValue(player.firstPlaceCount),
      numberValue(player.secondPlaceCount),
    ];
    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    }
    leaderboardListEl.appendChild(row);
  }

  if (sortedPlayers.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "No players yet.";
    cell.className = "empty-state";
    row.appendChild(cell);
    leaderboardListEl.appendChild(row);
  }
}

function gameDate(game) {
  const date = game.date || game.createdAt;
  if (date?.toDate) return date.toDate();
  if (date) return new Date(date);
  return null;
}

function renderUnfinishedGames() {
  const unfinishedGames = games
    .filter((game) => game.status === "in-progress")
    .sort(
      (left, right) =>
        (gameDate(left)?.getTime() || 0) - (gameDate(right)?.getTime() || 0),
    );

  unfinishedGamesEl.hidden =
    Boolean(currentGameId) ||
    (unfinishedGames.length === 0 && !unfinishedGamesStatusEl.textContent);
  unfinishedGameListEl.replaceChildren();

  for (const game of unfinishedGames) {
    const item = document.createElement("li");
    const details = document.createElement("p");
    const resumeButton = document.createElement("button");
    const discardButton = document.createElement("button");
    const date = gameDate(game);
    const playerNames = game.seatedIds.map(
      (playerId) =>
        players.find((player) => player.id === playerId)?.name ||
        "Unknown player",
    );

    details.textContent = `${date?.toLocaleString() || "Undated"} · ${playerNames.join(", ")}`;
    resumeButton.type = "button";
    resumeButton.textContent = "Resume";
    resumeButton.dataset.resumeGameId = game.id;
    resumeButton.disabled = !auth.currentUser;
    discardButton.type = "button";
    discardButton.textContent = "Discard";
    discardButton.dataset.discardGameId = game.id;
    discardButton.dataset.gameRevision = numberValue(game.revision);
    discardButton.disabled = !auth.currentUser;
    item.append(details, resumeButton, " ", discardButton);
    unfinishedGameListEl.appendChild(item);
  }
}

function renderGameHistory() {
  const sortedGames = [...games].sort(
    (left, right) =>
      (gameDate(right)?.getTime() || 0) - (gameDate(left)?.getTime() || 0),
  );

  gameHistoryEl.replaceChildren();
  for (const game of sortedGames) {
    const item = document.createElement("li");
    const date = gameDate(game);
    const dateText =
      date && !Number.isNaN(date.getTime())
        ? date.toLocaleDateString()
        : "Undated";
    const playerCount = game.seatedIds?.length || game.results?.length || 0;
    const statusText = game.status === "in-progress" ? " · Not finished" : "";
    item.textContent = `${dateText} · ${playerCount} players${statusText}`;
    gameHistoryEl.appendChild(item);
  }

  if (sortedGames.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No games recorded yet.";
    item.className = "empty-state";
    gameHistoryEl.appendChild(item);
  }
}

function renderPlayers() {
  const activePlayers = players
    .filter((player) => player.active !== false)
    .sort((left, right) => left.name.localeCompare(right.name));

  statusEl.textContent = `Connected. ${activePlayers.length} active player(s).`;
  playerListEl.replaceChildren();

  for (const player of activePlayers) {
    const li = document.createElement("li");
    const name = document.createElement("span");
    const removeButton = document.createElement("button");
    name.textContent = player.name;
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.dataset.playerId = player.id;
    removeButton.disabled = !auth.currentUser;
    li.append(name, removeButton);
    playerListEl.appendChild(li);
  }

  if (activePlayers.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No active players yet.";
    li.className = "empty-state";
    playerListEl.appendChild(li);
  }
}

function loadPlayers() {
  return db.collection("players").onSnapshot(
    (snapshot) => {
      players = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      refreshSuggestions();
      renderPlayers();
      renderLeaderboard();
      renderGameSetup();
      renderUnfinishedGames();
    },
    (err) => {
      statusEl.textContent =
        "Could not connect to Firestore. Check firebase-config.js and the Firestore rules.";
      console.error(err);
    },
  );
}

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

authTestForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = authTestForm.querySelector("button");
  submitButton.disabled = true;
  authStatusEl.textContent = "Testing PIN...";

  try {
    await auth.signInWithEmailAndPassword(
      firebaseOperatorEmail,
      organizerPinInput.value,
    );
    authTestForm.reset();
    authStatusEl.textContent = "Editing unlocked.";
  } catch (err) {
    const invalidPinErrors = [
      "auth/invalid-credential",
      "auth/wrong-password",
      "auth/user-not-found",
    ];
    authStatusEl.textContent = invalidPinErrors.includes(err.code)
      ? "Incorrect PIN."
      : "Could not authenticate. Check the Firebase setup and try again.";
    console.error(err);
  } finally {
    submitButton.disabled = false;
  }
});

auth.onAuthStateChanged((user) => {
  authTestForm.hidden = Boolean(user);
  signOutButton.hidden = !user;
  addPlayerForm.hidden = !user;
  newGameControls.hidden = !user || seatedPlayerIds.length > 0;
  newGameLockedEl.hidden = Boolean(user);
  if (!user) {
    authStatusEl.textContent = "Enter the organizer PIN to edit the roster.";
  }
  renderPlayers();
  renderUnfinishedGames();
});

signOutButton.addEventListener("click", async () => {
  await auth.signOut();
  authStatusEl.textContent = "Editing locked.";
});

addPlayerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = playerNameInput.value.trim();
  const submitButton = addPlayerForm.querySelector("button");
  const existingPlayer = players.find(
    (player) => player.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
  );

  if (existingPlayer && existingPlayer.active !== false) {
    rosterStatusEl.textContent = `${existingPlayer.name} is already active.`;
    return;
  }

  submitButton.disabled = true;
  rosterStatusEl.textContent = "Saving player...";

  try {
    if (existingPlayer) {
      await db
        .collection("players")
        .doc(existingPlayer.id)
        .update({ active: true });
    } else {
      await db.collection("players").add({
        name,
        gamesPlayed: 0,
        totalPoints: 0,
        firstPlaceCount: 0,
        secondPlaceCount: 0,
        active: true,
        qualifiedForFinale: false,
      });
    }
    addPlayerForm.reset();
    rosterStatusEl.textContent = `${name} added.`;
    playerNameInput.focus();
  } catch (err) {
    rosterStatusEl.textContent =
      "Could not save the player. Try unlocking editing again.";
    console.error(err);
  } finally {
    submitButton.disabled = false;
  }
});

playerListEl.addEventListener("click", async (event) => {
  const removeButton = event.target.closest("button[data-player-id]");
  if (!removeButton) return;

  const player = players.find(({ id }) => id === removeButton.dataset.playerId);
  if (
    !player ||
    !window.confirm(`Remove ${player.name} from the active roster?`)
  )
    return;

  removeButton.disabled = true;
  rosterStatusEl.textContent = `Removing ${player.name}...`;
  try {
    await db.collection("players").doc(player.id).update({ active: false });
    rosterStatusEl.textContent = `${player.name} removed.`;
  } catch (err) {
    removeButton.disabled = false;
    rosterStatusEl.textContent =
      "Could not remove the player. Try unlocking editing again.";
    console.error(err);
  }
});

for (const button of leaderboardViewButtons) {
  button.addEventListener("click", () => {
    leaderboardView = button.dataset.leaderboardView;
    for (const viewButton of leaderboardViewButtons) {
      viewButton.setAttribute("aria-pressed", String(viewButton === button));
    }
    renderLeaderboard();
  });
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

loadPlayers();
loadGames();
