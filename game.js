(() => {
  'use strict';

  const SAVE_KEY = 'shumatsuPrototype_v01';
  const TIME_NAMES = ['朝', '昼', '夕', '夜'];
  const app = document.getElementById('app');
  const toastRoot = document.getElementById('toast-root');

  const FACILITY_ORDER = ['plaza', 'well'];
  const FACILITIES = {
    plaza: {
      id: 'plaza',
      name: '寂れた広場',
      capacity: 10,
      development: 0,
      tags: ['広場'],
      description: 'かつて町の中心だったと思われる広場。今は静かだが、人が集まる余地は十分にある。',
      effectAbility: '盛り上げ',
      effectText: '「盛り上げ」を持つ住民がいると活気 +20（重複なし）'
    },
    well: {
      id: 'well',
      name: '井戸',
      capacity: 1,
      development: 10,
      tags: ['水場'],
      description: '修復された水場。拠点の暮らしを支える重要な設備。',
      effectAbility: '浄化',
      effectText: '「浄化」を持つ住民がいると清潔度 +10'
    }
  };

  const RESIDENTS = {
    slamin: {
      id: 'slamin',
      name: 'スラミン',
      species: 'スライム娘',
      lineage: 'スライム',
      ability: '浄化',
      image: 'images/slamin.webp'
    }
  };

  const defaultState = () => ({
    version: 2,
    started: false,
    currentTab: 'base',
    currentFacility: 'plaza',
    day: 1,
    timeIndex: 0,
    resources: { wood: 0, stone: 0 },
    stats: { development: 0, cleanliness: 0, liveliness: 0 },
    assignments: { plaza: [], well: [] },
    flags: {
      prologueDone: false,
      firstStoneGathered: false,
      wellBuildStarted: false,
      wellBuilt: false,
      slaminEventReady: false,
      slaminJoined: false,
      slaminAssignedToWell: false,
      sliceComplete: false
    },
    saveStamp: null
  });

  let state = defaultState();
  let overlay = null;

  const PROLOGUE = [
    { speaker: '主人公', text: '……ここは、どこだ。\n崩れた天井。ひび割れた床。人の気配は、ない。', char: null },
    { speaker: '？？？', text: 'あっ。\n……起きた？', char: 'shannon' },
    { speaker: 'シャノン', text: '私はシャノン。羊の魔物娘だよ。\n人間を見るのは、これが初めて。', char: 'shannon' },
    { speaker: 'シャノン', text: 'この近くに、みんなが暮らせる集落を作ろうと思ってるの。\nでも、一人じゃできることにも限界があって……。', char: 'shannon' },
    { speaker: '主人公', text: '俺も、人間に何があったのか知りたい。\nここにいれば、何か手がかりが集まるかもしれない。', char: null },
    { speaker: 'シャノン', text: 'じゃあ、決まりだね。\n一緒に作ろう。魔物娘たちが集まれる場所を。', char: 'shannon' },
    { speaker: 'シャノン', text: '建設予定地はすぐ近くだよ。\n使えそうなのは……壊れた井戸くらいだけど。', char: 'shannon' }
  ];

  const SLAMIN_EVENT = [
    { speaker: 'シャノン', text: '……ねえ。井戸のところ、何か動いてない？', char: 'shannon' },
    { speaker: '？？？', text: 'ぷる……。\nあ、人間だ！', char: 'slamin' },
    { speaker: 'スラミン', text: 'わたし、スラミン！\nこの井戸、昨日から水の匂いがして気になってたんだ。', char: 'slamin' },
    { speaker: 'シャノン', text: 'せっかくだし、ここで一緒に暮らさない？\nまだ何もない場所だけど。', char: 'shannon' },
    { speaker: 'スラミン', text: 'いいよ！ 井戸のお掃除なら得意だよ。\nぴかぴかにしてあげる！', char: 'slamin' }
  ];

  function save(auto = true) {
    recalculateStats();
    state.saveStamp = new Date().toISOString();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    if (!auto) toast('手動セーブしました');
  }

  function load() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      const fresh = defaultState();
      state = { ...fresh, ...parsed };
      state.resources = { ...fresh.resources, ...(parsed.resources || {}) };
      state.stats = { ...fresh.stats, ...(parsed.stats || {}) };
      state.flags = { ...fresh.flags, ...(parsed.flags || {}) };
      state.assignments = {
        plaza: Array.isArray(parsed.assignments?.plaza) ? parsed.assignments.plaza : [],
        well: Array.isArray(parsed.assignments?.well) ? parsed.assignments.well : []
      };
      if (!FACILITY_ORDER.includes(state.currentFacility)) state.currentFacility = 'plaza';

      // v0.1 のセーブをそのまま読み込めるように移行。
      if (parsed.flags?.slaminAssignedToWell && !state.assignments.well.includes('slamin')) {
        state.assignments.well = ['slamin'];
      }
      state.version = 2;
      recalculateStats();
      return true;
    } catch (err) {
      console.warn('Save load failed', err);
      return false;
    }
  }

  function resetSave() {
    localStorage.removeItem(SAVE_KEY);
    state = defaultState();
    overlay = null;
    renderTitle();
    toast('セーブデータを削除しました');
  }

  function toast(message) {
    const node = document.createElement('div');
    node.className = 'toast';
    node.textContent = message;
    toastRoot.appendChild(node);
    window.setTimeout(() => node.remove(), 2500);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

  function currentTimeName() { return TIME_NAMES[state.timeIndex]; }

  function joinedResidentIds() {
    const ids = [];
    if (state.flags.slaminJoined) ids.push('slamin');
    return ids;
  }

  function getResidentFacility(residentId) {
    return FACILITY_ORDER.find(id => (state.assignments[id] || []).includes(residentId)) || null;
  }

  function facilityName(id) {
    if (id === 'well' && !state.flags.wellBuilt) return '壊れた井戸';
    return FACILITIES[id]?.name || id;
  }

  function isFacilityUsable(id) {
    if (id === 'well') return state.flags.wellBuilt;
    return true;
  }

  function hasAbilityAtFacility(facilityId, ability) {
    return (state.assignments[facilityId] || []).some(residentId => RESIDENTS[residentId]?.ability === ability);
  }

  function recalculateStats() {
    state.stats.development = state.flags.wellBuilt ? 10 : 0;
    state.stats.cleanliness = state.flags.wellBuilt && hasAbilityAtFacility('well', '浄化') ? 10 : 0;
    state.stats.liveliness = joinedResidentIds().length * 10;
    if (hasAbilityAtFacility('plaza', '盛り上げ')) state.stats.liveliness += 20;

    state.flags.slaminAssignedToWell = (state.assignments.well || []).includes('slamin');
    if (state.flags.slaminAssignedToWell) state.flags.sliceComplete = true;
  }

  function assignResident(residentId, facilityId) {
    if (!joinedResidentIds().includes(residentId) || !isFacilityUsable(facilityId)) return false;
    const facility = FACILITIES[facilityId];
    const current = getResidentFacility(residentId);
    if (current === facilityId) return true;

    const target = state.assignments[facilityId] || [];
    if (target.length >= facility.capacity) return false;

    FACILITY_ORDER.forEach(id => {
      state.assignments[id] = (state.assignments[id] || []).filter(x => x !== residentId);
    });
    state.assignments[facilityId].push(residentId);
    recalculateStats();
    save(true);
    return true;
  }

  function unassignResident(residentId, facilityId) {
    state.assignments[facilityId] = (state.assignments[facilityId] || []).filter(x => x !== residentId);
    recalculateStats();
    save(true);
  }

  function advanceTime(steps = 1) {
    for (let i = 0; i < steps; i++) {
      if (state.timeIndex === 3) {
        state.day += 1;
        state.timeIndex = 0;
      } else {
        state.timeIndex += 1;
      }
      runTimeTriggers();
    }
    save(true);
  }

  function runTimeTriggers() {
    if (state.flags.wellBuilt && !state.flags.slaminJoined && state.day >= 2 && state.timeIndex === 0) {
      state.flags.slaminEventReady = true;
    }
  }

  function startNewGame() {
    state = defaultState();
    state.started = true;
    save(true);
    playDialogue(PROLOGUE, () => {
      state.flags.prologueDone = true;
      state.currentTab = 'base';
      state.currentFacility = 'plaza';
      save(true);
      renderGame();
      toast('「行動」から石材を5個集めてみましょう');
    });
  }

  function playDialogue(lines, onDone) {
    let index = 0;
    const show = () => {
      const line = lines[index];
      const charHtml = line.char
        ? `<img class="dialogue-char ${line.char === 'slamin' ? 'slamin' : ''}" src="images/${line.char === 'shannon' ? 'shannon.webp' : 'slamin.webp'}" alt="${escapeHtml(line.speaker)}">`
        : '';
      app.innerHTML = `
        <section class="dialogue-screen">
          ${charHtml}
          <div class="dialogue-box">
            <div class="speaker">${escapeHtml(line.speaker)}</div>
            <p class="dialogue-text">${escapeHtml(line.text)}</p>
            <div class="dialogue-next">
              <button class="primary-btn" id="dialogue-next">${index === lines.length - 1 ? '進む' : '次へ'}</button>
            </div>
          </div>
        </section>`;
      document.getElementById('dialogue-next').addEventListener('click', () => {
        index += 1;
        if (index >= lines.length) onDone();
        else show();
      });
    };
    show();
  }

  function renderTitle() {
    const hasSave = !!localStorage.getItem(SAVE_KEY);
    app.innerHTML = `
      <section class="title-screen">
        <div>
          <div class="title-kicker">MONSTER GIRL SETTLEMENT</div>
          <h1 class="title-logo">終末</h1>
          <p class="title-sub">スマートフォン向け プロトタイプ v0.2</p>
        </div>
        <div class="title-actions">
          <button class="primary-btn" id="new-game">はじめから</button>
          <button class="secondary-btn" id="continue" ${hasSave ? '' : 'disabled'}>つづきから</button>
        </div>
      </section>`;
    document.getElementById('new-game').addEventListener('click', () => {
      if (hasSave && !confirm('現在のセーブを上書きして、はじめから遊びますか？')) return;
      startNewGame();
    });
    document.getElementById('continue').addEventListener('click', () => {
      if (load()) {
        if (!state.flags.prologueDone) startNewGame();
        else renderGame();
      }
    });
  }

  function renderGame() {
    recalculateStats();
    app.innerHTML = `
      <section class="game-screen">
        ${topBarHtml()}
        <div class="content">${tabContentHtml()}</div>
        <div>
          ${resourcesHtml()}
          ${bottomNavHtml()}
        </div>
      </section>
      ${overlayHtml()}`;
    bindGameEvents();
  }

  function topBarHtml() {
    return `
      <header class="topbar">
        <div class="topbar-row">
          <div class="daytime"><strong>${state.day}日目</strong><span>${currentTimeName()}</span></div>
          <button class="icon-btn" id="menu-btn" aria-label="メニュー">☰</button>
        </div>
        <div class="stats">
          <div class="stat"><b>${state.stats.development}</b><small>発展度</small></div>
          <div class="stat"><b>${state.stats.cleanliness}</b><small>清潔度</small></div>
          <div class="stat"><b>${state.stats.liveliness}</b><small>活気</small></div>
        </div>
      </header>`;
  }

  function resourcesHtml() {
    return `<div class="resources-bar">
      <div class="resource-pill">🪵 木材 <b>${state.resources.wood}</b></div>
      <div class="resource-pill">🪨 石材 <b>${state.resources.stone}</b></div>
      <div class="resource-pill">🍎 食料 <b>0</b></div>
    </div>`;
  }

  function tutorialNeedsWellRepair() {
    return state.flags.firstStoneGathered && !state.flags.wellBuilt;
  }

  function needsTabDot(tab) {
    if (tab === 'actions' && !state.flags.firstStoneGathered) return true;
    if (tab === 'build' && tutorialNeedsWellRepair()) return true;
    if (tab === 'base' && state.flags.slaminEventReady && !state.flags.slaminJoined) return true;
    return false;
  }

  function bottomNavHtml() {
    const items = [
      ['base','🏠','拠点'], ['friends','👥','仲間'], ['actions','✋','行動'], ['build','🔨','建築'], ['items','🎒','物資']
    ];
    return `<nav class="bottom-nav" aria-label="メインメニュー">${items.map(([id,icon,label]) => `
      <button class="nav-btn ${state.currentTab === id ? 'active' : ''}" data-tab="${id}">
        <span class="nav-icon">${icon}</span><span>${label}</span>${needsTabDot(id) ? '<i class="nav-dot"></i>' : ''}
      </button>`).join('')}</nav>`;
  }

  function tabContentHtml() {
    switch (state.currentTab) {
      case 'friends': return friendsHtml();
      case 'actions': return actionsHtml();
      case 'build': return buildHtml();
      case 'items': return itemsHtml();
      case 'base':
      default: return baseHtml();
    }
  }

  function facilityResidentsForScene(facilityId) {
    if (facilityId === 'plaza') {
      const explicitlyPlaced = state.assignments.plaza || [];
      const idle = joinedResidentIds().filter(id => !getResidentFacility(id));
      return [...new Set([...explicitlyPlaced, ...idle])];
    }
    return state.assignments[facilityId] || [];
  }

  function sceneCharacterHtml(residentId, index, count, facilityId) {
    const resident = RESIDENTS[residentId];
    if (!resident) return '';
    const pos = characterPosition(facilityId, index, count);
    return `<button class="scene-character" data-resident="${residentId}" style="--char-left:${pos.left}%;--char-bottom:${pos.bottom}px;--char-width:${pos.width}px">
      <img src="${resident.image}" alt="${resident.name}">
      <span>${resident.name}</span>
    </button>`;
  }

  function characterPosition(facilityId, index, count) {
    const plazaPositions = [
      { left: 31, bottom: 76, width: 104 }, { left: 50, bottom: 68, width: 96 },
      { left: 72, bottom: 76, width: 100 }, { left: 20, bottom: 170, width: 86 },
      { left: 42, bottom: 178, width: 84 }, { left: 65, bottom: 174, width: 86 },
      { left: 82, bottom: 168, width: 80 }, { left: 29, bottom: 264, width: 72 },
      { left: 55, bottom: 258, width: 74 }, { left: 76, bottom: 264, width: 72 }
    ];
    const wellPositions = [
      { left: 72, bottom: 78, width: 112 }, { left: 25, bottom: 82, width: 104 }
    ];
    const list = facilityId === 'well' ? wellPositions : plazaPositions;
    return list[index % list.length];
  }

  function facilitySceneNote(facilityId) {
    if (facilityId === 'plaza') {
      if (!state.flags.firstStoneGathered) return 'シャノンと拠点づくりを始めます。「行動」から石材を集めましょう。';
      if (tutorialNeedsWellRepair()) return '井戸を直す石材が揃いました。「建築」から修復を進めましょう。';
      if (state.flags.slaminJoined && !getResidentFacility('slamin')) return 'スラミンは今、広場でのんびりしています。設備に配置することもできます。';
      return '拠点の中心になる広場。シャノンはここで様子を見ています。';
    }
    if (!state.flags.wellBuilt) return '壊れた井戸。石材5個があれば修復できます。';
    if (state.flags.slaminEventReady && !state.flags.slaminJoined) return '井戸のそばに、見慣れない気配があります……。';
    if (state.flags.slaminAssignedToWell) return 'スラミンが井戸を浄化中。清潔度 +10。';
    if (state.flags.slaminJoined) return '「設備情報」から住民を配置できます。';
    return '井戸が直りました。夜を越えれば、何か変化があるかもしれません。';
  }

  function baseHtml() {
    const id = state.currentFacility;
    const facility = FACILITIES[id];
    const idx = FACILITY_ORDER.indexOf(id);
    const isWell = id === 'well';
    const residents = facilityResidentsForScene(id);
    const slaminEvent = isWell && state.flags.slaminEventReady && !state.flags.slaminJoined;

    const mainObject = isWell
      ? `<button class="facility-object well-focus ${state.flags.wellBuilt ? '' : 'broken'}" id="facility-object" aria-label="${facilityName('well')}">
          <img src="images/well.webp" alt="${facilityName('well')}">
        </button>`
      : '';

    const characters = residents.map((residentId, i) => sceneCharacterHtml(residentId, i, residents.length, id)).join('');
    const shannon = id === 'plaza'
      ? `<button class="scene-character shannon-scene" id="shannon-object" style="--char-left:76%;--char-bottom:76px;--char-width:120px">
          <img src="images/shannon.webp" alt="シャノン"><span>シャノン</span>
        </button>` : '';

    return `
      ${state.flags.sliceComplete ? '<div class="prototype-banner">最初の実装範囲はここまでです。設備ページ切替と汎用配置も試せます。</div>' : ''}
      <div class="facility-scene time-${state.timeIndex}" id="facility-scene" data-facility="${id}">
        <div class="facility-scene-head">
          <div>
            <div class="facility-counter">${idx + 1} / ${FACILITY_ORDER.length}</div>
            <strong>${facilityName(id)}</strong>
          </div>
          <button class="scene-list-btn" id="facility-list-btn">設備一覧</button>
        </div>

        <button class="scene-arrow scene-arrow-left" id="facility-prev" ${idx === 0 ? 'disabled' : ''} aria-label="前の設備">‹</button>
        <button class="scene-arrow scene-arrow-right" id="facility-next" ${idx === FACILITY_ORDER.length - 1 ? 'disabled' : ''} aria-label="次の設備">›</button>

        ${mainObject}
        ${shannon}
        ${characters}
        ${slaminEvent ? '<button class="event-pin event-center" id="slamin-event" aria-label="イベント">!</button>' : ''}

        <div class="scene-bottom-panel">
          <div class="facility-dots">${FACILITY_ORDER.map((fid, i) => `<i class="${i === idx ? 'active' : ''}"></i>`).join('')}</div>
          <p>${facilitySceneNote(id)}</p>
          <button class="scene-detail-btn" id="facility-detail-btn">設備情報・配置</button>
        </div>
      </div>`;
  }

  function friendsHtml() {
    const slaminStatus = state.flags.slaminJoined
      ? (getResidentFacility('slamin') ? `${facilityName(getResidentFacility('slamin'))}に配置中` : '拠点で待機中')
      : '';
    return `<section class="page">
      <h2 class="page-title">仲間</h2>
      <p class="page-lead">拠点にいる魔物娘と、現在の役割を確認できます。</p>
      <div class="card-stack">
        <div class="resident-list-card static-card">
          <img src="images/shannon.webp" alt="シャノン">
          <div><div class="card-head"><span class="card-title">シャノン</span><span class="badge">ストーリー</span></div>
          <p class="card-desc">羊娘 / 獣<br>得意：相談<br>状態：寂れた広場</p></div>
        </div>
        ${state.flags.slaminJoined ? `<div class="resident-list-card static-card">
          <img src="images/slamin.webp" alt="スラミン">
          <div><div class="card-head"><span class="card-title">スラミン</span><span class="badge">スライム</span></div>
          <p class="card-desc">スライム娘<br>得意：浄化<br>状態：${slaminStatus}</p></div>
        </div>` : '<div class="empty-state">まだ通常の魔物娘はいません。</div>'}
      </div>
    </section>`;
  }

  function actionsHtml() {
    const tutorialLock = tutorialNeedsWellRepair();
    const canAct = !state.flags.wellBuildStarted && !tutorialLock;
    const night = state.timeIndex === 3;
    const canGatherStone = canAct && (!state.flags.firstStoneGathered || state.flags.wellBuilt);
    return `<section class="page">
      <h2 class="page-title">行動</h2>
      <p class="page-lead">主人公が行動すると、ゲーム内時間が1区分進みます。</p>
      ${tutorialLock ? `<div class="tutorial-lock"><strong>井戸修復を進めよう</strong><p>必要な石材5個が揃いました。チュートリアル中のため、井戸を修復するまで時間が進む行動は選べません。</p><button class="primary-btn" id="go-build">建築を開く</button></div>` : ''}
      <div class="card-stack">
        <button class="action-card" id="gather-stone" ${canGatherStone ? '' : 'disabled'}>
          <div class="card-head"><span class="card-title">🪨 石材を集める</span><span class="card-time">1区分</span></div>
          <p class="card-desc">周囲の瓦礫から使えそうな石材を集めます。${!state.flags.firstStoneGathered ? '初回は石材+5。' : '石材+5。'}</p>
        </button>
        <button class="action-card" id="gather-wood" ${state.flags.wellBuilt && canAct ? '' : 'disabled'}>
          <div class="card-head"><span class="card-title">🪵 木材を集める</span><span class="card-time">1区分</span></div>
          <p class="card-desc">周辺から使えそうな木材を集めます。井戸修復後に利用できます。</p>
        </button>
        <button class="action-card" id="rest-action" ${canAct ? '' : 'disabled'}>
          <div class="card-head"><span class="card-title">☕ 休む</span><span class="card-time">1区分</span></div>
          <p class="card-desc">何もせず時間を進めます。</p>
        </button>
        ${night ? `<button class="action-card" id="sleep-action" ${canAct ? '' : 'disabled'}>
          <div class="card-head"><span class="card-title">🌙 眠る</span><span class="card-time">翌朝へ</span></div>
          <p class="card-desc">夜を終えて、次の日の朝へ進みます。</p>
        </button>` : ''}
      </div>
    </section>`;
  }

  function buildHtml() {
    const enoughStone = state.resources.stone >= 5;
    if (state.flags.wellBuilt) {
      return `<section class="page"><h2 class="page-title">建築</h2><p class="page-lead">設備の建築・修復を行います。</p>
        <button class="action-card" id="jump-well"><div class="card-head"><span class="card-title">井戸</span><span class="badge">完成</span></div><p class="card-desc">発展度 +10 / 配置上限 1人 / タグ：水場<br>タップして井戸の画面へ移動。</p></button>
        <div class="empty-state" style="margin-top:10px">この実装範囲では、ほかの設備はまだ建てられません。</div></section>`;
    }
    return `<section class="page">
      <h2 class="page-title">建築</h2>
      <p class="page-lead">資材と協力者を使って、設備を修復・建築します。</p>
      <button class="action-card" id="repair-well" ${enoughStone && !state.flags.wellBuildStarted ? '' : 'disabled'}>
        <div class="card-head"><span class="card-title">壊れた井戸を修復</span><span class="card-time">2区分</span></div>
        <p class="card-desc">石材 5（所持 ${state.resources.stone}）<br>必要人員：魔物娘×1 → 今回はシャノンが協力<br>完成時：発展度 +10</p>
        <div class="progress"><i style="width:${enoughStone ? 100 : Math.min(100, state.resources.stone / 5 * 100)}%"></i></div>
      </button>
      ${!enoughStone ? '<p class="page-lead" style="margin-top:10px">石材が足りません。「行動」から石材を集めましょう。</p>' : '<p class="ready-note">✓ 資材が揃っています。修復を開始できます。</p>'}
    </section>`;
  }

  function itemsHtml() {
    return `<section class="page">
      <h2 class="page-title">物資</h2>
      <p class="page-lead">資材とアイテムを確認します。</p>
      <h3 class="section-title">資材</h3>
      <div class="action-card" role="group">
        <div class="item-row"><span>🪵 木材</span><b>${state.resources.wood}</b></div>
        <div class="item-row"><span>🪨 石材</span><b>${state.resources.stone}</b></div>
      </div>
      <h3 class="section-title">アイテム</h3>
      <div class="empty-state">まだアイテムを持っていません。</div>
    </section>`;
  }

  function facilityListOverlay() {
    return `<div class="sheet-backdrop" id="sheet-backdrop"><section class="sheet tall-sheet" role="dialog" aria-modal="true">
      <div class="sheet-handle"></div><h2>設備一覧</h2><p>行きたい場所を選んでください。普段は拠点画面を左右にスワイプしても移動できます。</p>
      <div class="facility-list">
        ${FACILITY_ORDER.map(id => {
          const assigned = (state.assignments[id] || []).length;
          const event = id === 'well' && state.flags.slaminEventReady && !state.flags.slaminJoined;
          return `<button class="facility-list-card" data-jump-facility="${id}">
            <div><strong>${facilityName(id)}</strong>${event ? '<span class="event-mini">!</span>' : ''}<small>${id === 'well' && !state.flags.wellBuilt ? '修復が必要' : `配置 ${assigned} / ${FACILITIES[id].capacity}`}</small></div>
            <span>›</span>
          </button>`;
        }).join('')}
      </div>
      <div class="sheet-actions"><button class="secondary-btn" id="close-sheet">閉じる</button></div>
    </section></div>`;
  }

  function facilityOverlay(facilityId) {
    const facility = FACILITIES[facilityId];
    const usable = isFacilityUsable(facilityId);
    const placed = state.assignments[facilityId] || [];
    const isBrokenWell = facilityId === 'well' && !state.flags.wellBuilt;
    return `<div class="sheet-backdrop" id="sheet-backdrop"><section class="sheet tall-sheet" role="dialog" aria-modal="true">
      <div class="sheet-handle"></div>
      <h2>${facilityName(facilityId)}</h2>
      <p>${isBrokenWell ? '長いあいだ放置されていた井戸。石材5個で修復できます。' : facility.description}</p>
      <div class="facility-meta">
        <span class="badge">配置 ${usable ? placed.length : 0} / ${facility.capacity}</span>
        ${facility.tags.map(tag => `<span class="badge">${tag}</span>`).join('')}
        <span class="badge">発展度 +${isBrokenWell ? 0 : facility.development}</span>
      </div>
      ${!isBrokenWell ? `<div class="effect-box"><strong>設備効果</strong><p>${facility.effectText}</p></div>` : ''}
      ${placed.length ? `<h3 class="sheet-subtitle">配置中</h3><div class="placed-list">${placed.map(id => {
        const r = RESIDENTS[id];
        return `<div class="placed-row"><img src="${r.image}" alt="${r.name}"><div><strong>${r.name}</strong><small>得意：${r.ability}</small></div><button class="mini-btn" data-unassign="${id}" data-from="${facilityId}">外す</button></div>`;
      }).join('')}</div>` : (!isBrokenWell ? '<p class="muted-text">配置中の住民はいません。</p>' : '')}
      <div class="sheet-actions">
        ${usable ? `<button class="primary-btn" id="open-resident-select">${placed.length >= facility.capacity ? '住民を入れ替える' : '住民を配置する'}</button>` : ''}
        <button class="secondary-btn" id="close-sheet">閉じる</button>
      </div>
    </section></div>`;
  }

  function residentSelectOverlay(facilityId) {
    const facility = FACILITIES[facilityId];
    const residents = joinedResidentIds();
    return `<div class="sheet-backdrop" id="sheet-backdrop"><section class="sheet tall-sheet" role="dialog" aria-modal="true">
      <div class="sheet-handle"></div><h2>住民を配置する</h2>
      <p>${facilityName(facilityId)}：配置 ${(state.assignments[facilityId] || []).length} / ${facility.capacity}</p>
      <div class="resident-select-list">
        ${residents.length ? residents.map(id => {
          const r = RESIDENTS[id];
          const current = getResidentFacility(id);
          const effective = r.ability === facility.effectAbility;
          const here = current === facilityId;
          return `<button class="resident-select-card ${here ? 'selected' : ''}" data-select-resident="${id}" ${here ? 'disabled' : ''}>
            <img src="${r.image}" alt="${r.name}">
            <div class="resident-card-body">
              <div class="resident-card-title"><strong>${r.name}</strong><span class="badge">${r.species}</span></div>
              <p>得意：${r.ability}</p>
              <small>${here ? `現在：${facilityName(facilityId)}に配置中` : current ? `現在：${facilityName(current)}に配置中` : '現在：待機中'}</small>
              <em class="${effective ? 'effect-good' : 'effect-none'}">${effective ? '✓ この設備で特殊効果あり' : 'この設備では特殊効果なし'}</em>
            </div>
          </button>`;
        }).join('') : '<div class="empty-state">配置できる通常住民がまだいません。</div>'}
      </div>
      <div class="sheet-actions"><button class="secondary-btn" id="back-facility-detail">戻る</button></div>
    </section></div>`;
  }

  function overlayHtml() {
    if (!overlay) return '';
    if (overlay.type === 'menu') {
      return `<div class="sheet-backdrop" id="sheet-backdrop"><section class="sheet" role="dialog" aria-modal="true">
        <div class="sheet-handle"></div><h2>メニュー</h2><p>オートセーブは主要な操作のたびに行われます。テスト用に手動操作も残しています。</p>
        <div class="sheet-actions">
          <button class="secondary-btn" id="manual-save">手動セーブ</button>
          <button class="secondary-btn" id="manual-load">手動ロード</button>
          <button class="secondary-btn" id="back-title">タイトルへ戻る</button>
          <button class="danger-btn" id="reset-save">セーブデータ削除</button>
          <button class="secondary-btn" id="close-sheet">閉じる</button>
        </div>
      </section></div>`;
    }
    if (overlay.type === 'facilityList') return facilityListOverlay();
    if (overlay.type === 'facility') return facilityOverlay(overlay.facilityId);
    if (overlay.type === 'residentSelect') return residentSelectOverlay(overlay.facilityId);
    if (overlay.type === 'shannon') {
      return `<div class="sheet-backdrop" id="sheet-backdrop"><section class="sheet" role="dialog" aria-modal="true"><div class="sheet-handle"></div><h2>シャノン</h2><p>${state.flags.wellBuilt ? '「井戸が直ると、ここも少し拠点らしく見えてきたね。」' : '「まずは井戸を直そう。石なら、この辺りの瓦礫から集められそうだよ。」'}</p><div class="sheet-actions"><button class="secondary-btn" id="close-sheet">閉じる</button></div></section></div>`;
    }
    if (overlay.type === 'resident') {
      const r = RESIDENTS[overlay.residentId];
      const place = getResidentFacility(r.id);
      return `<div class="sheet-backdrop" id="sheet-backdrop"><section class="sheet" role="dialog" aria-modal="true"><div class="sheet-handle"></div><h2>${r.name}</h2><p>${r.species} / ${r.lineage}<br>得意：${r.ability}<br>状態：${place ? facilityName(place) + 'に配置中' : '拠点で待機中'}</p><div class="sheet-actions"><button class="secondary-btn" id="close-sheet">閉じる</button></div></section></div>`;
    }
    return '';
  }

  function switchFacility(delta) {
    const idx = FACILITY_ORDER.indexOf(state.currentFacility);
    const next = idx + delta;
    if (next < 0 || next >= FACILITY_ORDER.length) return;
    state.currentFacility = FACILITY_ORDER[next];
    overlay = null;
    save(true);
    renderGame();
  }

  function bindSwipe() {
    const scene = document.getElementById('facility-scene');
    if (!scene) return;
    let startX = null;
    let startY = null;
    scene.addEventListener('touchstart', e => {
      if (e.target.closest('button')) return;
      const t = e.changedTouches[0];
      startX = t.clientX;
      startY = t.clientY;
    }, { passive: true });
    scene.addEventListener('touchend', e => {
      if (startX === null) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      startX = null;
      startY = null;
      if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
      if (dx < 0) switchFacility(1);
      else switchFacility(-1);
    }, { passive: true });
  }

  function bindGameEvents() {
    document.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => {
      state.currentTab = btn.dataset.tab;
      overlay = null;
      save(true);
      renderGame();
    }));

    document.getElementById('menu-btn')?.addEventListener('click', () => { overlay = { type:'menu' }; renderGame(); });
    document.getElementById('facility-list-btn')?.addEventListener('click', () => { overlay = { type:'facilityList' }; renderGame(); });
    document.getElementById('facility-detail-btn')?.addEventListener('click', () => { overlay = { type:'facility', facilityId: state.currentFacility }; renderGame(); });
    document.getElementById('facility-object')?.addEventListener('click', () => { overlay = { type:'facility', facilityId: state.currentFacility }; renderGame(); });
    document.getElementById('facility-prev')?.addEventListener('click', () => switchFacility(-1));
    document.getElementById('facility-next')?.addEventListener('click', () => switchFacility(1));
    document.getElementById('shannon-object')?.addEventListener('click', () => { overlay = { type:'shannon' }; renderGame(); });
    document.querySelectorAll('[data-resident]').forEach(btn => btn.addEventListener('click', () => { overlay = { type:'resident', residentId: btn.dataset.resident }; renderGame(); }));
    bindSwipe();

    document.getElementById('gather-stone')?.addEventListener('click', () => {
      if (tutorialNeedsWellRepair()) return;
      state.resources.stone += 5;
      state.flags.firstStoneGathered = true;
      advanceTime(1);
      toast('石材 +5。井戸を修復できるようになりました');
      renderGame();
    });

    document.getElementById('gather-wood')?.addEventListener('click', () => {
      if (tutorialNeedsWellRepair()) return;
      state.resources.wood += 5;
      advanceTime(1);
      toast('木材 +5');
      renderGame();
    });

    document.getElementById('rest-action')?.addEventListener('click', () => {
      if (tutorialNeedsWellRepair()) return;
      advanceTime(1);
      toast('少し休みました');
      renderGame();
    });

    document.getElementById('sleep-action')?.addEventListener('click', () => {
      if (tutorialNeedsWellRepair()) return;
      state.day += 1;
      state.timeIndex = 0;
      runTimeTriggers();
      save(true);
      toast(`${state.day}日目の朝になりました`);
      state.currentTab = 'base';
      renderGame();
    });

    document.getElementById('go-build')?.addEventListener('click', () => {
      state.currentTab = 'build';
      overlay = null;
      save(true);
      renderGame();
    });

    document.getElementById('repair-well')?.addEventListener('click', () => {
      if (state.resources.stone < 5 || state.flags.wellBuildStarted) return;
      state.resources.stone -= 5;
      state.flags.wellBuildStarted = true;
      save(true);
      playDialogue([
        { speaker:'シャノン', text:'石はこれで足りそう。\n私が支えるから、崩れたところを直していこう。', char:'shannon' },
        { speaker:'主人公', text:'二人で井戸の崩れた石組みを直していく。\n気づけば、空は夕暮れに変わっていた。', char:null },
        { speaker:'シャノン', text:'あと少し！\n今日のうちに終わらせちゃおう。', char:'shannon' }
      ], () => {
        advanceTime(2);
        state.flags.wellBuildStarted = false;
        state.flags.wellBuilt = true;
        state.currentTab = 'base';
        state.currentFacility = 'well';
        save(true);
        renderGame();
        toast('井戸を修復！ 発展度 +10');
      });
    });

    document.getElementById('jump-well')?.addEventListener('click', () => {
      state.currentTab = 'base';
      state.currentFacility = 'well';
      save(true);
      renderGame();
    });

    document.getElementById('slamin-event')?.addEventListener('click', () => {
      playDialogue(SLAMIN_EVENT, () => {
        state.flags.slaminEventReady = false;
        state.flags.slaminJoined = true;
        recalculateStats();
        save(true);
        state.currentTab = 'base';
        state.currentFacility = 'well';
        renderGame();
        toast('スラミンが仲間になりました！ 活気 +10');
      });
    });

    document.getElementById('open-resident-select')?.addEventListener('click', () => {
      overlay = { type:'residentSelect', facilityId: overlay.facilityId };
      renderGame();
    });

    document.querySelectorAll('[data-select-resident]').forEach(btn => btn.addEventListener('click', () => {
      const residentId = btn.dataset.selectResident;
      const facilityId = overlay.facilityId;
      const currentPlaced = state.assignments[facilityId] || [];
      if (currentPlaced.length >= FACILITIES[facilityId].capacity && getResidentFacility(residentId) !== facilityId) {
        toast('この設備の配置上限に達しています。先に住民を外してください');
        return;
      }
      if (assignResident(residentId, facilityId)) {
        const r = RESIDENTS[residentId];
        overlay = { type:'facility', facilityId };
        renderGame();
        toast(`${r.name}を${facilityName(facilityId)}に配置しました`);
      }
    }));

    document.querySelectorAll('[data-unassign]').forEach(btn => btn.addEventListener('click', () => {
      const residentId = btn.dataset.unassign;
      const facilityId = btn.dataset.from;
      unassignResident(residentId, facilityId);
      overlay = { type:'facility', facilityId };
      renderGame();
      toast(`${RESIDENTS[residentId].name}の配置を外しました`);
    }));

    document.getElementById('back-facility-detail')?.addEventListener('click', () => {
      overlay = { type:'facility', facilityId: overlay.facilityId };
      renderGame();
    });

    document.querySelectorAll('[data-jump-facility]').forEach(btn => btn.addEventListener('click', () => {
      state.currentFacility = btn.dataset.jumpFacility;
      state.currentTab = 'base';
      overlay = null;
      save(true);
      renderGame();
    }));

    document.getElementById('manual-save')?.addEventListener('click', () => save(false));
    document.getElementById('manual-load')?.addEventListener('click', () => {
      if (load()) { overlay = null; renderGame(); toast('セーブを読み込みました'); }
    });
    document.getElementById('back-title')?.addEventListener('click', () => { overlay = null; renderTitle(); });
    document.getElementById('reset-save')?.addEventListener('click', () => {
      if (confirm('セーブデータを削除します。よろしいですか？')) resetSave();
    });
    document.getElementById('close-sheet')?.addEventListener('click', () => { overlay = null; renderGame(); });
    document.getElementById('sheet-backdrop')?.addEventListener('click', e => {
      if (e.target.id === 'sheet-backdrop') { overlay = null; renderGame(); }
    });
  }

  renderTitle();
})();
