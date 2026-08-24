(() => {
  "use strict";

  const SAVE_KEY = "mongle-egg-forest-save-v1";
  const SAVE_VERSION = 1;
  const HATCH_TIME_MS = 8_000;
  const CHILD_XP = 35;
  const ADULT_XP = 90;
  const STAT_KEYS = ["fullness", "happiness", "cleanliness", "energy", "health"];
  const CORE_STAT_KEYS = ["fullness", "happiness", "cleanliness", "energy"];
  const STAGE_CLASSES = ["stage-egg", "stage-baby", "stage-child", "stage-adult"];
  const FORM_CLASSES = ["form-balanced", "form-active", "form-cozy"];
  const ACTION_CLASSES = ["action-feed", "action-clean", "action-heal", "action-play", "action-evolve"];

  const el = (id) => document.getElementById(id);
  const dom = {
    pet: el("pet"),
    petName: el("petName"),
    stageLabel: el("stageLabel"),
    ageLabel: el("ageLabel"),
    speechBubble: el("speechBubble"),
    speechText: el("speechText"),
    sleepMarks: el("sleepMarks"),
    sickMark: el("sickMark"),
    moodOrb: el("moodOrb"),
    moodFace: el("moodFace"),
    conditionChip: el("conditionChip"),
    growthCopy: el("growthCopy"),
    growthTrack: el("growthTrack"),
    growthFill: el("growthFill"),
    actionGrid: el("actionGrid"),
    actionHint: el("actionHint"),
    sleepActionTitle: el("sleepActionTitle"),
    sleepActionHint: el("sleepActionHint"),
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
    egg: { label: "신비한 알", aria: "무늬가 있는 신비한 알" },
    baby: { label: "말랑 아기", aria: "막 태어난 말랑한 아기 생명체" },
    child: { label: "호기심 꼬마", aria: "호기심 많은 어린 생명체" },
    adult: { label: "성체", aria: "건강하게 성장한 신비한 생명체" }
  };

  const formInfo = {
    balanced: { label: "별빛 수호형", aria: "분홍빛 날개를 가진 균형형 성체" },
    active: { label: "햇살 날개형", aria: "노란빛 긴 귀를 가진 활동형 성체" },
    cozy: { label: "포근 구름형", aria: "보랏빛 둥근 몸을 가진 포근형 성체" }
  };

  function clamp(value, min = 0, max = 100) {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
  }

  function createInitialState() {
    return {
      version: SAVE_VERSION,
      pet: {
        name: "",
        birthAt: null,
        stage: "egg",
        form: null,
        xp: 0,
        isSleeping: false,
        isSick: false
      },
      stats: {
        fullness: 82,
        happiness: 82,
        cleanliness: 82,
        energy: 82,
        health: 100
      },
      counters: {
        feed: 0,
        play: 0,
        clean: 0,
        sleep: 0,
        medicine: 0
      },
      settings: {
        muted: false
      },
      lastSeen: Date.now()
    };
  }

  function normalizeState(raw) {
    if (!raw || typeof raw !== "object" || raw.version !== SAVE_VERSION) {
      throw new Error("지원하지 않는 저장 데이터");
    }

    const fresh = createInitialState();
    const allowedStages = Object.keys(stageInfo);
    const allowedForms = Object.keys(formInfo);
    const name = typeof raw.pet?.name === "string" ? raw.pet.name.trim().slice(0, 10) : "";
    const now = Date.now();
    const rawBirthAt = Number(raw.pet?.birthAt);
    const birthAt = Number.isFinite(rawBirthAt) && rawBirthAt > 0
      ? Math.min(rawBirthAt, now)
      : null;
    const stage = allowedStages.includes(raw.pet?.stage) ? raw.pet.stage : "egg";
    const form = allowedForms.includes(raw.pet?.form) ? raw.pet.form : null;

    const normalized = {
      ...fresh,
      pet: {
        ...fresh.pet,
        name,
        birthAt,
        stage,
        form: stage === "adult" ? (form || "balanced") : null,
        xp: clamp(Number(raw.pet?.xp), 0, 9999),
        isSleeping: Boolean(raw.pet?.isSleeping),
        isSick: Boolean(raw.pet?.isSick)
      },
      stats: { ...fresh.stats },
      counters: { ...fresh.counters },
      settings: {
        muted: Boolean(raw.settings?.muted)
      },
      lastSeen: Number.isFinite(raw.lastSeen) ? raw.lastSeen : Date.now()
    };

    STAT_KEYS.forEach((key) => {
      const value = Number(raw.stats?.[key]);
      normalized.stats[key] = Number.isFinite(value) ? clamp(value, 0, 100) : fresh.stats[key];
    });

    Object.keys(normalized.counters).forEach((key) => {
      const value = Number(raw.counters?.[key]);
      normalized.counters[key] = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    });

    if (!normalized.pet.name || !normalized.pet.birthAt) {
      return fresh;
    }

    return normalized;
  }

  function loadGame() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return { data: createInitialState(), hadSave: false, wasInvalid: false };
    }

    try {
      return { data: normalizeState(JSON.parse(raw)), hadSave: true, wasInvalid: false };
    } catch (error) {
      console.warn("저장 데이터를 복구했습니다.", error);
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

  if (loaded.hadSave && state.pet.name) {
    const now = Date.now();
    const safeLastSeen = state.lastSeen > now + 300_000 ? now : state.lastSeen;
    const elapsed = Math.max(0, now - safeLastSeen);
    const before = { ...state.stats };
    if (elapsed > 0) applyElapsed(elapsed);
    state.lastSeen = now;
    lastTickAt = now;
    if (elapsed >= 60_000) {
      offlineReport = {
        elapsed,
        before,
        after: { ...state.stats }
      };
    }
  }

  function saveGame() {
    if (!state.pet.name) return;
    state.lastSeen = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      lastSavedAt = Date.now();
    } catch (error) {
      console.warn("저장하지 못했습니다.", error);
      showToast("저장 공간을 사용할 수 없어요. 브라우저 설정을 확인해 주세요.");
    }
  }

  function adjustStat(key, delta) {
    state.stats[key] = clamp(state.stats[key] + delta);
  }

  function applyElapsed(milliseconds) {
    if (!state.pet.name || milliseconds <= 0) return;

    const totalMinutes = milliseconds / 60_000;
    const steps = Math.min(720, Math.max(1, Math.ceil(totalMinutes / 5)));
    const minutesPerStep = totalMinutes / steps;

    for (let index = 0; index < steps; index += 1) {
      if (state.pet.isSleeping) {
        adjustStat("fullness", -0.18 * minutesPerStep);
        adjustStat("happiness", -0.08 * minutesPerStep);
        adjustStat("cleanliness", -0.1 * minutesPerStep);
        adjustStat("energy", 1.2 * minutesPerStep);
      } else {
        adjustStat("fullness", -0.28 * minutesPerStep);
        adjustStat("happiness", -0.2 * minutesPerStep);
        adjustStat("cleanliness", -0.16 * minutesPerStep);
        adjustStat("energy", -0.24 * minutesPerStep);
      }

      const criticalCount = CORE_STAT_KEYS.filter((key) => state.stats[key] <= 20).length;
      if (criticalCount >= 2) {
        adjustStat("health", -0.38 * minutesPerStep);
      } else if (criticalCount === 0 && !state.pet.isSick) {
        adjustStat("health", 0.08 * minutesPerStep);
      }

      if (state.stats.health <= 35) state.pet.isSick = true;
      if (state.pet.isSick && state.stats.health >= 60 && criticalCount < 2) {
        state.pet.isSick = false;
      }
    }
  }

  function averageCoreStats() {
    return CORE_STAT_KEYS.reduce((sum, key) => sum + state.stats[key], 0) / CORE_STAT_KEYS.length;
  }

  function grantXp(amount) {
    if (state.pet.isSick || averageCoreStats() < 35) return false;
    state.pet.xp = clamp(state.pet.xp + amount, 0, 9999);
    return true;
  }

  function chooseAdultForm() {
    const { feed, play, clean, sleep } = state.counters;
    const careTotal = Math.max(1, feed + play + clean);
    if (play / careTotal >= 0.4 && play >= feed && play >= clean) return "active";
    if (feed + sleep > play + clean + 2) return "cozy";
    return "balanced";
  }

  function checkGrowth() {
    if (!state.pet.name || state.pet.isSick || averageCoreStats() < 35) return null;
    const oldStage = state.pet.stage;

    if (state.pet.stage === "egg" && Date.now() - state.pet.birthAt >= HATCH_TIME_MS) {
      state.pet.stage = "baby";
    }
    if (state.pet.stage === "baby" && state.pet.xp >= CHILD_XP) {
      state.pet.stage = "child";
    }
    if (state.pet.stage === "child" && state.pet.xp >= ADULT_XP) {
      state.pet.stage = "adult";
      state.pet.form = chooseAdultForm();
    }

    if (oldStage !== state.pet.stage) {
      return { oldStage, newStage: state.pet.stage, form: state.pet.form };
    }
    return null;
  }

  function stageDisplay() {
    if (state.pet.stage === "adult") return formInfo[state.pet.form || "balanced"];
    return stageInfo[state.pet.stage];
  }

  function formatDuration(milliseconds) {
    const minutes = Math.max(0, Math.floor(milliseconds / 60_000));
    if (minutes < 1) return "방금 만남";
    if (minutes < 60) return `${minutes}분째 함께`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 ${minutes % 60}분째`;
    const days = Math.floor(hours / 24);
    return `${days}일 ${hours % 24}시간째`;
  }

  function growthState() {
    if (state.pet.stage === "egg") {
      const elapsed = Math.max(0, Date.now() - state.pet.birthAt);
      return {
        percent: clamp((elapsed / HATCH_TIME_MS) * 100),
        copy: elapsed >= HATCH_TIME_MS ? "곧 깨어나요" : "알이 깨어날 준비 중"
      };
    }
    if (state.pet.stage === "baby") {
      return { percent: clamp((state.pet.xp / CHILD_XP) * 100), copy: `꼬마까지 ${Math.max(0, CHILD_XP - Math.floor(state.pet.xp))} 성장` };
    }
    if (state.pet.stage === "child") {
      return {
        percent: clamp(((state.pet.xp - CHILD_XP) / (ADULT_XP - CHILD_XP)) * 100),
        copy: `성체까지 ${Math.max(0, ADULT_XP - Math.floor(state.pet.xp))} 성장`
      };
    }
    return { percent: 100, copy: `${formInfo[state.pet.form || "balanced"].label} 완성` };
  }

  function conditionState() {
    if (state.pet.isSleeping) return { label: "꿈꾸는 중", className: "sleep", face: "–", mood: "잠들어 있음" };
    if (state.pet.isSick) return { label: "치료가 필요해요", className: "danger", face: "﹏", mood: "아픔" };
    const average = averageCoreStats();
    if (average >= 72) return { label: "아주 좋아요", className: "", face: "⌣", mood: "기분 좋음" };
    if (average >= 42) return { label: "조금 신경 써줘요", className: "warning", face: "•", mood: "보통" };
    return { label: "돌봄이 필요해요", className: "danger", face: "⌢", mood: "기분 나쁨" };
  }

  function defaultSpeech() {
    if (!state.pet.name) return "알 속에서 작은 소리가 들려요.";
    if (state.pet.isSleeping) return "새근새근… 포근한 꿈을 꾸는 중이야.";
    if (state.pet.isSick) return "몸이 조금 안 좋아… 치료해 줄래?";
    if (state.pet.stage === "egg") return "톡, 토독… 곧 만날 수 있을 것 같아!";
    const lowestKey = CORE_STAT_KEYS.reduce((lowest, key) => state.stats[key] < state.stats[lowest] ? key : lowest, CORE_STAT_KEYS[0]);
    if (state.stats[lowestKey] < 28) {
      const messages = {
        fullness: "배에서 꼬르륵 소리가 나!",
        happiness: "같이 신나게 놀고 싶어.",
        cleanliness: "보송보송하게 씻고 싶어.",
        energy: "눈이 자꾸 감겨… 조금 잘까?"
      };
      return messages[lowestKey];
    }
    const happyMessages = [
      `${state.pet.name}, 오늘도 반짝반짝!`,
      "네가 와줘서 정말 좋아.",
      "오늘은 어떤 일이 생길까?",
      "함께 있으니 마음이 몽글몽글해."
    ];
    return happyMessages[Math.floor(Date.now() / 15_000) % happyMessages.length];
  }

  function render() {
    const display = stageDisplay();
    const age = state.pet.birthAt ? formatDuration(Date.now() - state.pet.birthAt) : "방금 만남";
    dom.petName.textContent = state.pet.name || "새 친구";
    dom.stageLabel.textContent = display.label;
    dom.ageLabel.textContent = age;
    dom.settingsAge.textContent = age;
    dom.settingsStage.textContent = display.label;

    dom.pet.classList.remove(...STAGE_CLASSES, ...FORM_CLASSES);
    dom.pet.classList.add(`stage-${state.pet.stage}`);
    if (state.pet.stage === "adult") dom.pet.classList.add(`form-${state.pet.form || "balanced"}`);
    dom.pet.classList.toggle("is-sick", state.pet.isSick);
    dom.pet.classList.toggle("is-sleeping", state.pet.isSleeping);
    dom.pet.setAttribute("aria-label", state.pet.stage === "adult" ? formInfo[state.pet.form || "balanced"].aria : stageInfo[state.pet.stage].aria);
    dom.sleepMarks.classList.toggle("visible", state.pet.isSleeping);
    dom.sickMark.classList.toggle("visible", state.pet.isSick);

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
    dom.growthCopy.textContent = state.pet.isSick || averageCoreStats() < 35 ? "회복하면 다시 자라요" : growth.copy;
    dom.growthFill.style.width = `${growth.percent}%`;
    dom.growthTrack.setAttribute("aria-valuenow", String(Math.round(growth.percent)));

    const condition = conditionState();
    dom.conditionChip.textContent = condition.label;
    dom.conditionChip.className = `condition-chip ${condition.className}`.trim();
    dom.moodFace.textContent = condition.face;
    dom.moodOrb.setAttribute("aria-label", condition.mood);
    dom.moodOrb.style.background = condition.className === "danger" ? "#ffe0e3" : condition.className === "sleep" ? "#e9e5ff" : condition.className === "warning" ? "#ffedd1" : "#ffe7a9";

    dom.sleepActionTitle.textContent = state.pet.isSleeping ? "깨우기" : "재우기";
    dom.sleepActionHint.textContent = state.pet.isSleeping ? "살며시 톡톡" : "포근한 꿈";

    const buttons = dom.actionGrid.querySelectorAll("[data-action]");
    buttons.forEach((button) => {
      const action = button.dataset.action;
      let disabled = false;
      if (!state.pet.name) disabled = true;
      if (state.pet.isSleeping && action !== "sleep") disabled = true;
      if (action === "play" && (state.pet.stage === "egg" || state.stats.energy < 15 || state.stats.fullness < 10)) disabled = true;
      if (action === "medicine" && !state.pet.isSick && state.stats.health >= 70) disabled = true;
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
    if (duration > 0) {
      speechTimer = window.setTimeout(() => {
        dom.speechText.textContent = defaultSpeech();
      }, duration);
    }
  }

  function animatePet(action) {
    window.clearTimeout(animationTimer);
    dom.pet.classList.remove(...ACTION_CLASSES);
    void dom.pet.offsetWidth;
    dom.pet.classList.add(`action-${action}`);
    animationTimer = window.setTimeout(() => dom.pet.classList.remove(`action-${action}`), action === "evolve" ? 1500 : 1200);
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
      playTone(330, 0.18, "sine");
      playTone(260, 0.2, "sine", 0.12);
      return;
    }
    playTone(520, 0.12, "sine");
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
    animatePet(animation);
    createParticles(symbols, color);
    playChime(sound);
    render();
    saveGame();
    if (growth) announceGrowth(growth);
  }

  function handleCare(action) {
    if (!state.pet.name || Date.now() < cooldownUntil) {
      if (Date.now() < cooldownUntil) showToast("조금만 천천히 돌봐 주세요.");
      return;
    }

    if (state.pet.isSleeping && action !== "sleep") {
      showToast(`${state.pet.name}가 자고 있어요. 먼저 깨워 주세요.`);
      return;
    }

    if (action === "feed") {
      if (state.stats.fullness >= 96) {
        setSpeech("배가 아주 든든해! 나중에 먹을래.");
        showToast("이미 배가 불러요.");
        return;
      }
      adjustStat("fullness", 24);
      adjustStat("happiness", 3);
      adjustStat("cleanliness", -3);
      state.counters.feed += 1;
      grantXp(5);
      afterCare({ speech: "냠냠! 별맛 간식은 정말 맛있어!", toast: "포만감이 올랐어요.", animation: "feed", symbols: ["♥", "●"], color: "#ee8da8" });
      return;
    }

    if (action === "clean") {
      if (state.stats.cleanliness >= 97) {
        setSpeech("지금도 보송보송한걸? 반짝반짝해!");
        showToast("이미 아주 깨끗해요.");
        return;
      }
      adjustStat("cleanliness", 30);
      adjustStat("happiness", state.stats.energy < 20 ? -2 : 3);
      state.counters.clean += 1;
      grantXp(5);
      afterCare({ speech: "뽀득뽀득, 기분까지 상쾌해!", toast: "깨끗하게 씻었어요.", animation: "clean", symbols: ["○", "✦"], color: "#69bcae" });
      return;
    }

    if (action === "sleep") {
      state.pet.isSleeping = !state.pet.isSleeping;
      if (state.pet.isSleeping) {
        state.counters.sleep += 1;
        grantXp(2);
        afterCare({ speech: "이불이 구름처럼 포근해… 잘 자!", toast: "잠들었어요. 에너지가 회복됩니다.", animation: "feed", symbols: ["☾", "✦"], color: "#9181cb" });
      } else {
        adjustStat("happiness", 2);
        afterCare({ speech: "잘 잤다! 다시 함께 놀자.", toast: "상쾌하게 일어났어요.", animation: "feed", symbols: ["☀", "✦"], color: "#eebd57" });
      }
      return;
    }

    if (action === "medicine") {
      if (!state.pet.isSick && state.stats.health >= 70) {
        showToast("지금은 약이 필요하지 않아요.");
        setSpeech("나는 아주 건강해!");
        return;
      }
      adjustStat("health", 30);
      adjustStat("happiness", -3);
      state.counters.medicine += 1;
      if (state.stats.health >= 60 && CORE_STAT_KEYS.filter((key) => state.stats[key] <= 20).length < 2) {
        state.pet.isSick = false;
      }
      grantXp(3);
      afterCare({ speech: state.pet.isSick ? "조금 나아졌어. 한 번 더 돌봐줘!" : "이제 몸이 한결 가벼워졌어!", toast: "건강이 회복되었어요.", animation: "heal", symbols: ["＋", "♥"], color: "#e37a80" });
      return;
    }

    if (action === "play") {
      if (state.pet.stage === "egg") {
        showToast("알이 깨어나면 함께 놀 수 있어요.");
        return;
      }
      if (state.stats.energy < 15 || state.stats.fullness < 10) {
        showToast("놀기 전에 밥이나 잠이 필요해요.");
        return;
      }
      openMiniGame();
    }
  }

  function announceGrowth(growth) {
    const display = stageDisplay();
    window.setTimeout(() => {
      animatePet("evolve");
      createParticles(["✦", "♥", "★"], "#cf80ad");
      playChime("evolve");
      setSpeech(growth.newStage === "adult" ? `짜잔! ${display.label}으로 자랐어!` : "몸이 반짝이더니 한 뼘 더 자랐어!", 5200);
      showToast(`${state.pet.name}가 ${display.label}(으)로 성장했어요!`);
      render();
      saveGame();
    }, 180);
  }

  function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function triggerRandomEvent() {
    if (!state.pet.name || dom.minigameDialog.open || dom.settingsDialog.open || document.hidden) return;
    const event = ["gift", "mess", "sleepy"][Math.floor(Math.random() * 3)];

    if (event === "gift") {
      adjustStat("happiness", 12);
      adjustStat("health", 5);
      setSpeech("창가에서 반짝이는 별조각을 찾았어!");
      showToast("깜짝 선물! 행복과 건강이 올랐어요.");
      createParticles(["✦", "★"], "#e6b64e");
      playChime();
    } else if (event === "mess") {
      adjustStat("cleanliness", -14);
      setSpeech("앗, 신나게 뛰다가 방을 조금 어질렀어…");
      showToast("장난감이 와르르! 청결이 내려갔어요.");
      createParticles(["·", "●"], "#aa8a76");
      playChime("sad");
    } else {
      adjustStat("energy", -12);
      adjustStat("happiness", 5);
      setSpeech("하암… 구름을 세다가 조금 졸려졌어.");
      showToast("포근한 오후예요. 에너지가 조금 줄었어요.");
      createParticles(["☁", "z"], "#8d80bb");
      playTone(370, 0.2, "sine");
    }

    render();
    saveGame();
    nextEventAt = Date.now() + randomBetween(180_000, 300_000);
  }

  function showOfflineReport(report) {
    dom.offlineSummary.textContent = `${formatDuration(report.elapsed).replace("째 함께", "").replace("째", "")} 동안의 변화를 반영했어요.`;
    dom.offlineChanges.replaceChildren();
    const labels = { fullness: "포만감", happiness: "행복", cleanliness: "청결", energy: "에너지", health: "건강" };
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
      item.textContent = "큰 변화 없이 편안히 지냈어요.";
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
    treats: [],
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
    const context = dom.gameCanvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
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
    mini.treats = [];
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
    playTone(440, 0.1, "sine");

    let count = 3;
    const countdownTimer = window.setInterval(() => {
      if (session !== mini.session || !mini.counting) {
        window.clearInterval(countdownTimer);
        return;
      }
      count -= 1;
      if (count > 0) {
        dom.gameCountdown.textContent = String(count);
        playTone(440 + (3 - count) * 70, 0.1, "sine");
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

  function spawnTreat() {
    const special = Math.random() < 0.18;
    mini.treats.push({
      x: randomBetween(24, Math.max(25, mini.width - 24)),
      y: -24,
      radius: special ? 15 : 12,
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
      spawnTreat();
      mini.lastSpawn = now;
    }

    const catcherY = mini.height - 45;
    mini.treats.forEach((treat) => {
      treat.y += treat.speed * delta;
      treat.rotation += delta * 2.6;
      if (
        treat.y + treat.radius >= catcherY - 14 &&
        treat.y - treat.radius <= catcherY + 16 &&
        Math.abs(treat.x - mini.playerX) <= 48
      ) {
        treat.caught = true;
        mini.score += treat.special ? 3 : 1;
        dom.gameScore.textContent = String(mini.score);
        playTone(treat.special ? 820 : 620, 0.07, "sine");
      }
    });
    mini.treats = mini.treats.filter((treat) => !treat.caught && treat.y < mini.height + 35);

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
    sky.addColorStop(0, "#a9d9ec");
    sky.addColorStop(0.72, "#dff1ec");
    sky.addColorStop(0.72, "#a9d5ac");
    sky.addColorStop(1, "#8bc398");
    context.fillStyle = sky;
    context.fillRect(0, 0, width, height);

    context.fillStyle = "rgba(255,255,255,.72)";
    for (let index = 0; index < 4; index += 1) {
      const x = ((index * 190 + 35) % (width + 100)) - 30;
      const y = 48 + (index % 2) * 78;
      context.beginPath();
      context.ellipse(x, y, 40, 17, 0, 0, Math.PI * 2);
      context.ellipse(x + 29, y + 3, 32, 14, 0, 0, Math.PI * 2);
      context.fill();
    }

    mini.treats.forEach((treat) => {
      context.save();
      context.shadowColor = "rgba(80, 58, 79, .16)";
      context.shadowBlur = 8;
      if (treat.special) {
        context.fillStyle = "#f6bf4d";
        drawStar(context, treat.x, treat.y, 5, treat.radius, treat.radius * 0.48, treat.rotation);
        context.fill();
      } else {
        context.translate(treat.x, treat.y);
        context.rotate(treat.rotation);
        context.fillStyle = "#ed8da7";
        context.beginPath();
        context.roundRect(-treat.radius, -treat.radius * 0.72, treat.radius * 2, treat.radius * 1.44, 6);
        context.fill();
        context.fillStyle = "#fff0d0";
        context.beginPath();
        context.arc(-4, -2, 2, 0, Math.PI * 2);
        context.arc(4, 3, 2, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    });

    const x = mini.playerX || width / 2;
    const y = height - 45;
    context.save();
    context.translate(x, y);
    context.shadowColor = "rgba(64, 59, 71, .2)";
    context.shadowBlur = 10;
    context.fillStyle = "#fff8eb";
    context.beginPath();
    context.roundRect(-45, -16, 90, 35, [8, 8, 22, 22]);
    context.fill();
    context.shadowBlur = 0;
    context.lineWidth = 5;
    context.strokeStyle = "#dc85a0";
    context.stroke();
    context.fillStyle = "#dc85a0";
    context.beginPath();
    context.arc(-25, -20, 13, Math.PI, 0);
    context.arc(25, -20, 13, Math.PI, 0);
    context.fill();
    context.fillStyle = "#6e5368";
    context.beginPath();
    context.arc(-14, -2, 2.5, 0, Math.PI * 2);
    context.arc(14, -2, 2.5, 0, Math.PI * 2);
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

    adjustStat("happiness", Math.min(25, 5 + score * 1.4));
    adjustStat("fullness", Math.min(12, Math.floor(score / 2)));
    adjustStat("energy", -10);
    state.counters.play += 1;
    grantXp(Math.min(15, 4 + Math.floor(score / 3)));
    const growth = checkGrowth();
    const suffix = quitEarly ? "짧게 놀았지만 즐거웠어!" : `${score}개의 간식을 받았어!`;
    setSpeech(suffix);
    showToast(`미니게임 종료 · 점수 ${score}`);
    animatePet("play");
    createParticles(["★", "♥"], "#e590aa");
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
    if (state.pet.name && elapsed > 0) applyElapsed(elapsed);
    lastTickAt = now;
  }

  function tick() {
    if (!state.pet.name) return;
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
    state.pet.name = name.slice(0, 10);
    state.pet.birthAt = Date.now();
    state.lastSeen = Date.now();
    lastTickAt = Date.now();
    dom.nameError.textContent = "";
    dom.welcomeDialog.close();
    render();
    setSpeech(`${state.pet.name}, 멋진 이름이야! 곧 알에서 만날게.`);
    showToast(`${state.pet.name}와의 첫날이 시작됐어요.`);
    createParticles(["✦", "♥"], "#e68aa5");
    playChime("evolve");
    saveGame();
  });

  dom.welcomeDialog.addEventListener("cancel", (event) => event.preventDefault());
  dom.soundButton.addEventListener("click", toggleSound);
  dom.soundToggle.addEventListener("click", toggleSound);
  dom.settingsButton.addEventListener("click", () => {
    render();
    dom.settingsDialog.showModal();
  });
  document.querySelector("[data-close='settings']").addEventListener("click", () => dom.settingsDialog.close());
  dom.offlineClose.addEventListener("click", () => dom.offlineDialog.close());
  dom.resetButton.addEventListener("click", () => {
    const confirmed = window.confirm(`${state.pet.name || "현재 친구"}와의 기록을 지우고 새 알로 시작할까요? 이 작업은 되돌릴 수 없어요.`);
    if (!confirmed) return;
    localStorage.removeItem(SAVE_KEY);
    window.location.reload();
  });

  dom.quitGameButton.addEventListener("click", () => finishMiniGame(true));
  dom.minigameDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    finishMiniGame(true);
  });
  dom.gameCanvas.addEventListener("pointerdown", moveCatcherFromPointer);
  dom.gameCanvas.addEventListener("pointermove", (event) => {
    if (event.buttons || event.pointerType === "touch") moveCatcherFromPointer(event);
  });

  window.addEventListener("keydown", (event) => {
    if (!dom.minigameDialog.open) return;
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
      mini.keys.left = true;
      event.preventDefault();
    }
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
      mini.keys.right = true;
      event.preventDefault();
    }
  });
  window.addEventListener("keyup", (event) => {
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") mini.keys.left = false;
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") mini.keys.right = false;
  });
  window.addEventListener("resize", () => {
    if (dom.minigameDialog.open) {
      resizeGameCanvas();
      drawGame();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      advanceToNow();
      saveGame();
    } else {
      advanceToNow();
      render();
    }
  });
  window.addEventListener("beforeunload", () => {
    advanceToNow();
    saveGame();
  });

  render();
  setSpeech(defaultSpeech(), 0);
  if (!state.pet.name) {
    dom.welcomeDialog.showModal();
    window.setTimeout(() => dom.nameInput.focus(), 100);
  } else {
    const growth = checkGrowth();
    if (growth) announceGrowth(growth);
    saveGame();
    if (offlineReport) window.setTimeout(() => showOfflineReport(offlineReport), 250);
  }
  if (loaded.wasInvalid) window.setTimeout(() => showToast("저장 데이터를 안전하게 복구했어요. 새 친구를 만나 주세요."), 350);
  window.setInterval(tick, 1000);
})();
