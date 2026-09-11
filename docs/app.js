firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const statusEl = document.getElementById("status");
const playerListEl = document.getElementById("player-list");

db.collection("players")
  .get()
  .then((snapshot) => {
    statusEl.textContent = `Connected. ${snapshot.size} player(s) found.`;
    snapshot.forEach((doc) => {
      const li = document.createElement("li");
      li.textContent = doc.data().name;
      playerListEl.appendChild(li);
    });
  })
  .catch((err) => {
    statusEl.textContent = "Could not connect to Firestore — check firebase-config.js.";
    console.error(err);
  });
