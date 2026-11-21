import { MAX_SCORE } from "./game.js";

export function showStartupError(message, document = globalThis.document) {
  document.querySelectorAll("button, input").forEach((control) => { control.disabled = true; });
  document.getElementById("main").setAttribute("aria-busy", "false");
  document.getElementById("startup-status").hidden = true;
  const error = document.getElementById("startup-error");
  error.textContent = message;
  error.hidden = false;
}

export function createView(i18n, document = globalThis.document) {
  const byId = (id) => document.getElementById(id);
  const controls = Object.freeze({
    players: Object.freeze([1, 2].map((id) => Object.freeze({
      id,
      name: byId(`player-${id}-name`),
      score: byId(`player-${id}-score`),
      minus: byId(`player-${id}-minus`),
      plus: byId(`player-${id}-plus`),
    }))),
    start: byId("timer-start"),
    reset: byId("timer-reset"),
    nextRound: byId("next-round"),
    languages: Object.freeze(i18n.languages.map((language) => Object.freeze({
      language,
      button: byId(`language-${language}`),
    }))),
  });
  const timer = {
    card: document.querySelector(".timer-card"),
    display: byId("timer-display"),
    phase: byId("timer-phase"),
    status: byId("timer-status"),
    hint: byId("timer-hint"),
    progress: byId("timer-progress"),
    label: byId("timer-start-label"),
    symbol: document.querySelector(".start-symbol"),
  };

  function playerName(player) {
    return player.customName ?? i18n.t("defaultPlayer", { number: player.id });
  }

  function renderLanguage() {
    document.documentElement.lang = i18n.language;
    document.title = i18n.t("title");
    document.querySelector('meta[name="description"]').content = i18n.t("description");
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = i18n.t(element.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-label]").forEach((element) => {
      element.setAttribute("aria-label", i18n.t(element.dataset.i18nLabel));
    });
    for (const { language, button } of controls.languages) {
      button.setAttribute("aria-pressed", String(language === i18n.language));
    }
  }

  function renderGame(game, { forceNames = false, forceNameId = null, forceScoreId = null } = {}) {
    byId("round-number").textContent = String(game.round).padStart(2, "0");
    for (const player of game.players) {
      const fields = controls.players.find((entry) => entry.id === player.id);
      const name = playerName(player);
      if ((forceNames || document.activeElement !== fields.name || forceNameId === player.id) && fields.name.value !== name) {
        fields.name.value = name;
      }
      if (!player.canEditScore || document.activeElement !== fields.score || forceScoreId === player.id) {
        if (fields.score.value !== String(player.score)) fields.score.value = String(player.score);
      }
      fields.name.closest("article").setAttribute("aria-label", name);
      fields.score.setAttribute("aria-label", i18n.t("scoreLabel", { name }));
      fields.minus.setAttribute("aria-label", i18n.t("minusLabel", { name }));
      fields.plus.setAttribute("aria-label", i18n.t("plusLabel", { name }));
      fields.score.readOnly = !player.canEditScore;
      fields.minus.disabled = !player.canEditScore || player.score === 0;
      fields.plus.disabled = !player.canEditScore || player.score === MAX_SCORE;
      const role = byId(`player-${player.id}-role`);
      role.textContent = i18n.t(player.role);
      role.className = `role-badge role-${player.role}`;
      byId(`player-${player.id}-role-hint`).textContent = i18n.t(`${player.role}Hint`);
    }
  }

  function renderTimer(snapshot, game) {
    const seconds = Math.ceil(snapshot.remainingMs / 1000);
    timer.display.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    timer.progress.style.strokeDashoffset = String(1 - snapshot.remainingMs / snapshot.durationMs);
    timer.card.classList.toggle("is-finished", snapshot.phase === "finished");
    const [phase, status, button] = i18n.phaseLabels(snapshot.phase);
    timer.phase.textContent = phase;
    timer.status.textContent = status;
    timer.label.textContent = button;
    timer.symbol.textContent = snapshot.phase === "running" ? "Ⅱ" : "▶";
    timer.hint.textContent = i18n.t(snapshot.phase === "finished" ? "guessingHint" : "buildingHint", {
      speaker: playerName(game.players.find((player) => player.id === game.speakerId)),
      translator: playerName(game.players.find((player) => player.id === game.translatorId)),
    });
  }

  function renderAnnouncement(announcement, game) {
    if (!announcement) return;
    const { key, values = {} } = announcement;
    const params = {
      ...values,
      speaker: playerName(game.players.find((player) => player.id === game.speakerId)),
      translator: playerName(game.players.find((player) => player.id === game.translatorId)),
      round: game.round,
    };
    if (values.playerNumber) params.name = playerName(game.players.find((player) => player.id === values.playerNumber));
    if (values.score !== undefined) params.points = i18n.pointWord(values.score);
    const message = i18n.t(`announcements.${key}`, params);
    const status = byId("game-status");
    if (status.textContent !== message) status.textContent = message;
  }

  function showReady(game, countdown, announcement) {
    document.querySelectorAll("button, input").forEach((control) => { control.disabled = false; });
    renderLanguage();
    renderGame(game);
    renderTimer(countdown, game);
    renderAnnouncement(announcement, game);
    byId("startup-status").hidden = true;
    byId("startup-error").hidden = true;
    byId("main").setAttribute("aria-busy", "false");
  }

  return Object.freeze({ controls, renderLanguage, renderGame, renderTimer, renderAnnouncement, showReady });
}
