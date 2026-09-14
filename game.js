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
    },
    lily: {
      id: 'lily',
      name: 'リリー',
      species: 'アルラウネ',
      lineage: '自然',
      ability: '栽培',
      image: 'images/lily.webp'
    },
    pochi: {
      id: 'pochi',
      name: 'ポチ',
      species: '犬娘',
      lineage: '獣',
      ability: '探索',
      image: 'images/pochi.webp'
    }
  };

  // 拠点画面での見た目補正。画像素材ごとの差をここだけで吸収する。
  // scale はキャラクターの見た目サイズ、offsetX / offsetY は足元基準の微調整。
  const SCENE_CHARACTER_STYLE = {
    shannon: { scale: 1.00, offsetX: 0, offsetY: 0 },
    slamin:  { scale: 1.08, offsetX: 0, offsetY: 0 },
    lily:    { scale: 1.24, offsetX: 0, offsetY: 2 },
    pochi:    { scale: 1.70, offsetX: 0, offsetY: 0 }
  };

  const defaultState = () => ({
    version: 6,
    started: false,
    tutorialStep: 'collectStone',
    currentTab: 'base',
    currentFacility: 'plaza',
    day: 1,
    timeIndex: 0,
    resources: { wood: 0, stone: 0 },
    items: { matari: 0 },
    tasks: { cultivation: null, exploration: null },
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
      lilyEventReady: false,
      lilyJoined: false,
      matariReceived: false,
      cultivationStarted: false,
      cultivationReady: false,
      cultivationHarvested: false,
      pochiEventReady: false,
      pochiJoined: false,
      explorationStarted: false,
      explorationReady: false,
      explorationClaimed: false,
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

  const POCHI_EVENT = [
    { speaker: 'シャノン', text: '……あれ？ 広場の向こうから、すごい勢いで誰か走ってくる。', char: 'shannon' },
    { speaker: '？？？', text: 'この匂い！ 食べものだよね！？', char: 'pochi' },
    { speaker: 'ポチ', text: 'わたしはポチ！ いい匂いにつられて来ちゃった！\nここ、みんなで暮らしてるの？', char: 'pochi' },
    { speaker: 'シャノン', text: 'うん。まだ作り始めたばかりだけどね。\nよかったらポチも一緒にどう？', char: 'shannon' },
    { speaker: 'ポチ', text: 'いいの！？ やったー！\nわたし、外を歩き回るの得意だよ。使えそうなものも探してくる！', char: 'pochi' }
  ];

  const LILY_EVENT = [
    { speaker: 'シャノン', text: 'あれ？ 広場に誰か来てるみたい。', char: 'shannon' },
    { speaker: '？？？', text: 'ここ、前よりずっと空気が澄んでる。\nきれいな水の気配もするわ。', char: 'lily' },
    { speaker: 'リリー', text: '私はリリー。アルラウネよ。\n植物を育てることなら、少し自信があるの。', char: 'lily' },
    { speaker: 'シャノン', text: 'それなら、ここで一緒に暮らさない？\nちょうど植物のことで頼みたいこともあるんだ。', char: 'shannon' },
    { speaker: 'リリー', text: 'ええ。面白そうね。力を貸すわ。', char: 'lily' },
    { speaker: 'シャノン', text: 'そうだ。私が持ってた「マタリの実」がひとつ残ってるの。\nリリーなら増やせるかな？', char: 'shannon' },
    { speaker: 'リリー', text: 'もちろん。預けてくれれば、次の朝には増やしてみせるわ。', char: 'lily' }
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
      state.items = { ...fresh.items, ...(parsed.items || {}) };
      state.tasks = { ...fresh.tasks, ...(parsed.tasks || {}) };
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
      state.version = 6;
      recalculateStats();
      if (!parsed.tutorialStep) state.tutorialStep = deriveTutorialStep();
      if ((parsed.version || 0) < 4 && state.flags.slaminAssignedToWell && !state.flags.lilyJoined) {
        state.tutorialStep = 'waitLily';
        state.flags.sliceComplete = false;
      }
      if ((parsed.version || 0) < 6 && state.flags.cultivationHarvested && !state.flags.pochiJoined) {
        state.flags.pochiEventReady = true;
        state.flags.sliceComplete = false;
        state.tutorialStep = 'meetPochi';
      }
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
  function foodCount() { return state.items.matari || 0; }

  function deriveTutorialStep() {
    if (state.flags.explorationClaimed || state.flags.sliceComplete) return 'complete';
    if (state.flags.explorationReady) return 'explorationReady';
    if (state.flags.explorationStarted) return 'waitExploration';
    if (state.flags.pochiJoined) return 'startExploration';
    if (state.flags.pochiEventReady || state.flags.cultivationHarvested) return 'meetPochi';
    if (state.flags.cultivationReady) return 'harvestCultivation';
    if (state.flags.cultivationStarted) return 'waitCultivation';
    if (state.flags.lilyJoined) return 'startCultivation';
    if (state.flags.lilyEventReady) return 'meetLily';
    if (state.flags.slaminAssignedToWell) return 'waitLily';
    if (state.flags.slaminJoined) return 'assignSlamin';
    if (state.flags.slaminEventReady) return 'meetSlamin';
    if (state.flags.wellBuilt) return 'sleepAfterWell';
    if (state.flags.firstStoneGathered) return 'repairWell';
    return 'collectStone';
  }

  function setTutorialStep(step) {
    state.tutorialStep = step;
  }

  function joinedResidentIds() {
    const ids = [];
    if (state.flags.slaminJoined) ids.push('slamin');
    if (state.flags.lilyJoined) ids.push('lily');
    if (state.flags.pochiJoined) ids.push('pochi');
    return ids;
  }

  function residentAwayFromBase(residentId) {
    const task = state.tasks.exploration;
    return !!(task && task.residentId === residentId && !task.ready);
  }

  function residentBusyText(residentId) {
    const task = state.tasks.exploration;
    if (task && task.residentId === residentId) {
      return task.ready ? '探索から帰還・報告待ち' : `探索中（あと${task.remaining}区分）`;
    }
    return null;
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
    if (residentId === 'slamin' && facilityId === 'well' && state.tutorialStep === 'assignSlamin') {
      setTutorialStep('waitLily');
    }
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
    const exploration = state.tasks.exploration;
    if (exploration && !exploration.ready) {
      exploration.remaining = Math.max(0, exploration.remaining - 1);
      if (exploration.remaining === 0) {
        exploration.ready = true;
        exploration.reward = {
          wood: 4 + Math.floor(Math.random() * 5),
          stone: 4 + Math.floor(Math.random() * 5)
        };
        state.flags.explorationReady = true;
        setTutorialStep('explorationReady');
      }
    }

    if (state.flags.wellBuilt && !state.flags.slaminJoined && state.day >= 2 && state.timeIndex === 0) {
      state.flags.slaminEventReady = true;
      setTutorialStep('meetSlamin');
    }

    if (state.tutorialStep === 'waitLily' && state.stats.cleanliness >= 10 && !state.flags.lilyJoined) {
      state.flags.lilyEventReady = true;
      setTutorialStep('meetLily');
    }

    const cultivation = state.tasks.cultivation;
    if (cultivation && !cultivation.ready && state.day >= cultivation.finishDay && state.timeIndex === 0) {
      cultivation.ready = true;
      state.flags.cultivationReady = true;
      setTutorialStep('harvestCultivation');
    }
  }

  function startNewGame() {
    state = defaultState();
    state.started = true;
    state.tutorialStep = 'collectStone';
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
      const dialogueImages = { shannon: 'images/shannon.webp', slamin: 'images/slamin.webp', lily: 'images/lily.webp', pochi: 'images/pochi.webp' };
      const charHtml = line.char
        ? `<img class="dialogue-char ${line.char}" src="${dialogueImages[line.char]}" alt="${escapeHtml(line.speaker)}">`
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
          <p class="title-sub">スマートフォン向け プロトタイプ v0.6</p>
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
      <div class="resource-pill">🍎 食料 <b>${foodCount()}</b></div>
    </div>`;
  }

  function tutorialNeedsWellRepair() {
    return state.tutorialStep === 'repairWell';
  }

  function isTutorialLocked() {
    return !['free'].includes(state.tutorialStep);
  }

  function needsTabDot(tab) {
    if (tab === 'actions' && ['collectStone', 'sleepAfterWell', 'waitLily', 'waitCultivation', 'startExploration', 'waitExploration'].includes(state.tutorialStep)) return true;
    if (tab === 'build' && state.tutorialStep === 'repairWell') return true;
    if (tab === 'base' && ['meetSlamin', 'assignSlamin', 'meetLily', 'startCultivation', 'harvestCultivation', 'meetPochi', 'explorationReady'].includes(state.tutorialStep)) return true;
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
      const idle = joinedResidentIds().filter(id => !getResidentFacility(id) && !residentAwayFromBase(id));
      return [...new Set([...explicitlyPlaced.filter(id => !residentAwayFromBase(id)), ...idle])];
    }
    return (state.assignments[facilityId] || []).filter(id => !residentAwayFromBase(id));
  }

  function sceneCharacterHtml(residentId, index, count, facilityId) {
    const resident = RESIDENTS[residentId];
    if (!resident) return '';
    const pos = characterPosition(facilityId, index, count);
    const style = SCENE_CHARACTER_STYLE[residentId] || { scale: 1, offsetX: 0, offsetY: 0 };
    let statusBadge = '';
    if (residentId === 'lily' && state.tasks.cultivation?.ready) statusBadge = '<span class="character-status-badge task-ready" aria-hidden="true">!</span>';
    if (residentId === 'pochi' && state.tasks.exploration?.ready) statusBadge = '<span class="character-status-badge task-ready task-box" aria-hidden="true">📦</span>';
    return `<button class="scene-character" data-resident="${residentId}" aria-label="${resident.name}" style="--char-left:${pos.left}%;--char-bottom:${pos.bottom}px;--char-width:${pos.width}px;--char-scale:${style.scale};--char-offset-x:${style.offsetX}px;--char-offset-y:${style.offsetY}px">
      ${statusBadge}<img src="${resident.image}" alt="${resident.name}">
    </button>`;
  }

  function characterPosition(facilityId, index, count) {
    // bottom は下部メッセージパネルの「安全線」より上に置く。
    // 人数が増えても前列・中列・後列の順に並べられる。
    const plazaPositions = [
      { left: 31, bottom: 146, width: 104 }, { left: 50, bottom: 140, width: 96 },
      { left: 72, bottom: 146, width: 100 }, { left: 20, bottom: 226, width: 86 },
      { left: 42, bottom: 234, width: 84 }, { left: 65, bottom: 230, width: 86 },
      { left: 82, bottom: 224, width: 80 }, { left: 29, bottom: 310, width: 72 },
      { left: 55, bottom: 304, width: 74 }, { left: 76, bottom: 310, width: 72 }
    ];
    const wellPositions = [
      { left: 72, bottom: 146, width: 112 }, { left: 25, bottom: 150, width: 104 }
    ];
    const list = facilityId === 'well' ? wellPositions : plazaPositions;
    return list[index % list.length];
  }

  function facilitySceneNote(facilityId) {
    const step = state.tutorialStep;
    if (facilityId === 'plaza') {
      if (step === 'collectStone') return 'シャノンと拠点づくりを始めます。「行動」から石材を5個集めましょう。';
      if (step === 'repairWell') return '井戸を直す石材が揃いました。「建築」から修復を進めましょう。';
      if (step === 'sleepAfterWell') return '井戸の修復は完了しました。今夜は休んで、翌朝を迎えましょう。';
      if (step === 'meetSlamin') return '井戸の方から、何か妙な気配がします。❗を確認してみましょう。';
      if (step === 'assignSlamin') return 'スラミンが仲間になりました。井戸に配置して「浄化」を試しましょう。';
      if (step === 'waitLily') return '井戸の水がきれいになりました。木材を集めながら、少し時間を進めてみましょう。';
      if (step === 'meetLily') return '広場に見慣れない魔物娘が来ています。❗を確認してみましょう。';
      if (step === 'startCultivation') return 'リリーが仲間になりました。リリーをタップして、マタリの実の栽培をお願いしましょう。';
      if (step === 'waitCultivation') return 'リリーがマタリの実を栽培中。翌朝になるまで待ちましょう。';
      if (step === 'harvestCultivation') return '栽培が終わったようです。リリーの頭上の印を確認して、マタリの実を受け取りましょう。';
      if (step === 'meetPochi') return '食べものの匂いにつられて、誰かが広場へやって来たようです。❗を確認しましょう。';
      if (step === 'startExploration') return 'ポチが仲間になりました。「行動」から探索をお願いしてみましょう。';
      if (step === 'waitExploration') return `ポチは周辺を探索中。帰還まであと${state.tasks.exploration?.remaining ?? 0}区分です。`;
      if (step === 'explorationReady') return 'ポチが探索から帰ってきました。頭上の箱印を確認して報告を受けましょう。';
      if (step === 'complete') return 'ポチの初回探索が完了しました。今回の実装範囲はここまでです。';
      return '拠点の中心になる広場。シャノンはここで様子を見ています。';
    }
    if (!state.flags.wellBuilt) return '壊れた井戸。石材5個があれば修復できます。';
    if (step === 'sleepAfterWell') return '井戸が直りました。今夜は休んで、翌朝を迎えましょう。';
    if (step === 'meetSlamin') return '井戸のそばに見慣れない気配が……。❗をタップしましょう。';
    if (step === 'assignSlamin') return '「設備情報・配置」からスラミンを井戸に配置してみましょう。';
    if (state.flags.slaminAssignedToWell) return 'スラミンが井戸を浄化中。清潔度 +10。';
    if (state.flags.slaminJoined) return '「設備情報・配置」から住民を配置できます。';
    return '修復された井戸。拠点の水場として使えそうです。';
  }

  function baseHtml() {
    const id = state.currentFacility;
    const facility = FACILITIES[id];
    const idx = FACILITY_ORDER.indexOf(id);
    const isWell = id === 'well';
    const residents = facilityResidentsForScene(id);
    const slaminEvent = isWell && state.flags.slaminEventReady && !state.flags.slaminJoined;
    const lilyEvent = id === 'plaza' && state.flags.lilyEventReady && !state.flags.lilyJoined;
    const pochiEvent = id === 'plaza' && state.flags.pochiEventReady && !state.flags.pochiJoined;

    const mainObject = isWell
      ? `<button class="facility-object well-focus ${state.flags.wellBuilt ? '' : 'broken'}" id="facility-object" aria-label="${facilityName('well')}">
          <img src="images/well.webp" alt="${facilityName('well')}">
        </button>`
      : '';

    const characters = residents.map((residentId, i) => sceneCharacterHtml(residentId, i, residents.length, id)).join('');
    const shannonStyle = SCENE_CHARACTER_STYLE.shannon;
    const shannon = id === 'plaza'
      ? `<button class="scene-character shannon-scene" id="shannon-object" aria-label="シャノン" style="--char-left:76%;--char-bottom:146px;--char-width:132px;--char-scale:${shannonStyle.scale};--char-offset-x:${shannonStyle.offsetX}px;--char-offset-y:${shannonStyle.offsetY}px">
          <img src="images/shannon.webp" alt="シャノン">
        </button>` : '';

    return `
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
        ${lilyEvent ? '<button class="event-pin event-center" id="lily-event" aria-label="リリー来訪イベント">!</button>' : ''}
        ${pochiEvent ? '<button class="event-pin event-center" id="pochi-event" aria-label="ポチ来訪イベント">!</button>' : ''}

        <div class="scene-bottom-panel">
          <div class="facility-dots">${FACILITY_ORDER.map((fid, i) => `<i class="${i === idx ? 'active' : ''}"></i>`).join('')}</div>
          <p>${facilitySceneNote(id)}</p>
          <button class="scene-detail-btn" id="facility-detail-btn">設備情報・配置</button>
        </div>
      </div>`;
  }

  function friendsHtml() {
    const residentStatus = id => {
      if (id === 'lily' && state.tasks.cultivation) {
        return state.tasks.cultivation.ready ? '栽培完了・受け取り待ち' : '栽培中（翌朝完成）';
      }
      const busy = residentBusyText(id);
      if (busy) return busy;
      const place = getResidentFacility(id);
      return place ? `${facilityName(place)}に配置中` : '拠点で待機中';
    };
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
          <p class="card-desc">スライム娘<br>得意：浄化<br>状態：${residentStatus('slamin')}</p></div>
        </div>` : ''}
        ${state.flags.lilyJoined ? `<div class="resident-list-card static-card">
          <img src="images/lily.webp" alt="リリー">
          <div><div class="card-head"><span class="card-title">リリー</span><span class="badge">自然</span></div>
          <p class="card-desc">アルラウネ<br>得意：栽培<br>状態：${residentStatus('lily')}</p></div>
        </div>` : ''}
        ${state.flags.pochiJoined ? `<div class="resident-list-card static-card">
          <img src="images/pochi.webp" alt="ポチ">
          <div><div class="card-head"><span class="card-title">ポチ</span><span class="badge">獣</span></div>
          <p class="card-desc">犬娘<br>得意：探索<br>状態：${residentStatus('pochi')}</p></div>
        </div>` : ''}
        ${!state.flags.slaminJoined && !state.flags.lilyJoined && !state.flags.pochiJoined ? '<div class="empty-state">まだ通常の魔物娘はいません。</div>' : ''}
      </div>
    </section>`;
  }

  function actionsHtml() {
    const step = state.tutorialStep;
    let body = '';

    if (step === 'collectStone') {
      body = `<div class="tutorial-lock tutorial-focus"><strong>まずは井戸を直す石を集めよう</strong><p>最初のチュートリアルでは、ほかの行動はまだ選べません。</p></div>
        <div class="card-stack"><button class="action-card action-highlight" id="gather-stone"><div class="card-head"><span class="card-title">🪨 石材を集める</span><span class="card-time">1区分</span></div><p class="card-desc">周囲の瓦礫から石材を5個集めます。</p></button></div>`;
    } else if (step === 'repairWell') {
      body = `<div class="tutorial-lock"><strong>井戸を修復しよう</strong><p>必要な石材5個が揃いました。修復を終えるまで、時間が進む行動は選べません。</p><button class="primary-btn" id="go-build">建築を開く</button></div>`;
    } else if (step === 'sleepAfterWell') {
      body = `<div class="tutorial-lock tutorial-focus"><strong>今日はここまで</strong><p>井戸の修復が終わりました。眠って翌朝を迎えましょう。</p></div><div class="card-stack"><button class="action-card action-highlight" id="sleep-action"><div class="card-head"><span class="card-title">🌙 眠る</span><span class="card-time">翌朝へ</span></div><p class="card-desc">1日目の夜を終えて、次の日の朝へ進みます。</p></button></div>`;
    } else if (step === 'meetSlamin') {
      body = `<div class="tutorial-lock"><strong>井戸に何かいる……？</strong><p>必須イベントが発生しています。井戸の❗を確認するまで、時間が進む行動は選べません。</p><button class="primary-btn" id="go-well-event">井戸へ行く</button></div>`;
    } else if (step === 'assignSlamin') {
      body = `<div class="tutorial-lock"><strong>スラミンを配置しよう</strong><p>井戸に「浄化」を得意とするスラミンを配置して、設備効果を試しましょう。</p><button class="primary-btn" id="go-well-assign">井戸の配置を開く</button></div>`;
    } else if (step === 'waitLily') {
      body = `<div class="tutorial-lock tutorial-focus"><strong>きれいになった拠点で少し過ごそう</strong><p>清潔度が10になりました。木材を集めながら1区分だけ時間を進めてみましょう。</p></div><div class="card-stack"><button class="action-card action-highlight" id="gather-wood-lily"><div class="card-head"><span class="card-title">🪵 木材を集める</span><span class="card-time">1区分</span></div><p class="card-desc">木材 +5。時間が進むと、新しい変化があるかもしれません。</p></button></div>`;
    } else if (step === 'meetLily') {
      body = `<div class="tutorial-lock"><strong>広場に誰か来たようです</strong><p>必須イベントが発生しています。広場の❗を確認しましょう。</p><button class="primary-btn" id="go-lily-event">広場へ行く</button></div>`;
    } else if (step === 'startCultivation') {
      body = `<div class="tutorial-lock"><strong>リリーに栽培をお願いしよう</strong><p>シャノンからマタリの実を1個受け取りました。広場のリリーに直接お願いしてみましょう。</p><button class="primary-btn" id="go-lily-cultivation">リリーのところへ</button></div>`;
    } else if (step === 'waitCultivation') {
      const night = state.timeIndex === 3;
      body = `<div class="tutorial-lock tutorial-focus"><strong>栽培が終わるのを待とう</strong><p>リリーが栽培中です。今回は待ち時間のため、「${night ? '眠る' : '休む'}」で時間を進められます。翌朝に完成します。</p></div><div class="card-stack"><button class="action-card action-highlight" id="wait-cultivation"><div class="card-head"><span class="card-title">${night ? '🌙 眠る' : '☕ 休む'}</span><span class="card-time">1区分</span></div><p class="card-desc">何もせず1区分進めます。</p></button></div>`;
    } else if (step === 'harvestCultivation') {
      body = `<div class="tutorial-lock"><strong>栽培が終わりました</strong><p>リリーの頭上に完了アイコンが出ています。広場でマタリの実を受け取りましょう。</p><button class="primary-btn" id="go-lily-harvest">リリーのところへ</button></div>`;
    } else if (step === 'meetPochi') {
      body = `<div class="tutorial-lock"><strong>食べものの匂いにつられて……</strong><p>必須イベントが発生しています。広場の❗を確認しましょう。</p><button class="primary-btn" id="go-pochi-event">広場へ行く</button></div>`;
    } else if (step === 'startExploration') {
      body = `<div class="tutorial-lock tutorial-focus"><strong>ポチに探索をお願いしよう</strong><p>探索が得意な住民を派遣すると、時間経過後に資材を持ち帰ります。依頼そのものでは時間は進みません。</p></div><div class="card-stack"><button class="action-card action-highlight" id="open-exploration"><div class="card-head"><span class="card-title">🐾 近隣を探索</span><span class="card-time">2区分</span></div><p class="card-desc">探索役を選んで、拠点周辺を調べてもらいます。報酬：木材4〜8、石材4〜8。</p></button></div>`;
    } else if (step === 'waitExploration') {
      const remaining = state.tasks.exploration?.remaining ?? 0;
      body = `<div class="tutorial-lock tutorial-focus"><strong>ポチが探索中</strong><p>帰還まであと${remaining}区分です。探索は裏で進むので、その間に主人公も別の行動ができます。</p></div><div class="card-stack"><button class="action-card" id="explore-gather-wood"><div class="card-head"><span class="card-title">🪵 木材を集める</span><span class="card-time">1区分</span></div><p class="card-desc">木材 +5。ポチの探索も1区分進みます。</p></button><button class="action-card" id="explore-gather-stone"><div class="card-head"><span class="card-title">🪨 石材を集める</span><span class="card-time">1区分</span></div><p class="card-desc">石材 +5。ポチの探索も1区分進みます。</p></button><button class="action-card" id="explore-rest"><div class="card-head"><span class="card-title">☕ 休む</span><span class="card-time">1区分</span></div><p class="card-desc">何も得ずに1区分進めます。</p></button></div>`;
    } else if (step === 'explorationReady') {
      body = `<div class="tutorial-lock"><strong>ポチが帰ってきました</strong><p>探索結果を受け取るまで、次の時間行動には進みません。広場のポチを確認しましょう。</p><button class="primary-btn" id="go-pochi-report">ポチのところへ</button></div>`;
    } else if (step === 'complete') {
      body = `<div class="tutorial-lock complete-card"><strong>ポチの探索まで実装完了</strong><p>探索で木材と石材を持ち帰れるようになりました。今回の実装範囲はここまでです。次は初回探索をきっかけにバーニィ加入へつなげられます。</p></div>`;
    } else {
      body = `<div class="card-stack"><button class="action-card" id="gather-stone"><div class="card-head"><span class="card-title">🪨 石材を集める</span><span class="card-time">1区分</span></div><p class="card-desc">石材 +5。</p></button><button class="action-card" id="gather-wood"><div class="card-head"><span class="card-title">🪵 木材を集める</span><span class="card-time">1区分</span></div><p class="card-desc">木材 +5。</p></button></div>`;
    }

    return `<section class="page"><h2 class="page-title">行動</h2><p class="page-lead">チュートリアル中は、次に必要な行動だけが解放されます。</p>${body}</section>`;
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
    const matariKnown = state.flags.matariReceived || state.flags.cultivationStarted || state.flags.cultivationHarvested;
    return `<section class="page">
      <h2 class="page-title">物資</h2><p class="page-lead">資材とアイテムを確認します。</p>
      <h3 class="section-title">資材</h3><div class="action-card" role="group"><div class="item-row"><span>🪵 木材</span><b>${state.resources.wood}</b></div><div class="item-row"><span>🪨 石材</span><b>${state.resources.stone}</b></div></div>
      <h3 class="section-title">アイテム</h3>
      ${matariKnown ? `<div class="action-card" role="group"><div class="item-row"><span>🍎 マタリの実</span><b>${state.items.matari}</b></div><p class="card-desc">ほんのり甘い赤い実。タグ：<span class="badge">食料</span> <span class="badge">植物</span></p></div>` : '<div class="empty-state">まだアイテムを持っていません。</div>'}
    </section>`;
  }

  function facilityListOverlay() {
    return `<div class="sheet-backdrop" id="sheet-backdrop"><section class="sheet tall-sheet" role="dialog" aria-modal="true">
      <div class="sheet-handle"></div><h2>設備一覧</h2><p>行きたい場所を選んでください。普段は拠点画面を左右にスワイプしても移動できます。</p>
      <div class="facility-list">
        ${FACILITY_ORDER.map(id => {
          const assigned = (state.assignments[id] || []).length;
          const event = (id === 'well' && state.flags.slaminEventReady && !state.flags.slaminJoined) ||
            (id === 'plaza' && ((state.flags.lilyEventReady && !state.flags.lilyJoined) || (state.flags.pochiEventReady && !state.flags.pochiJoined) || ['startCultivation', 'harvestCultivation', 'explorationReady'].includes(state.tutorialStep)));
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
        ${usable && !(state.tutorialStep === 'assignSlamin' && facilityId !== 'well') ? `<button class="primary-btn" id="open-resident-select">${placed.length >= facility.capacity ? '住民を入れ替える' : '住民を配置する'}</button>` : ''}
        ${state.tutorialStep === 'assignSlamin' && facilityId !== 'well' ? '<p class="muted-text">チュートリアル中は、先にスラミンを井戸へ配置しましょう。</p>' : ''}
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
          const busy = residentAwayFromBase(id);
          return `<button class="resident-select-card ${here ? 'selected' : ''}" data-select-resident="${id}" ${here || busy ? 'disabled' : ''}>
            <img src="${r.image}" alt="${r.name}">
            <div class="resident-card-body">
              <div class="resident-card-title"><strong>${r.name}</strong><span class="badge">${r.species}</span></div>
              <p>得意：${r.ability}</p>
              <small>${busy ? '現在：探索中' : here ? `現在：${facilityName(facilityId)}に配置中` : current ? `現在：${facilityName(current)}に配置中` : '現在：待機中'}</small>
              <em class="${effective ? 'effect-good' : 'effect-none'}">${effective ? '✓ この設備で特殊効果あり' : 'この設備では特殊効果なし'}</em>
            </div>
          </button>`;
        }).join('') : '<div class="empty-state">配置できる通常住民がまだいません。</div>'}
      </div>
      <div class="sheet-actions"><button class="secondary-btn" id="back-facility-detail">戻る</button></div>
    </section></div>`;
  }

  function cultivationOverlay() {
    return `<div class="sheet-backdrop" id="sheet-backdrop"><section class="sheet" role="dialog" aria-modal="true">
      <div class="sheet-handle"></div><h2>リリーに栽培をお願いする</h2>
      <p>植物系アイテムを預けて増やしてもらいます。プロトタイプではマタリの実だけが対象です。</p>
      <div class="action-card static-card"><div class="item-row"><span>🍎 マタリの実</span><b>${state.items.matari}個</b></div><p class="card-desc">使用：1個 → 翌朝：5個受け取り</p></div>
      <div class="sheet-actions"><button class="primary-btn" id="start-cultivation" ${state.items.matari >= 1 ? '' : 'disabled'}>マタリの実を預ける</button><button class="secondary-btn" id="back-lily-detail">戻る</button></div>
    </section></div>`;
  }

  function explorationOverlay() {
    const explorers = joinedResidentIds().filter(id => RESIDENTS[id]?.ability === '探索');
    return `<div class="sheet-backdrop" id="sheet-backdrop"><section class="sheet tall-sheet" role="dialog" aria-modal="true">
      <div class="sheet-handle"></div><h2>探索する住民を選ぶ</h2>
      <p>近隣探索：所要2区分。探索中の住民は拠点画面から離れます。帰還時に木材4〜8、石材4〜8を持ち帰ります。</p>
      <div class="resident-select-list">
        ${explorers.length ? explorers.map(id => {
          const r = RESIDENTS[id];
          return `<button class="resident-select-card" data-start-explorer="${id}"><img src="${r.image}" alt="${r.name}"><div class="resident-card-body"><div class="resident-card-title"><strong>${r.name}</strong><span class="badge">${r.species}</span></div><p>得意：${r.ability}</p><small>現在：${getResidentFacility(id) ? facilityName(getResidentFacility(id)) + 'に配置中' : '待機中'}</small><em class="effect-good">✓ 探索可能</em></div></button>`;
        }).join('') : '<div class="empty-state">探索を得意とする住民がいません。</div>'}
      </div>
      <div class="sheet-actions"><button class="secondary-btn" id="close-sheet">閉じる</button></div>
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
    if (overlay.type === 'cultivation') return cultivationOverlay();
    if (overlay.type === 'exploration') return explorationOverlay();
    if (overlay.type === 'shannon') {
      return `<div class="sheet-backdrop" id="sheet-backdrop"><section class="sheet" role="dialog" aria-modal="true"><div class="sheet-handle"></div><h2>シャノン</h2><p>${state.flags.wellBuilt ? '「井戸が直ると、ここも少し拠点らしく見えてきたね。」' : '「まずは井戸を直そう。石なら、この辺りの瓦礫から集められそうだよ。」'}</p><div class="sheet-actions"><button class="secondary-btn" id="close-sheet">閉じる</button></div></section></div>`;
    }
    if (overlay.type === 'resident') {
      const r = RESIDENTS[overlay.residentId];
      const place = getResidentFacility(r.id);
      const task = r.id === 'lily' ? state.tasks.cultivation : null;
      const explorationTask = r.id === 'pochi' ? state.tasks.exploration : null;
      let extra = '';
      if (r.id === 'lily' && state.flags.lilyJoined) {
        if (task?.ready) {
          extra = `<button class="primary-btn" id="receive-cultivation">マタリの実を受け取る</button>`;
        } else if (task) {
          extra = `<div class="effect-box"><strong>🌱 栽培中</strong><p>マタリの実を育てています。翌朝に完成します。</p></div>`;
        } else if (state.items.matari > 0) {
          extra = `<button class="primary-btn" id="open-cultivation">栽培をお願いする</button>`;
        }
      }
      if (r.id === 'pochi' && state.flags.pochiJoined) {
        if (explorationTask?.ready) {
          extra = `<div class="effect-box"><strong>📦 探索完了</strong><p>木材 ${explorationTask.reward?.wood ?? 0}、石材 ${explorationTask.reward?.stone ?? 0} を持ち帰っています。</p></div><button class="primary-btn" id="receive-exploration">探索結果を受け取る</button>`;
        } else if (explorationTask) {
          extra = `<div class="effect-box"><strong>🐾 探索中</strong><p>帰還まであと${explorationTask.remaining}区分です。</p></div>`;
        }
      }
      const stateText = task ? (task.ready ? '栽培完了' : '栽培中') : explorationTask ? (explorationTask.ready ? '探索から帰還' : `探索中・あと${explorationTask.remaining}区分`) : (place ? facilityName(place) + 'に配置中' : '拠点で待機中');
      return `<div class="sheet-backdrop" id="sheet-backdrop"><section class="sheet" role="dialog" aria-modal="true"><div class="sheet-handle"></div><h2>${r.name}</h2><p>${r.species} / ${r.lineage}<br>得意：${r.ability}<br>状態：${stateText}</p>${extra}<div class="sheet-actions"><button class="secondary-btn" id="close-sheet">閉じる</button></div></section></div>`;
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
      if (state.tutorialStep !== 'collectStone' && state.tutorialStep !== 'free') return;
      state.resources.stone += 5;
      if (state.tutorialStep === 'collectStone') {
        state.flags.firstStoneGathered = true;
        setTutorialStep('repairWell');
      }
      advanceTime(1);
      toast(state.tutorialStep === 'repairWell' ? '石材 +5。次は井戸を修復しましょう' : '石材 +5');
      renderGame();
    });

    document.getElementById('gather-wood')?.addEventListener('click', () => {
      if (state.tutorialStep !== 'free') return;
      state.resources.wood += 5;
      advanceTime(1);
      toast('木材 +5');
      renderGame();
    });

    document.getElementById('gather-wood-lily')?.addEventListener('click', () => {
      if (state.tutorialStep !== 'waitLily') return;
      state.resources.wood += 5;
      advanceTime(1);
      toast('木材 +5。広場に誰か来たようです');
      state.currentTab = 'base';
      state.currentFacility = 'plaza';
      renderGame();
    });

    document.getElementById('wait-cultivation')?.addEventListener('click', () => {
      if (state.tutorialStep !== 'waitCultivation') return;
      advanceTime(1);
      if (state.tutorialStep === 'harvestCultivation') {
        toast('翌朝になりました。栽培が終わったようです');
        state.currentTab = 'base';
        state.currentFacility = 'plaza';
      } else {
        toast(`${currentTimeName()}になりました`);
      }
      renderGame();
    });

    document.getElementById('sleep-action')?.addEventListener('click', () => {
      if (state.tutorialStep !== 'sleepAfterWell') return;
      state.day += 1;
      state.timeIndex = 0;
      runTimeTriggers();
      save(true);
      toast(`${state.day}日目の朝になりました`);
      state.currentTab = 'base';
      state.currentFacility = 'well';
      renderGame();
    });

    document.getElementById('go-build')?.addEventListener('click', () => {
      state.currentTab = 'build';
      overlay = null;
      save(true);
      renderGame();
    });

    document.getElementById('go-well-event')?.addEventListener('click', () => {
      state.currentTab = 'base';
      state.currentFacility = 'well';
      overlay = null;
      save(true);
      renderGame();
    });

    document.getElementById('go-well-assign')?.addEventListener('click', () => {
      state.currentTab = 'base';
      state.currentFacility = 'well';
      overlay = { type:'facility', facilityId:'well' };
      save(true);
      renderGame();
    });

    document.getElementById('go-lily-event')?.addEventListener('click', () => {
      state.currentTab = 'base';
      state.currentFacility = 'plaza';
      overlay = null;
      save(true);
      renderGame();
    });

    document.getElementById('go-lily-cultivation')?.addEventListener('click', () => {
      state.currentTab = 'base';
      state.currentFacility = 'plaza';
      overlay = { type:'resident', residentId:'lily' };
      save(true);
      renderGame();
    });

    document.getElementById('go-lily-harvest')?.addEventListener('click', () => {
      state.currentTab = 'base';
      state.currentFacility = 'plaza';
      overlay = { type:'resident', residentId:'lily' };
      save(true);
      renderGame();
    });

    document.getElementById('go-pochi-event')?.addEventListener('click', () => {
      state.currentTab = 'base';
      state.currentFacility = 'plaza';
      overlay = null;
      save(true);
      renderGame();
    });

    document.getElementById('go-pochi-report')?.addEventListener('click', () => {
      state.currentTab = 'base';
      state.currentFacility = 'plaza';
      overlay = { type:'resident', residentId:'pochi' };
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
        setTutorialStep('sleepAfterWell');
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
        setTutorialStep('assignSlamin');
        recalculateStats();
        save(true);
        state.currentTab = 'base';
        state.currentFacility = 'well';
        renderGame();
        toast('スラミンが仲間になりました！ 活気 +10');
      });
    });

    document.getElementById('lily-event')?.addEventListener('click', () => {
      playDialogue(LILY_EVENT, () => {
        state.flags.lilyEventReady = false;
        state.flags.lilyJoined = true;
        state.flags.matariReceived = true;
        state.items.matari += 1;
        setTutorialStep('startCultivation');
        recalculateStats();
        save(true);
        state.currentTab = 'base';
        state.currentFacility = 'plaza';
        renderGame();
        toast('リリーが仲間に！ マタリの実 ×1を受け取りました');
      });
    });

    document.getElementById('pochi-event')?.addEventListener('click', () => {
      playDialogue(POCHI_EVENT, () => {
        state.flags.pochiEventReady = false;
        state.flags.pochiJoined = true;
        setTutorialStep('startExploration');
        recalculateStats();
        save(true);
        state.currentTab = 'base';
        state.currentFacility = 'plaza';
        renderGame();
        toast('ポチが仲間になりました！ 活気 +10');
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
      if (residentId === 'slamin' && state.tutorialStep !== 'complete') {
        toast('チュートリアル中はスラミンを井戸に配置したまま進めましょう');
        return;
      }
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

    document.getElementById('open-cultivation')?.addEventListener('click', () => {
      overlay = { type:'cultivation' };
      renderGame();
    });

    document.getElementById('open-exploration')?.addEventListener('click', () => {
      overlay = { type:'exploration' };
      renderGame();
    });

    document.querySelectorAll('[data-start-explorer]').forEach(btn => btn.addEventListener('click', () => {
      const residentId = btn.dataset.startExplorer;
      if (state.tasks.exploration || RESIDENTS[residentId]?.ability !== '探索') return;
      FACILITY_ORDER.forEach(id => { state.assignments[id] = (state.assignments[id] || []).filter(x => x !== residentId); });
      state.tasks.exploration = { residentId, remaining: 2, ready: false, reward: null };
      state.flags.explorationStarted = true;
      state.flags.explorationReady = false;
      setTutorialStep('waitExploration');
      overlay = null;
      save(true);
      renderGame();
      toast(`${RESIDENTS[residentId].name}を探索に送り出しました`);
    }));

    document.getElementById('back-lily-detail')?.addEventListener('click', () => {
      overlay = { type:'resident', residentId:'lily' };
      renderGame();
    });

    document.getElementById('start-cultivation')?.addEventListener('click', () => {
      if (state.items.matari < 1 || state.tasks.cultivation) return;
      state.items.matari -= 1;
      state.tasks.cultivation = {
        residentId: 'lily',
        itemId: 'matari',
        finishDay: state.day + 1,
        ready: false
      };
      state.flags.cultivationStarted = true;
      state.flags.cultivationReady = false;
      setTutorialStep('waitCultivation');
      overlay = null;
      save(true);
      renderGame();
      toast('リリーにマタリの実を預けました。翌朝に完成します');
    });

    document.getElementById('receive-cultivation')?.addEventListener('click', () => {
      if (!state.tasks.cultivation?.ready) return;
      state.items.matari += 5;
      state.tasks.cultivation = null;
      state.flags.cultivationReady = false;
      state.flags.cultivationHarvested = true;
      state.flags.pochiEventReady = foodCount() >= 5;
      state.flags.sliceComplete = false;
      setTutorialStep(state.flags.pochiEventReady ? 'meetPochi' : 'free');
      overlay = null;
      save(true);
      renderGame();
      toast(state.flags.pochiEventReady ? 'マタリの実 ×5。広場に誰か来たようです！' : 'マタリの実 ×5を受け取りました！');
    });

    const advanceExplorationWait = (kind) => {
      if (state.tutorialStep !== 'waitExploration' || !state.tasks.exploration) return;
      if (kind === 'wood') state.resources.wood += 5;
      if (kind === 'stone') state.resources.stone += 5;
      advanceTime(1);
      if (state.tutorialStep === 'explorationReady') {
        state.currentTab = 'base';
        state.currentFacility = 'plaza';
        toast('ポチが探索から帰ってきました');
      } else if (kind === 'wood') toast('木材 +5。ポチの探索も進みました');
      else if (kind === 'stone') toast('石材 +5。ポチの探索も進みました');
      else toast(`${currentTimeName()}になりました。ポチの探索も進みました`);
      renderGame();
    };
    document.getElementById('explore-gather-wood')?.addEventListener('click', () => advanceExplorationWait('wood'));
    document.getElementById('explore-gather-stone')?.addEventListener('click', () => advanceExplorationWait('stone'));
    document.getElementById('explore-rest')?.addEventListener('click', () => advanceExplorationWait('rest'));

    document.getElementById('receive-exploration')?.addEventListener('click', () => {
      const task = state.tasks.exploration;
      if (!task?.ready) return;
      const reward = task.reward || { wood: 4, stone: 4 };
      state.resources.wood += reward.wood;
      state.resources.stone += reward.stone;
      state.tasks.exploration = null;
      state.flags.explorationReady = false;
      state.flags.explorationClaimed = true;
      state.flags.sliceComplete = true;
      setTutorialStep('complete');
      overlay = null;
      save(true);
      renderGame();
      toast(`探索報酬：木材 +${reward.wood} / 石材 +${reward.stone}`);
    });

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
