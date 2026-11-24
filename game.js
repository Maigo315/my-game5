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
let state,activeTeam=0,tab='home',selected='grass',modal=null,selectedUnit=null,detailReturn='units',returnScroll=0;
const $=id=>document.getElementById(id);
const now=()=>Math.max(state?.last||0,Date.now()+(state?.offset||0));
const fmt=t=>new Date(t).toLocaleString('ja-JP',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
const num=n=>Number(n||0).toLocaleString('ja-JP');
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const ch=id=>CHARACTERS.find(c=>c.id===id);
const get=id=>state.units.find(u=>u.uid===id);
const stg=id=>STAGES.find(s=>s.id===id);
function createUnit(name,ts){return {uid:'u'+(state.nextId++),cid:byName[name].id,level:1,cap:20,energy:byName[name].lv1[4],regenAt:ts,regenProgress:0,cooldowns:{}}}
const TRIBES=['獣','ハーピー','植物','虫','スライム','悪魔','物質','アンデッド','神秘','水棲','有鱗','天使'];
const COMMAND=[null,null,{lv:2,cost:20,key:'supply'},{lv:7,cost:60,key:'front'},{lv:10,cost:100,key:'tavern'},{lv:14,cost:160,key:'monument'},{lv:18,cost:240,key:'training'}];
const FACILITY_COSTS={supply:[15,20,25,30,40,50,60,75,90,110,130,150,180,210,240,280,320,360,400],tavern:[20,25,30,40,50,60,75,95,110,140,160,190,225,260,300,350,400,450,500],monument:[20,25,30,40,50,60,75,95,110,140,160,190,225,260,300,350,400,450,500],training:[5,10,10,10,15,20,25,30,35,45,50,60,70,85,95,110,130,145,160]};
const facilityNames={command:'司令室',supply:'支給ボックス',front:'前線基地',tavern:'酒場',monument:'石碑',training:'訓練所'};
const makeBase=()=>({command:1,supply:0,front:0,tavern:0,monument:0,training:Object.fromEntries(TRIBES.map(t=>[t,0])),stock:[0,0]});
const makeTeam=(id)=>({id,party:[],pending:[],rounds:0,explore:null,auto:true,stopAfter:false,selected:'grass'});
const team=()=>state.teams[activeTeam]||state.teams[0];
const teamName=t=>`第${t.id}部隊`;
const owner=uid=>state.teams.find(t=>t.party.includes(uid));
const isExploring=uid=>state.teams.some(t=>t.explore?.ids.includes(uid));
const regenInterval=(lv=state.base.tavern)=>900000-300000*Math.max(0,lv-1)/19;
const monumentBonus=()=>.1*Math.max(0,state.base.monument-1)/19;
const trainingBonus=tribe=>.1*Math.max(0,(state.base.training[tribe]||0)-1)/19;
const supplyRates=(lv=state.base.supply)=>lv?[(1+9*(lv-1)/19)*10,1+9*(lv-1)/19]:[0,0];
function defaultState(){const ts=Date.now();activeTeam=0;selected='grass';state={version:3,offset:0,last:ts,nextId:1,units:[],teams:[makeTeam(1)],base:makeBase(),resources:[0,0,0],tickets:0,exp:0,rounds:0,stageUnlocked:['grass'],best:{},tutorial:true,history:[],abilityHistory:[]};state.units=['スライム娘','ゴブリン娘','マイコニド'].map(n=>createUnit(n,ts));state.teams[0].party=state.units.map(u=>u.uid);return state}
function migrate(s){if(!s||!Array.isArray(s.units)||!Array.isArray(s.resources))return null;if(s.version===3)return Array.isArray(s.teams)&&s.teams.length&&s.base?s:null;if(![1,2].includes(s.version)||!Array.isArray(s.pending))return null;
 if(s.version===1){s.resources[0]=Math.round(s.resources[0]*10);s.pending.forEach(e=>{e.reward[0]=Math.round(e.reward[0]*10)});s.tickets=0;s.abilityHistory=[];if(s.explore){s.explore.legacyV01=true;s.explore.info||={};s.explore.info.rawTotals=[0,0,0];}}
 s.history||=[];s.abilityHistory||=[];
 const t=makeTeam(1);for(const key of ['party','pending','rounds','explore','auto','stopAfter']){if(s[key]!==undefined)t[key]=s[key];if(key!=='rounds')delete s[key]}
 s.version=3;s.teams=[t];s.base=makeBase();s.history.unshift('v0.3に移行：旧部隊・未受取報酬を第1部隊へ引き継ぎ。拠点は司令室Lv.1から。');return s;
}
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(state))}catch(e){alert('保存に失敗しました。設定からバックアップを書き出してください。')}}
function load(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY));state=migrate(s)||defaultState()}catch(e){defaultState()}activeTeam=0;selected=team().selected||'grass';sync();save()}
function log(t,ts=now()){state.history.unshift(`${fmt(ts)} ${t}`);state.history=state.history.slice(0,240)}
function abilityLog(t,ts=now()){state.abilityHistory.unshift(`${fmt(ts)} ${t}`);state.abilityHistory=state.abilityHistory.slice(0,120)}
function lerp(obj,L){const keys=Object.keys(obj).map(Number).sort((a,b)=>a-b);let lo=keys[0],hi=keys[keys.length-1];for(let i=0;i<keys.length-1;i++){if(L>=keys[i]&&L<=keys[i+1]){lo=keys[i];hi=keys[i+1];break}}return lo===hi?obj[lo]:obj[lo]+(obj[hi]-obj[lo])*(L-lo)/(hi-lo)}
function baseStats(u){const c=ch(u.cid),g=GROW[c.growth]||GROW['普通'],r=(lerp(g,u.level)-30)/(g[100]-30);return c.lv1.slice(0,3).map((x,i)=>Math.floor(x+(c.lv100[i]-x)*r+.5))}
function levelCost(level){return LEVEL_COSTS[level-1]||0}
function cumulative(level){return LEVEL_COSTS.slice(0,Math.max(0,level-1)).reduce((a,x)=>a+x,0)}
function playerLv(){let xp=state.exp,l=1;while(l<200){const need=Math.floor(100+12*l+.8*l*l);if(xp<need)return [l,xp,need];xp-=need;l++}return[l,xp,0]}
function members(t=team()){return t.party.map(get).filter(Boolean)}
function energyCandidates(party){return ABILITY_ENGINE.targetsForAlraune(party)}
function evaluate(people,stage,ts,target){return ABILITY_ENGINE.evaluate(people,stage,ts,target,{monument:monumentBonus(),training:Object.fromEntries(TRIBES.map(t=>[t,trainingBonus(t)]))})}
function preview(stage,ts=now(),t=team()){const people=members(t),choices=energyCandidates(people);const plans=choices.map(uid=>evaluate(people,stage,ts,uid));const exemplar=plans[0]||evaluate([],stage,ts);return {...exemplar,canStart:plans.some(p=>p.canStart),variableCosts:choices.length>1,plans}}
function recover(u,to){if(isExploring(u.uid))return;const max=ch(u.cid).lv1[4];const interval=regenInterval();if(u.energy>=max){u.regenAt=to;u.regenProgress=0;return}const elapsed=Math.max(0,to-(u.regenAt??to));const progress=(u.regenProgress||0)+elapsed/interval;const ticks=Math.floor(progress+1e-10);u.energy=Math.min(max,u.energy+ticks);u.regenAt=to;u.regenProgress=u.energy>=max?0:Math.max(0,progress-ticks)}
function begin(stage,ts,silent=false,t=team()){if(!stage||t.explore||state.tutorial||!state.stageUnlocked.includes(stage.id)||t.party.length!==4)return false;
 const people=members(t);if(people.some(u=>isExploring(u.uid)))return false;const choices=energyCandidates(people),target=pick(choices),info=evaluate(people,stage,ts,target);
 if(!info.canStart)return false;
 people.forEach((u,i)=>{u.energy-=info.costs[i];u.regenAt=ts;u.regenProgress=0});
 t.explore={stageId:stage.id,started:ts,ends:ts+info.duration,info,ids:people.map(u=>u.uid),costs:info.costs};t.stopAfter=false;t.selected=stage.id;
 info.abilityLog.forEach(x=>abilityLog(`${teamName(t)}：${x}`,ts));if(!silent)log(`${teamName(t)}：${stage.name}へ出発。${info.ep}EP / ${duration(info.duration)} / 短縮${Math.round(info.shorten*100)}%`,ts);
 return true;
}
const randomAmount=value=>Math.floor(value)+(Math.random()<value%1?1:0);
const gradeName=g=>g<0?'D未満':['D','C','B','A','S'][g];
function endExplore(exp,t){const stage=stg(exp.stageId),info=exp.info,ts=exp.ends,grade=info.grade;
 t.explore=null;
 const great=Math.random()<info.rate,mult=[.5,1,1.2,1.4,1.7,2][grade+1]*(great?1.5:1);
 const reward=stage.base.map((v,i)=>randomAmount(v*mult*(i===0?Math.max(0,1+info.stoneMod):1)));
 const recruited=[];
 if(grade>=0){const pool=stage.pool.slice(0,grade+1).flat();if(pool.length){if(Math.random()<info.recruit)recruited.push(pick(pool));if(Math.random()<[0,.05,.1,.15,.2][grade])recruited.push(pick(pool))}}
 const people=exp.ids.map(get).filter(Boolean),result=ABILITY_ENGINE.recoverAtEnd(people,info,ts,great);
 people.forEach(u=>{u.regenProgress=0});
 const endNotes=[...(result.outcomes||[])];
 result.effects.forEach(e=>{const u=get(e.uid);if(u)endNotes.push(`${e.source} → ${people.indexOf(u)+1}番 ${ch(u.cid).name}：回復効果 +${e.amount}`)});
 for(const u of people){const before=result.energyBefore[u.uid],after=result.energyAfter[u.uid];if(result.effects.some(e=>e.uid===u.uid))endNotes.push(`${people.indexOf(u)+1}番 ${ch(u.cid).name}：実際の元気 ${before} → ${after}（上限反映後）`)}
 if(info.stoneMod)endNotes.push(`強化の石の獲得量補正：${signed(info.stoneMod*100)}%（基本資源報酬）`);

 let tickets=0;
 for(const u of people){if(ch(u.cid).name==='犬娘'){
  const r=Math.random();let item;if(r<.50){reward[1]++;item='拠点資材 +1'}else if(r<.90){reward[0]+=10;item='強化の石 +10'}else if(r<.98){reward[2]++;item='飛躍の石 +1'}else {tickets++;item='ご褒美チケット +1'}endNotes.push(`${people.indexOf(u)+1}番 犬娘：追加報酬 ${item}`);
 }}
 state.rounds++;t.rounds++;t.pending.push({teamId:t.id,stage:stage.name,grade:gradeName(grade),great,reward,recruited,exp:120,ts,extra:tickets,endNotes});
 state.best[stage.id]=Math.max(state.best[stage.id]??-1,grade);
 if(stage.id==='grass'){if(grade>=2&&!state.stageUnlocked.includes('forest'))state.stageUnlocked.push('forest');if(grade>=4&&!state.stageUnlocked.includes('normal'))state.stageUnlocked.push('normal')}
 if(stage.id==='forest'&&grade>=2&&!state.stageUnlocked.includes('cave'))state.stageUnlocked.push('cave');
 if(stage.id==='cave'&&grade>=2&&!state.stageUnlocked.includes('ruins'))state.stageUnlocked.push('ruins');
 log(`${teamName(t)}：${stage.name}：未受取報酬に追加`,ts);
 if(t.auto&&!t.stopAfter){if(!begin(stage,ts,true,t))log(`${teamName(t)}：元気不足のため自動周回停止`,ts)}
 else if(t.stopAfter)log(`${teamName(t)}：停止予約により自動周回終了`,ts);
 t.stopAfter=false;
}
function accrueSupply(to){const hours=Math.max(0,to-state.last)/3600000;const rates=supplyRates();state.base.stock=state.base.stock.map((x,i)=>x+hours*rates[i]);}
function sync(target=now()){if(!state)return;const ts=Math.max(state.last,target);
 // 全部隊の完了イベントを時刻順に処理。同時刻は部隊番号順。探索中は個体別の自然回復を停止。
 while(true){const next=state.teams.filter(t=>t.explore&&t.explore.ends<=ts).sort((a,b)=>a.explore.ends-b.explore.ends||a.id-b.id)[0];if(!next)break;const exp=next.explore;for(const u of state.units)recover(u,exp.ends);endExplore(exp,next)}
 for(const u of state.units)recover(u,ts);accrueSupply(ts);state.last=ts;save();
}
function tuto(){sync();if(!state.tutorial)return;state.tutorial=false;state.teams[0].pending.push({teamId:1,stage:'チュートリアル',grade:'特別',great:false,reward:[150,12,2],recruited:['犬娘'],exp:120,ts:now(),extra:0});log('チュートリアル完了。犬娘・固定報酬を受け取り待ちに追加');save();render()}
function pendingCount(){return state.teams.reduce((n,t)=>n+t.pending.length,0)}
function reveal(id=0){sync();const targets=state.teams.filter(t=>!id||t.id===id);const entries=targets.flatMap(t=>t.pending.map(e=>({...e,teamId:t.id}))).sort((a,b)=>a.ts-b.ts||a.teamId-b.teamId);if(!entries.length)return;const sum=[0,0,0],newNames=[];let xp=0,tickets=0;
 for(const e of entries){e.reward.forEach((v,i)=>sum[i]+=v);xp+=e.exp;newNames.push(...e.recruited);tickets+=e.extra||0}
 state.resources=state.resources.map((n,i)=>n+sum[i]);state.exp+=xp;state.tickets+=tickets;
 newNames.forEach(n=>{if(byName[n])state.units.push(createUnit(n,now()))});targets.forEach(t=>t.pending=[]);
 for(const e of entries){for(const x of e.endNotes||[])abilityLog(`第${e.teamId}部隊：${x}`,e.ts)}
 log(`${entries.length}回分の報酬受取：${newNames.length}体加入`);save();modal={kind:'rewards',entries,sum,xp,newNames,tickets};render();
}
function facilityUpgrade(key,tribe){const b=state.base;let lv=key==='training'?b.training[tribe]:b[key];if(key==='command'){if(lv>=6)return null;const next=COMMAND[lv+1];return {cost:next.cost,reason:playerLv()[0]<next.lv?`プレイヤーLv.${next.lv}が必要`:'',next:lv+1,unlock:next.key}}
 if(!lv||lv>=(key==='front'?3:20))return null;
 if(key==='front')return {cost:lv===1?160:1000,reason:lv===2&&b.command<6?'司令室Lv.6が必要':'',next:lv+1};
 if(!FACILITY_COSTS[key])return null;return {cost:FACILITY_COSTS[key][lv-1],reason:'',next:lv+1};
}
function upgradeFacility(key,tribe){sync();const u=facilityUpgrade(key,tribe);if(!u||u.reason||state.resources[1]<u.cost)return false;state.resources[1]-=u.cost;const b=state.base;
 if(key==='training')b.training[tribe]=u.next;else b[key]=u.next;
 if(u.unlock==='training')TRIBES.forEach(t=>b.training[t]=1);else if(u.unlock)b[u.unlock]=1;
 if(key==='front')state.teams.push(makeTeam(u.next));
 log(`${facilityNames[key]}${tribe?'（'+tribe+'族）':''} Lv.${u.next}に強化`+(u.unlock?' / '+facilityNames[u.unlock]+'解放':''));save();render();return true;
}
function collectSupply(){sync();if(!state.base.supply)return;const earned=state.base.stock.map(v=>Math.floor(v+1e-9));if(!earned.some(Boolean))return;earned.forEach((v,i)=>{state.resources[i]+=v;state.base.stock[i]=Math.max(0,state.base.stock[i]-v)});log(`支給ボックス受取：強化の石${num(earned[0])} / 拠点資材${num(earned[1])}`);save();modal={kind:'supply',sum:earned};render()}

function levelUp(uid){sync();const u=get(uid);if(!u||u.level>=u.cap)return;const cost=levelCost(u.level);if(state.resources[0]<cost)return alert(`強化の石が${num(cost)}個必要です`);state.resources[0]-=cost;u.level++;save();render()}
function unlockCap(uid){sync();const u=get(uid);if(!u||u.cap>=100||u.level<u.cap)return;const costs={20:10,40:20,60:40,80:80},cost=costs[u.cap];if(state.resources[2]<cost)return alert(`飛躍の石が${cost}個必要です`);state.resources[2]-=cost;u.cap+=20;log(`${ch(u.cid).name}の上限をLv.${u.cap}に解放`);save();render()}
function assign(uid){sync();const t=team(),u=get(uid);if(!u||t.explore||isExploring(uid))return;const index=t.party.indexOf(uid);if(index>=0)t.party.splice(index,1);else{if(t.party.length>=4)return alert('現在の部隊は4人までです。先に1人外してください。');const from=owner(uid);if(from)from.party=from.party.filter(x=>x!==uid);t.party.push(uid)}save();render()}

function duration(ms){const sec=Math.round(ms/1000);return `${Math.floor(sec/3600)}時間${String(Math.floor(sec%3600/60)).padStart(2,'0')}分${sec%60?' '+(sec%60)+'秒':''}`}
function img(c){return c?.image?`<img src="${esc(c.image)}" alt="${esc(c.name)}">`:'<div class="fallback">✦</div>'}
function member(u){if(!u)return '<div class="member"><div class="fallback">＋</div><span>空き枠</span></div>';const c=ch(u.cid);return `<div class="member">${img(c)}<span>${esc(c.name)}</span><span>Lv.${u.level}</span><span>元気${u.energy}/${c.lv1[4]}</span></div>`}
function partyHTML(t=team()){return `<div class="members">${[0,1,2,3].map(i=>member(get(t.party[i]))).join('')}</div>`}
function levelText(){const [l,x,need]=playerLv();return `プレイヤーLv.${l}（${num(x)}/${num(need)}EXP）`}
function teamTabs(){return `<div class="team-tabs" aria-label="部隊切替">${state.teams.map((t,i)=>`<button class="${activeTeam===i?'':'secondary'}" onclick="switchTeam(${i})">第${t.id}部隊<small>${t.explore?'探索中':'待機中'}</small></button>`).join('')}</div>`}
function switchTeam(i,dest){if(!state.teams[i])return;activeTeam=i;selected=team().selected||'grass';if(dest)tab=dest;render();window.scrollTo(0,0)}
function teamStatus(t){return t.explore?`${stg(t.explore.stageId).name} 探索中 / 残り ${duration(Math.max(0,t.explore.ends-now()))}`:t.party.length===4?'待機中':'待機中（編成 '+t.party.length+'/4）'}
function home(){return `<section class="panel"><div class="row"><h2>🌼 探索隊</h2><span class="muted">${state.teams.length} / 3部隊</span></div><p class="muted">${levelText()}</p>${state.tutorial?`<div class="notice">初期3人でチュートリアル探索。即時完了・元気消費なし・犬娘が確定加入します。</div><button onclick="tuto()">チュートリアル探索を始める</button>`:''}${state.teams.map((t,i)=>`<div class="team-card"><div class="row"><h3>${teamName(t)}</h3><span class="muted">自動周回 ${t.auto?'ON':'OFF'}${t.stopAfter?' / 停止予約中':''}</span></div>${partyHTML(t)}<p class="small">${teamStatus(t)}</p><div class="actions"><button onclick="switchTeam(${i},'explore')">${t.explore?'探索状況':'探索に出発する'}</button><button class="secondary" onclick="switchTeam(${i},'party')">編成</button></div><div class="row team-reward"><span>未受取 ${num(t.pending.length)}回分</span><button class="secondary" ${!t.pending.length?'disabled':''} onclick="reveal(${t.id})">受け取る</button></div></div>`).join('')}</section>
 <section class="panel"><h2>🎁 全部隊の未受取報酬</h2><div class="big">${num(pendingCount())} 回分</div><p class="muted">内容は受け取るまで秘密。探索中でも受け取れます。</p><button ${!pendingCount()?'disabled':''} onclick="reveal()">まとめて受け取る ✨</button></section>
 <section class="panel"><h2>🏡 拠点</h2><p class="small">司令室 Lv.${state.base.command} / ${state.teams.length}部隊運用可能</p>${state.base.supply?supplyClaimHTML():''}<button class="secondary" onclick="go('base')">拠点へ</button></section>`}

function explore(){const stage=stg(selected),ts=now(),p=preview(stage,ts),busy=team().explore;
 return `<section class="panel"><h2>🗺️ 探索先</h2>${teamTabs()}<div class="stages">${STAGES.map(s=>`<button class="stage ${s.id===selected?'active':''} ${state.stageUnlocked.includes(s.id)?'':'locked'}" onclick="selectStage('${s.id}')"><strong>${s.name}</strong><span>${state.stageUnlocked.includes(s.id)?`最高到達：${state.best[s.id]==null?'未挑戦':gradeName(state.best[s.id])}`:'🔒 未解放'}</span></button>`).join('')}</div>${stage.incomplete?'<div class="notice">草原Normalは新加入6種とボスが未実装のため暫定版です。</div>':''}</section>
 <section class="panel"><h2>${stage.name}</h2>${busy?'<p class="muted">以下は現在の元気・編成による次回探索の試算です。進行中の探索の確定値とは異なります。</p>':''}<div class="row"><div><div class="muted">実効EP</div><div class="big">${num(p.ep)}</div></div><div><div class="muted">予想到達度</div><div class="big">${gradeName(p.grade)}</div></div></div>
 <p class="small">必要EP D ${num(stage.thresholds[0])} / B ${num(stage.thresholds[2])} / S ${num(stage.thresholds[4])}</p>
 <p class="small">探索時間：<b>${duration(p.duration)}</b>（短縮${Math.round(p.shorten*100)}%）</p>
 <p class="small">大成功率：${Math.round(p.rate*100)}% / 基本勧誘率：${Math.round(p.recruit*100)}%</p>
 <div class="energy-list">${members().map((u,i)=>`<div>${esc(ch(u.cid).name)}：元気 ${u.energy} / 通常消費 ${p.basicCosts[i]}${p.extraCosts[i]?` ＋追加${p.extraCosts[i]}`:''}</div>`).join('')}</div>
 ${p.variableCosts?'<p class="muted">※アルラウネの元気軽減対象は出発時に抽選するため消費量が変わります。</p>':''}
 ${breakdown(stage,p,ts)}
 ${p.abilityLog.length?`<div class="notice">${p.abilityLog.map(esc).join('<br>')}</div>`:''}
 ${busy?`<div class="notice">${stg(busy.stageId).name}を探索中。終了予定 ${fmt(busy.ends)}<br>今回の確定EP ${num(busy.info.ep)} / 到達度 ${gradeName(busy.info.grade)} / 大成功率 ${decimal(busy.info.rate*100)}%<br>残り約 ${duration(Math.max(0,busy.ends-now()))}</div><div class="actions"><button class="secondary" onclick="setStop()">${team().stopAfter?'停止予約を解除':'探索終了後に停止'}</button></div>`:
 `<div class="actions"><button ${!p.canStart||!state.stageUnlocked.includes(stage.id)||state.tutorial?'disabled':''} onclick="dispatch()">探索開始</button><button class="secondary" onclick="toggleAuto()">自動周回：${team().auto?'ON':'OFF'}</button></div>${!p.canStart?'<p class="muted">4人編成か元気を確認してください。</p>':''}`}</section>`}
function party(){const t=team();return `<section class="panel"><h2>🧭 編成</h2>${teamTabs()}<h3>${teamName(t)}</h3>${partyHTML(t)}<p class="muted">探索中は編成変更できません。待機中の別部隊から選ぶと自動的に移動します。</p></section><section class="panel"><h2>仲間たち（${num(state.units.length)}体）</h2><div class="charlist">${state.units.map(u=>{const c=ch(u.cid),is=t.party.includes(u.uid),from=owner(u.uid),busy=isExploring(u.uid);return `<div class="char">${img(c)}<div class="grow"><b class="truncate">${esc(c.name)}</b><div class="muted">Lv.${u.level} / 元気 ${u.energy}</div><div class="muted">${from?teamName(from)+(busy?'・探索中':'・待機中'):'未編成'}</div><button class="${is?'secondary':''}" ${t.explore||busy?'disabled':''} onclick="assign('${u.uid}')">${is?'編成解除':from?'移動する':'編成する'}</button><button class="secondary" onclick="ability('${u.uid}')">詳細</button></div></div>`}).join('')}</div></section>`}

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
function breakdown(stage,p,ts){const people=members(),rawSum=p.raw.flat().reduce((a,b)=>a+b,0),adjSum=p.adjusted.flat().reduce((a,b)=>a+b,0);let field=0,tribes=0,trained=0,vamp=0;const rows=people.map((u,i)=>{const c=ch(u.cid),raw=p.raw[i],adj=p.adjusted[i],base=raw.reduce((a,b)=>a+b,0),after=adj.reduce((a,b)=>a+b,0),terrain=adj.reduce((a,v,k)=>a+v*stage.mods[k],0),race=terrain*(stage.tribes.includes(c.tribe)?1.1:1),train=race*(1+trainingBonus(c.tribe)),ep=train*(c.name==='ヴァンパイア'?1.3:1);field+=terrain;tribes+=race;trained+=train;vamp+=ep;return `<div class="ep-person"><div class="row"><b>${i+1}番 ${esc(c.name)}</b><strong>${decimal(ep)} EP</strong></div><span class="muted">基本 ${base} → 能力補正後 ${decimal(after)} → 地形 ${decimal(terrain)} → 種族適性 ${decimal(race)} → 訓練所 ${decimal(train)}${c.name==='ヴァンパイア'?` → 固有EP ${decimal(ep)}`:''}</span><div class="muted">攻撃 ${raw[0]}→${decimal(adj[0])} / 防御 ${raw[1]}→${decimal(adj[1])} / 魔法 ${raw[2]}→${decimal(adj[2])}</div></div>`}).join('');
 const totalLines=[['基本EP合計',rawSum],['能力値補正',adjSum-rawSum],['地形補正',field-adjSum],['種族適性',tribes-field],['訓練所補正',trained-tribes],['個別EP補正',vamp-trained],['部隊EP補正',p.rawEp-vamp]];
 const statuses=ABILITY_ENGINE.statuses(people,stage,ts,p); // 計算例と同じ開始時刻を参照
 const statusGroups=people.map((u,i)=>`<div class="effect-group"><h3>${i+1}番 ${esc(ch(u.cid).name)}</h3>${statuses.filter(x=>x.uid===u.uid).map(x=>`<div class="effect-line"><div class="row"><b>固有${x.slot===1?'①':'②'}</b><span class="effect-state ${x.status===false?'inactive':''}">${x.status===true?'適用':x.status===false?'条件不成立':x.status==='end'?'終了時判定':'未実装'}</span></div><div>${esc(x.effect)}</div>${x.condition?`<small>${esc(x.condition)}</small>`:''}</div>`).join('')}</div>`).join('');
 return `<details class="ability-details" id="ability-breakdown"><summary>固有アビリティと計算内訳</summary><div class="calc-section"><h3>実効EPの内訳</h3>${totalLines.map(([k,v],i)=>`<div class="row"><span>${k}</span><b>${i?signed(v):decimal(v)}</b></div>`).join('')}<div class="row calc-total"><b>最終実効EP（切り捨て）</b><strong>${num(p.ep)}</strong></div><p class="muted">表示上の小数は2桁まで。内部計算は途中で丸めません。</p>${rows}</div><div class="calc-section"><h3>確率・探索時間</h3><div class="row"><span>大成功率：基本20% / 石碑 ${signed(monumentBonus()*100)}ポイント</span><b>${decimal(p.rate*100)}%（固有込み）</b></div><div class="row"><span>基本勧誘率：基本35%</span><b>${signed(p.recruit*100-35)}ポイント → ${decimal(p.recruit*100)}%</b></div><div class="row"><span>探索時間：120分</span><b>−${decimal(p.shorten*100)}% → ${duration(p.duration)}</b></div><div class="row"><span>強化の石報酬補正</span><b>${signed(p.stoneMod*100)}%</b></div>${p.grade<0?'<p class="muted">D未満では勧誘抽選なし。</p>':''}<p class="muted">確率は0〜100%、時間短縮は75%が上限です。</p></div><h3>各アビリティの条件・効果</h3>${statusGroups||'<p>編成されている魔物娘がいません。</p>'}</details>`}
function supplyClaimHTML(){const stock=state.base.stock.map(v=>Math.floor(v+1e-9));return `<div class="supply-stock"><div class="row"><span>💎 強化の石</span><b>${num(stock[0])}</b></div><div class="row"><span>🪵 拠点資材</span><b>${num(stock[1])}</b></div><button class="secondary" ${!stock.some(Boolean)?'disabled':''} onclick="collectSupply()">支給品を受け取る</button></div>`}
function upgradeButton(key,tribe){const u=facilityUpgrade(key,tribe);if(!u)return '<p class="muted">最大レベル</p>';return `<div class="actions"><button ${u.reason||state.resources[1]<u.cost?'disabled':''} onclick="upgradeFacility('${key}'${tribe?`, '${tribe}'`:''})">Lv.${u.next}へ　🪵 ${num(u.cost)}</button></div>${u.reason?`<p class="muted">${u.reason}</p>`:state.resources[1]<u.cost?'<p class="muted">拠点資材が不足しています</p>':''}`}
function facilityEffect(key,lv){if(key==='supply'){const rates=supplyRates(lv);return `強化の石 ${decimal(rates[0])}個/時 ・ 拠点資材 ${decimal(rates[1])}個/時`}if(key==='front')return `${lv}部隊を運用可能`;if(key==='tavern')return `元気1回復：${duration(regenInterval(lv))}`;if(key==='monument')return `大成功率 +${decimal(10*(lv-1)/19)}ポイント`;return `実効EP +${decimal(10*(lv-1)/19)}%`}
function baseView(){const b=state.base,cmd=facilityUpgrade('command');return `<section class="panel"><h2>🏡 拠点</h2><p class="muted">${levelText()} / 強化は即時完了</p><div class="facility"><div class="row"><h3>🏛 司令室</h3><b>Lv.${b.command} / 6</b></div><p class="small">${cmd?`次の解放：${facilityNames[cmd.unlock]}`:'すべての施設を解放済み'}</p>${upgradeButton('command')}</div></section>${[['supply','📦',2],['front','⛺',3],['tavern','🍺',4],['monument','🪨',5]].map(([key,icon,req])=>{const lv=b[key],max=key==='front'?3:20;return `<section class="panel facility"><div class="row"><h2>${icon} ${facilityNames[key]}</h2><b>${lv?`Lv.${lv} / ${max}`:'🔒 未解放'}</b></div>${lv?`<p class="small">${facilityEffect(key,lv)}</p>${lv<max?`<p class="muted">次：${facilityEffect(key,lv+1)}</p>`:''}${key==='supply'?supplyClaimHTML():''}${upgradeButton(key)}`:`<p class="muted">司令室Lv.${req}で解放</p>`}</section>`}).join('')}<section class="panel facility"><div class="row"><h2>⚔ 訓練所</h2><b>${b.command>=6?'種族別':'🔒 未解放'}</b></div>${b.command<6?'<p class="muted">司令室Lv.6で解放</p>':`<p class="muted">対応種族の実効EPを強化。全部隊に適用されます。</p>${TRIBES.map(t=>{const lv=b.training[t];return `<div class="training-row"><div class="row"><b>${t}族</b><span>Lv.${lv} / 20</span></div><p class="small">${facilityEffect('training',lv)}${lv<20?' → '+facilityEffect('training',lv+1):''}</p>${upgradeButton('training',t)}</div>`}).join('')}`}</section>`}
function settings(){return `<section class="panel"><h2>🛠️ 開発用コントロール</h2><div class="notice">時刻を2時間単位で進めます。短縮探索はその間に複数回完了することがあります。</div><p class="small">ゲーム内時刻：${fmt(now())}</p><div class="actions"><button onclick="skip(1)">＋2時間</button><button onclick="skip(6)">＋12時間</button><button onclick="skip(12)">＋1日</button><button onclick="skip(84)">＋7日</button></div></section>
 <section class="panel"><h2>💾 セーブ管理</h2><p class="small">操作時に自動保存します。v0.1セーブは石と未受取石を10倍換算して移行します。</p><div class="actions"><button onclick="exportSave()">バックアップ書き出し</button><label class="secondary upload-label">読み込み <input type="file" accept=".json,application/json" onchange="importSave(event)"></label><button class="danger" onclick="resetGame()">初期化</button></div></section>
 <section class="panel"><h2>🧪 アビリティ発動ログ</h2><p class="muted">終了時の効果・追加報酬は受け取り後に記録されます（直近120件）。</p><div class="log">${state.abilityHistory.map(t=>`<div>${esc(t)}</div>`).join('')||'<p>まだ記録はありません</p>'}</div></section>
 <section class="panel"><h2>📜 開発ログ</h2><div class="log">${state.history.map(t=>`<div>${esc(t)}</div>`).join('')||'<p>まだ記録はありません</p>'}</div></section>
 <section class="panel"><h2>試作版の範囲</h2><p class="small">Easy24種の固有48枠は計算処理に反映済み。ただし草原Normalの追加キャラ・ボス、連続失敗勧誘保証、アイテム使用、カスタムアビリティは未実装。拠点費用・プレイヤーEXP曲線は暫定値です。端数処理・同率判定は仮ルールです。</p></section>`}
function render(){const scroll=window.scrollY||0,open=!!$('ability-breakdown')?.open,historyOpen=!!$('reward-history')?.open,dialogScroll=document.querySelector('.dialog')?.scrollTop||0;sync();const res=state.resources,content=tab==='home'?home():tab==='explore'?explore():tab==='party'?party():tab==='units'?unitsView():tab==='unit-detail'?unitDetail():tab==='base'?baseView():settings();$('app').innerHTML=`<div class="app"><header class="top"><h1>🌿 魔物娘 放置探索</h1><div class="sub">プレイ可能な試作版 v0.3　${fmt(now())}</div><div class="res"><span class="pill">💎 強化の石 ${num(res[0])}</span><span class="pill">🪵 拠点資材 ${num(res[1])}</span><span class="pill">✨ 飛躍の石 ${num(res[2])}</span>${state.tickets?`<span class="pill">🎟 ご褒美チケット ${num(state.tickets)}</span>`:''}</div></header>${content}</div><nav class="footer"><div class="footinner">${[['home','🏠 ホーム'],['explore','🗺️ 探索'],['party','🧭 編成'],['units','🌱 魔物娘'],['base','🏡 拠点'],['settings','⚙️ 設定']].map(([id,title])=>`<button class="nav ${(id===tab||(tab==='unit-detail'&&id===detailReturn))?'on':''}" onclick="go('${id}')">${title}</button>`).join('')}</div></nav>${modal?modalHtml():''}`;if($('ability-breakdown'))$('ability-breakdown').open=open;if($('reward-history'))$('reward-history').open=historyOpen;const d=document.querySelector('.dialog');if(d)d.scrollTop=dialogScroll;window.scrollTo(0,scroll)}
function modalHtml(){const m=modal;if(m.kind==='supply')return `<div class="modal"><div class="dialog"><h2>📦 支給品を受取</h2><div class="reward-lines"><div>💎 強化の石 <b>＋${num(m.sum[0])}</b></div><div>🪵 拠点資材 <b>＋${num(m.sum[1])}</b></div></div><button onclick="closeModal()">閉じる</button></div></div>`;
 return `<div class="modal"><div class="dialog"><h2>🎁 探索報酬を獲得！</h2><p>${num(m.entries.length)}回の探索結果を開封しました。</p><div class="reward-lines"><div>💎 強化の石 <b>＋${num(m.sum[0])}</b></div><div>🪵 拠点資材 <b>＋${num(m.sum[1])}</b></div><div>✨ 飛躍の石 <b>＋${num(m.sum[2])}</b></div><div>⭐ プレイヤーEXP <b>＋${num(m.xp)}</b></div>${m.tickets?`<div>🎟 ご褒美チケット <b>＋${num(m.tickets)}</b></div>`:''}</div><h3>新たな仲間：${num(m.newNames.length)}体</h3><div class="reveal">${m.newNames.map(n=>`<div>${img(byName[n])}<span>${esc(n)}</span></div>`).join('')||'<p class="muted">今回は加入なし</p>'}</div><details class="ability-details" id="reward-history"><summary>探索ごとの結果・アビリティ発動履歴</summary>${m.entries.map((e,i)=>`<div class="effect-group"><h3>${i+1}回目 第${e.teamId||1}部隊 ${esc(e.stage)} · ${esc(e.grade)}${e.great?' ★大成功':''}</h3><p class="muted">${fmt(e.ts)}</p>${(e.endNotes||[]).map(t=>`<div>${esc(t)}</div>`).join('')||'<div class="muted">終了時の記録なし（旧版の探索・チュートリアルを含む）</div>'}</div>`).join('')}</details><div class="actions"><button onclick="closeModal()">閉じる</button></div></div></div>`;
}
function closeModal(){modal=null;render()}
function ability(uid){detailReturn=tab==='party'?'party':'units';returnScroll=window.scrollY||0;selectedUnit=uid;tab='unit-detail';modal=null;render();window.scrollTo(0,0)}
function go(t){tab=t;modal=null;selectedUnit=null;render();window.scrollTo(0,0)}
function selectStage(id){selected=id;team().selected=id;save();render()}
function dispatch(){sync();if(!begin(stg(selected),now()))alert('元気が不足しているか、編成・ステージ条件を満たしていません');save();render()}
function toggleAuto(){sync();team().auto=!team().auto;save();render()}
function setStop(){sync();if(team().explore)team().stopAfter=!team().stopAfter;save();render()}
function skip(units){sync();state.offset+=units*2*3600000;sync();render()}
function exportSave(){sync();const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download=`majo-v03-save-${Date.now()}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function importSave(e){const f=e.target.files?.[0];if(!f)return;const reader=new FileReader();reader.onload=()=>{try{const incoming=migrate(JSON.parse(reader.result));if(!incoming)throw Error('非対応');if(!confirm('現在のセーブデータを上書きしますか？'))return;state=incoming;activeTeam=0;selected=team().selected||'grass';tab='home';modal=null;sync();save();render()}catch(err){alert('対応するセーブファイルではありません')}};reader.readAsText(f)}
function resetGame(){if(confirm('データを初期化します。元には戻せません。続けますか？')){defaultState();save();tab='home';modal=null;render()}}
load();render();setInterval(()=>{if(!modal&&document.visibilityState==='visible')render()},30000);
