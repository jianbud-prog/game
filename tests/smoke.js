"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const gameSource = fs.readFileSync(path.join(root, "game.js"), "utf8");
const SAVE_KEY = "cozy-little-garden-save-v2";

class FakeClassList {
  constructor() {
    this.names = new Set();
  }
  add(...names) { names.forEach((name) => this.names.add(name)); }
  remove(...names) { names.forEach((name) => this.names.delete(name)); }
  contains(name) { return this.names.has(name); }
  toggle(name, force) {
    const next = force === undefined ? !this.names.has(name) : Boolean(force);
    if (next) this.names.add(name); else this.names.delete(name);
    return next;
  }
}

class FakeStyle {
  setProperty(name, value) { this[name] = value; }
}

class FakeCanvasContext {
  createLinearGradient() { return { addColorStop() {} }; }
  setTransform() {}
  clearRect() {}
  fillRect() {}
  beginPath() {}
  closePath() {}
  ellipse() {}
  arc() {}
  lineTo() {}
  roundRect() {}
  moveTo() {}
  fill() {}
  stroke() {}
  save() {}
  restore() {}
  translate() {}
  rotate() {}
}

class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.textContent = "";
    this.value = "";
    this.disabled = false;
    this.open = false;
    this.dataset = {};
    this.style = new FakeStyle();
    this.classList = new FakeClassList();
    this.children = [];
    this.listeners = {};
    this.attributes = new Map();
    this.selectorChildren = new Map();
    this.offsetWidth = 100;
  }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  querySelector(selector) {
    if (!this.selectorChildren.has(selector)) this.selectorChildren.set(selector, new FakeElement(`${this.id}-${selector}`));
    return this.selectorChildren.get(selector);
  }
  querySelectorAll(selector) {
    if (selector === "[data-action]") return this.actionButtons || [];
    if (selector === "[data-strategy]") return this.strategyButtons || [];
    return [];
  }
  closest() { return this.closestElement || new FakeElement("closest"); }
  appendChild(child) { this.children.push(child); return child; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = [...children]; }
  remove() {}
  focus() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
  getBoundingClientRect() { return { width: 620, height: 400, left: 0, top: 0 }; }
  getContext() { return new FakeCanvasContext(); }
}

class MemoryStorage {
  constructor(seed = {}) { this.values = new Map(Object.entries(seed)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function makeDocument() {
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
  const elements = new Map(ids.map((id) => [id, new FakeElement(id)]));
  const actions = ["water", "sun", "soil", "music", "tonic"].map((action) => {
    const button = new FakeElement(`action-${action}`);
    button.dataset.action = action;
    return button;
  });
  elements.get("actionGrid").actionButtons = actions;
  const strategies = ["balanced", "irrigate", "ventilate", "shade"].map((strategy) => {
    const button = new FakeElement(`strategy-${strategy}`);
    button.dataset.strategy = strategy;
    return button;
  });
  elements.get("strategyGrid").strategyButtons = strategies;

  STAT_IDS.forEach((id) => {
    elements.get(`${id}Meter`).closestElement = new FakeElement(`${id}-stat`);
  });

  const settingsClose = new FakeElement("settings-close");
  const document = {
    hidden: false,
    listeners: {},
    getElementById(id) { return elements.get(id) || null; },
    querySelector(selector) { return selector === "[data-close='settings']" ? settingsClose : new FakeElement("query"); },
    createElement() { return new FakeElement("created"); },
    addEventListener(type, listener) { this.listeners[type] = listener; }
  };
  return { document, elements, actions, strategies };
}

const STAT_IDS = ["water", "sunlight", "nutrients", "vitality", "health"];

function runGame(storage, clockRef, options = {}) {
  const { document, elements, actions, strategies } = makeDocument();
  const selectedSpecies = new FakeElement("selected-species");
  selectedSpecies.value = options.species || "tomato";
  elements.get("welcomeForm").selectorChildren.set("input[name='species']:checked", selectedSpecies);
  let timeoutId = 0;
  const context = {
    console: { log() {}, warn() {}, error: console.error },
    document,
    localStorage: storage,
    performance: { now: () => clockRef.value },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    confirm: () => false,
    location: { reload() {} },
    devicePixelRatio: 1
  };
  if (options.fetch) context.fetch = options.fetch;
  context.Date = class extends Date { static now() { return clockRef.value; } };
  context.window = context;
  context.window.setTimeout = () => ++timeoutId;
  context.window.clearTimeout = () => {};
  context.window.setInterval = () => ++timeoutId;
  context.window.clearInterval = () => {};
  context.window.addEventListener = () => {};
  context.window.location = context.location;
  vm.runInNewContext(gameSource, context, { filename: "game.js" });
  return { elements, actions, strategies, document };
}

function clickAction(app, actionName) {
  const button = app.actions.find((item) => item.dataset.action === actionName);
  app.elements.get("actionGrid").listeners.click({ target: { closest: () => button } });
}

const clock = { value: 1_800_000_000_000 };
const storage = new MemoryStorage();
const app = runGame(storage, clock);

assert.equal(app.elements.get("welcomeDialog").open, true, "새 게임은 이름 입력창을 연다");
app.elements.get("nameInput").value = "몽실이";
app.elements.get("welcomeForm").listeners.submit({ preventDefault() {} });

let saved = JSON.parse(storage.getItem(SAVE_KEY));
assert.equal(saved.plant.name, "몽실이");
assert.equal(saved.plant.stage, "seed");
assert.equal(saved.plant.speciesId, "tomato", "데이터 리그는 방울토마토로 시작한다");
assert.equal(saved.stats.water, 82);
assert.equal(saved.league.day, 1);
assert.equal(app.elements.get("seasonWeek").textContent, "2주차", "스마트팜 벤치마크 주차를 표시한다");
assert.equal(app.elements.get("farmStem").textContent, "2 mm", "실제 2주차 줄기 중앙값을 표시한다");
assert.ok(app.elements.get("pet").classList.contains("species-tomato"), "방울토마토 외형 클래스를 반영한다");
assert.equal(app.elements.get("speciesScientific").textContent, "Solanum lycopersicum L.", "GBIF 학명을 표시한다");

clock.value += 2_000;
clickAction(app, "water");
saved = JSON.parse(storage.getItem(SAVE_KEY));
assert.equal(saved.stats.water, 100);
assert.equal(saved.counters.water, 1);
assert.equal(saved.plant.xp, 5);

clock.value += 2_000;
clickAction(app, "music");
saved = JSON.parse(storage.getItem(SAVE_KEY));
assert.equal(saved.stats.vitality, 100);
assert.equal(saved.counters.music, 1);

clock.value += 10_000;
clickAction(app, "soil");
closeFarmDay(app);
saved = JSON.parse(storage.getItem(SAVE_KEY));
assert.equal(saved.plant.stage, "sprout", "첫 영농일 결과가 저장되면 씨앗이 새싹을 틔운다");
assert.equal(saved.league.day, 2, "영농일이 하루 진행된다");
assert.equal(saved.league.history.length, 1, "일일 생육 점수를 시즌 기록에 저장한다");
assert.equal(app.elements.get("dayReportDialog").open, true, "영농일 결과 리포트를 연다");
app.elements.get("dayReportClose").listeners.click();

clock.value += 2_000;
const beforeMiniSun = saved.stats.sunlight;
const beforeMiniWater = saved.stats.water;
clickAction(app, "sun");
assert.equal(app.elements.get("minigameDialog").open, true, "햇빛 받기는 미니게임을 연다");
app.elements.get("quitGameButton").listeners.click();
saved = JSON.parse(storage.getItem(SAVE_KEY));
assert.equal(saved.counters.sun, 1);
assert.ok(saved.stats.sunlight > beforeMiniSun, "햇살방울 보상으로 광량 준비도가 오른다");
assert.ok(saved.stats.water < beforeMiniWater, "햇빛 활동은 수분을 소모한다");

app.elements.get("soundButton").listeners.click();
saved = JSON.parse(storage.getItem(SAVE_KEY));
assert.equal(saved.settings.muted, true, "음소거 설정을 저장한다");

const beforeOffline = saved.stats.water;
clock.value += 6 * 60 * 60 * 1_000;
runGame(storage, clock);
saved = JSON.parse(storage.getItem(SAVE_KEY));
assert.ok(saved.stats.water < beforeOffline, "오프라인 경과 시간만큼 수분이 감소한다");
assert.ok(saved.stats.water >= 0 && saved.stats.health >= 0, "상태값은 0 아래로 내려가지 않는다");

function offlineWeatherResult(weatherData) {
  const seeded = JSON.parse(storage.getItem(SAVE_KEY));
  seeded.stats = { water: 90, sunlight: 60, nutrients: 90, vitality: 90, health: 100 };
  seeded.lastSeen = clock.value - 60 * 60 * 1_000;
  seeded.weather = weatherData ? { fetchedAt: clock.value - 30 * 60_000, data: weatherData } : { fetchedAt: 0, data: null };
  const weatherStorage = new MemoryStorage({ [SAVE_KEY]: JSON.stringify(seeded) });
  const weatherApp = runGame(weatherStorage, clock);
  return { saved: JSON.parse(weatherStorage.getItem(SAVE_KEY)), app: weatherApp };
}

function chooseStrategy(app, strategyName) {
  const button = app.strategies.find((item) => item.dataset.strategy === strategyName);
  app.elements.get("strategyGrid").listeners.click({ target: { closest: () => button } });
}

function closeFarmDay(app) {
  app.elements.get("closeDayButton").listeners.click();
}

const neutralHour = offlineWeatherResult(null);
const hotHour = offlineWeatherResult({
  temperature: 35, humidity: 30, precipitation: 0, weatherCode: 0, cloudCover: 5, isDay: 1,
  maxTemperature: 36, minTemperature: 26, sunrise: "2026-08-25T05:56", sunset: "2026-08-25T19:12"
});
assert.ok(hotHour.saved.stats.water < neutralHour.saved.stats.water, "실제 폭염 데이터는 기본 환경보다 수분을 빠르게 소모시킨다");
assert.ok(hotHour.saved.stats.sunlight > neutralHour.saved.stats.sunlight, "맑은 낮 데이터는 햇빛 상태를 높인다");

const rainyHour = offlineWeatherResult({
  temperature: 21, humidity: 92, precipitation: 1.2, weatherCode: 61, cloudCover: 96, isDay: 1,
  maxTemperature: 23, minTemperature: 17, sunrise: "2026-08-25T05:56", sunset: "2026-08-25T19:12"
});
assert.ok(rainyHour.saved.stats.water > neutralHour.saved.stats.water, "비와 높은 습도는 수분 마름을 늦춘다");
assert.ok(rainyHour.app.elements.get("room").classList.contains("weather-rain"), "비 날씨가 온실 장면에 반영된다");
assert.match(rainyHour.app.elements.get("weatherEffect").textContent, /촉촉/, "날씨가 게임에 미치는 효과를 글로 설명한다");

const oddSeed = JSON.parse(storage.getItem(SAVE_KEY));
oddSeed.plant.stage = "seed";
oddSeed.plant.plantedAt = clock.value + 7 * 24 * 60 * 60 * 1_000;
oddSeed.stats.sunlight = "not-a-number";
oddSeed.lastSeen = clock.value + 7 * 24 * 60 * 60 * 1_000;
const oddStorage = new MemoryStorage({ [SAVE_KEY]: JSON.stringify(oddSeed) });
runGame(oddStorage, clock);
const repairedOddSave = JSON.parse(oddStorage.getItem(SAVE_KEY));
assert.equal(repairedOddSave.plant.plantedAt, clock.value, "미래의 식재 시각을 현재 시각으로 보정한다");
assert.equal(repairedOddSave.stats.sunlight, 82, "잘못된 상태값은 안전한 기본값으로 복구한다");

function assertFruitForm(counters, expected) {
  const seeded = JSON.parse(storage.getItem(SAVE_KEY));
  seeded.plant.stage = "flower";
  seeded.plant.form = null;
  seeded.plant.xp = 150;
  seeded.plant.isSick = false;
  seeded.league = { ...seeded.league, day: 21, daysPlayed: 20, lastClosedAt: 0 };
  seeded.stats = { water: 80, sunlight: 80, nutrients: 80, vitality: 80, health: 90 };
  seeded.counters = { tonic: 0, ...counters };
  seeded.lastSeen = clock.value;
  const formStorage = new MemoryStorage({ [SAVE_KEY]: JSON.stringify(seeded) });
  runGame(formStorage, clock);
  const result = JSON.parse(formStorage.getItem(SAVE_KEY));
  assert.equal(result.plant.stage, "fruit");
  assert.equal(result.plant.form, expected);
}

assertFruitForm({ water: 3, sun: 3, soil: 3, music: 3 }, "balanced");
assertFruitForm({ water: 1, sun: 8, soil: 1, music: 1 }, "sunny");
assertFruitForm({ water: 8, sun: 1, soil: 4, music: 1 }, "dewy");

function assertGrowthStage(startStage, xp, expectedStage) {
  const seeded = JSON.parse(storage.getItem(SAVE_KEY));
  seeded.plant.stage = startStage;
  seeded.plant.form = null;
  seeded.plant.xp = xp;
  seeded.plant.isSick = false;
  seeded.stats = { water: 80, sunlight: 80, nutrients: 80, vitality: 80, health: 90 };
  seeded.league = { ...seeded.league, day: expectedStage === "tree" ? 7 : 15, daysPlayed: expectedStage === "tree" ? 6 : 14, lastClosedAt: 0 };
  seeded.lastSeen = clock.value;
  const stageStorage = new MemoryStorage({ [SAVE_KEY]: JSON.stringify(seeded) });
  runGame(stageStorage, clock);
  assert.equal(JSON.parse(stageStorage.getItem(SAVE_KEY)).plant.stage, expectedStage);
}

assertGrowthStage("sprout", 35, "tree");
assertGrowthStage("tree", 90, "flower");

const sickSeed = JSON.parse(storage.getItem(SAVE_KEY));
sickSeed.plant.stage = "sprout";
sickSeed.plant.xp = 10;
sickSeed.plant.isSick = true;
sickSeed.stats = { water: 80, sunlight: 80, nutrients: 80, vitality: 80, health: 35 };
sickSeed.lastSeen = clock.value;
const sickStorage = new MemoryStorage({ [SAVE_KEY]: JSON.stringify(sickSeed) });
const sickApp = runGame(sickStorage, clock);
clock.value += 2_000;
clickAction(sickApp, "tonic");
const recoveredPlant = JSON.parse(sickStorage.getItem(SAVE_KEY));
assert.equal(recoveredPlant.plant.isSick, false, "영양제로 시든 식물을 회복한다");
assert.equal(recoveredPlant.stats.health, 65);

function scoreFarmDay(strategy) {
  const seeded = JSON.parse(storage.getItem(SAVE_KEY));
  seeded.plant.stage = "sprout";
  seeded.plant.isSick = false;
  seeded.stats = { water: 45, sunlight: 78, nutrients: 75, vitality: 78, health: 90 };
  seeded.league = { day: 5, daysPlayed: 0, rating: 75, strategy: "balanced", dailyCare: 2, lastClosedAt: 0, history: [] };
  seeded.weather = {
    fetchedAt: clock.value,
    data: {
      temperature: 29, humidity: 38, precipitation: 0, weatherCode: 0, cloudCover: 8, isDay: 1,
      maxTemperature: 31, minTemperature: 21, sunrise: "2026-08-25T05:56", sunset: "2026-08-25T19:12",
      radiation: 18, evapotranspiration: 5.2
    }
  };
  seeded.lastSeen = clock.value;
  const dayStorage = new MemoryStorage({ [SAVE_KEY]: JSON.stringify(seeded) });
  const dayApp = runGame(dayStorage, clock);
  chooseStrategy(dayApp, strategy);
  closeFarmDay(dayApp);
  return JSON.parse(dayStorage.getItem(SAVE_KEY)).league.history[0].score;
}

const balancedDryScore = scoreFarmDay("balanced");
const irrigatedDryScore = scoreFarmDay("irrigate");
assert.ok(irrigatedDryScore > balancedDryScore, "실제 고온·건조 환경에서는 관수 강화 전략이 생육 점수를 높인다");

const legacySave = JSON.parse(storage.getItem(SAVE_KEY));
delete legacySave.league;
delete legacySave.soil;
legacySave.plant.speciesId = "apple";
legacySave.plant.stage = "flower";
legacySave.lastSeen = clock.value;
const legacyStorage = new MemoryStorage({ [SAVE_KEY]: JSON.stringify(legacySave) });
runGame(legacyStorage, clock);
const migrated = JSON.parse(legacyStorage.getItem(SAVE_KEY));
assert.equal(migrated.plant.speciesId, "tomato", "기존 다종 저장을 방울토마토 데이터 리그로 이전한다");
assert.equal(migrated.league.day, 15, "기존 성장 단계를 대응하는 시즌 일차로 보존한다");

const brokenStorage = new MemoryStorage({ [SAVE_KEY]: "{broken" });
const recovered = runGame(brokenStorage, clock);
assert.equal(recovered.elements.get("welcomeDialog").open, true, "손상된 저장 데이터는 새 게임으로 복구한다");

console.log("Smoke tests passed: data league, smartfarm benchmark, weather strategy, planting, care, farm-day report, sunlight game, save migration, offline progress, fruit forms, recovery.");
