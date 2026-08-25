(() => {
  "use strict";

  const SAVE_KEY = "cozy-little-garden-save-v2";
  const SAVE_VERSION = 2;
  const STAT_KEYS = ["water", "sunlight", "nutrients", "vitality", "health"];
  const CORE_STAT_KEYS = ["water", "sunlight", "nutrients", "vitality"];
  const STAGE_CLASSES = ["stage-seed", "stage-sprout", "stage-tree", "stage-flower", "stage-fruit"];
  const FORM_CLASSES = ["form-balanced", "form-sunny", "form-dewy"];
  const ACTION_CLASSES = ["action-water", "action-soil", "action-heal", "action-sun", "action-music", "action-evolve"];
  const SPECIES_CLASSES = ["species-sunflower", "species-strawberry", "species-tomato", "species-apple"];
  const WEATHER_CLASSES = ["weather-sunny", "weather-cloudy", "weather-rain", "weather-night"];
  const WEATHER_CACHE_MS = 30 * 60_000;
  const WEATHER_EFFECT_MAX_AGE_MS = 6 * 60 * 60_000;
  const SOIL_CACHE_MS = 180 * 24 * 60 * 60_000;
  const FARM_DAY_COOLDOWN_MS = 3_000;
  const DEFAULT_LOCATION = { name: "서울", country: "대한민국", latitude: 37.5665, longitude: 126.978, timezone: "Asia/Seoul" };

  // 농림수산식품교육문화정보원의 시설 방울토마토 생육 공개데이터를 주차별 중앙값으로 요약했습니다.
  // 시설별 가지치기와 수확 때문에 일부 값은 다음 주에 낮아질 수 있으며, 이것도 실제 재배 흐름의 일부입니다.
  const SMARTFARM_BENCHMARK = {
    2: { stem: 2, leaves: 6, clusters: 0, fruits: 0, samples: 2 },
    3: { stem: 3, leaves: 9, clusters: 0, fruits: 0, samples: 2 },
    4: { stem: 3, leaves: 7, clusters: 0, fruits: 0, samples: 2 },
    5: { stem: 2.5, leaves: 10.5, clusters: 0, fruits: 0, samples: 2 },
    6: { stem: 4, leaves: 14.5, clusters: 0, fruits: 0, samples: 2 },
    7: { stem: 5.5, leaves: 13.5, clusters: 0, fruits: 0, samples: 2 },
    8: { stem: 6.5, leaves: 13.5, clusters: 0, fruits: 0, samples: 2 },
    9: { stem: 7.5, leaves: 16.5, clusters: 0.5, fruits: 0, samples: 2 },
    10: { stem: 9, leaves: 21, clusters: 1, fruits: 0, samples: 2 },
    11: { stem: 9.5, leaves: 27.5, clusters: 1, fruits: 0, samples: 2 },
    12: { stem: 9.5, leaves: 20.5, clusters: 1, fruits: 2.5, samples: 2 },
    13: { stem: 8, leaves: 14, clusters: 1.5, fruits: 3.5, samples: 2 },
    14: { stem: 8.5, leaves: 10, clusters: 2.5, fruits: 22, samples: 4 },
    15: { stem: 8, leaves: 9, clusters: 3.5, fruits: 17, samples: 4 },
    16: { stem: 8, leaves: 11.5, clusters: 5, fruits: 44, samples: 5 },
    17: { stem: 7.5, leaves: 12, clusters: 6, fruits: 48, samples: 5 },
    18: { stem: 9, leaves: 11, clusters: 7, fruits: 66, samples: 5 },
    19: { stem: 8, leaves: 13, clusters: 7.5, fruits: 89.5, samples: 6 },
    20: { stem: 8, leaves: 13, clusters: 7.5, fruits: 87, samples: 6 },
    21: { stem: 8, leaves: 13.5, clusters: 8, fruits: 76.5, samples: 6 },
    22: { stem: 8, leaves: 14, clusters: 9, fruits: 78, samples: 7 },
    23: { stem: 8, leaves: 14.5, clusters: 8.5, fruits: 59, samples: 6 },
    24: { stem: 7, leaves: 16, clusters: 9, fruits: 67, samples: 7 },
    25: { stem: 7, leaves: 16, clusters: 10, fruits: 85, samples: 5 }
  };

  // GBIF Species API에서 확인한 실제 학명·분류 키입니다. 게임 수치는 별도의 게임 규칙입니다.
  const SPECIES = {
    sunflower: { name: "해바라기", scientific: "Helianthus annuus L.", family: "국화과", familyScientific: "Asteraceae", gbifKey: 9206251, mark: "🌻" },
    strawberry: { name: "딸기", scientific: "Fragaria × ananassa (Weston) Rozier", family: "장미과", familyScientific: "Rosaceae", gbifKey: 3029912, mark: "🍓" },
    tomato: { name: "방울토마토", scientific: "Solanum lycopersicum L.", family: "가지과", familyScientific: "Solanaceae", gbifKey: 2930137, mark: "🍅" },
    apple: { name: "사과나무", scientific: "Malus domestica (Suckow) Borkh.", family: "장미과", familyScientific: "Rosaceae", gbifKey: 3001244, mark: "🍎" }
  };

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
    settingsDataSource: el("settingsDataSource"),
    settingsLocationButton: el("settingsLocationButton"),
    resetButton: el("resetButton"),
    welcomeDialog: el("welcomeDialog"),
    welcomeForm: el("welcomeForm"),
    nameInput: el("nameInput"),
    nameError: el("nameError"),
    room: el("room"),
    speciesLink: el("speciesLink"),
    speciesMark: el("speciesMark"),
    speciesName: el("speciesName"),
    speciesScientific: el("speciesScientific"),
    speciesFamily: el("speciesFamily"),
    weatherCard: el("weatherCard"),
    weatherIcon: el("weatherIcon"),
    weatherLocation: el("weatherLocation"),
    weatherTemperature: el("weatherTemperature"),
    weatherCondition: el("weatherCondition"),
    weatherHumidity: el("weatherHumidity"),
    weatherRain: el("weatherRain"),
    weatherRange: el("weatherRange"),
    weatherSunTime: el("weatherSunTime"),
    weatherEffect: el("weatherEffect"),
    weatherUpdated: el("weatherUpdated"),
    weatherRefresh: el("weatherRefresh"),
    locationButton: el("locationButton"),
    locationDialog: el("locationDialog"),
    locationClose: el("locationClose"),
    locationForm: el("locationForm"),
    locationInput: el("locationInput"),
    locationStatus: el("locationStatus"),
    locationResults: el("locationResults"),
    offlineDialog: el("offlineDialog"),
    offlineSummary: el("offlineSummary"),
    offlineChanges: el("offlineChanges"),
    offlineClose: el("offlineClose"),
    minigameDialog: el("minigameDialog"),
    gameCanvas: el("gameCanvas"),
    gameScore: el("gameScore"),
    gameTime: el("gameTime"),
    gameCountdown: el("gameCountdown"),
    quitGameButton: el("quitGameButton"),
    leagueCard: el("leagueCard"),
    seasonWeek: el("seasonWeek"),
    seasonDay: el("seasonDay"),
    leagueGrade: el("leagueGrade"),
    leaguePercentile: el("leaguePercentile"),
    coachTitle: el("coachTitle"),
    coachCopy: el("coachCopy"),
    strategyGrid: el("strategyGrid"),
    strategyHint: el("strategyHint"),
    closeDayButton: el("closeDayButton"),
    benchmarkNote: el("benchmarkNote"),
    dayReportDialog: el("dayReportDialog"),
    reportScore: el("reportScore"),
    dayReportTitle: el("dayReportTitle"),
    dayReportSummary: el("dayReportSummary"),
    reportBreakdown: el("reportBreakdown"),
    reportRating: el("reportRating"),
    reportWeek: el("reportWeek"),
    reportTip: el("reportTip"),
    dayReportClose: el("dayReportClose")
  };

  const stageInfo = {
    seed: { label: "작은 씨앗", aria: "화분 흙에 심긴 작은 갈색 씨앗" },
    sprout: { label: "초록 새싹", aria: "화분 위로 두 잎을 틔운 초록 새싹" },
    tree: { label: "영양생장기", aria: "줄기와 잎을 힘차게 키우는 방울토마토" },
    flower: { label: "개화기", aria: "노란 꽃이 피기 시작한 방울토마토" },
    fruit: { label: "착과·수확기", aria: "붉은 열매를 맺은 건강한 방울토마토" }
  };

  const formInfo = {
    balanced: { label: "균형 수확형", aria: "고르게 익은 방울토마토 열매를 맺은 균형 잡힌 식물" },
    sunny: { label: "고광합성형", aria: "햇빛 관리를 많이 받아 열매를 맺은 방울토마토" },
    dewy: { label: "수분 충실형", aria: "수분과 토양 관리를 많이 받아 열매를 맺은 방울토마토" }
  };

  function clamp(value, min = 0, max = 100) {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
  }

  function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function finiteNumber(value, fallback = null) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizeLocation(raw) {
    const latitude = finiteNumber(raw?.latitude);
    const longitude = finiteNumber(raw?.longitude);
    if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return { ...DEFAULT_LOCATION };
    return {
      name: typeof raw?.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 40) : DEFAULT_LOCATION.name,
      country: typeof raw?.country === "string" ? raw.country.trim().slice(0, 40) : "",
      latitude,
      longitude,
      timezone: typeof raw?.timezone === "string" && raw.timezone ? raw.timezone : "auto"
    };
  }

  function normalizeWeather(raw) {
    const fetchedAt = finiteNumber(raw?.fetchedAt, 0);
    const source = raw?.data;
    if (!source || typeof source !== "object" || fetchedAt <= 0) return { fetchedAt: 0, data: null };
    const temperature = finiteNumber(source.temperature);
    const humidity = finiteNumber(source.humidity);
    const weatherCode = finiteNumber(source.weatherCode);
    if (temperature === null || humidity === null || weatherCode === null) return { fetchedAt: 0, data: null };
    return {
      fetchedAt: Math.min(fetchedAt, Date.now()),
      data: {
        temperature,
        humidity: clamp(humidity),
        precipitation: Math.max(0, finiteNumber(source.precipitation, 0)),
        weatherCode,
        cloudCover: clamp(finiteNumber(source.cloudCover, 0)),
        isDay: finiteNumber(source.isDay, 1) === 1,
        maxTemperature: finiteNumber(source.maxTemperature, temperature),
        minTemperature: finiteNumber(source.minTemperature, temperature),
        sunrise: typeof source.sunrise === "string" ? source.sunrise : "",
        sunset: typeof source.sunset === "string" ? source.sunset : "",
        radiation: Math.max(0, finiteNumber(source.radiation, 0)),
        evapotranspiration: Math.max(0, finiteNumber(source.evapotranspiration, 0)),
        sunshineDuration: Math.max(0, finiteNumber(source.sunshineDuration, 0)),
        observedAt: typeof source.observedAt === "string" ? source.observedAt : ""
      }
    };
  }

  function normalizeSoil(raw) {
    const fetchedAt = finiteNumber(raw?.fetchedAt, 0);
    const source = raw?.data;
    const locationKey = typeof raw?.locationKey === "string" ? raw.locationKey.slice(0, 80) : "";
    if (!source || typeof source !== "object" || fetchedAt <= 0) return { fetchedAt: 0, locationKey: "", data: null };
    const ph = finiteNumber(source.ph);
    if (ph === null || ph < 2 || ph > 12) return { fetchedAt: 0, locationKey: "", data: null };
    return {
      fetchedAt: Math.min(fetchedAt, Date.now()),
      locationKey,
      data: {
        ph,
        sand: clamp(finiteNumber(source.sand, 45), 0, 100),
        clay: clamp(finiteNumber(source.clay, 25), 0, 100),
        carbon: Math.max(0, finiteNumber(source.carbon, 0)),
        nitrogen: Math.max(0, finiteNumber(source.nitrogen, 0))
      }
    };
  }

  function stageStartDay(stage) {
    return ({ seed: 1, sprout: 2, tree: 7, flower: 15, fruit: 21 })[stage] || 1;
  }

  function normalizeLeague(raw, previousStage = "seed") {
    const allowedStrategies = ["balanced", "irrigate", "ventilate", "shade"];
    const day = Math.max(1, Math.min(999, Math.floor(finiteNumber(raw?.day, stageStartDay(previousStage)))));
    const daysPlayed = Math.max(0, Math.min(day - 1, Math.floor(finiteNumber(raw?.daysPlayed, day - 1))));
    const history = Array.isArray(raw?.history) ? raw.history.slice(-20).map((item) => ({
      day: Math.max(1, Math.floor(finiteNumber(item?.day, 1))),
      week: Math.max(2, Math.min(25, Math.floor(finiteNumber(item?.week, 2)))),
      score: clamp(finiteNumber(item?.score, 70), 0, 110),
      strategy: allowedStrategies.includes(item?.strategy) ? item.strategy : "balanced"
    })) : [];
    return {
      day,
      daysPlayed,
      rating: clamp(finiteNumber(raw?.rating, 75), 0, 110),
      strategy: allowedStrategies.includes(raw?.strategy) ? raw.strategy : "balanced",
      dailyCare: Math.max(0, Math.min(20, Math.floor(finiteNumber(raw?.dailyCare, 0)))),
      lastClosedAt: Math.min(Date.now(), Math.max(0, finiteNumber(raw?.lastClosedAt, 0))),
      history
    };
  }

  function createInitialState() {
    return {
      version: SAVE_VERSION,
      plant: {
        name: "",
        plantedAt: null,
        stage: "seed",
        form: null,
        speciesId: "tomato",
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
        muted: false,
        location: { ...DEFAULT_LOCATION }
      },
      weather: {
        fetchedAt: 0,
        data: null
      },
      soil: {
        fetchedAt: 0,
        locationKey: "",
        data: null
      },
      league: normalizeLeague(null, "seed"),
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
        // v2의 기존 다종 저장도 데이터 리그에 맞춰 방울토마토 시즌으로 안전하게 이전합니다.
        speciesId: "tomato",
        xp: clamp(Number(raw.plant?.xp), 0, 9999),
        isSick: Boolean(raw.plant?.isSick)
      },
      stats: { ...fresh.stats },
      counters: { ...fresh.counters },
      settings: {
        muted: Boolean(raw.settings?.muted),
        location: normalizeLocation(raw.settings?.location)
      },
      weather: normalizeWeather(raw.weather),
      soil: normalizeSoil(raw.soil),
      league: normalizeLeague(raw.league, stage),
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

  function weatherDescription(code) {
    if (code === 0) return { label: "맑음", icon: "☀", className: "weather-sunny" };
    if ([1, 2].includes(code)) return { label: "구름 조금", icon: "◒", className: "weather-sunny" };
    if (code === 3 || [45, 48].includes(code)) return { label: code === 3 ? "흐림" : "안개", icon: "☁", className: "weather-cloudy" };
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return { label: code >= 95 ? "천둥번개" : "비", icon: "☂", className: "weather-rain" };
    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return { label: "눈", icon: "❄", className: "weather-cloudy" };
    return { label: "날씨 변화", icon: "⌁", className: "weather-cloudy" };
  }

  function weatherProfile(useWeather = true) {
    const sample = state.weather?.data;
    const age = Date.now() - finiteNumber(state.weather?.fetchedAt, 0);
    const neutral = { active: false, waterMultiplier: 1, sunlightRate: -0.2, vitalityRate: -0.18, copy: "기본 성장 환경" };
    if (!useWeather || !sample || age < 0 || age > WEATHER_EFFECT_MAX_AGE_MS) return neutral;

    let waterMultiplier = sample.temperature >= 30 ? 1.4 : sample.temperature >= 25 ? 1.18 : sample.temperature <= 5 ? 0.82 : 1;
    if (sample.humidity >= 80) waterMultiplier *= 0.72;
    else if (sample.humidity >= 65) waterMultiplier *= 0.86;
    if (sample.precipitation > 0) waterMultiplier *= 0.62;

    let sunlightRate = -0.2;
    if (!sample.isDay) sunlightRate = -0.24;
    else if (sample.cloudCover <= 25 && sample.weatherCode <= 2) sunlightRate = 0.07;
    else if (sample.cloudCover <= 70) sunlightRate = -0.08;
    else sunlightRate = -0.18;

    let vitalityRate = -0.18;
    if (sample.temperature > 33 || sample.temperature < 2) vitalityRate -= 0.16;
    else if (sample.temperature > 29 || sample.temperature < 8) vitalityRate -= 0.07;
    else if (sample.temperature >= 16 && sample.temperature <= 25) vitalityRate += 0.03;

    const notes = [];
    if (sample.precipitation > 0 || sample.humidity >= 80) notes.push("촉촉해서 물이 천천히 말라요");
    else if (sample.temperature >= 30) notes.push("더워서 물이 빨리 말라요");
    else notes.push("수분 소모가 평소와 비슷해요");
    if (!sample.isDay) notes.push("밤이라 햇빛이 줄어요");
    else if (sunlightRate > 0) notes.push("맑은 햇빛이 차올라요");
    else if (sample.cloudCover > 70) notes.push("구름이 햇빛을 가려요");
    if (vitalityRate < -0.25) notes.push("기온 스트레스 주의");

    return { active: true, waterMultiplier, sunlightRate, vitalityRate, copy: notes.join(" · ") };
  }

  function applyElapsed(milliseconds) {
    if (!state.plant.name || milliseconds <= 0) return;
    const totalMinutes = milliseconds / 60_000;
    const steps = Math.min(720, Math.max(1, Math.ceil(totalMinutes / 5)));
    const minutesPerStep = totalMinutes / steps;

    for (let index = 0; index < steps; index += 1) {
      const weatherMinutes = index * minutesPerStep;
      const profile = weatherProfile(weatherMinutes <= 360);
      adjustStat("water", -0.3 * profile.waterMultiplier * minutesPerStep);
      adjustStat("sunlight", profile.sunlightRate * minutesPerStep);
      adjustStat("nutrients", -0.12 * minutesPerStep);
      adjustStat("vitality", profile.vitalityRate * minutesPerStep);

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

  function benchmarkWeek(day = state.league.day) {
    return Math.min(25, 2 + Math.floor((Math.max(1, day) - 1) / 2));
  }

  function benchmarkFor(day = state.league.day) {
    return SMARTFARM_BENCHMARK[benchmarkWeek(day)] || SMARTFARM_BENCHMARK[25];
  }

  function rangeFit(value, optimalMin, optimalMax, absoluteMin, absoluteMax) {
    if (value >= optimalMin && value <= optimalMax) return 100;
    if (value <= absoluteMin || value >= absoluteMax) return 8;
    if (value < optimalMin) return clamp(8 + ((value - absoluteMin) / (optimalMin - absoluteMin)) * 92);
    return clamp(8 + ((absoluteMax - value) / (absoluteMax - optimalMax)) * 92);
  }

  function strategyInfo(strategy = state.league.strategy) {
    return ({
      balanced: { label: "균형 관리", short: "기본 균형" },
      irrigate: { label: "관수 강화", short: "수분 보완" },
      ventilate: { label: "환기 강화", short: "온습도 완화" },
      shade: { label: "차광 관리", short: "일사 스트레스 완화" }
    })[strategy] || { label: "균형 관리", short: "기본 균형" };
  }

  function growthFactors() {
    const sample = state.weather.data;
    const temperature = finiteNumber(sample?.temperature, 23);
    const humidity = finiteNumber(sample?.humidity, 65);
    const radiation = finiteNumber(sample?.radiation, sample?.isDay === false ? 0 : Math.max(5, 22 - finiteNumber(sample?.cloudCover, 45) * 0.17));
    const precipitation = finiteNumber(sample?.precipitation, 0);
    const et0 = finiteNumber(sample?.evapotranspiration, Math.max(1.5, temperature / 8 - humidity / 80));
    const ph = finiteNumber(state.soil.data?.ph, 6.2);

    let temperatureScore = rangeFit(temperature, 20, 27, 7, 35);
    const weatherLightScore = radiation >= 12 && radiation <= 22 ? 100 : radiation < 12 ? clamp(25 + radiation * 6.25) : clamp(100 - (radiation - 22) * 5.5);
    let lightScore = weatherLightScore * 0.7 + state.stats.sunlight * 0.3;
    let waterScore = rangeFit(state.stats.water, 58, 86, 20, 100);
    const phScore = rangeFit(ph, 5.5, 6.8, 5, 7.5);
    let soilScore = phScore * 0.55 + state.stats.nutrients * 0.45;
    const careScore = clamp(averageCoreStats() * 0.75 + state.stats.health * 0.15 + Math.min(10, state.league.dailyCare * 4));
    let diseaseRisk = humidity >= 88 && temperature >= 16 && temperature <= 30 ? 13 : humidity >= 80 ? 6 : 0;
    let strategyBonus = 0;

    if (state.league.strategy === "balanced") {
      temperatureScore += 3;
      lightScore += 3;
      waterScore += 3;
      soilScore += 3;
      strategyBonus = 3;
    } else if (state.league.strategy === "irrigate") {
      const needed = state.stats.water < 72 || et0 >= 4 || temperature >= 29;
      waterScore += needed ? 19 : (precipitation >= 2 || state.stats.water >= 90 ? -16 : 5);
      strategyBonus = needed ? 12 : -7;
    } else if (state.league.strategy === "ventilate") {
      const needed = humidity >= 78 || temperature > 27;
      temperatureScore += needed ? 17 : 4;
      diseaseRisk = Math.max(0, diseaseRisk - 11);
      strategyBonus = needed ? 12 : 3;
    } else if (state.league.strategy === "shade") {
      const needed = temperature > 28 && radiation > 20;
      temperatureScore += needed ? 18 : -4;
      lightScore += needed ? 7 : -9;
      strategyBonus = needed ? 13 : -5;
    }

    temperatureScore = clamp(temperatureScore);
    lightScore = clamp(lightScore);
    waterScore = clamp(waterScore);
    soilScore = clamp(soilScore);
    const score = clamp(
      temperatureScore * 0.25 + lightScore * 0.18 + waterScore * 0.18 + soilScore * 0.15 + careScore * 0.24 - diseaseRisk,
      0,
      110
    );

    return { temperature, humidity, radiation, precipitation, et0, ph, temperatureScore, lightScore, waterScore, soilScore, careScore, diseaseRisk, strategyBonus, score };
  }

  function gradeFor(score) {
    if (score >= 95) return "S";
    if (score >= 85) return "A";
    if (score >= 72) return "B";
    if (score >= 58) return "C";
    return "D";
  }

  function leagueStage(day = state.league.day) {
    if (day < 2) return "seed";
    if (day < 7) return "sprout";
    if (day < 15) return "tree";
    if (day < 21) return "flower";
    return "fruit";
  }

  function metricSnapshot() {
    const farm = benchmarkFor();
    const performanceFactor = clamp(0.7 + state.league.rating / 250, 0.72, 1.15);
    return {
      farm,
      mine: {
        stem: farm.stem * performanceFactor,
        leaves: farm.leaves * performanceFactor,
        clusters: farm.clusters * performanceFactor,
        fruits: farm.fruits * performanceFactor
      }
    };
  }

  function checkGrowth() {
    if (!state.plant.name || state.plant.isSick || averageCoreStats() < 35) return null;
    const oldStage = state.plant.stage;
    state.plant.stage = leagueStage();
    if (state.plant.stage === "fruit" && !state.plant.form) state.plant.form = chooseFruitForm();
    if (state.plant.stage !== "fruit") state.plant.form = null;
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
    const day = state.league.day;
    if (state.plant.stage === "seed") return { percent: 35, copy: "첫 영농일을 마치면 발아" };
    if (state.plant.stage === "sprout") return { percent: clamp(((day - 2) / 5) * 100), copy: `영양생장까지 ${Math.max(0, 7 - day)}영농일` };
    if (state.plant.stage === "tree") return { percent: clamp(((day - 7) / 8) * 100), copy: `첫 개화까지 ${Math.max(0, 15 - day)}영농일` };
    if (state.plant.stage === "flower") return { percent: clamp(((day - 15) / 6) * 100), copy: `첫 착과까지 ${Math.max(0, 21 - day)}영농일` };
    return { percent: 100, copy: `수확 시즌 · 실제 농가 ${benchmarkWeek()}주차 비교` };
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

  function shortClock(value) {
    if (!value) return "--:--";
    const match = String(value).match(/T(\d{2}:\d{2})/);
    return match ? match[1] : "--:--";
  }

  function weatherAgeLabel() {
    const fetchedAt = finiteNumber(state.weather?.fetchedAt, 0);
    if (!fetchedAt) return "아직 갱신되지 않음";
    const minutes = Math.max(0, Math.floor((Date.now() - fetchedAt) / 60_000));
    if (minutes < 1) return "방금 갱신 · Open-Meteo";
    if (minutes < 60) return `${minutes}분 전 갱신 · Open-Meteo`;
    return `${Math.floor(minutes / 60)}시간 전 저장 데이터 · Open-Meteo`;
  }

  function renderWeather() {
    const location = state.settings.location;
    const sample = state.weather.data;
    dom.weatherLocation.textContent = location.name;
    dom.room.classList.remove(...WEATHER_CLASSES);

    if (!sample) {
      dom.weatherIcon.textContent = "⌁";
      dom.weatherTemperature.textContent = "--°";
      dom.weatherCondition.textContent = "오프라인 기본 환경";
      dom.weatherHumidity.textContent = "--%";
      dom.weatherRain.textContent = "-- mm";
      dom.weatherRange.textContent = "--° / --°";
      dom.weatherSunTime.textContent = "--:-- / --:--";
      dom.weatherEffect.textContent = "데이터 없이도 중립 규칙으로 자라요";
      dom.weatherUpdated.textContent = weatherAgeLabel();
      return;
    }

    const description = weatherDescription(sample.weatherCode);
    dom.weatherIcon.textContent = description.icon;
    dom.weatherTemperature.textContent = `${Math.round(sample.temperature)}°`;
    dom.weatherCondition.textContent = `${description.label} · ${sample.isDay ? "낮" : "밤"}`;
    dom.weatherHumidity.textContent = `${Math.round(sample.humidity)}%`;
    dom.weatherRain.textContent = `${sample.precipitation.toFixed(1)} mm`;
    dom.weatherRange.textContent = `${Math.round(sample.maxTemperature)}° / ${Math.round(sample.minTemperature)}°`;
    dom.weatherSunTime.textContent = `${shortClock(sample.sunrise)} / ${shortClock(sample.sunset)}`;
    const profile = weatherProfile(true);
    dom.weatherEffect.textContent = profile.copy;
    dom.weatherUpdated.textContent = weatherAgeLabel();
    dom.room.classList.add(sample.isDay ? description.className : "weather-night");
  }

  function formatMetric(value, digits = 1) {
    const rounded = Math.round(value * (10 ** digits)) / (10 ** digits);
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(digits);
  }

  function setFactor(prefix, score, detail) {
    const valueEl = el(`factor${prefix}`);
    const detailEl = el(`factor${prefix}Detail`);
    valueEl.textContent = `${Math.round(score)}점`;
    detailEl.textContent = detail;
    const card = valueEl.parentElement || valueEl.closest("div");
    if (card?.classList) {
      card.classList.toggle("factor-low", score < 55);
      card.classList.toggle("factor-mid", score >= 55 && score < 78);
    }
  }

  function coachBrief(factors) {
    const sample = state.weather.data;
    let recommended = "balanced";
    if (factors.waterScore < 70 || factors.et0 >= 4) recommended = "irrigate";
    if (factors.humidity >= 82 || factors.temperature > 30) recommended = "ventilate";
    if (factors.temperature > 29 && factors.radiation > 21) recommended = "shade";

    const scores = [
      ["온도", factors.temperatureScore],
      ["광량", factors.lightScore],
      ["수분", factors.waterScore],
      ["토양", factors.soilScore]
    ].sort((a, b) => a[1] - b[1]);
    const weakest = scores[0];
    const strategy = strategyInfo(recommended);
    const sourceCopy = sample ? `${state.settings.location.name} 실제 날씨` : "오프라인 표준 날씨";
    return {
      recommended,
      title: weakest[1] < 72 ? `${weakest[0]} 관리가 승부처예요` : "균형 잡힌 성장 환경이에요",
      copy: `${sourceCopy} 기준, 가장 낮은 요인은 ${weakest[0]} ${Math.round(weakest[1])}점입니다. 오늘은 ‘${strategy.label}’ 전략이 유리해요.`
    };
  }

  function renderLeague() {
    const factors = growthFactors();
    const grade = gradeFor(state.league.rating);
    const topPercent = Math.max(5, Math.min(75, Math.round(100 - state.league.rating * 0.8)));
    const brief = coachBrief(factors);
    const metrics = metricSnapshot();
    const week = benchmarkWeek();
    const farm = metrics.farm;
    const mine = metrics.mine;

    dom.seasonWeek.textContent = `${week}주차`;
    dom.seasonDay.textContent = `${state.league.day}일`;
    dom.leagueGrade.className = `league-grade grade-${grade.toLowerCase()}`;
    dom.leagueGrade.setAttribute("aria-label", `시즌 등급 ${grade}`);
    dom.leagueGrade.querySelector("strong").textContent = grade;
    dom.leaguePercentile.textContent = `상위 ${topPercent}% 예상`;
    dom.coachTitle.textContent = brief.title;
    dom.coachCopy.textContent = brief.copy;
    dom.strategyHint.textContent = state.league.strategy === brief.recommended
      ? `코치 추천과 일치 · ${strategyInfo(state.league.strategy).short}`
      : `코치 추천: ${strategyInfo(brief.recommended).label} · 현재: ${strategyInfo(state.league.strategy).label}`;

    setFactor("Temperature", factors.temperatureScore, `${formatMetric(factors.temperature)}°C · FAO 20–27°C`);
    setFactor("Light", factors.lightScore, `${formatMetric(factors.radiation)} MJ/㎡ · 일사량`);
    setFactor("Water", factors.waterScore, `수분 ${Math.round(state.stats.water)} · ET₀ ${formatMetric(factors.et0)}`);
    setFactor("Soil", factors.soilScore, state.soil.data ? `지역 표토 pH ${formatMetric(factors.ph)}` : "표준 상토 pH 6.2");

    dom.strategyGrid.querySelectorAll("[data-strategy]").forEach((button) => {
      button.setAttribute("aria-checked", String(button.dataset.strategy === state.league.strategy));
    });
    const wait = FARM_DAY_COOLDOWN_MS - (Date.now() - state.league.lastClosedAt);
    dom.closeDayButton.disabled = !state.plant.name || wait > 0;

    const metricRows = [
      ["Stem", mine.stem, farm.stem, " mm"],
      ["Leaves", mine.leaves, farm.leaves, "장"],
      ["Flowers", mine.clusters, farm.clusters, "단"],
      ["Fruits", mine.fruits, farm.fruits, "개"]
    ];
    metricRows.forEach(([key, myValue, farmValue, unit]) => {
      el(`my${key}`).textContent = formatMetric(myValue);
      el(`farm${key}`).textContent = `${formatMetric(farmValue)}${unit}`;
      el(`bar${key}`).style.width = `${farmValue <= 0 ? (myValue > 0 ? 100 : 8) : clamp((myValue / farmValue) * 82, 8, 100)}%`;
    });
    dom.benchmarkNote.textContent = `공개데이터 7개 시설 · ${week}주차 측정 중앙값(n=${farm.samples}) · 가지치기·수확 반영`;
  }

  function render() {
    const display = stageDisplay();
    const age = state.plant.plantedAt ? formatDuration(Date.now() - state.plant.plantedAt) : "방금 심음";
    dom.plantName.textContent = state.plant.name || "새 씨앗";
    dom.stageLabel.textContent = display.label;
    dom.ageLabel.textContent = age;
    dom.settingsAge.textContent = age;
    dom.settingsStage.textContent = display.label;

    const species = SPECIES[state.plant.speciesId] || SPECIES.tomato;
    dom.plant.classList.remove(...STAGE_CLASSES, ...FORM_CLASSES, ...SPECIES_CLASSES);
    dom.plant.classList.add(`stage-${state.plant.stage}`);
    dom.plant.classList.add(`species-${state.plant.speciesId || "tomato"}`);
    if (state.plant.stage === "fruit") dom.plant.classList.add(`form-${state.plant.form || "balanced"}`);
    dom.plant.classList.toggle("is-sick", state.plant.isSick);
    dom.plant.setAttribute("aria-label", `${species.name} · ${state.plant.stage === "fruit" ? formInfo[state.plant.form || "balanced"].aria : stageInfo[state.plant.stage].aria}`);
    dom.sickMark.classList.toggle("visible", state.plant.isSick);

    dom.speciesMark.textContent = species.mark;
    dom.speciesName.textContent = species.name;
    dom.speciesScientific.textContent = species.scientific;
    dom.speciesFamily.textContent = `${species.family} (${species.familyScientific}) · GBIF`;
    dom.speciesLink.href = `https://www.gbif.org/species/${species.gbifKey}`;
    dom.settingsDataSource.textContent = `${state.settings.location.name} 날씨 · 농정원 생육 · FAO 적정환경`;

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
    renderWeather();
    renderLeague();
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
    state.league.dailyCare = Math.min(20, state.league.dailyCare + 1);
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

  function showDayReport(result) {
    const grade = gradeFor(result.score);
    const titles = { S: "현장 기록을 압도한 하루예요", A: "아주 좋은 하루를 운영했어요", B: "안정적으로 성장했어요", C: "보완할 단서가 보였어요", D: "회복 전략이 필요한 하루예요" };
    dom.reportScore.textContent = grade;
    dom.dayReportTitle.textContent = titles[grade];
    dom.dayReportSummary.textContent = `${strategyInfo(result.strategy).label} 전략으로 ${result.week}주차 환경에 대응해 ${Math.round(result.score)}점을 기록했습니다.`;
    dom.reportBreakdown.replaceChildren();
    [
      ["기후", (result.factors.temperatureScore + result.factors.lightScore) / 2],
      ["수분", result.factors.waterScore],
      ["토양", result.factors.soilScore],
      ["돌봄", result.factors.careScore]
    ].forEach(([label, score]) => {
      const item = document.createElement("div");
      const labelEl = document.createElement("span");
      const scoreEl = document.createElement("strong");
      labelEl.textContent = label;
      scoreEl.textContent = String(Math.round(score));
      item.append(labelEl, scoreEl);
      dom.reportBreakdown.appendChild(item);
    });
    dom.reportRating.textContent = `${Math.round(state.league.rating)}점 · ${gradeFor(state.league.rating)}등급`;
    dom.reportWeek.textContent = result.week !== benchmarkWeek() ? `${benchmarkWeek()}주차 진입` : `${benchmarkWeek()}주차 진행 중`;

    const ranked = [
      ["온도", result.factors.temperatureScore, "환기나 차광 전략으로 온도 스트레스를 줄여 보세요."],
      ["광량", result.factors.lightScore, "햇살방울 미니게임으로 광합성 준비를 보완해 보세요."],
      ["수분", result.factors.waterScore, "수분 게이지와 ET₀를 함께 보고 관수량을 정해 보세요."],
      ["토양", result.factors.soilScore, "흙 돌보기로 실제 지역 토양의 약점을 보정해 보세요."],
      ["돌봄", result.factors.careScore, "영농일을 마치기 전에 필요한 돌봄을 2회 정도 해 보세요."]
    ].sort((a, b) => a[1] - b[1]);
    dom.reportTip.textContent = `${ranked[0][0]} ${Math.round(ranked[0][1])}점 · ${ranked[0][2]}`;
    if (!dom.dayReportDialog.open) dom.dayReportDialog.showModal();
  }

  function closeFarmDay() {
    if (!state.plant.name) return;
    const remaining = FARM_DAY_COOLDOWN_MS - (Date.now() - state.league.lastClosedAt);
    if (remaining > 0) {
      showToast(`${Math.ceil(remaining / 1000)}초 뒤 다음 영농일을 진행할 수 있어요.`);
      return;
    }

    const currentDay = state.league.day;
    const currentWeek = benchmarkWeek(currentDay);
    const factors = growthFactors();
    const score = factors.score;
    const result = { day: currentDay, week: currentWeek, score, strategy: state.league.strategy, factors };
    const playedBefore = state.league.daysPlayed;
    state.league.rating = clamp((state.league.rating * playedBefore + score) / (playedBefore + 1), 0, 110);
    state.league.daysPlayed += 1;
    state.league.history.push({ day: currentDay, week: currentWeek, score, strategy: state.league.strategy });
    state.league.history = state.league.history.slice(-20);
    state.league.day = Math.min(999, state.league.day + 1);
    state.league.lastClosedAt = Date.now();
    state.league.dailyCare = 0;

    const irrigated = state.league.strategy === "irrigate";
    const shaded = state.league.strategy === "shade";
    const ventilated = state.league.strategy === "ventilate";
    if (irrigated) adjustStat("water", 12);
    adjustStat("water", -(6 + factors.et0 * 1.25 + Math.max(0, factors.temperature - 27) * 0.35));
    adjustStat("sunlight", shaded ? -3 : -6);
    adjustStat("nutrients", -4.5);
    adjustStat("vitality", score >= 85 ? 6 : score < 58 ? -9 : -2);
    if (score >= 85) adjustStat("health", 4);
    else if (score < 50) adjustStat("health", -12);
    else if (score < 68) adjustStat("health", -5);
    if (factors.diseaseRisk >= 10 && !ventilated) adjustStat("health", -6);
    if (state.stats.health <= 35) state.plant.isSick = true;
    if (state.plant.isSick && state.stats.health >= 60 && CORE_STAT_KEYS.filter((key) => state.stats[key] <= 20).length < 2) state.plant.isSick = false;
    grantXp(Math.max(2, Math.round(score / 10)));
    const growth = checkGrowth();

    const grade = gradeFor(score);
    setSpeech(`${currentDay}일차 운영은 ${grade}등급! ${strategyInfo(result.strategy).short} 결과가 생육에 기록됐어.`, 5200);
    showToast(`영농 ${currentDay}일 완료 · ${Math.round(score)}점 ${grade}등급`);
    animatePlant(score >= 85 ? "music" : "water");
    createParticles(score >= 72 ? ["✦", "♧"] : ["·", "♧"], score >= 72 ? "#70ad70" : "#b58a62");
    playChime(score >= 85 ? "evolve" : score < 58 ? "sad" : "happy");
    render();
    saveGame();
    showDayReport(result);
    if (growth) announceGrowth(growth);
  }

  function triggerRandomEvent() {
    if (!state.plant.name || dom.minigameDialog.open || dom.settingsDialog.open || document.hidden) return;
    const sample = state.weather.data;
    const roll = Math.random();
    const event = sample?.precipitation > 0.3 ? "rain" : sample?.humidity >= 82 && roll < 0.68 ? "pest" : roll < 0.28 ? "pest" : "butterfly";
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
      setSpeech(sample?.humidity >= 82 ? "습도가 높아 잎 상태가 나빠졌어… 환기가 필요해!" : "앗, 작은 벌레가 잎을 살짝 갉아먹었어…");
      showToast(sample?.humidity >= 82 ? "고습 병해 위험! 환기와 건강을 살펴봐 주세요." : "해충이 다녀갔어요. 건강을 살펴봐 주세요.");
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
    state.league.dailyCare = Math.min(20, state.league.dailyCare + 1);
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

  function weatherApiUrl(location) {
    const current = "temperature_2m,relative_humidity_2m,precipitation,weather_code,cloud_cover,is_day";
    const daily = "temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset,shortwave_radiation_sum,et0_fao_evapotranspiration,sunshine_duration";
    return `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(location.latitude)}&longitude=${encodeURIComponent(location.longitude)}&current=${current}&daily=${daily}&timezone=auto&forecast_days=2`;
  }

  function locationKey(location = state.settings.location) {
    return `${Number(location.latitude).toFixed(3)},${Number(location.longitude).toFixed(3)}`;
  }

  function soilApiUrl(location) {
    const properties = ["phh2o", "sand", "clay", "soc", "nitrogen"].map((name) => `property=${name}`).join("&");
    return `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${encodeURIComponent(location.longitude)}&lat=${encodeURIComponent(location.latitude)}&${properties}&depth=0-5cm&value=mean`;
  }

  function soilLayerValue(layers, name) {
    const layer = layers.find((item) => item?.name === name);
    const mean = finiteNumber(layer?.depths?.[0]?.values?.mean);
    if (mean === null) return null;
    const divisor = Math.max(1, finiteNumber(layer?.unit_measure?.d_factor, 1));
    return mean / divisor;
  }

  async function refreshSoil(force = false) {
    const key = locationKey();
    const age = Date.now() - finiteNumber(state.soil?.fetchedAt, 0);
    if (!force && state.soil.data && state.soil.locationKey === key && age >= 0 && age < SOIL_CACHE_MS) return true;
    if (typeof window.fetch !== "function") return false;
    const controller = typeof window.AbortController === "function" ? new window.AbortController() : null;
    const timeout = controller ? window.setTimeout(() => controller.abort(), 8_000) : 0;
    try {
      const response = await window.fetch(soilApiUrl(state.settings.location), controller ? { signal: controller.signal } : undefined);
      if (!response.ok) throw new Error(`토양 응답 ${response.status}`);
      const payload = await response.json();
      const layers = Array.isArray(payload?.properties?.layers) ? payload.properties.layers : [];
      const ph = soilLayerValue(layers, "phh2o");
      if (ph === null) throw new Error("토양 pH가 없음");
      const nextSoil = normalizeSoil({
        fetchedAt: Date.now(),
        locationKey: key,
        data: {
          ph,
          sand: soilLayerValue(layers, "sand"),
          clay: soilLayerValue(layers, "clay"),
          carbon: soilLayerValue(layers, "soc"),
          nitrogen: soilLayerValue(layers, "nitrogen")
        }
      });
      if (!nextSoil.data) throw new Error("토양 데이터 형식이 올바르지 않음");
      state.soil = nextSoil;
      renderLeague();
      saveGame();
      return true;
    } catch (error) {
      console.warn("지역 토양을 불러오지 못해 표준 상토를 사용합니다.", error);
      renderLeague();
      return false;
    } finally {
      if (timeout) window.clearTimeout(timeout);
    }
  }

  function setWeatherLoading(loading) {
    dom.weatherCard.classList.toggle("is-loading", loading);
    dom.weatherRefresh.disabled = loading;
  }

  async function refreshWeather(force = false) {
    const age = Date.now() - finiteNumber(state.weather?.fetchedAt, 0);
    if (!force && state.weather.data && age >= 0 && age < WEATHER_CACHE_MS) {
      renderWeather();
      return true;
    }
    if (typeof window.fetch !== "function") {
      renderWeather();
      return false;
    }

    setWeatherLoading(true);
    const controller = typeof window.AbortController === "function" ? new window.AbortController() : null;
    const timeout = controller ? window.setTimeout(() => controller.abort(), 8_000) : 0;
    try {
      const response = await window.fetch(weatherApiUrl(state.settings.location), controller ? { signal: controller.signal } : undefined);
      if (!response.ok) throw new Error(`날씨 응답 ${response.status}`);
      const payload = await response.json();
      const current = payload.current || {};
      const daily = payload.daily || {};
      const nextWeather = normalizeWeather({
        fetchedAt: Date.now(),
        data: {
          temperature: current.temperature_2m,
          humidity: current.relative_humidity_2m,
          precipitation: current.precipitation,
          weatherCode: current.weather_code,
          cloudCover: current.cloud_cover,
          isDay: current.is_day,
          maxTemperature: daily.temperature_2m_max?.[0],
          minTemperature: daily.temperature_2m_min?.[0],
          sunrise: daily.sunrise?.[0],
          sunset: daily.sunset?.[0],
          radiation: daily.shortwave_radiation_sum?.[0],
          evapotranspiration: daily.et0_fao_evapotranspiration?.[0],
          sunshineDuration: daily.sunshine_duration?.[0],
          observedAt: current.time
        }
      });
      if (!nextWeather.data) throw new Error("날씨 데이터 형식이 올바르지 않음");
      state.weather = nextWeather;
      renderWeather();
      saveGame();
      if (force) showToast(`${state.settings.location.name}의 실제 날씨를 반영했어요.`);
      return true;
    } catch (error) {
      console.warn("실시간 날씨를 불러오지 못했습니다.", error);
      renderWeather();
      if (force) showToast(state.weather.data ? "연결할 수 없어 저장된 날씨를 사용해요." : "날씨 연결 없이 기본 환경으로 계속할게요.");
      return false;
    } finally {
      if (timeout) window.clearTimeout(timeout);
      setWeatherLoading(false);
    }
  }

  function openLocationDialog() {
    dom.settingsDialog.close();
    dom.locationStatus.textContent = "";
    dom.locationResults.replaceChildren();
    dom.locationInput.value = state.settings.location.name;
    dom.locationDialog.showModal();
    window.setTimeout(() => dom.locationInput.focus(), 80);
  }

  async function searchLocations(query) {
    if (typeof window.fetch !== "function") {
      dom.locationStatus.textContent = "인터넷 연결이 없어 도시를 검색할 수 없어요.";
      return;
    }
    dom.locationStatus.textContent = "도시를 찾고 있어요…";
    dom.locationResults.replaceChildren();
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=ko&format=json`;
    try {
      const response = await window.fetch(url);
      if (!response.ok) throw new Error(`도시 검색 응답 ${response.status}`);
      const payload = await response.json();
      const results = Array.isArray(payload.results) ? payload.results : [];
      if (!results.length) {
        dom.locationStatus.textContent = "검색 결과가 없어요. 다른 도시 이름을 입력해 보세요.";
        return;
      }
      dom.locationStatus.textContent = `${results.length}개의 지역을 찾았어요.`;
      results.forEach((result) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "location-result";
        const copy = document.createElement("span");
        const title = document.createElement("strong");
        const detail = document.createElement("small");
        const arrow = document.createElement("span");
        title.textContent = result.name || "이름 없는 지역";
        detail.textContent = [result.admin1, result.country].filter(Boolean).join(" · ");
        arrow.textContent = "→";
        copy.append(title, detail);
        button.append(copy, arrow);
        button.addEventListener("click", () => {
          state.settings.location = normalizeLocation({
            name: result.name,
            country: result.country,
            latitude: result.latitude,
            longitude: result.longitude,
            timezone: result.timezone
          });
          state.weather = { fetchedAt: 0, data: null };
          state.soil = { fetchedAt: 0, locationKey: "", data: null };
          dom.locationDialog.close();
          render();
          saveGame();
          refreshWeather(true);
          refreshSoil(true);
        });
        dom.locationResults.appendChild(button);
      });
    } catch (error) {
      console.warn("도시를 검색하지 못했습니다.", error);
      dom.locationStatus.textContent = "도시 검색에 실패했어요. 연결을 확인해 주세요.";
    }
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

  dom.strategyGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-strategy]");
    if (!button) return;
    state.league.strategy = ["balanced", "irrigate", "ventilate", "shade"].includes(button.dataset.strategy) ? button.dataset.strategy : "balanced";
    renderLeague();
    saveGame();
    playTone(510, 0.08, "sine");
  });
  dom.closeDayButton.addEventListener("click", closeFarmDay);
  dom.dayReportClose.addEventListener("click", () => dom.dayReportDialog.close());
  dom.dayReportDialog.addEventListener("cancel", (event) => { event.preventDefault(); dom.dayReportDialog.close(); });

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
    state.plant.speciesId = "tomato";
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
  dom.weatherRefresh.addEventListener("click", () => refreshWeather(true));
  dom.locationButton.addEventListener("click", openLocationDialog);
  dom.settingsLocationButton.addEventListener("click", openLocationDialog);
  dom.locationClose.addEventListener("click", () => dom.locationDialog.close());
  dom.locationDialog.addEventListener("cancel", (event) => { event.preventDefault(); dom.locationDialog.close(); });
  dom.locationForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = dom.locationInput.value.trim();
    if (query) searchLocations(query);
  });
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
    if (document.hidden) { advanceToNow(); saveGame(); } else { advanceToNow(); render(); refreshWeather(false); }
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
  refreshWeather(false);
  refreshSoil(false);
  window.setInterval(tick, 1000);
})();
