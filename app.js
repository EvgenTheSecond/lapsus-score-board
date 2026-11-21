import { createGame } from "./js/game.js";
import { createRoundTimer } from "./js/timer.js";
import { createI18n, loadLocales } from "./js/i18n.js";
import { createTimerAudio } from "./js/audio.js";
import { createView, showStartupError } from "./js/view.js";

async function bootstrap() {
  const i18n = createI18n(await loadLocales());
  const game = createGame();
  const audio = createTimerAudio();
  const view = createView(i18n);
  let interval = null;
  let announcement = null;

  function clearTicker() {
    if (interval !== null) window.clearInterval(interval);
    interval = null;
  }

  function render(options) {
    const snapshot = game.getSnapshot();
    view.renderGame(snapshot, options);
    view.renderTimer(timer.getSnapshot(), snapshot);
  }

  function announce(key, values = {}) {
    announcement = { key, values };
    view.renderAnnouncement(announcement, game.getSnapshot());
  }

  const timer = createRoundTimer({
    onFinish() {
      clearTicker();
      announce("finished");
      render();
      audio.play();
    },
  });

  function refreshTimer() {
    timer.tick();
    view.renderTimer(timer.getSnapshot(), game.getSnapshot());
  }

  function resetTimer(shouldAnnounce = true) {
    audio.stop();
    clearTicker();
    timer.reset();
    if (shouldAnnounce) announce("reset");
    render();
  }

  const { controls } = view;
  for (const fields of controls.players) {
    fields.name.addEventListener("input", (event) => {
      game.setPlayerName(fields.id, event.target.value);
      render();
    });
    fields.name.addEventListener("blur", () => render({ forceNameId: fields.id }));

    function setScore(value, { announceChange = false, commit = false } = {}) {
      const accepted = game.setScore(fields.id, value);
      render(commit ? { forceScoreId: fields.id } : undefined);
      if (accepted && announceChange) {
        const player = game.getSnapshot().players.find((entry) => entry.id === fields.id);
        announce("score", { playerNumber: player.id, score: player.score });
      }
    }

    fields.score.addEventListener("input", (event) => setScore(event.target.value));
    fields.score.addEventListener("change", (event) => setScore(event.target.value, { announceChange: true, commit: true }));
    fields.score.addEventListener("blur", (event) => setScore(event.target.value, { commit: true }));
    for (const [button, amount] of [[fields.minus, -1], [fields.plus, 1]]) {
      button.addEventListener("click", () => {
        if (game.adjustScore(fields.id, amount)) {
          const player = game.getSnapshot().players.find((entry) => entry.id === fields.id);
          announce("score", { playerNumber: player.id, score: player.score });
        }
        render({ forceScoreId: fields.id });
      });
    }
  }

  controls.start.addEventListener("click", () => {
    const previousPhase = timer.getSnapshot().phase;
    if (previousPhase === "running") {
      timer.pause();
      clearTicker();
      if (timer.getSnapshot().phase === "paused") announce("paused");
    } else {
      audio.stop();
      audio.prepare();
      timer.start();
      clearTicker();
      interval = window.setInterval(refreshTimer, 100);
      announce(previousPhase === "paused" ? "resumed" : "started");
    }
    render();
  });
  controls.reset.addEventListener("click", () => resetTimer());
  controls.nextRound.addEventListener("click", () => {
    game.nextRound();
    resetTimer(false);
    announce("nextRound");
  });
  for (const { language, button } of controls.languages) {
    button.addEventListener("click", () => {
      i18n.setLanguage(language);
      view.renderLanguage();
      render({ forceNames: true });
      view.renderAnnouncement(announcement, game.getSnapshot());
    });
  }
  document.addEventListener("visibilitychange", refreshTimer);
  view.showReady(game.getSnapshot(), timer.getSnapshot(), announcement);
}

bootstrap().catch((error) => {
  console.error("Could not initialize the scoreboard:", error);
  showStartupError("The scoreboard could not load. Serve this folder over HTTP (for example, python3 -m http.server 8000), check that its files are available, and reload the page.");
});
