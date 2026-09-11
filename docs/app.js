firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

const statusEl = document.getElementById("status");
const playerListEl = document.getElementById("player-list");
const authTestForm = document.getElementById("auth-test-form");
const organizerPinInput = document.getElementById("organizer-pin");
const authStatusEl = document.getElementById("auth-status");

async function loadPlayers() {
  try {
    const snapshot = await db.collection("players").get();
    statusEl.textContent = `Connected. ${snapshot.size} player(s) found.`;
    playerListEl.replaceChildren();
    snapshot.forEach((doc) => {
      const li = document.createElement("li");
      li.textContent = doc.data().name;
      playerListEl.appendChild(li);
    });
  } catch (err) {
    statusEl.textContent =
      "Could not connect to Firestore. Check firebase-config.js and the Firestore rules.";
    console.error(err);
  }
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
    authStatusEl.textContent = "PIN accepted. Authentication works.";
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
    await auth.signOut().catch(() => {});
    submitButton.disabled = false;
  }
});

loadPlayers();
