import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createI18n, loadLocales, SUPPORTED_LANGUAGES } from "../js/i18n.js";

const dictionaries = Object.fromEntries(await Promise.all(SUPPORTED_LANGUAGES.map(async (language) => [
  language,
  JSON.parse(await readFile(new URL(`../locales/${language}.json`, import.meta.url), "utf8")),
])));

test("every locale supplies all strings, phases, placeholders, and HTML bindings", async () => {
  const i18n = createI18n(dictionaries);
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const keys = [...html.matchAll(/data-i18n(?:-label)?="([^"]+)"/g)].map((match) => match[1]);
  for (const language of SUPPORTED_LANGUAGES) {
    i18n.setLanguage(language);
    for (const key of keys) assert(i18n.t(key).trim());
    for (const phase of ["ready", "running", "paused", "finished"]) assert.equal(i18n.phaseLabels(phase).length, 3);
  }
});

test("English, Russian, and Ukrainian score plural forms are correct", () => {
  const i18n = createI18n(dictionaries);
  for (const [language, expected] of [
    ["en", ["point", "points", "points", "points", "points", "points"]],
    ["ru", ["очко", "очка", "очков", "очков", "очко", "очка"]],
    ["uk", ["очко", "очки", "очок", "очок", "очко", "очки"]],
  ]) {
    i18n.setLanguage(language);
    assert.deepEqual([1, 2, 5, 11, 21, 22].map(i18n.pointWord), expected);
  }
});

test("formatting preserves user text literally, and language changes do not mutate translations", () => {
  const i18n = createI18n(dictionaries);
  const before = JSON.stringify(dictionaries);
  assert.equal(i18n.t("scoreLabel", { name: "<b>$&{name}</b>" }), "Score for <b>$&{name}</b>");
  i18n.setLanguage("uk");
  assert.equal(i18n.t("defaultPlayer", { number: 2 }), "Гравець 2");
  const labels = i18n.phaseLabels("ready");
  labels[0] = "changed";
  assert.notEqual(i18n.phaseLabels("ready")[0], "changed");
  assert.equal(JSON.stringify(dictionaries), before);
  assert.throws(() => i18n.setLanguage("ua"), RangeError);
});

test("incomplete or mismatched locale data is rejected before application startup", () => {
  const missing = structuredClone(dictionaries);
  delete missing.uk.timerHeading;
  assert.throws(() => createI18n(missing), /Missing translation/);
  const mismatched = structuredClone(dictionaries);
  mismatched.ru.defaultPlayer = "Игрок {wrong}";
  assert.throws(() => createI18n(mismatched), /placeholders/);
});

test("English must satisfy the application contract independently of other dictionaries", () => {
  for (const key of ["title", "defaultPlayer", "translatorHint"]) {
    const missing = structuredClone(dictionaries);
    delete missing.en[key];
    assert.throws(() => createI18n(missing), new RegExp(`Missing translation: en.${key}`));
  }
  for (const phase of ["ready", "running", "paused", "finished"]) {
    const missing = structuredClone(dictionaries);
    delete missing.en.phases[phase];
    assert.throws(() => createI18n(missing), new RegExp(`en.phases.${phase}`));
  }
  const missingAnnouncement = structuredClone(dictionaries);
  delete missingAnnouncement.en.announcements.finished;
  assert.throws(() => createI18n(missingAnnouncement), /en.announcements.finished/);
});

test("every Russian and Ukrainian plural category must be a nonempty string", () => {
  for (const language of ["ru", "uk"]) {
    for (const category of new Intl.PluralRules(language).resolvedOptions().pluralCategories) {
      for (const invalid of [undefined, " ", 5]) {
        const missing = structuredClone(dictionaries);
        missing[language].pointForms[category] = invalid;
        assert.throws(() => createI18n(missing), new RegExp(`${language}.pointForms.${category}`));
      }
    }
  }
});

test("JSON loading requests each locale once and reports unavailable or invalid files", async () => {
  const requested = [];
  const loaded = await loadLocales(async (url) => {
    const language = url.pathname.split("/").at(-1).replace(".json", "");
    requested.push(language);
    return { ok: true, json: async () => dictionaries[language] };
  });
  assert.deepEqual(requested.sort(), [...SUPPORTED_LANGUAGES].sort());
  assert.deepEqual(loaded, dictionaries);
  await assert.rejects(loadLocales(async () => ({ ok: false, status: 404 })), /Could not load/);
  await assert.rejects(loadLocales(async () => ({ ok: true, json: async () => { throw new SyntaxError("Invalid JSON"); } })), SyntaxError);
});
