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
  querySelectorAll(selector) { return selector === "[data-action]" ? (this.actionButtons || []) : []; }
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
  return { document, elements, actions };
}

const STAT_IDS = ["water", "sunlight", "nutrients", "vitality", "health"];

function runGame(storage, clockRef) {
  const { document, elements, actions } = makeDocument();
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
  context.Date = class extends Date { static now() { return clockRef.value; } };
  context.window = context;
  context.window.setTimeout = () => ++timeoutId;
  context.window.clearTimeout = () => {};
  context.window.setInterval = () => ++timeoutId;
  context.window.clearInterval = () => {};
  context.window.addEventListener = () => {};
  context.window.location = context.location;
  vm.runInNewContext(gameSource, context, { filename: "game.js" });
  return { elements, actions, document };
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
assert.equal(saved.stats.water, 82);

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
saved = JSON.parse(storage.getItem(SAVE_KEY));
assert.equal(saved.plant.stage, "sprout", "충분한 시간이 지나면 씨앗이 새싹을 틔운다");

clock.value += 2_000;
clickAction(app, "sun");
assert.equal(app.elements.get("minigameDialog").open, true, "햇빛 받기는 미니게임을 연다");
app.elements.get("quitGameButton").listeners.click();
saved = JSON.parse(storage.getItem(SAVE_KEY));
assert.equal(saved.counters.sun, 1);
assert.equal(saved.stats.sunlight, 88);
assert.equal(saved.stats.water, 90);

app.elements.get("soundButton").listeners.click();
saved = JSON.parse(storage.getItem(SAVE_KEY));
assert.equal(saved.settings.muted, true, "음소거 설정을 저장한다");

const beforeOffline = saved.stats.water;
clock.value += 6 * 60 * 60 * 1_000;
runGame(storage, clock);
saved = JSON.parse(storage.getItem(SAVE_KEY));
assert.ok(saved.stats.water < beforeOffline, "오프라인 경과 시간만큼 수분이 감소한다");
assert.ok(saved.stats.water >= 0 && saved.stats.health >= 0, "상태값은 0 아래로 내려가지 않는다");

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

const brokenStorage = new MemoryStorage({ [SAVE_KEY]: "{broken" });
const recovered = runGame(brokenStorage, clock);
assert.equal(recovered.elements.get("welcomeDialog").open, true, "손상된 저장 데이터는 새 게임으로 복구한다");

console.log("Smoke tests passed: planting, care, sprouting, sunlight game, save, offline progress, fruit forms, recovery.");
