export const SUPPORTED_LANGUAGES = Object.freeze(["en", "ru", "uk"]);

const REQUIRED_TEXT_KEYS = [
  "title", "description", "skip", "brand", "brandLabel", "brandTileOne", "brandTileTwo",
  "edition", "languageLabel", "eyebrow", "introTitle", "introCopy", "round",
  "timerHeading", "secondsBadge", "timerLabel", "resetTimer", "timerFootnote",
  "playersHeading", "renameHint", "playerOneLabel", "playerTwoLabel", "pointsLabel",
  "scoreCorrectQuestion", "scoreCorrect", "scoreIncorrect", "nextRound", "nextRoundHint",
  "rulesSummary", "ruleBuildTitle", "ruleBuildBody", "ruleGuessTitle", "ruleGuessBody",
  "ruleScoreTitle", "ruleScoreBody", "rulesSourcePrefix", "rulesSourceLink",
  "footerTagline", "footerNote", "defaultPlayer", "scoreLabel", "minusLabel", "plusLabel",
  "speaker", "translator", "speakerHint", "translatorHint", "buildingHint", "guessingHint",
];
const REQUIRED_PHASES = ["ready", "running", "paused", "finished"];
const REQUIRED_ANNOUNCEMENTS = ["score", "finished", "paused", "resumed", "started", "reset", "nextRound"];
const PLACEHOLDERS = {
  defaultPlayer: ["number"],
  scoreLabel: ["name"],
  minusLabel: ["name"],
  plusLabel: ["name"],
  buildingHint: ["speaker"],
  guessingHint: ["translator"],
  "announcements.score": ["name", "points", "score"],
  "announcements.finished": ["translator"],
  "announcements.started": ["speaker"],
  "announcements.nextRound": ["round", "speaker", "translator"],
};

function validateText(value, path, language) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing translation: ${language}.${path}`);
  }
  const actual = [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  const expected = PLACEHOLDERS[path] || [];
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Translation placeholders do not match: ${language}.${path}`);
  }
}

function validateDictionary(dictionary, language) {
  for (const key of REQUIRED_TEXT_KEYS) validateText(dictionary?.[key], key, language);
  for (const phase of REQUIRED_PHASES) {
    const labels = dictionary.phases?.[phase];
    if (!Array.isArray(labels) || labels.length !== 3) {
      throw new Error(`Invalid translation list: ${language}.phases.${phase}`);
    }
    labels.forEach((label, index) => validateText(label, `phases.${phase}.${index}`, language));
  }
  for (const key of REQUIRED_ANNOUNCEMENTS) {
    validateText(dictionary.announcements?.[key], `announcements.${key}`, language);
  }
  for (const category of new Intl.PluralRules(language).resolvedOptions().pluralCategories) {
    validateText(dictionary.pointForms?.[category], `pointForms.${category}`, language);
  }
}

export async function loadLocales(fetcher = globalThis.fetch) {
  const entries = await Promise.all(SUPPORTED_LANGUAGES.map(async (language) => {
    const response = await fetcher(new URL(`../locales/${language}.json`, import.meta.url));
    if (!response.ok) throw new Error(`Could not load ${language} translations (${response.status}).`);
    return [language, await response.json()];
  }));
  return Object.fromEntries(entries);
}

export function createI18n(dictionaries) {
  for (const language of SUPPORTED_LANGUAGES) {
    validateDictionary(dictionaries[language], language);
  }
  let language = "en";

  function entry(key) {
    return key.split(".").reduce((value, part) => value?.[part], dictionaries[language]);
  }

  function t(key, values = {}) {
    const template = entry(key);
    if (typeof template !== "string") throw new Error(`Unknown translation: ${key}`);
    return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ""));
  }

  function setLanguage(nextLanguage) {
    if (!SUPPORTED_LANGUAGES.includes(nextLanguage)) throw new RangeError(`Unsupported language: ${nextLanguage}`);
    language = nextLanguage;
  }

  function pointWord(score) {
    const form = new Intl.PluralRules(language).select(score);
    return entry(`pointForms.${form}`) || entry("pointForms.other");
  }

  function phaseLabels(phase) {
    const labels = entry(`phases.${phase}`);
    if (!Array.isArray(labels)) throw new Error(`Unknown timer phase: ${phase}`);
    return [...labels];
  }

  return Object.freeze({
    languages: SUPPORTED_LANGUAGES,
    get language() { return language; },
    t,
    setLanguage,
    pointWord,
    phaseLabels,
  });
}
