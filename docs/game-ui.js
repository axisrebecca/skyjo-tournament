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
