(() => {
  'use strict';

  const SAVE_KEY = 'shumatsuPrototype_v01';
  const TIME_NAMES = ['朝', '昼', '夕', '夜'];
  const app = document.getElementById('app');
  const toastRoot = document.getElementById('toast-root');

  const defaultState = () => ({
    version: 1,
    started: false,
    currentTab: 'base',
    day: 1,
    timeIndex: 0,
    resources: { wood: 0, stone: 0 },
    stats: { development: 0, cleanliness: 0, liveliness: 0 },
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
    state.saveStamp = new Date().toISOString();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    if (!auto) toast('手動セーブしました');
  }

  function load() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      state = { ...defaultState(), ...parsed };
      state.resources = { ...defaultState().resources, ...(parsed.resources || {}) };
      state.stats = { ...defaultState().stats, ...(parsed.stats || {}) };
      state.flags = { ...defaultState().flags, ...(parsed.flags || {}) };
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
      save(true);
      renderGame();
      toast('「行動」から石材を集めてみましょう');
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
          <p class="title-sub">スマートフォン向け プロトタイプ v0.1</p>
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

  function needsTabDot(tab) {
    if (tab === 'actions' && !state.flags.firstStoneGathered) return true;
    if (tab === 'build' && state.flags.firstStoneGathered && !state.flags.wellBuilt) return true;
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

  function baseHtml() {
    const wellClass = state.flags.wellBuilt ? '' : 'broken';
    const wellName = state.flags.wellBuilt ? '井戸' : '壊れた井戸';
    const eventPin = state.flags.slaminEventReady && !state.flags.slaminJoined
      ? `<button class="event-pin event-well" id="slamin-event" aria-label="イベント">!</button>` : '';
    const slamin = state.flags.slaminJoined
      ? `<button class="object-btn slamin-object" id="slamin-object"><img src="images/slamin.webp" alt="スラミン"><span class="object-name">スラミン</span></button>` : '';
    const assignmentNote = state.flags.slaminAssignedToWell
      ? 'スラミンが井戸を浄化中。清潔度が上がっています。'
      : state.flags.slaminJoined
        ? '井戸をタップすると、スラミンを配置できます。'
        : state.flags.wellBuilt
          ? '井戸が直りました。今夜は休んで、明日の様子を見ましょう。'
          : 'まずは石材を集めて、壊れた井戸を修復しましょう。';
    return `
      ${state.flags.sliceComplete ? '<div class="prototype-banner">最初の実装範囲はここまでです。スラミン加入と設備配置まで試せます。次はリリー来訪・栽培へ拡張できます。</div>' : ''}
      <div class="base-scene">
        <div class="location-label">寂れた広場</div>
        <button class="object-btn well-object ${wellClass}" id="well-object"><img src="images/well.webp" alt="${wellName}"><span class="object-name">${wellName}</span></button>
        <button class="object-btn shannon-object" id="shannon-object"><img src="images/shannon.webp" alt="シャノン"><span class="object-name">シャノン</span></button>
        ${slamin}
        ${eventPin}
        <div class="scene-note">${assignmentNote}</div>
      </div>`;
  }

  function friendsHtml() {
    return `<section class="page">
      <h2 class="page-title">仲間</h2>
      <p class="page-lead">拠点にいる魔物娘と、現在の役割を確認できます。</p>
      <div class="card-stack">
        <div class="action-card" role="group">
          <div class="card-head"><span class="card-title">シャノン</span><span class="badge">ストーリー</span></div>
          <p class="card-desc">羊娘 / 獣　得意：相談<br>通常住民とは別枠。井戸修復を手伝ってくれます。</p>
        </div>
        ${state.flags.slaminJoined ? `<div class="action-card" role="group">
          <div class="card-head"><span class="card-title">スラミン</span><span class="badge">スライム</span></div>
          <p class="card-desc">スライム娘　得意：浄化<br>状態：${state.flags.slaminAssignedToWell ? '井戸に配置中' : '拠点にいる'}</p>
        </div>` : '<div class="empty-state">まだ通常の魔物娘はいません。</div>'}
      </div>
    </section>`;
  }

  function actionsHtml() {
    const canGather = !state.flags.wellBuildStarted;
    const night = state.timeIndex === 3;
    return `<section class="page">
      <h2 class="page-title">行動</h2>
      <p class="page-lead">主人公が行動すると、ゲーム内時間が1区分進みます。</p>
      <div class="card-stack">
        <button class="action-card" id="gather-stone" ${canGather ? '' : 'disabled'}>
          <div class="card-head"><span class="card-title">🪨 石材を集める</span><span class="card-time">1区分</span></div>
          <p class="card-desc">周囲の瓦礫から使えそうな石材を集めます。${!state.flags.firstStoneGathered ? ' 初回は石材+5。' : ' 石材+5。'}</p>
        </button>
        <button class="action-card" id="gather-wood" ${state.flags.wellBuilt ? '' : 'disabled'}>
          <div class="card-head"><span class="card-title">🪵 木材を集める</span><span class="card-time">1区分</span></div>
          <p class="card-desc">周辺から使えそうな木材を集めます。井戸修復後に利用できます。</p>
        </button>
        <button class="action-card" id="rest-action" ${canGather ? '' : 'disabled'}>
          <div class="card-head"><span class="card-title">☕ 休む</span><span class="card-time">1区分</span></div>
          <p class="card-desc">何もせず時間を進めます。</p>
        </button>
        ${night ? `<button class="action-card" id="sleep-action">
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
        <div class="action-card"><div class="card-head"><span class="card-title">井戸</span><span class="badge">完成</span></div><p class="card-desc">発展度 +10 / 配置上限 1人 / タグ：水場</p></div>
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
      ${!enoughStone ? '<p class="page-lead" style="margin-top:10px">石材が足りません。「行動」から石材を集めましょう。</p>' : ''}
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
    if (overlay.type === 'well') {
      const joined = state.flags.slaminJoined;
      return `<div class="sheet-backdrop" id="sheet-backdrop"><section class="sheet" role="dialog" aria-modal="true">
        <div class="sheet-handle"></div><h2>${state.flags.wellBuilt ? '井戸' : '壊れた井戸'}</h2>
        <p>${state.flags.wellBuilt ? '修復された水場。発展度 +10。配置上限 1人。' : '長いあいだ放置されていた井戸。石材5で修復できます。'}</p>
        ${state.flags.wellBuilt ? `<p><span class="badge">タグ：水場</span></p>` : ''}
        ${joined ? `<div class="sheet-actions"><button class="primary-btn" id="assign-slamin" ${state.flags.slaminAssignedToWell ? 'disabled' : ''}>${state.flags.slaminAssignedToWell ? 'スラミン配置中' : 'スラミンを配置する'}</button><button class="secondary-btn" id="close-sheet">閉じる</button></div>` : '<div class="sheet-actions"><button class="secondary-btn" id="close-sheet">閉じる</button></div>'}
      </section></div>`;
    }
    if (overlay.type === 'shannon') {
      return `<div class="sheet-backdrop" id="sheet-backdrop"><section class="sheet" role="dialog" aria-modal="true"><div class="sheet-handle"></div><h2>シャノン</h2><p>${state.flags.wellBuilt ? '「井戸が直ると、ここも少し拠点らしく見えてきたね。」' : '「まずは井戸を直そう。石なら、この辺りの瓦礫から集められそうだよ。」'}</p><div class="sheet-actions"><button class="secondary-btn" id="close-sheet">閉じる</button></div></section></div>`;
    }
    if (overlay.type === 'slamin') {
      return `<div class="sheet-backdrop" id="sheet-backdrop"><section class="sheet" role="dialog" aria-modal="true"><div class="sheet-handle"></div><h2>スラミン</h2><p>スライム娘 / 得意：浄化<br>${state.flags.slaminAssignedToWell ? '「井戸、ぴかぴかにしておくね！」' : '「井戸のお掃除なら、わたしに任せて！」'}</p><div class="sheet-actions"><button class="secondary-btn" id="close-sheet">閉じる</button></div></section></div>`;
    }
    return '';
  }

  function bindGameEvents() {
    document.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => {
      state.currentTab = btn.dataset.tab;
      overlay = null;
      save(true);
      renderGame();
    }));

    document.getElementById('menu-btn')?.addEventListener('click', () => { overlay = { type:'menu' }; renderGame(); });
    document.getElementById('well-object')?.addEventListener('click', () => { overlay = { type:'well' }; renderGame(); });
    document.getElementById('shannon-object')?.addEventListener('click', () => { overlay = { type:'shannon' }; renderGame(); });
    document.getElementById('slamin-object')?.addEventListener('click', () => { overlay = { type:'slamin' }; renderGame(); });

    document.getElementById('gather-stone')?.addEventListener('click', () => {
      state.resources.stone += 5;
      state.flags.firstStoneGathered = true;
      advanceTime(1);
      toast('石材 +5');
      renderGame();
    });

    document.getElementById('gather-wood')?.addEventListener('click', () => {
      state.resources.wood += 5;
      advanceTime(1);
      toast('木材 +5');
      renderGame();
    });

    document.getElementById('rest-action')?.addEventListener('click', () => {
      advanceTime(1);
      toast('少し休みました');
      renderGame();
    });

    document.getElementById('sleep-action')?.addEventListener('click', () => {
      state.day += 1;
      state.timeIndex = 0;
      runTimeTriggers();
      save(true);
      toast(`${state.day}日目の朝になりました`);
      state.currentTab = 'base';
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
        state.stats.development += 10;
        state.currentTab = 'base';
        save(true);
        renderGame();
        toast('井戸を修復！ 発展度 +10');
      });
    });

    document.getElementById('slamin-event')?.addEventListener('click', () => {
      playDialogue(SLAMIN_EVENT, () => {
        state.flags.slaminEventReady = false;
        state.flags.slaminJoined = true;
        state.stats.liveliness += 10;
        save(true);
        state.currentTab = 'base';
        renderGame();
        toast('スラミンが仲間になりました！ 活気 +10');
      });
    });

    document.getElementById('assign-slamin')?.addEventListener('click', () => {
      if (!state.flags.slaminJoined || state.flags.slaminAssignedToWell) return;
      state.flags.slaminAssignedToWell = true;
      state.stats.cleanliness += 10;
      state.flags.sliceComplete = true;
      overlay = null;
      save(true);
      renderGame();
      toast('スラミンを井戸に配置。清潔度 +10');
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
