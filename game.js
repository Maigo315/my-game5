'use strict';
const SAVE_KEY='majo-explore-v01'; // v0.1セーブを自動移行するためキーは変更しない
const byName=Object.fromEntries(CHARACTERS.map(c=>[c.name,c]));
const STAGES=[
 {id:'grass',name:'草原 Easy',area:'草原',thresholds:[100,300,400,480,550],base:[150,12,2],mods:[1,1,1],tribes:['獣','ハーピー'],pool:[['スライム娘','犬娘','フェアリー'],['スライムベス娘','アルラウネ'],['ウサギ娘','ハーピー'],[],[]]},
 {id:'forest',name:'森林 Easy',area:'森林',thresholds:[250,450,550,650,720],base:[210,17,2],mods:[1,1,1.2],tribes:['植物','虫'],pool:[['スライム娘','マイコニド','モス娘'],['エルフ','フクロウ娘'],['シルフィ'],['ドリアード'],[]]},
 {id:'cave',name:'洞窟 Easy',area:'洞窟',thresholds:[280,490,600,700,790],base:[180,15,2],mods:[1,1.2,1],tribes:['スライム','悪魔'],pool:[['スライム娘','ゴブリン娘','ナメクジ娘'],['ワーバット','アラクネ'],['ゴーレム娘'],['デーモン'],[]]},
 {id:'ruins',name:'廃墟 Easy',area:'廃墟',thresholds:[320,530,650,760,860],base:[240,20,3],mods:[1.2,1,1],tribes:['物質','アンデッド'],pool:[['スライム娘','ロイド','ワーバット'],['ゴースト娘','妖狐'],['土偶娘'],['ヴァンパイア'],[]]},
 {id:'normal',name:'草原 Normal',area:'草原',thresholds:[550,750,950,1100,1250],base:[280,22,3],mods:[1,1,1],tribes:['獣','ハーピー'],pool:[['スライム娘','犬娘','フェアリー','スライムベス娘','アルラウネ','ウサギ娘','ハーピー'],[],[],[],[]],incomplete:true}
];
const GROW={
 '普通':{1:30,20:160,40:295,60:430,70:500,80:565,90:635,100:700},
 '早熟':{1:30,20:185,40:350,60:490,70:550,80:600,90:645,100:675},
 '超早熟':{1:30,20:220,40:390,60:530,70:570,80:610,90:635,100:650},
 '晩成':{1:30,20:125,40:235,60:405,70:555,80:630,90:690,100:725},
 '超晩成':{1:30,20:100,40:190,60:350,70:470,80:615,90:700,100:750}
};
let state,tab='home',selected='grass',modal=null,selectedUnit=null,detailReturn='units',returnScroll=0;
const $=id=>document.getElementById(id);
const now=()=>Date.now()+(state?.offset||0);
const fmt=t=>new Date(t).toLocaleString('ja-JP',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
const num=n=>Number(n||0).toLocaleString('ja-JP');
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const ch=id=>CHARACTERS.find(c=>c.id===id);
const get=id=>state.units.find(u=>u.uid===id);
const stg=id=>STAGES.find(s=>s.id===id);
function createUnit(name,ts){return {uid:'u'+(state.nextId++),cid:byName[name].id,level:1,cap:20,energy:byName[name].lv1[4],regenAt:ts,cooldowns:{}}}
function defaultState(){const ts=Date.now();state={version:2,offset:0,last:ts,nextId:1,units:[],party:[],resources:[0,0,0],tickets:0,exp:0,pending:[],rounds:0,explore:null,auto:true,stopAfter:false,stageUnlocked:['grass'],best:{},tutorial:true,history:[],abilityHistory:[]};state.units=['スライム娘','ゴブリン娘','マイコニド'].map(n=>createUnit(n,ts));state.party=state.units.map(u=>u.uid);return state}
function migrate(s){if(s?.version===2)return s;if(s?.version!==1||!Array.isArray(s.units)||!Array.isArray(s.pending))return null;
 s.version=2;s.resources[0]=Math.round(s.resources[0]*10);s.pending.forEach(e=>{e.reward[0]=Math.round(e.reward[0]*10)});
 s.tickets=0;s.abilityHistory=[];
 // 進行中だった探索は、残り時間を保持し、今回の1回だけ旧発動条件で精算する。
 if(s.explore){s.explore.legacyV01=true;s.explore.info ||= {};s.explore.info.rawTotals=[0,0,0];}
 s.history ||= [];s.history.unshift('v0.2に移行：強化の石の所持数と未受取分を10倍換算');return s;
}
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(state))}catch(e){alert('保存に失敗しました。設定からバックアップを書き出してください。')}}
function load(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY));state=migrate(s)||defaultState()}catch(e){defaultState()}selected='grass';sync();save()}
function log(t,ts=now()){state.history.unshift(`${fmt(ts)} ${t}`);state.history=state.history.slice(0,240)}
function abilityLog(t,ts=now()){state.abilityHistory.unshift(`${fmt(ts)} ${t}`);state.abilityHistory=state.abilityHistory.slice(0,120)}
function lerp(obj,L){const keys=Object.keys(obj).map(Number).sort((a,b)=>a-b);let lo=keys[0],hi=keys[keys.length-1];for(let i=0;i<keys.length-1;i++){if(L>=keys[i]&&L<=keys[i+1]){lo=keys[i];hi=keys[i+1];break}}return lo===hi?obj[lo]:obj[lo]+(obj[hi]-obj[lo])*(L-lo)/(hi-lo)}
function baseStats(u){const c=ch(u.cid),g=GROW[c.growth]||GROW['普通'],r=(lerp(g,u.level)-30)/(g[100]-30);return c.lv1.slice(0,3).map((x,i)=>Math.floor(x+(c.lv100[i]-x)*r+.5))}
function levelCost(level){return LEVEL_COSTS[level-1]||0}
function cumulative(level){return LEVEL_COSTS.slice(0,Math.max(0,level-1)).reduce((a,x)=>a+x,0)}
function playerLv(){let xp=state.exp,l=1;while(l<200){const need=Math.floor(100+12*l+.8*l*l);if(xp<need)return [l,xp,need];xp-=need;l++}return[l,xp,0]}
function members(){return state.party.map(get).filter(Boolean)}
function energyCandidates(party){return ABILITY_ENGINE.targetsForAlraune(party)}
function preview(stage,ts=now()){const people=members(),choices=energyCandidates(people);const plans=choices.map(uid=>ABILITY_ENGINE.evaluate(people,stage,ts,uid));const exemplar=plans[0]||ABILITY_ENGINE.evaluate([],stage,ts);return {...exemplar,canStart:plans.some(p=>p.canStart),variableCosts:choices.length>1,plans}}
function recover(u,to){if(state.explore?.ids.includes(u.uid))return;const max=ch(u.cid).lv1[4];if(u.energy>=max){u.regenAt=to;return}const ticks=Math.max(0,Math.floor((to-u.regenAt)/(15*60000)));if(ticks){u.energy=Math.min(max,u.energy+ticks);u.regenAt+=ticks*15*60000;if(u.energy>=max)u.regenAt=to}}
function begin(stage,ts,silent=false){if(state.tutorial||!state.stageUnlocked.includes(stage.id)||state.party.length!==4)return false;
 const people=members(),choices=energyCandidates(people),target=pick(choices),info=ABILITY_ENGINE.evaluate(people,stage,ts,target);
 if(!info.canStart)return false;
 people.forEach((u,i)=>{u.energy-=info.costs[i];u.regenAt=ts});
 state.explore={stageId:stage.id,started:ts,ends:ts+info.duration,info,ids:people.map(u=>u.uid),costs:info.costs};state.stopAfter=false;
 info.abilityLog.forEach(t=>abilityLog(t,ts));if(!silent)log(`${stage.name}へ出発。${info.ep}EP / ${duration(info.duration)} / 短縮${Math.round(info.shorten*100)}%`,ts);
 return true;
}
const randomAmount=value=>Math.floor(value)+(Math.random()<value%1?1:0);
const gradeName=g=>g<0?'D未満':['D','C','B','A','S'][g];
function endExplore(exp){const stage=stg(exp.stageId),info=exp.info,ts=exp.ends,grade=info.grade;
 state.explore=null;
 const great=Math.random()<info.rate,mult=[.5,1,1.2,1.4,1.7,2][grade+1]*(great?1.5:1);
 const reward=stage.base.map((v,i)=>randomAmount(v*mult*(i===0?Math.max(0,1+info.stoneMod):1)));
 const recruited=[];
 if(grade>=0){const pool=stage.pool.slice(0,grade+1).flat();if(pool.length){if(Math.random()<info.recruit)recruited.push(pick(pool));if(Math.random()<[0,.05,.1,.15,.2][grade])recruited.push(pick(pool))}}
 const people=exp.ids.map(get).filter(Boolean),result=ABILITY_ENGINE.recoverAtEnd(people,info,ts,great);
 const endNotes=[...(result.outcomes||[])];
 result.effects.forEach(e=>{const u=get(e.uid);if(u)endNotes.push(`${e.source} → ${people.indexOf(u)+1}番 ${ch(u.cid).name}：回復効果 +${e.amount}`)});
 for(const u of people){const before=result.energyBefore[u.uid],after=result.energyAfter[u.uid];if(result.effects.some(e=>e.uid===u.uid))endNotes.push(`${people.indexOf(u)+1}番 ${ch(u.cid).name}：実際の元気 ${before} → ${after}（上限反映後）`)}
 if(info.stoneMod)endNotes.push(`強化の石の獲得量補正：${signed(info.stoneMod*100)}%（基本資源報酬）`);

 let tickets=0;
 for(const u of people){if(ch(u.cid).name==='犬娘'){
  const r=Math.random();let item;if(r<.50){reward[1]++;item='拠点資材 +1'}else if(r<.90){reward[0]+=10;item='強化の石 +10'}else if(r<.98){reward[2]++;item='飛躍の石 +1'}else {tickets++;item='ご褒美チケット +1'}endNotes.push(`${people.indexOf(u)+1}番 犬娘：追加報酬 ${item}`);
 }}
 state.rounds++;state.pending.push({stage:stage.name,grade:gradeName(grade),great,reward,recruited,exp:120,ts,extra:tickets,endNotes});
 state.best[stage.id]=Math.max(state.best[stage.id]??-1,grade);
 if(stage.id==='grass'){if(grade>=2&&!state.stageUnlocked.includes('forest'))state.stageUnlocked.push('forest');if(grade>=4&&!state.stageUnlocked.includes('normal'))state.stageUnlocked.push('normal')}
 if(stage.id==='forest'&&grade>=2&&!state.stageUnlocked.includes('cave'))state.stageUnlocked.push('cave');
 if(stage.id==='cave'&&grade>=2&&!state.stageUnlocked.includes('ruins'))state.stageUnlocked.push('ruins');
 log(`${stage.name}：未受取報酬に追加`,ts);
 if(state.auto&&!state.stopAfter){if(!begin(stage,ts,true))log('元気不足のため自動周回停止',ts)}
 else if(state.stopAfter)log('停止予約により自動周回終了',ts);
 state.stopAfter=false;
}
function sync(){if(!state)return;const ts=now();if(ts<state.last){state.last=ts;return}let iterations=0;
 while(state.explore&&state.explore.ends<=ts&&iterations<50000){const exp=state.explore;for(const u of state.units)if(!exp.ids.includes(u.uid))recover(u,exp.ends);endExplore(exp);iterations++}
 for(const u of state.units)if(!state.explore?.ids.includes(u.uid))recover(u,ts);
 state.last=ts;save();
}
function tuto(){if(!state.tutorial)return;state.tutorial=false;state.pending.push({stage:'チュートリアル',grade:'特別',great:false,reward:[150,12,2],recruited:['犬娘'],exp:120,ts:now(),extra:0});log('チュートリアル完了。犬娘・固定報酬を受け取り待ちに追加');save();render()}
function reveal(){sync();if(!state.pending.length)return;const entries=state.pending.slice(),sum=[0,0,0],newNames=[];let xp=0,tickets=0;
 for(const e of entries){e.reward.forEach((v,i)=>sum[i]+=v);xp+=e.exp;newNames.push(...e.recruited);tickets+=e.extra||0}
 state.resources=state.resources.map((n,i)=>n+sum[i]);state.exp+=xp;state.tickets+=tickets;
 newNames.forEach(n=>{if(byName[n])state.units.push(createUnit(n,now()))});state.pending=[];
 for(const e of entries){for(const t of e.endNotes||[])abilityLog(t,e.ts)}
 log(`${entries.length}回分の報酬受取：${newNames.length}体加入`);save();modal={kind:'rewards',entries,sum,xp,newNames,tickets};render();
}
function levelUp(uid){sync();const u=get(uid);if(!u||u.level>=u.cap)return;const cost=levelCost(u.level);if(state.resources[0]<cost)return alert(`強化の石が${num(cost)}個必要です`);state.resources[0]-=cost;u.level++;save();render()}
function unlockCap(uid){sync();const u=get(uid);if(!u||u.cap>=100||u.level<u.cap)return;const costs={20:10,40:20,60:40,80:80},cost=costs[u.cap];if(state.resources[2]<cost)return alert(`飛躍の石が${cost}個必要です`);state.resources[2]-=cost;u.cap+=20;log(`${ch(u.cid).name}の上限をLv.${u.cap}に解放`);save();render()}
function assign(uid){sync();if(state.explore)return alert('探索中の編成変更はできません。終了後停止を予約してください。');const index=state.party.indexOf(uid);if(index>=0)state.party.splice(index,1);else if(state.party.length<4)state.party.push(uid);else return alert('現在の部隊は4人までです。先に1人外してください。');save();render()}
function duration(ms){const sec=Math.round(ms/1000);return `${Math.floor(sec/3600)}時間${String(Math.floor(sec%3600/60)).padStart(2,'0')}分${sec%60?' '+(sec%60)+'秒':''}`}
function img(c){return c?.image?`<img src="${esc(c.image)}" alt="${esc(c.name)}">`:'<div class="fallback">✦</div>'}
function member(u){if(!u)return '<div class="member"><div class="fallback">＋</div><span>空き枠</span></div>';const c=ch(u.cid);return `<div class="member">${img(c)}<span>${esc(c.name)}</span><span>Lv.${u.level}</span><span>元気${u.energy}/${c.lv1[4]}</span></div>`}
function partyHTML(){return `<div class="members">${[0,1,2,3].map(i=>member(get(state.party[i]))).join('')}</div>`}
function levelText(){const [l,x,need]=playerLv();return `プレイヤーLv.${l}（${num(x)}/${num(need)}EXP）`}
function home(){return `<section class="panel"><h2>🌼 探索隊</h2>${partyHTML()}<p class="muted">${levelText()}</p>${state.tutorial?`<div class="notice">初期3人でチュートリアル探索。即時完了・元気消費なし・犬娘が確定加入します。</div><button onclick="tuto()">チュートリアル探索を始める</button>`:`<div class="actions"><button onclick="go('explore')">探索に出発する</button><button class="secondary" onclick="go('party')">編成を変更</button></div>`}</section>
 <section class="panel"><h2>🎁 未受取報酬</h2><div class="big">${num(state.pending.length)} 回分</div><p class="muted">内容は受け取るまで秘密。探索中でも受け取れます。</p><button ${!state.pending.length?'disabled':''} onclick="reveal()">まとめて受け取る ✨</button></section>
 <section class="panel"><h2>🏡 拠点</h2><p class="small">司令室 Lv.1 / 施設と複数部隊は次の開発段階で実装予定</p></section>`}
function explore(){const stage=stg(selected),ts=now(),p=preview(stage,ts),busy=state.explore;
 return `<section class="panel"><h2>🗺️ 探索先</h2><div class="stages">${STAGES.map(s=>`<button class="stage ${s.id===selected?'active':''} ${state.stageUnlocked.includes(s.id)?'':'locked'}" onclick="selectStage('${s.id}')"><strong>${s.name}</strong><span>${state.stageUnlocked.includes(s.id)?`最高到達：${state.best[s.id]==null?'未挑戦':gradeName(state.best[s.id])}`:'🔒 未解放'}</span></button>`).join('')}</div>${stage.incomplete?'<div class="notice">草原Normalは新加入6種とボスが未実装のため暫定版です。</div>':''}</section>
 <section class="panel"><h2>${stage.name}</h2>${busy?'<p class="muted">以下は現在の元気・編成による次回探索の試算です。進行中の探索の確定値とは異なります。</p>':''}<div class="row"><div><div class="muted">実効EP</div><div class="big">${num(p.ep)}</div></div><div><div class="muted">予想到達度</div><div class="big">${gradeName(p.grade)}</div></div></div>
 <p class="small">必要EP D ${num(stage.thresholds[0])} / B ${num(stage.thresholds[2])} / S ${num(stage.thresholds[4])}</p>
 <p class="small">探索時間：<b>${duration(p.duration)}</b>（短縮${Math.round(p.shorten*100)}%）</p>
 <p class="small">大成功率：${Math.round(p.rate*100)}% / 基本勧誘率：${Math.round(p.recruit*100)}%</p>
 <div class="energy-list">${members().map((u,i)=>`<div>${esc(ch(u.cid).name)}：元気 ${u.energy} / 通常消費 ${p.basicCosts[i]}${p.extraCosts[i]?` ＋追加${p.extraCosts[i]}`:''}</div>`).join('')}</div>
 ${p.variableCosts?'<p class="muted">※アルラウネの元気軽減対象は出発時に抽選するため消費量が変わります。</p>':''}
 ${breakdown(stage,p,ts)}
 ${p.abilityLog.length?`<div class="notice">${p.abilityLog.map(esc).join('<br>')}</div>`:''}
 ${busy?`<div class="notice">${stg(busy.stageId).name}を探索中。終了予定 ${fmt(busy.ends)}<br>今回の確定EP ${num(busy.info.ep)} / 到達度 ${gradeName(busy.info.grade)} / 大成功率 ${decimal(busy.info.rate*100)}%<br>残り約 ${duration(Math.max(0,busy.ends-now()))}</div><div class="actions"><button class="secondary" onclick="setStop()">${state.stopAfter?'停止予約を解除':'探索終了後に停止'}</button></div>`:
 `<div class="actions"><button ${!p.canStart||!state.stageUnlocked.includes(stage.id)||state.tutorial?'disabled':''} onclick="dispatch()">探索開始</button><button class="secondary" onclick="toggleAuto()">自動周回：${state.auto?'ON':'OFF'}</button></div>${!p.canStart?'<p class="muted">4人編成か元気を確認してください。</p>':''}`}</section>`}
function party(){return `<section class="panel"><h2>🧭 第1部隊</h2>${partyHTML()}<p class="muted">現在は1部隊のみです。探索中は編成変更できません。</p></section><section class="panel"><h2>仲間たち（${num(state.units.length)}体）</h2><div class="charlist">${state.units.map(u=>{const c=ch(u.cid),is=state.party.includes(u.uid);return `<div class="char">${img(c)}<div class="grow"><b class="truncate">${esc(c.name)}</b><div class="muted">Lv.${u.level} / 元気 ${u.energy}</div><button class="${is?'secondary':''}" ${state.explore?'disabled':''} onclick="assign('${u.uid}')">${is?'編成解除':'編成する'}</button><button class="secondary" onclick="ability('${u.uid}')">詳細</button></div></div>`}).join('')}</div></section>`}
function unitsView(){return `<section class="panel roster-panel"><h2>🌱 魔物娘 <span class="muted">${num(state.units.length)}体</span></h2><p class="muted">魔物娘をタップして詳細・育成へ</p><div class="roster">${state.units.map(u=>{const c=ch(u.cid),ep=baseStats(u).reduce((a,b)=>a+b,0);return `<button class="roster-unit" onclick="ability('${u.uid}')" aria-label="${esc(c.name)} Lv.${u.level} 基本EP ${ep}"><div class="roster-art">${img(c)}</div><b>${esc(c.name)}</b><span>Lv.${u.level} <small>EP ${num(ep)}</small></span></button>`}).join('')}</div></section>`}
function unitDetail(){const u=get(selectedUnit);if(!u)return unitsView();const c=ch(u.cid),s=baseStats(u),cost=levelCost(u.level),capCost={20:10,40:20,60:40,80:80}[u.cap];return `<section class="panel unit-detail">
 <button class="back-link" onclick="backUnit()">‹ ${detailReturn==='party'?'編成に戻る':'魔物娘一覧に戻る'}</button>
 <div class="hero-title"><span class="eyebrow">${esc(c.tribe)}族 ・ ${esc(c.growth)}</span><h2>${esc(c.name)}</h2></div>
 <div class="portrait">${img(c)}<span class="portrait-level">Lv.${u.level} / ${u.cap}</span></div>
 <div class="detail-overview"><div><span class="muted">基本EP</span><strong>${num(s.reduce((a,b)=>a+b,0))}</strong></div><div><div class="row"><span class="muted">元気</span><b>${u.energy} / ${c.lv1[4]}</b></div><div class="meter"><i style="width:${100*u.energy/c.lv1[4]}%"></i></div></div></div>
 <div class="detail-stats">${['攻撃力','防御力','魔法力','幸運'].map((label,i)=>`<div><span>${label}</span><b>${num(i===3?c.lv1[3]:s[i])}</b></div>`).join('')}</div>
 <div class="training"><h3>育成</h3><button class="level-btn" ${u.level>=u.cap||state.resources[0]<cost?'disabled':''} onclick="levelUp('${u.uid}')">${u.level>=u.cap?'レベル上限に到達':`Lv.アップ　💎 ${num(cost)}`}</button>${u.level===u.cap&&u.cap<100?`<button class="secondary level-btn" ${state.resources[2]<capCost?'disabled':''} onclick="unlockCap('${u.uid}')">上限解放　✨ ${capCost}</button>`:''}<p class="muted">強化の石 所持 ${num(state.resources[0])}個</p></div>
 <h3 class="section-title">固有アビリティ</h3>${c.abilities.map((a,i)=>`<div class="ability-card"><b>固有 ${i+1}</b><p>${esc(c.name==='スライム娘'&&i===0?'探索終了時、自分と部隊内の自分以外のランダムな1人の元気を各10回復。':c.name==='犬娘'&&i===0?'探索終了時、追加報酬を抽選。拠点資材1（50%）、強化の石10（40%）、飛躍の石1（8%）、ご褒美チケット1（2%）。':a)}</p></div>`).join('')}</section>`}
function backUnit(){tab=detailReturn;selectedUnit=null;render();window.scrollTo(0,returnScroll)}
function signed(v){const n=Math.round(v*100)/100;return (n>=0?'+':'−')+num(Math.abs(n))}
function decimal(v){return num(Math.round(v*100)/100)}
function breakdown(stage,p,ts){const people=members(),rawSum=p.raw.flat().reduce((a,b)=>a+b,0),adjSum=p.adjusted.flat().reduce((a,b)=>a+b,0);let field=0,tribes=0,vamp=0;const rows=people.map((u,i)=>{const c=ch(u.cid),raw=p.raw[i],adj=p.adjusted[i],base=raw.reduce((a,b)=>a+b,0),after=adj.reduce((a,b)=>a+b,0),terrain=adj.reduce((a,v,k)=>a+v*stage.mods[k],0),race=terrain*(stage.tribes.includes(c.tribe)?1.1:1),ep=race*(c.name==='ヴァンパイア'?1.3:1);field+=terrain;tribes+=race;vamp+=ep;return `<div class="ep-person"><div class="row"><b>${i+1}番 ${esc(c.name)}</b><strong>${decimal(ep)} EP</strong></div><span class="muted">基本 ${base} → 能力補正後 ${decimal(after)} → 地形 ${decimal(terrain)} → 種族適性 ${decimal(race)}${c.name==='ヴァンパイア'?` → 固有EP ${decimal(ep)}`:''}</span><div class="muted">攻撃 ${raw[0]}→${decimal(adj[0])} / 防御 ${raw[1]}→${decimal(adj[1])} / 魔法 ${raw[2]}→${decimal(adj[2])}</div></div>`}).join('');
 const totalLines=[['基本EP合計',rawSum],['能力値補正',adjSum-rawSum],['地形補正',field-adjSum],['種族適性',tribes-field],['個別EP補正',vamp-tribes],['部隊EP補正',p.rawEp-vamp]];
 const statuses=ABILITY_ENGINE.statuses(people,stage,ts,p); // 計算例と同じ開始時刻を参照
 const statusGroups=people.map((u,i)=>`<div class="effect-group"><h3>${i+1}番 ${esc(ch(u.cid).name)}</h3>${statuses.filter(x=>x.uid===u.uid).map(x=>`<div class="effect-line"><div class="row"><b>固有${x.slot===1?'①':'②'}</b><span class="effect-state ${x.status===false?'inactive':''}">${x.status===true?'適用':x.status===false?'条件不成立':x.status==='end'?'終了時判定':'未実装'}</span></div><div>${esc(x.effect)}</div>${x.condition?`<small>${esc(x.condition)}</small>`:''}</div>`).join('')}</div>`).join('');
 return `<details class="ability-details" id="ability-breakdown"><summary>固有アビリティと計算内訳</summary><div class="calc-section"><h3>実効EPの内訳</h3>${totalLines.map(([k,v],i)=>`<div class="row"><span>${k}</span><b>${i?signed(v):decimal(v)}</b></div>`).join('')}<div class="row calc-total"><b>最終実効EP（切り捨て）</b><strong>${num(p.ep)}</strong></div><p class="muted">表示上の小数は2桁まで。内部計算は途中で丸めません。</p>${rows}</div><div class="calc-section"><h3>確率・探索時間</h3><div class="row"><span>大成功率：基本20%</span><b>${signed(p.rate*100-20)}ポイント → ${decimal(p.rate*100)}%</b></div><div class="row"><span>基本勧誘率：基本35%</span><b>${signed(p.recruit*100-35)}ポイント → ${decimal(p.recruit*100)}%</b></div><div class="row"><span>探索時間：120分</span><b>−${decimal(p.shorten*100)}% → ${duration(p.duration)}</b></div><div class="row"><span>強化の石報酬補正</span><b>${signed(p.stoneMod*100)}%</b></div>${p.grade<0?'<p class="muted">D未満では勧誘抽選なし。</p>':''}<p class="muted">確率は0〜100%、時間短縮は75%が上限です。</p></div><h3>各アビリティの条件・効果</h3>${statusGroups||'<p>編成されている魔物娘がいません。</p>'}</details>`}
function settings(){return `<section class="panel"><h2>🛠️ 開発用コントロール</h2><div class="notice">時刻を2時間単位で進めます。短縮探索はその間に複数回完了することがあります。</div><p class="small">ゲーム内時刻：${fmt(now())}</p><div class="actions"><button onclick="skip(1)">＋2時間</button><button onclick="skip(6)">＋12時間</button><button onclick="skip(12)">＋1日</button><button onclick="skip(84)">＋7日</button></div></section>
 <section class="panel"><h2>💾 セーブ管理</h2><p class="small">操作時に自動保存します。v0.1セーブは石と未受取石を10倍換算して移行します。</p><div class="actions"><button onclick="exportSave()">バックアップ書き出し</button><label class="secondary upload-label">読み込み <input type="file" accept=".json,application/json" onchange="importSave(event)"></label><button class="danger" onclick="resetGame()">初期化</button></div></section>
 <section class="panel"><h2>🧪 アビリティ発動ログ</h2><p class="muted">終了時の効果・追加報酬は受け取り後に記録されます（直近120件）。</p><div class="log">${state.abilityHistory.map(t=>`<div>${esc(t)}</div>`).join('')||'<p>まだ記録はありません</p>'}</div></section>
 <section class="panel"><h2>📜 開発ログ</h2><div class="log">${state.history.map(t=>`<div>${esc(t)}</div>`).join('')||'<p>まだ記録はありません</p>'}</div></section>
 <section class="panel"><h2>試作版の範囲</h2><p class="small">Easy24種の固有48枠は計算処理に反映済み。ただし草原Normalの追加キャラ・ボス、拠点施設、複数部隊、連続失敗勧誘保証などは未実装。端数処理・同率判定は仮ルールです。</p></section>`}
function render(){const scroll=window.scrollY||0,open=!!$('ability-breakdown')?.open,historyOpen=!!$('reward-history')?.open,dialogScroll=document.querySelector('.dialog')?.scrollTop||0;sync();const res=state.resources,content=tab==='home'?home():tab==='explore'?explore():tab==='party'?party():tab==='units'?unitsView():tab==='unit-detail'?unitDetail():settings();$('app').innerHTML=`<div class="app"><header class="top"><h1>🌿 魔物娘 放置探索</h1><div class="sub">プレイ可能な試作版 v0.2.1　${fmt(now())}</div><div class="res"><span class="pill">💎 強化の石 ${num(res[0])}</span><span class="pill">🪵 拠点資材 ${num(res[1])}</span><span class="pill">✨ 飛躍の石 ${num(res[2])}</span>${state.tickets?`<span class="pill">🎟 ご褒美チケット ${num(state.tickets)}</span>`:''}</div></header>${content}</div><nav class="footer"><div class="footinner">${[['home','🏠 ホーム'],['explore','🗺️ 探索'],['party','🧭 編成'],['units','🌱 魔物娘'],['settings','⚙️ 設定']].map(([id,title])=>`<button class="nav ${(id===tab||(tab==='unit-detail'&&id===detailReturn))?'on':''}" onclick="go('${id}')">${title}</button>`).join('')}</div></nav>${modal?modalHtml():''}`;if($('ability-breakdown'))$('ability-breakdown').open=open;if($('reward-history'))$('reward-history').open=historyOpen;const d=document.querySelector('.dialog');if(d)d.scrollTop=dialogScroll;window.scrollTo(0,scroll)}
function modalHtml(){const m=modal;
 return `<div class="modal"><div class="dialog"><h2>🎁 探索報酬を獲得！</h2><p>${num(m.entries.length)}回の探索結果を開封しました。</p><div class="reward-lines"><div>💎 強化の石 <b>＋${num(m.sum[0])}</b></div><div>🪵 拠点資材 <b>＋${num(m.sum[1])}</b></div><div>✨ 飛躍の石 <b>＋${num(m.sum[2])}</b></div><div>⭐ プレイヤーEXP <b>＋${num(m.xp)}</b></div>${m.tickets?`<div>🎟 ご褒美チケット <b>＋${num(m.tickets)}</b></div>`:''}</div><h3>新たな仲間：${num(m.newNames.length)}体</h3><div class="reveal">${m.newNames.map(n=>`<div>${img(byName[n])}<span>${esc(n)}</span></div>`).join('')||'<p class="muted">今回は加入なし</p>'}</div><details class="ability-details" id="reward-history"><summary>探索ごとの結果・アビリティ発動履歴</summary>${m.entries.map((e,i)=>`<div class="effect-group"><h3>${i+1}回目 ${esc(e.stage)} · ${esc(e.grade)}${e.great?' ★大成功':''}</h3><p class="muted">${fmt(e.ts)}</p>${(e.endNotes||[]).map(t=>`<div>${esc(t)}</div>`).join('')||'<div class="muted">終了時の記録なし（旧版の探索・チュートリアルを含む）</div>'}</div>`).join('')}</details><div class="actions"><button onclick="closeModal()">閉じる</button></div></div></div>`;
}
function closeModal(){modal=null;render()}
function ability(uid){detailReturn=tab==='party'?'party':'units';returnScroll=window.scrollY||0;selectedUnit=uid;tab='unit-detail';modal=null;render();window.scrollTo(0,0)}
function go(t){tab=t;modal=null;selectedUnit=null;render();window.scrollTo(0,0)}
function selectStage(id){selected=id;render()}
function dispatch(){sync();if(!begin(stg(selected),now()))alert('元気が不足しているか、編成・ステージ条件を満たしていません');save();render()}
function toggleAuto(){state.auto=!state.auto;save();render()}
function setStop(){state.stopAfter=!state.stopAfter;save();render()}
function skip(units){sync();state.offset+=units*2*3600000;sync();render()}
function exportSave(){sync();const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download=`majo-v021-save-${Date.now()}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function importSave(e){const f=e.target.files?.[0];if(!f)return;const reader=new FileReader();reader.onload=()=>{try{const incoming=migrate(JSON.parse(reader.result));if(!incoming)throw Error('非対応');if(!confirm('現在のセーブデータを上書きしますか？'))return;state=incoming;sync();save();render()}catch(err){alert('対応するセーブファイルではありません')}};reader.readAsText(f)}
function resetGame(){if(confirm('データを初期化します。元には戻せません。続けますか？')){defaultState();save();tab='home';modal=null;render()}}
load();render();setInterval(()=>{if(!modal&&document.visibilityState==='visible')render()},30000);
