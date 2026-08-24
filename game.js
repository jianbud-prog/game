(() => {
  "use strict";

  const SAVE_KEY = "cozy-little-garden-save-v2";
  const SAVE_VERSION = 2;
  const SPROUT_TIME_MS = 8_000;
  const TREE_XP = 35;
  const FLOWER_XP = 90;
  const FRUIT_XP = 150;
  const STAT_KEYS = ["water", "sunlight", "nutrients", "vitality", "health"];
  const CORE_STAT_KEYS = ["water", "sunlight", "nutrients", "vitality"];
  const STAGE_CLASSES = ["stage-seed", "stage-sprout", "stage-tree", "stage-flower", "stage-fruit"];
  const FORM_CLASSES = ["form-balanced", "form-sunny", "form-dewy"];
  const ACTION_CLASSES = ["action-water", "action-soil", "action-heal", "action-sun", "action-music", "action-evolve"];

  const el = (id) => document.getElementById(id);
  const dom = {
    plant: el("pet"),
    plantName: el("petName"),
    stageLabel: el("stageLabel"),
    ageLabel: el("ageLabel"),
    speechBubble: el("speechBubble"),
    speechText: el("speechText"),
    sickMark: el("sickMark"),
    moodOrb: el("moodOrb"),
    moodFace: el("moodFace"),
    conditionChip: el("conditionChip"),
    growthCopy: el("growthCopy"),
    growthTrack: el("growthTrack"),
    growthFill: el("growthFill"),
    actionGrid: el("actionGrid"),
    actionHint: el("actionHint"),
    particleLayer: el("particleLayer"),
    toast: el("toast"),
    soundButton: el("soundButton"),
    soundIcon: el("soundIcon"),
    settingsButton: el("settingsButton"),
    settingsDialog: el("settingsDialog"),
    soundToggle: el("soundToggle"),
    settingsAge: el("settingsAge"),
    settingsStage: el("settingsStage"),
    resetButton: el("resetButton"),
    welcomeDialog: el("welcomeDialog"),
    welcomeForm: el("welcomeForm"),
    nameInput: el("nameInput"),
    nameError: el("nameError"),
    offlineDialog: el("offlineDialog"),
    offlineSummary: el("offlineSummary"),
    offlineChanges: el("offlineChanges"),
    offlineClose: el("offlineClose"),
    minigameDialog: el("minigameDialog"),
    gameCanvas: el("gameCanvas"),
    gameScore: el("gameScore"),
    gameTime: el("gameTime"),
    gameCountdown: el("gameCountdown"),
    quitGameButton: el("quitGameButton")
  };

  const stageInfo = {
    seed: { label: "작은 씨앗", aria: "화분 흙에 심긴 작은 갈색 씨앗" },
    sprout: { label: "초록 새싹", aria: "화분 위로 두 잎을 틔운 초록 새싹" },
    tree: { label: "어린 나무", aria: "둥근 잎이 풍성하게 자란 어린 나무" },
    flower: { label: "활짝 핀 꽃", aria: "나무 위에 분홍 꽃을 활짝 피운 반려 식물" },
    fruit: { label: "열매 나무", aria: "세 개의 열매를 맺은 건강한 반려 식물" }
  };

  const formInfo = {
    balanced: { label: "별빛 열매", aria: "분홍빛 별빛 열매를 맺은 균형 잡힌 나무" },
    sunny: { label: "햇살 열매", aria: "노란 햇살 열매를 맺은 밝은 나무" },
    dewy: { label: "이슬 열매", aria: "푸른 이슬 열매를 맺은 촉촉한 나무" }
  };

  function clamp(value, min = 0, max = 100) {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
  }

  function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function createInitialState() {
    return {
      version: SAVE_VERSION,
      plant: {
        name: "",
        plantedAt: null,
        stage: "seed",
        form: null,
        xp: 0,
        isSick: false
      },
      stats: {
        water: 82,
        sunlight: 82,
        nutrients: 82,
        vitality: 82,
        health: 100
      },
      counters: {
        water: 0,
        sun: 0,
        soil: 0,
        music: 0,
        tonic: 0
      },
      settings: {
        muted: false
      },
      lastSeen: Date.now()
    };
  }

  function normalizeState(raw) {
    if (!raw || typeof raw !== "object" || raw.version !== SAVE_VERSION) {
      throw new Error("지원하지 않는 정원 저장 데이터");
    }

    const fresh = createInitialState();
    const now = Date.now();
    const allowedStages = Object.keys(stageInfo);
    const allowedForms = Object.keys(formInfo);
    const name = typeof raw.plant?.name === "string" ? raw.plant.name.trim().slice(0, 10) : "";
    const rawPlantedAt = Number(raw.plant?.plantedAt);
    const plantedAt = Number.isFinite(rawPlantedAt) && rawPlantedAt > 0 ? Math.min(rawPlantedAt, now) : null;
    const stage = allowedStages.includes(raw.plant?.stage) ? raw.plant.stage : "seed";
    const form = allowedForms.includes(raw.plant?.form) ? raw.plant.form : null;

    const normalized = {
      ...fresh,
      plant: {
        ...fresh.plant,
        name,
        plantedAt,
        stage,
        form: stage === "fruit" ? (form || "balanced") : null,
        xp: clamp(Number(raw.plant?.xp), 0, 9999),
        isSick: Boolean(raw.plant?.isSick)
      },
      stats: { ...fresh.stats },
      counters: { ...fresh.counters },
      settings: { muted: Boolean(raw.settings?.muted) },
      lastSeen: Number.isFinite(raw.lastSeen) ? raw.lastSeen : now
    };

    STAT_KEYS.forEach((key) => {
      const value = Number(raw.stats?.[key]);
      normalized.stats[key] = Number.isFinite(value) ? clamp(value) : fresh.stats[key];
    });
    Object.keys(normalized.counters).forEach((key) => {
      const value = Number(raw.counters?.[key]);
      normalized.counters[key] = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    });

    if (!name || !plantedAt) return fresh;
    return normalized;
  }

  function loadGame() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { data: createInitialState(), hadSave: false, wasInvalid: false };
    try {
      return { data: normalizeState(JSON.parse(raw)), hadSave: true, wasInvalid: false };
    } catch (error) {
      console.warn("정원 저장 데이터를 복구했습니다.", error);
      return { data: createInitialState(), hadSave: false, wasInvalid: true };
    }
  }

  const loaded = loadGame();
  let state = loaded.data;
  let lastTickAt = Date.now();
  let lastSavedAt = Date.now();
  let cooldownUntil = 0;
  let toastTimer = 0;
  let speechTimer = 0;
  let animationTimer = 0;
  let audioContext = null;
  let nextEventAt = Date.now() + randomBetween(180_000, 300_000);
  let offlineReport = null;

  if (loaded.hadSave && state.plant.name) {
    const now = Date.now();
    const safeLastSeen = state.lastSeen > now + 300_000 ? now : state.lastSeen;
    const elapsed = Math.max(0, now - safeLastSeen);
    const before = { ...state.stats };
    if (elapsed > 0) applyElapsed(elapsed);
    state.lastSeen = now;
    lastTickAt = now;
    if (elapsed >= 60_000) offlineReport = { elapsed, before, after: { ...state.stats } };
  }

  function saveGame() {
    if (!state.plant.name) return;
    state.lastSeen = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      lastSavedAt = Date.now();
    } catch (error) {
      console.warn("정원을 저장하지 못했습니다.", error);
      showToast("저장 공간을 사용할 수 없어요. 브라우저 설정을 확인해 주세요.");
    }
  }

  function adjustStat(key, delta) {
    state.stats[key] = clamp(state.stats[key] + delta);
  }

  function applyElapsed(milliseconds) {
    if (!state.plant.name || milliseconds <= 0) return;
    const totalMinutes = milliseconds / 60_000;
    const steps = Math.min(720, Math.max(1, Math.ceil(totalMinutes / 5)));
    const minutesPerStep = totalMinutes / steps;

    for (let index = 0; index < steps; index += 1) {
      adjustStat("water", -0.3 * minutesPerStep);
      adjustStat("sunlight", -0.2 * minutesPerStep);
      adjustStat("nutrients", -0.12 * minutesPerStep);
      adjustStat("vitality", -0.18 * minutesPerStep);

      const criticalCount = CORE_STAT_KEYS.filter((key) => state.stats[key] <= 20).length;
      if (criticalCount >= 2) {
        adjustStat("health", -0.38 * minutesPerStep);
      } else if (criticalCount === 0 && !state.plant.isSick) {
        adjustStat("health", 0.08 * minutesPerStep);
      }
      if (state.stats.health <= 35) state.plant.isSick = true;
      if (state.plant.isSick && state.stats.health >= 60 && criticalCount < 2) state.plant.isSick = false;
    }
  }

  function averageCoreStats() {
    return CORE_STAT_KEYS.reduce((sum, key) => sum + state.stats[key], 0) / CORE_STAT_KEYS.length;
  }

  function grantXp(amount) {
    if (state.plant.isSick || averageCoreStats() < 35) return false;
    state.plant.xp = clamp(state.plant.xp + amount, 0, 9999);
    return true;
  }

  function chooseFruitForm() {
    const { water, sun, soil, music } = state.counters;
    const careTotal = Math.max(1, water + sun + soil + music);
    if (sun / careTotal >= 0.4 && sun >= water && sun >= soil) return "sunny";
    if (water + soil > sun + music + 2) return "dewy";
    return "balanced";
  }

  function checkGrowth() {
    if (!state.plant.name || state.plant.isSick || averageCoreStats() < 35) return null;
    const oldStage = state.plant.stage;
    if (state.plant.stage === "seed" && Date.now() - state.plant.plantedAt >= SPROUT_TIME_MS) state.plant.stage = "sprout";
    if (state.plant.stage === "sprout" && state.plant.xp >= TREE_XP) state.plant.stage = "tree";
    if (state.plant.stage === "tree" && state.plant.xp >= FLOWER_XP) state.plant.stage = "flower";
    if (state.plant.stage === "flower" && state.plant.xp >= FRUIT_XP) {
      state.plant.stage = "fruit";
      state.plant.form = chooseFruitForm();
    }
    return oldStage === state.plant.stage ? null : { oldStage, newStage: state.plant.stage, form: state.plant.form };
  }

  function stageDisplay() {
    return state.plant.stage === "fruit" ? formInfo[state.plant.form || "balanced"] : stageInfo[state.plant.stage];
  }

  function formatDuration(milliseconds) {
    const minutes = Math.max(0, Math.floor(milliseconds / 60_000));
    if (minutes < 1) return "방금 심음";
    if (minutes < 60) return `${minutes}분째 함께`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 ${minutes % 60}분째`;
    const days = Math.floor(hours / 24);
    return `${days}일 ${hours % 24}시간째`;
  }

  function growthState() {
    if (state.plant.stage === "seed") {
      const elapsed = Math.max(0, Date.now() - state.plant.plantedAt);
      return { percent: clamp((elapsed / SPROUT_TIME_MS) * 100), copy: elapsed >= SPROUT_TIME_MS ? "곧 새싹이 올라와요" : "새싹을 틔울 준비 중" };
    }
    if (state.plant.stage === "sprout") return { percent: clamp((state.plant.xp / TREE_XP) * 100), copy: `나무까지 ${Math.max(0, TREE_XP - Math.floor(state.plant.xp))} 성장` };
    if (state.plant.stage === "tree") return { percent: clamp(((state.plant.xp - TREE_XP) / (FLOWER_XP - TREE_XP)) * 100), copy: `꽃까지 ${Math.max(0, FLOWER_XP - Math.floor(state.plant.xp))} 성장` };
    if (state.plant.stage === "flower") return { percent: clamp(((state.plant.xp - FLOWER_XP) / (FRUIT_XP - FLOWER_XP)) * 100), copy: `열매까지 ${Math.max(0, FRUIT_XP - Math.floor(state.plant.xp))} 성장` };
    return { percent: 100, copy: `${formInfo[state.plant.form || "balanced"].label} 완성` };
  }

  function conditionState() {
    if (state.plant.isSick) return { label: "시들고 있어요", className: "danger", face: "﹏", mood: "시듦" };
    const average = averageCoreStats();
    if (average >= 72) return { label: "싱그럽게 반짝여요", className: "", face: "⌣", mood: "싱그러움" };
    if (average >= 42) return { label: "조금 보살펴 주세요", className: "warning", face: "•", mood: "보통" };
    return { label: "돌봄이 필요해요", className: "danger", face: "⌢", mood: "기운 없음" };
  }

  function defaultSpeech() {
    if (!state.plant.name) return "흙 속에서 작은 생명이 기다리고 있어요.";
    if (state.plant.isSick) return "잎에 힘이 없어… 영양제를 줄래?";
    if (state.plant.stage === "seed") return "흙이 포근해. 곧 초록 잎을 보여 줄게!";
    const lowestKey = CORE_STAT_KEYS.reduce((lowest, key) => state.stats[key] < state.stats[lowest] ? key : lowest, CORE_STAT_KEYS[0]);
    if (state.stats[lowestKey] < 28) {
      const messages = {
        water: "흙이 바싹 말랐어… 물이 필요해!",
        sunlight: "따뜻한 햇살을 쬐고 싶어.",
        nutrients: "흙에 영양이 조금 부족한 것 같아.",
        vitality: "기분 좋은 음악을 들려줄래?"
      };
      return messages[lowestKey];
    }
    const messages = [
      `${state.plant.name}, 오늘도 쑥쑥 자라는 중!`,
      "네가 와주니 잎이 더 반짝이는 것 같아.",
      "오늘은 어떤 햇살이 찾아올까?",
      "정원 바람이 살랑살랑 기분 좋아."
    ];
    return messages[Math.floor(Date.now() / 15_000) % messages.length];
  }

  function render() {
    const display = stageDisplay();
    const age = state.plant.plantedAt ? formatDuration(Date.now() - state.plant.plantedAt) : "방금 심음";
    dom.plantName.textContent = state.plant.name || "새 씨앗";
    dom.stageLabel.textContent = display.label;
    dom.ageLabel.textContent = age;
    dom.settingsAge.textContent = age;
    dom.settingsStage.textContent = display.label;

    dom.plant.classList.remove(...STAGE_CLASSES, ...FORM_CLASSES);
    dom.plant.classList.add(`stage-${state.plant.stage}`);
    if (state.plant.stage === "fruit") dom.plant.classList.add(`form-${state.plant.form || "balanced"}`);
    dom.plant.classList.toggle("is-sick", state.plant.isSick);
    dom.plant.setAttribute("aria-label", state.plant.stage === "fruit" ? formInfo[state.plant.form || "balanced"].aria : stageInfo[state.plant.stage].aria);
    dom.sickMark.classList.toggle("visible", state.plant.isSick);

    STAT_KEYS.forEach((key) => {
      const value = Math.round(state.stats[key]);
      const valueEl = el(`${key}Value`);
      const meterEl = el(`${key}Meter`);
      const statEl = meterEl.closest(".stat");
      valueEl.textContent = String(value);
      meterEl.setAttribute("aria-valuenow", String(value));
      meterEl.querySelector("i").style.width = `${value}%`;
      statEl.classList.toggle("warning", value > 20 && value <= 40);
      statEl.classList.toggle("critical", value <= 20);
    });

    const growth = growthState();
    dom.growthCopy.textContent = state.plant.isSick || averageCoreStats() < 35 ? "회복하면 다시 자라요" : growth.copy;
    dom.growthFill.style.width = `${growth.percent}%`;
    dom.growthTrack.setAttribute("aria-valuenow", String(Math.round(growth.percent)));

    const condition = conditionState();
    dom.conditionChip.textContent = condition.label;
    dom.conditionChip.className = `condition-chip ${condition.className}`.trim();
    dom.moodFace.textContent = condition.face;
    dom.moodOrb.setAttribute("aria-label", condition.mood);
    dom.moodOrb.style.background = condition.className === "danger" ? "#ffe0e3" : condition.className === "warning" ? "#ffedd1" : "#e2f3d5";

    dom.actionGrid.querySelectorAll("[data-action]").forEach((button) => {
      const action = button.dataset.action;
      let disabled = !state.plant.name;
      if (action === "sun" && (state.plant.stage === "seed" || state.stats.water < 10)) disabled = true;
      if (action === "tonic" && !state.plant.isSick && state.stats.health >= 75 && state.stats.nutrients >= 75) disabled = true;
      button.disabled = disabled;
    });
    updateSoundControls();
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    dom.toast.textContent = message;
    dom.toast.classList.add("visible");
    toastTimer = window.setTimeout(() => dom.toast.classList.remove("visible"), 2800);
  }

  function setSpeech(message, duration = 3600) {
    window.clearTimeout(speechTimer);
    dom.speechBubble.classList.remove("hidden");
    dom.speechText.textContent = message;
    if (duration > 0) speechTimer = window.setTimeout(() => { dom.speechText.textContent = defaultSpeech(); }, duration);
  }

  function animatePlant(action) {
    window.clearTimeout(animationTimer);
    dom.plant.classList.remove(...ACTION_CLASSES);
    void dom.plant.offsetWidth;
    dom.plant.classList.add(`action-${action}`);
    animationTimer = window.setTimeout(() => dom.plant.classList.remove(`action-${action}`), action === "evolve" ? 1500 : 1200);
  }

  function createParticles(symbols, color) {
    for (let index = 0; index < 9; index += 1) {
      const particle = document.createElement("span");
      particle.className = "particle";
      particle.textContent = symbols[index % symbols.length];
      particle.style.color = color;
      particle.style.setProperty("--x", `${randomBetween(-105, 105)}px`);
      particle.style.setProperty("--y", `${randomBetween(-110, -35)}px`);
      particle.style.setProperty("--r", `${randomBetween(-90, 90)}deg`);
      particle.style.animationDelay = `${index * 45}ms`;
      dom.particleLayer.appendChild(particle);
      window.setTimeout(() => particle.remove(), 1500);
    }
  }

  function ensureAudio() {
    if (state.settings.muted) return null;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    if (!audioContext) audioContext = new AudioContext();
    if (audioContext.state === "suspended") audioContext.resume();
    return audioContext;
  }

  function playTone(frequency = 520, duration = 0.12, type = "sine", delay = 0) {
    const context = ensureAudio();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.045, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function playChime(kind = "happy") {
    if (kind === "sad") {
      playTone(330, 0.18);
      playTone(260, 0.2, "sine", 0.12);
      return;
    }
    playTone(520, 0.12);
    playTone(690, 0.13, "sine", 0.1);
    if (kind === "evolve") playTone(880, 0.28, "triangle", 0.22);
  }

  function updateSoundControls() {
    const soundOn = !state.settings.muted;
    dom.soundIcon.textContent = soundOn ? "♫" : "×";
    dom.soundButton.setAttribute("aria-label", soundOn ? "효과음 끄기" : "효과음 켜기");
    dom.soundToggle.setAttribute("aria-checked", String(soundOn));
    dom.soundToggle.querySelector("span").textContent = soundOn ? "켜짐" : "꺼짐";
  }

  function toggleSound() {
    state.settings.muted = !state.settings.muted;
    if (!state.settings.muted) playChime();
    updateSoundControls();
    saveGame();
  }

  function afterCare({ speech, toast, animation, symbols, color, sound = "happy" }) {
    cooldownUntil = Date.now() + 1200;
    const growth = checkGrowth();
    setSpeech(speech);
    showToast(toast);
    animatePlant(animation);
    createParticles(symbols, color);
    playChime(sound);
    render();
    saveGame();
    if (growth) announceGrowth(growth);
  }

  function handleCare(action) {
    if (!state.plant.name || Date.now() < cooldownUntil) {
      if (Date.now() < cooldownUntil) showToast("조금만 천천히 돌봐 주세요.");
      return;
    }

    if (action === "water") {
      if (state.stats.water >= 96) {
        setSpeech("흙이 이미 촉촉해! 잠시 후에 물을 줄래?");
        showToast("수분이 이미 충분해요.");
        return;
      }
      adjustStat("water", 28);
      adjustStat("vitality", 3);
      adjustStat("nutrients", -1);
      state.counters.water += 1;
      grantXp(5);
      afterCare({ speech: "쪼르르… 시원한 물이 뿌리까지 내려와!", toast: "흙이 촉촉해졌어요.", animation: "water", symbols: ["●", "♧"], color: "#62b8d1" });
      return;
    }

    if (action === "soil") {
      if (state.stats.nutrients >= 97) {
        setSpeech("흙이 폭신하고 영양도 가득해!");
        showToast("흙 상태가 이미 아주 좋아요.");
        return;
      }
      adjustStat("nutrients", 27);
      adjustStat("water", -2);
      adjustStat("vitality", 3);
      state.counters.soil += 1;
      grantXp(5);
      afterCare({ speech: "폭신폭신한 흙 덕분에 뿌리가 쭉 뻗어!", toast: "흙에 영양을 채웠어요.", animation: "soil", symbols: ["◆", "♧"], color: "#9f7656" });
      return;
    }

    if (action === "music") {
      if (state.stats.vitality >= 97) {
        setSpeech("지금도 신나서 잎이 살랑살랑 춤추고 있어!");
        showToast("이미 생기가 가득해요.");
        return;
      }
      adjustStat("vitality", 25);
      adjustStat("health", 4);
      state.counters.music += 1;
      grantXp(4);
      afterCare({ speech: "라라라♪ 잎사귀가 절로 춤을 추는걸!", toast: "음악을 듣고 생기가 올랐어요.", animation: "music", symbols: ["♫", "♥"], color: "#6ab27a" });
      return;
    }

    if (action === "tonic") {
      if (!state.plant.isSick && state.stats.health >= 75 && state.stats.nutrients >= 75) {
        showToast("지금은 영양제가 필요하지 않아요.");
        setSpeech("나는 아주 싱싱해!");
        return;
      }
      adjustStat("health", 30);
      adjustStat("nutrients", 18);
      adjustStat("water", -3);
      state.counters.tonic += 1;
      if (state.stats.health >= 60 && CORE_STAT_KEYS.filter((key) => state.stats[key] <= 20).length < 2) state.plant.isSick = false;
      grantXp(3);
      afterCare({ speech: state.plant.isSick ? "조금 나아졌어. 다른 상태도 돌봐줘!" : "줄기와 잎에 다시 힘이 생겼어!", toast: "영양제로 건강을 회복했어요.", animation: "heal", symbols: ["＋", "♧"], color: "#df7c82" });
      return;
    }

    if (action === "sun") {
      if (state.plant.stage === "seed") {
        showToast("새싹이 올라오면 햇살을 모을 수 있어요.");
        return;
      }
      if (state.stats.water < 10) {
        showToast("강한 햇빛을 받기 전에 물을 먼저 주세요.");
        return;
      }
      openMiniGame();
    }
  }

  function announceGrowth(growth) {
    const display = stageDisplay();
    window.setTimeout(() => {
      animatePlant("evolve");
      createParticles(["✦", "♧", "♥"], "#73b77f");
      playChime("evolve");
      const message = growth.newStage === "fruit" ? `짜잔! ${display.label}를 맺었어!` : `${display.label}(으)로 쑥 자랐어!`;
      setSpeech(message, 5200);
      showToast(`${state.plant.name}가 ${display.label}(으)로 성장했어요!`);
      render();
      saveGame();
    }, 180);
  }

  function triggerRandomEvent() {
    if (!state.plant.name || dom.minigameDialog.open || dom.settingsDialog.open || document.hidden) return;
    const event = ["rain", "pest", "butterfly"][Math.floor(Math.random() * 3)];
    if (event === "rain") {
      adjustStat("water", 18);
      adjustStat("vitality", 5);
      setSpeech("창밖에서 보슬비가 내려 흙이 촉촉해졌어!");
      showToast("반가운 보슬비! 수분이 올랐어요.");
      createParticles(["●", "○"], "#64b5d0");
      playChime();
    } else if (event === "pest") {
      adjustStat("health", -14);
      adjustStat("vitality", -8);
      if (state.stats.health <= 35) state.plant.isSick = true;
      setSpeech("앗, 작은 벌레가 잎을 살짝 갉아먹었어…");
      showToast("해충이 다녀갔어요. 건강을 살펴봐 주세요.");
      createParticles(["·", "×"], "#9b7960");
      playChime("sad");
    } else {
      adjustStat("vitality", 12);
      adjustStat("sunlight", 5);
      setSpeech("예쁜 나비가 찾아와 잎 위에서 쉬어 갔어!");
      showToast("나비의 방문! 햇빛과 생기가 올랐어요.");
      createParticles(["✦", "♥"], "#e6ad60");
      playTone(680, 0.18, "sine");
    }
    render();
    saveGame();
    nextEventAt = Date.now() + randomBetween(180_000, 300_000);
  }

  function showOfflineReport(report) {
    dom.offlineSummary.textContent = `${formatDuration(report.elapsed).replace("째 함께", "").replace("째", "")} 동안 정원의 변화를 반영했어요.`;
    dom.offlineChanges.replaceChildren();
    const labels = { water: "수분", sunlight: "햇빛", nutrients: "영양", vitality: "생기", health: "건강" };
    STAT_KEYS.forEach((key) => {
      const before = Math.round(report.before[key]);
      const after = Math.round(report.after[key]);
      if (before === after && key !== "health") return;
      const item = document.createElement("div");
      item.className = "offline-change";
      const label = document.createElement("span");
      const value = document.createElement("strong");
      label.textContent = labels[key];
      value.textContent = `${before} → ${after}`;
      item.append(label, value);
      dom.offlineChanges.appendChild(item);
    });
    if (!dom.offlineChanges.children.length) {
      const item = document.createElement("div");
      item.className = "offline-change";
      item.style.gridColumn = "1 / -1";
      item.textContent = "큰 변화 없이 편안히 햇살을 받았어요.";
      dom.offlineChanges.appendChild(item);
    }
    dom.offlineDialog.showModal();
  }

  const mini = {
    session: 0,
    running: false,
    counting: false,
    score: 0,
    startedAt: 0,
    lastFrame: 0,
    lastSpawn: 0,
    playerX: 0,
    width: 0,
    height: 0,
    drops: [],
    keys: { left: false, right: false },
    frameId: 0
  };

  function resizeGameCanvas() {
    const rect = dom.gameCanvas.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    mini.width = Math.max(1, rect.width);
    mini.height = Math.max(1, rect.height);
    dom.gameCanvas.width = Math.round(mini.width * ratio);
    dom.gameCanvas.height = Math.round(mini.height * ratio);
    dom.gameCanvas.getContext("2d").setTransform(ratio, 0, 0, ratio, 0, 0);
    if (!mini.playerX) mini.playerX = mini.width / 2;
    mini.playerX = clamp(mini.playerX, 45, mini.width - 45);
  }

  function openMiniGame() {
    cooldownUntil = Date.now() + 1500;
    mini.session += 1;
    const session = mini.session;
    mini.running = false;
    mini.counting = true;
    mini.score = 0;
    mini.drops = [];
    mini.playerX = 0;
    mini.keys.left = false;
    mini.keys.right = false;
    dom.gameScore.textContent = "0";
    dom.gameTime.textContent = "30";
    dom.gameCountdown.classList.remove("hidden");
    dom.gameCountdown.textContent = "3";
    dom.minigameDialog.showModal();
    resizeGameCanvas();
    drawGame();
    playTone(440, 0.1);

    let count = 3;
    const countdownTimer = window.setInterval(() => {
      if (session !== mini.session || !mini.counting) {
        window.clearInterval(countdownTimer);
        return;
      }
      count -= 1;
      if (count > 0) {
        dom.gameCountdown.textContent = String(count);
        playTone(440 + (3 - count) * 70, 0.1);
      } else {
        window.clearInterval(countdownTimer);
        dom.gameCountdown.textContent = "시작!";
        playTone(660, 0.15, "triangle");
        window.setTimeout(() => {
          if (session !== mini.session || !mini.counting) return;
          dom.gameCountdown.classList.add("hidden");
          mini.counting = false;
          mini.running = true;
          mini.startedAt = performance.now();
          mini.lastFrame = mini.startedAt;
          mini.lastSpawn = mini.startedAt - 500;
          mini.frameId = requestAnimationFrame(gameLoop);
        }, 500);
      }
    }, 700);
  }

  function spawnSunDrop() {
    const special = Math.random() < 0.18;
    mini.drops.push({
      x: randomBetween(24, Math.max(25, mini.width - 24)),
      y: -24,
      radius: special ? 16 : 12,
      speed: randomBetween(105, 185),
      rotation: Math.random() * Math.PI,
      special
    });
  }

  function gameLoop(now) {
    if (!mini.running) return;
    const delta = Math.min(0.035, (now - mini.lastFrame) / 1000);
    mini.lastFrame = now;
    const elapsed = (now - mini.startedAt) / 1000;
    const remaining = Math.max(0, 30 - elapsed);
    dom.gameTime.textContent = String(Math.ceil(remaining));

    if (mini.keys.left) mini.playerX -= 250 * delta;
    if (mini.keys.right) mini.playerX += 250 * delta;
    mini.playerX = clamp(mini.playerX, 45, mini.width - 45);
    if (now - mini.lastSpawn > Math.max(360, 690 - elapsed * 5)) {
      spawnSunDrop();
      mini.lastSpawn = now;
    }

    const catcherY = mini.height - 45;
    mini.drops.forEach((drop) => {
      drop.y += drop.speed * delta;
      drop.rotation += delta * 2.6;
      if (drop.y + drop.radius >= catcherY - 14 && drop.y - drop.radius <= catcherY + 16 && Math.abs(drop.x - mini.playerX) <= 48) {
        drop.caught = true;
        mini.score += drop.special ? 3 : 1;
        dom.gameScore.textContent = String(mini.score);
        playTone(drop.special ? 820 : 620, 0.07);
      }
    });
    mini.drops = mini.drops.filter((drop) => !drop.caught && drop.y < mini.height + 35);
    drawGame();
    if (remaining <= 0) {
      finishMiniGame(false);
      return;
    }
    mini.frameId = requestAnimationFrame(gameLoop);
  }

  function drawStar(context, x, y, points, outer, inner, rotation) {
    context.save();
    context.translate(x, y);
    context.rotate(rotation);
    context.beginPath();
    for (let index = 0; index < points * 2; index += 1) {
      const radius = index % 2 === 0 ? outer : inner;
      const angle = -Math.PI / 2 + (index * Math.PI) / points;
      context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    context.closePath();
    context.restore();
  }

  function drawGame() {
    const context = dom.gameCanvas.getContext("2d");
    const { width, height } = mini;
    context.clearRect(0, 0, width, height);
    const sky = context.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#9fd4e8");
    sky.addColorStop(0.72, "#e7f2d2");
    sky.addColorStop(0.72, "#9dcc91");
    sky.addColorStop(1, "#74b27d");
    context.fillStyle = sky;
    context.fillRect(0, 0, width, height);

    context.fillStyle = "rgba(255,255,255,.7)";
    for (let index = 0; index < 4; index += 1) {
      const x = ((index * 190 + 35) % (width + 100)) - 30;
      const y = 48 + (index % 2) * 78;
      context.beginPath();
      context.ellipse(x, y, 40, 17, 0, 0, Math.PI * 2);
      context.ellipse(x + 29, y + 3, 32, 14, 0, 0, Math.PI * 2);
      context.fill();
    }

    mini.drops.forEach((drop) => {
      context.save();
      context.shadowColor = "rgba(126, 91, 35, .18)";
      context.shadowBlur = 9;
      context.fillStyle = drop.special ? "#fff0a0" : "#f5c94f";
      drawStar(context, drop.x, drop.y, drop.special ? 8 : 6, drop.radius, drop.radius * 0.5, drop.rotation);
      context.fill();
      context.restore();
    });

    const x = mini.playerX || width / 2;
    const y = height - 45;
    context.save();
    context.translate(x, y);
    context.shadowColor = "rgba(59, 65, 48, .2)";
    context.shadowBlur = 10;
    context.fillStyle = "#d88561";
    context.beginPath();
    context.roundRect(-45, -16, 90, 35, [8, 8, 22, 22]);
    context.fill();
    context.shadowBlur = 0;
    context.lineWidth = 5;
    context.strokeStyle = "#fff0dc";
    context.stroke();
    context.strokeStyle = "#4b9662";
    context.lineWidth = 7;
    context.beginPath();
    context.moveTo(0, -15);
    context.lineTo(0, -36);
    context.stroke();
    context.fillStyle = "#72bd82";
    context.beginPath();
    context.ellipse(-16, -36, 19, 10, 0.42, 0, Math.PI * 2);
    context.ellipse(16, -36, 19, 10, -0.42, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function finishMiniGame(quitEarly) {
    if (!mini.running && !mini.counting) return;
    mini.session += 1;
    mini.running = false;
    mini.counting = false;
    cancelAnimationFrame(mini.frameId);
    const score = mini.score;
    if (dom.minigameDialog.open) dom.minigameDialog.close();

    adjustStat("sunlight", Math.min(28, 6 + score * 1.5));
    adjustStat("vitality", Math.min(18, 5 + Math.floor(score / 2)));
    adjustStat("water", -8);
    state.counters.sun += 1;
    grantXp(Math.min(16, 4 + Math.floor(score / 3)));
    const growth = checkGrowth();
    setSpeech(quitEarly ? "짧게라도 햇살을 받아서 기분 좋아!" : `${score}개의 햇살방울을 모았어!`);
    showToast(`햇살 모으기 종료 · 점수 ${score}`);
    animatePlant("sun");
    createParticles(["☀", "✦"], "#edbd4a");
    playChime(score >= 10 ? "evolve" : "happy");
    cooldownUntil = Date.now() + 1500;
    render();
    saveGame();
    if (growth) announceGrowth(growth);
  }

  function moveCatcherFromPointer(event) {
    if (!mini.running && !mini.counting) return;
    const rect = dom.gameCanvas.getBoundingClientRect();
    mini.playerX = clamp(event.clientX - rect.left, 45, mini.width - 45);
    if (!mini.running) drawGame();
  }

  function advanceToNow() {
    const now = Date.now();
    const elapsed = Math.max(0, now - lastTickAt);
    if (state.plant.name && elapsed > 0) applyElapsed(elapsed);
    lastTickAt = now;
  }

  function tick() {
    if (!state.plant.name) return;
    advanceToNow();
    const growth = checkGrowth();
    render();
    if (growth) announceGrowth(growth);
    if (Date.now() >= nextEventAt) triggerRandomEvent();
    if (Date.now() - lastSavedAt >= 20_000) saveGame();
  }

  dom.actionGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    handleCare(button.dataset.action);
  });

  dom.welcomeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = dom.nameInput.value.trim();
    if (!name) {
      dom.nameError.textContent = "한 글자 이상의 이름을 입력해 주세요.";
      dom.nameInput.focus();
      return;
    }
    state = createInitialState();
    state.plant.name = name.slice(0, 10);
    state.plant.plantedAt = Date.now();
    state.lastSeen = Date.now();
    lastTickAt = Date.now();
    dom.nameError.textContent = "";
    dom.welcomeDialog.close();
    render();
    setSpeech(`${state.plant.name}, 멋진 이름이야! 곧 초록 잎을 보여 줄게.`);
    showToast(`${state.plant.name}와의 첫 정원이 시작됐어요.`);
    createParticles(["✦", "♧"], "#71b97d");
    playChime("evolve");
    saveGame();
  });

  dom.welcomeDialog.addEventListener("cancel", (event) => event.preventDefault());
  dom.soundButton.addEventListener("click", toggleSound);
  dom.soundToggle.addEventListener("click", toggleSound);
  dom.settingsButton.addEventListener("click", () => { render(); dom.settingsDialog.showModal(); });
  document.querySelector("[data-close='settings']").addEventListener("click", () => dom.settingsDialog.close());
  dom.offlineClose.addEventListener("click", () => dom.offlineDialog.close());
  dom.resetButton.addEventListener("click", () => {
    const confirmed = window.confirm(`${state.plant.name || "현재 식물"}의 기록을 지우고 새 씨앗으로 시작할까요? 이 작업은 되돌릴 수 없어요.`);
    if (!confirmed) return;
    localStorage.removeItem(SAVE_KEY);
    window.location.reload();
  });

  dom.quitGameButton.addEventListener("click", () => finishMiniGame(true));
  dom.minigameDialog.addEventListener("cancel", (event) => { event.preventDefault(); finishMiniGame(true); });
  dom.gameCanvas.addEventListener("pointerdown", moveCatcherFromPointer);
  dom.gameCanvas.addEventListener("pointermove", (event) => {
    if (event.buttons || event.pointerType === "touch") moveCatcherFromPointer(event);
  });
  window.addEventListener("keydown", (event) => {
    if (!dom.minigameDialog.open) return;
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") { mini.keys.left = true; event.preventDefault(); }
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") { mini.keys.right = true; event.preventDefault(); }
  });
  window.addEventListener("keyup", (event) => {
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") mini.keys.left = false;
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") mini.keys.right = false;
  });
  window.addEventListener("resize", () => {
    if (dom.minigameDialog.open) { resizeGameCanvas(); drawGame(); }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { advanceToNow(); saveGame(); } else { advanceToNow(); render(); }
  });
  window.addEventListener("beforeunload", () => { advanceToNow(); saveGame(); });

  render();
  setSpeech(defaultSpeech(), 0);
  if (!state.plant.name) {
    dom.welcomeDialog.showModal();
    window.setTimeout(() => dom.nameInput.focus(), 100);
  } else {
    const growth = checkGrowth();
    if (growth) announceGrowth(growth);
    saveGame();
    if (offlineReport) window.setTimeout(() => showOfflineReport(offlineReport), 250);
  }
  if (loaded.wasInvalid) window.setTimeout(() => showToast("정원 저장 데이터를 안전하게 복구했어요. 새 씨앗을 심어 주세요."), 350);
  window.setInterval(tick, 1000);
})();
