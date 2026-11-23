'use strict';
const KEY='majo-explore-v01';
const byName=Object.fromEntries(CHARACTERS.map(c=>[c.name,c]));
const STAGES=[
 {id:'grass',name:'草原 Easy',area:'草原',thresholds:[100,300,400,480,550],base:[15,12,2],mods:[1,1,1],tribes:['獣','ハーピー'],pool:[['スライム娘','犬娘','フェアリー'],['スライムベス娘','アルラウネ'],['ウサギ娘','ハーピー'],[],[]]},
 {id:'forest',name:'森林 Easy',area:'森林',thresholds:[250,450,550,650,720],base:[21,17,2],mods:[1,1,1.2],tribes:['植物','虫'],pool:[['スライム娘','マイコニド','モス娘'],['エルフ','フクロウ娘'],['シルフィ'],['ドリアード'],[]]},
 {id:'cave',name:'洞窟 Easy',area:'洞窟',thresholds:[280,490,600,700,790],base:[18,15,2],mods:[1,1.2,1],tribes:['スライム','悪魔'],pool:[['スライム娘','ゴブリン娘','ナメクジ娘'],['ワーバット','アラクネ'],['ゴーレム娘'],['デーモン'],[]]},
 {id:'ruins',name:'廃墟 Easy',area:'廃墟',thresholds:[320,530,650,760,860],base:[24,20,3],mods:[1.2,1,1],tribes:['物質','アンデッド'],pool:[['スライム娘','ロイド','ワーバット'],['ゴースト娘','妖狐'],['土偶娘'],['ヴァンパイア'],[]]},
 {id:'normal',name:'草原 Normal',area:'草原',thresholds:[550,750,950,1100,1250],base:[28,22,3],mods:[1,1,1],tribes:['獣','ハーピー'],pool:[['スライム娘','犬娘','フェアリー','スライムベス娘','アルラウネ','ウサギ娘','ハーピー'],[],[],[],[]],incomplete:true}
];
const KNOT={1:30,20:160,40:295,60:430,70:500,80:565,90:635,100:700};
const EARLY={1:30,20:185,40:350,60:490,70:550,80:600,90:645,100:675};
const GROW={'普通':KNOT,'早熟':EARLY,'超早熟':{1:30,20:220,40:390,60:530,70:570,80:610,90:635,100:650},'晩成':{1:30,20:125,40:235,60:405,70:555,80:630,90:690,100:725},'超晩成':{1:30,20:100,40:190,60:350,70:470,80:615,90:700,100:750}};
const COST={1:0,10:20,20:100,30:350,40:900,50:2000,60:4400,70:12000,80:36000,90:160000,100:1000000};
let state,tab='home',selected='grass',modal=null;
const $=id=>document.getElementById(id);
const clock=()=>Date.now()+state.offset;
const fmt=t=>new Date(t).toLocaleString('ja-JP',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
const esc=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rand=(n)=>Math.floor(Math.random()*n);
const pick=a=>a[rand(a.length)];
const ch=id=>CHARACTERS.find(x=>x.id===id);
const get=id=>state.units.find(x=>x.uid===id);
const createUnit=(name,now)=>({uid:'u'+(state.nextId++),cid:byName[name].id,level:1,cap:20,energy:byName[name].lv1[4],regenAt:now,cooldowns:{}});
const def=()=>{let now=Date.now();state={version:1,offset:0,last:now,nextId:1,units:[],party:[],resources:[0,0,0],exp:0,pending:[],rounds:0,explore:null,auto:true,stopAfter:false,stageUnlocked:['grass'],best:{},tutorial:true,history:[]};state.units=['スライム娘','ゴブリン娘','マイコニド'].map(n=>createUnit(n,now));state.party=state.units.map(x=>x.uid);return state};
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){alert('保存に失敗しました。バックアップを書き出してください。')}}
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));state=s&&s.version===1?s:def()}catch(e){def()}selected='grass';sync();save()}
function log(t){state.history.unshift(`${fmt(clock())} ${t}`);state.history=state.history.slice(0,150)}
function lerp(obj,L){const keys=Object.keys(obj).map(Number).sort((a,b)=>a-b);let lo=keys[0],hi=keys[keys.length-1];for(let i=0;i<keys.length-1;i++){if(L>=keys[i]&&L<=keys[i+1]){lo=keys[i];hi=keys[i+1];break}}return lo===hi?obj[lo]:obj[lo]+(obj[hi]-obj[lo])*(L-lo)/(hi-lo)}
function baseStats(u){const c=ch(u.cid),r=(lerp(GROW[c.growth]||KNOT,u.level)-30)/((GROW[c.growth]||KNOT)[100]-30);return c.lv1.slice(0,3).map((v,i)=>Math.floor(v+(c.lv100[i]-v)*r+0.5))}
function cumCost(l){return Math.round(lerp(COST,l))}
function playerLv(){let xp=state.exp,l=1;while(xp>=Math.floor(100+12*l+.8*l*l)&&l<200){xp-=Math.floor(100+12*l+.8*l*l);l++}return [l,xp,Math.floor(100+12*l+.8*l*l)]}
function active(){return state.party.map(get).filter(Boolean)}
function stage(id){return STAGES.find(s=>s.id===id)}
function snapshot(st){let units=active(),raw=units.map(u=>baseStats(u));let totals=[0,0,0];raw.forEach(a=>a.forEach((v,i)=>totals[i]+=v));const count=n=>units.filter(u=>ch(u.cid).name===n).length;let allDefense=units.filter(u=>['マイコニド','アラクネ','ゴーレム娘','土偶娘'].includes(ch(u.cid).name));let sum=0;
 for(let j=0;j<units.length;j++){
  const u=units[j],c=ch(u.cid),v=raw[j].slice(),n=c.name;let mods=[0,0,0],fixed=[0,0,0];
  if(count('マイコニド'))mods[1]+=.05*count('マイコニド');
  if(count('アラクネ')&&c.tribe==='虫')mods[1]+=.05*count('アラクネ');
  if(count('ゴーレム娘')&&c.tribe==='物質')mods[1]+=.05*count('ゴーレム娘');
  if(count('土偶娘')&&['物質','アンデッド'].includes(c.tribe))mods[1]+=.05*count('土偶娘');
  if(count('アルラウネ'))mods[0]-=.05*count('アルラウネ');
  if(n==='ゴブリン娘'&&v[0]===Math.max(...raw.map(x=>x[0])))mods[0]+=.1;
  if(n==='犬娘')fixed[0]+=new Set(units.map(x=>ch(x.cid).tribe)).size;
  if(n==='スライムベス娘')mods[0]+=.05*units.filter(x=>ch(x.cid).tribe==='スライム').length;
  if(n==='ワーバット'&&st.area==='洞窟')mods[2]+=.5;
  if(n==='ワーバット'&&units.some(x=>ch(x.cid).tribe==='アンデッド'))mods[2]+=.2;
  if(n==='ゴーレム娘'&&j===0)mods[1]+=.1;
  if(n==='ナメクジ娘'&&u.energy===100)mods[1]+=.3;
  if(n==='ドリアード'&&st.area==='森林'&&c.tribe==='植物')mods[2]+=.2;
  if(count('ドリアード')&&st.area==='森林'&&c.tribe==='植物')mods[2]+=.2*(count('ドリアード')-(n==='ドリアード'?1:0));
  if(n==='フクロウ娘'&&u.energy<=50)mods=mods.map(x=>x+.1);
  if(n==='フクロウ娘'){let hr=new Date(clock()).getHours();if(hr>=18||hr<6)mods=mods.map(x=>x+.1)}
  if(n==='ヴァンパイア'){};
  const vals=v.map((x,k)=>(x+fixed[k])*(1+mods[k]));let ep=vals.reduce((a,x,k)=>a+x*st.mods[k],0)*(st.tribes.includes(c.tribe)?1.1:1);
  if(n==='ヴァンパイア')ep*=1.3;
  sum+=ep;
 }
 if(units.length&&ch(units[0].cid).name==='土偶娘')sum*=.9;
 let rate=.2,shorten=0,recruit=.35,stoneMod=0;
 for(let i=0;i<units.length;i++){
  const u=units[i],n=ch(u.cid).name;
  if(n==='スライム娘'){const e=units.reduce((a,x)=>a+x.energy,0);if(e>=300)rate+=.1;if(e>=400)rate+=.1}
  if(n==='フェアリー')rate+=units.filter(x=>ch(x.cid).tribe==='神秘').length*.04;
  if(n==='ウサギ娘')recruit+=.05;
  if(n==='ゴブリン娘')stoneMod+=.05;
  if(n==='妖狐'){if(i===0){recruit+=.10;stoneMod-=.10}if(new Set(units.map(x=>ch(x.cid).tribe)).size===4||units.every(x=>ch(x.cid).name==='妖狐'))rate+=.10}
  if(n==='ドリアード'&&st.area==='森林')rate+=.20;
  if(n==='土偶娘'&&i===0)rate+=.15;
  if(n==='ハーピー'){shorten+=.1;if(u.energy>=50)shorten+=.1}
  if(n==='シルフィ')shorten+=.1;
  if(n==='アラクネ')shorten+=.15;
  if(n==='ゴースト娘'){shorten+=.15;if(i===0){shorten+=.15;recruit-=.10}}
  if(n==='エルフ'&&totals[0]>totals[1]&&totals[0]>totals[2])shorten+=.1;
  if(n==='スライムベス娘'&&totals[0]>totals[1]&&totals[0]>totals[2])rate+=.1;
 }
 let grade=-1;st.thresholds.forEach((t,i)=>{if(sum>=t)grade=i});
 return {ep:Math.floor(sum),grade,rate:Math.max(0,Math.min(1,rate)),recruit:Math.max(0,Math.min(1,recruit)),stoneMod,shorten:Math.min(.75,shorten),duration:120*60000*(1-Math.min(.75,shorten))};
}
function energyCosts(st){let units=active();const a=units.filter(u=>ch(u.cid).name==='アラクネ').length,g=units.filter(u=>ch(u.cid).name==='ゴースト娘').length,v=units.filter(u=>ch(u.cid).name==='ヴァンパイア').length;let lvlmin=Math.min(...units.map(u=>u.level));let eligible=units.filter(u=>u.level===lvlmin);const selectedAl=units.some(u=>ch(u.cid).name==='アルラウネ')?pick(eligible):null;
 return units.map(u=>{const n=ch(u.cid).name;let c=Math.ceil(Math.max(0,20*(1+a*.1+g*.2+(n==='ヴァンパイア'?1:0))-(n==='マイコニド'&&['森林','洞窟'].includes(st.area)?10:0)-(selectedAl?.uid===u.uid?10:0)));return c})}
function recover(u,to){if(state.explore&&state.party.includes(u.uid))return;const c=ch(u.cid),max=c.lv1[4];if(u.energy>=max){u.regenAt=to;return}let period=15*60000;let ticks=Math.floor((to-u.regenAt)/period);if(ticks>0){u.energy=Math.min(max,u.energy+ticks);u.regenAt+=(ticks*period);if(u.energy>=max)u.regenAt=to}}
function canStart(st,ts){if(state.tutorial)return false;if(state.party.length!==4)return false;if(!state.stageUnlocked.includes(st.id))return false;const costs=energyCosts(st);return active().every((u,i)=>u.energy>=costs[i])}
function begin(st,ts,silent=false){if(state.tutorial||state.party.length!==4||!state.stageUnlocked.includes(st.id))return false;let info=snapshot(st),units=active(),costs=energyCosts(st);if(!units.every((u,i)=>u.energy>=costs[i]))return false;units.forEach((u,i)=>{u.energy-=costs[i];u.regenAt=ts});
 // Extra ability cost: Silphy buffs the front unit only if the cost is payable, otherwise no buff. Its EP impact is marked provisional in v0.1.
 let hasSilphy=units.some(u=>ch(u.cid).name==='シルフィ');if(hasSilphy){let extra=units.some(u=>ch(u.cid).name==='モス娘')?10:20;if(units[0].energy>=extra){units[0].energy-=extra;info.ep=Math.floor(info.ep*1.02);info.grade=-1;st.thresholds.forEach((t,i)=>{if(info.ep>=t)info.grade=i})}}
 state.explore={stageId:st.id,started:ts,ends:ts+info.duration,info,ids:units.map(u=>u.uid),costs};state.stopAfter=false;if(!silent)log(`${st.name}へ出発`);return true}
function randomAmount(n){let floor=Math.floor(n);return floor+(Math.random()<n-floor?1:0)}
function gradeName(n){return n<0?'D未満':['D','C','B','A','S'][n]}
function endExplore(exp){const st=stage(exp.stageId),info=exp.info,ts=exp.ends,grade=info.grade;state.explore=null;
 const great=Math.random()<info.rate, mult=[.5,1,1.2,1.4,1.7,2][grade+1]*(great?1.5:1),reward=st.base.map((n,i)=>randomAmount(n*mult*(i===0?Math.max(0,1+info.stoneMod):1)));
 let recruited=[];if(grade>=0){const pool=st.pool.slice(0,grade+1).flat();if(Math.random()<info.recruit)recruited.push(pick(pool));if(Math.random()<[0,.05,.1,.15,.2][grade])recruited.push(pick(pool));}
 const members=exp.ids.map(get).filter(Boolean);const name=u=>ch(u.cid).name;
 // Ability recovery is evaluated against the same post-exploration energy snapshot.
 let effects=[];const add=(uid,v)=>effects.push({uid,v});
 for(const u of members){let n=name(u);if(n==='スライム娘'){add(u.uid,10);const other=members.filter(x=>x.uid!==u.uid);if(other.length)add(pick(other).uid,10)}
 if(n==='アルラウネ')members.forEach(x=>add(x.uid,5));
 if(n==='ナメクジ娘'&&Math.random()<.5)add(u.uid,20);
 if(n==='ヴァンパイア'&&great)add(u.uid,20);
 if(n==='エルフ'){const totals=[0,0,0];members.forEach(x=>baseStats(x).forEach((v,i)=>totals[i]+=v));if(totals[2]>totals[0]&&totals[2]>totals[1])add(u.uid,10)}
 if(n==='フェアリー'){const opts=members.filter(x=>x.uid!==u.uid&&x.energy<=20);if(opts.length)add(pick(opts).uid,50)}
 if(n==='デーモン'){const opts=members.filter(x=>x.energy===0);if(opts.length)add(pick(opts).uid,20)}
 if(n==='ロイド'){
  if(!u.cooldowns.a||ts-u.cooldowns.a>=12*3600000){members.forEach(x=>add(x.uid,10));u.cooldowns.a=ts}
  if(u.energy<=50&&(!u.cooldowns.b||ts-u.cooldowns.b>=12*3600000)){add(u.uid,20);u.cooldowns.b=ts}
 }
 if(n==='犬娘'){const r=Math.random(),idx=r<.5?1:r<.9?0:r<.98?2:3;if(idx===3)reward.push('ご褒美チケット');else reward[idx]++}
 }
 for(const effect of effects){let u=get(effect.uid);u.energy=Math.min(ch(u.cid).lv1[4],u.energy+effect.v)}
 members.forEach(u=>u.regenAt=ts);
 state.rounds++;state.pending.push({stage:st.name,grade:gradeName(grade),great,reward:reward.slice(0,3),recruited,exp:120,ts,extra:reward.includes('ご褒美チケット')?1:0});
 if(grade>=2){const prev=state.best[st.id]??-1;state.best[st.id]=Math.max(prev,grade)}
 if(st.id==='grass'){if(grade>=2&&!state.stageUnlocked.includes('forest'))state.stageUnlocked.push('forest');if(grade>=4&&!state.stageUnlocked.includes('normal'))state.stageUnlocked.push('normal')}
 if(st.id==='forest'&&grade>=2&&!state.stageUnlocked.includes('cave'))state.stageUnlocked.push('cave');
 if(st.id==='cave'&&grade>=2&&!state.stageUnlocked.includes('ruins'))state.stageUnlocked.push('ruins');
 log(`${st.name} ${gradeName(grade)} ${great?'★大成功':''}：未受取に追加`);
 if(state.auto&&!state.stopAfter&&canStart(st,ts)){begin(st,ts,true)}else{if(state.stopAfter)log('停止予約により周回終了');else if(state.auto)log('元気不足で自動周回停止');state.stopAfter=false}
}
function sync(){if(!state)return;let now=clock();if(now<state.last){state.last=now;return}let count=0;
 while(state.explore&&state.explore.ends<=now&&count<10000){const e=state.explore;for(const u of state.units){if(!e.ids.includes(u.uid))recover(u,e.ends)}endExplore(e);count++}
 for(const u of state.units)if(!state.explore||!state.explore.ids.includes(u.uid))recover(u,now);
 state.last=now;save()}
function tuto(){if(!state.tutorial)return;state.tutorial=false;state.pending.push({stage:'チュートリアル',grade:'特別',great:false,reward:[15,12,2],recruited:['犬娘'],exp:120,ts:clock(),extra:0});log('初回探索完了。犬娘と固定報酬を獲得（受け取り待ち）');save();render()}
function reveal(){sync();if(!state.pending.length)return;const entries=state.pending.slice(),sum=[0,0,0];let xp=0,newUnits=[],tickets=0;for(const e of entries){e.reward.forEach((v,i)=>sum[i]+=v);xp+=e.exp;tickets+=e.extra||0;newUnits.push(...e.recruited)}
 state.resources=state.resources.map((v,i)=>v+sum[i]);state.exp+=xp;newUnits.forEach(n=>state.units.push(createUnit(n,clock())));state.pending=[];log(`${entries.length}回分の報酬受け取り：${newUnits.length}体加入`);save();modal={entries,sum,xp,newUnits,tickets};render()}
function levelUp(uid){sync();let u=get(uid);if(!u||u.level>=u.cap)return;let cost=cumCost(u.level+1)-cumCost(u.level);if(state.resources[0]<cost)return alert(`強化の石が${cost}必要です`);state.resources[0]-=cost;u.level++;save();render()}
function assign(uid){sync();if(state.explore)return alert('探索中の編成変更はできません。終了後停止を予約してください。');let i=state.party.indexOf(uid);if(i>=0)state.party.splice(i,1);else if(state.party.length<4)state.party.push(uid);else return alert('部隊は4人までです。先に1人外してください。');save();render()}
function formatDuration(ms){const m=Math.ceil(ms/60000);return `${Math.floor(m/60)}時間${String(m%60).padStart(2,'0')}分`}
function img(c){return c.image?`<img src="${c.image}" alt="${esc(c.name)}">`:`<div class="fallback">✦</div>`}
function member(u){let c=ch(u.cid);return `<div class="member">${img(c)}<span>${esc(c.name)}</span><span>Lv.${u.level}</span><span>元気${u.energy}/${c.lv1[4]}</span></div>`}
function partyHTML(){return `<div class="members">${[0,1,2,3].map(i=>state.party[i]?member(get(state.party[i])):'<div class="member"><div class="fallback">＋</div><span>空き枠</span></div>').join('')}</div>`}
function levelText(){const [l,x,need]=playerLv();return `プレイヤーLv.${l}（${x}/${need}EXP）`}
function home(){return `<section class="panel"><h2>🌼 探索隊</h2>${partyHTML()}<p class="muted">${levelText()}</p>${state.tutorial?`<div class="notice">最初の3人でチュートリアル探索へ。即時完了・元気消費なし・犬娘が確定加入します。</div><button onclick="tuto()">チュートリアル探索を始める</button>`:`<div class="actions"><button onclick="go('explore')">探索に出発する</button><button class="secondary" onclick="go('party')">編成を変更</button></div>`}</section>
 <section class="panel"><h2>🎁 未受取報酬</h2><div class="big">${state.pending.length} 回分</div><p class="muted">中身は受け取るまで秘密です。探索中でも受け取れます。</p><button ${!state.pending.length?'disabled':''} onclick="reveal()">まとめて受け取る ✨</button></section>
 <section class="panel"><h2>🏡 拠点</h2><p class="small">司令室 Lv.1 / 支給ボックスほかは次の開発段階で実装予定</p></section>`}
function explore(){let st=stage(selected),info=snapshot(st),cost=energyCosts(st),busy=state.explore;return `<section class="panel"><h2>🗺️ 探索先</h2><div class="stages">${STAGES.map(s=>`<button class="stage ${s.id===selected?'active':''} ${state.stageUnlocked.includes(s.id)?'':'locked'}" onclick="selectStage('${s.id}')"><strong>${s.name}</strong><span>${state.stageUnlocked.includes(s.id)?`最高到達：${gradeName(state.best[s.id]??-1)}`:'🔒 未解放'}</span></button>`).join('')}</div>${st.incomplete?'<div class="notice">草原Normalは新登場キャラ・ボスが未実装のため、現時点では検証用の暫定版です。</div>':''}</section>
 <section class="panel"><h2>${st.name}</h2><div class="row"><div><div class="muted">実効EP</div><div class="big">${info.ep}</div></div><div><div class="muted">予想到達度</div><div class="big">${gradeName(info.grade)}</div></div></div><p class="small">必要EP D ${st.thresholds[0]} / B ${st.thresholds[2]} / S ${st.thresholds[4]}</p><p class="small">探索時間：${formatDuration(info.duration)}　大成功率：${Math.round(info.rate*100)}%</p><p class="muted">${active().map((u,i)=>`${ch(u.cid).name}：消費${cost[i]}`).join(' / ')}</p>
 ${busy?`<div class="notice">${stage(busy.stageId).name}を探索中。終了予定 ${fmt(busy.ends)}<br>終了まで約 ${formatDuration(Math.max(0,busy.ends-clock()))}</div><div class="actions"><button class="secondary" onclick="setStop()">${state.stopAfter?'停止予約を解除':'探索終了後に停止'}</button></div>`:`<div class="actions"><button ${!canStart(st,clock())?'disabled':''} onclick="dispatch()">探索開始</button><button class="secondary" onclick="toggleAuto()">自動周回：${state.auto?'ON':'OFF'}</button></div>${!canStart(st,clock())?'<p class="muted">4人編成・元気・解放条件を確認してください。</p>':''}`}</section>`}
function party(){return `<section class="panel"><h2>🧭 第1部隊</h2>${partyHTML()}<p class="muted">現在は1部隊のみ。複数部隊は次の開発段階で追加します。</p></section><section class="panel"><h2>仲間たち（${state.units.length}体）</h2><div class="charlist">${state.units.map(u=>{const c=ch(u.cid),is=state.party.includes(u.uid);return `<div class="char">${img(c)}<div class="grow"><div class="truncate"><b>${esc(c.name)}</b></div><div class="muted">Lv.${u.level} / 元気 ${u.energy}</div><button class="${is?'secondary':''}" ${state.explore?'disabled':''} onclick="assign('${u.uid}')">${is?'編成解除':'編成する'}</button></div></div>`}).join('')}</div></section>`}
function unitsView(){return `<section class="panel"><h2>🌱 魔物娘の育成</h2><p class="muted">強化の石でレベルアップ。上限解放は後続版で追加します。</p><div class="charlist">${state.units.map(u=>{let c=ch(u.cid),stats=baseStats(u),cost=cumCost(u.level+1)-cumCost(u.level);return `<div class="char">${img(c)}<div class="grow"><div class="truncate"><b>${esc(c.name)}</b></div><div class="muted">Lv.${u.level}/${u.cap} ${esc(c.growth)}</div><div class="muted">攻${stats[0]} 防${stats[1]} 魔${stats[2]}</div><button ${u.level>=u.cap||state.resources[0]<cost?'disabled':''} onclick="levelUp('${u.uid}')">Lvアップ ${u.level>=u.cap?'上限':cost+'石'}</button><div><button class="secondary" onclick="ability('${u.uid}')">固有能力</button></div></div></div>`}).join('')}</div></section>`}
function settings(){return `<section class="panel"><h2>🛠️ 開発用コントロール</h2><div class="notice">ゲーム時刻を2時間単位で進めます。探索完了、周回、自然回復を再現します。時間スキップ後も端末の現実時間に沿って進行します。</div><p class="small">ゲーム内の現在時刻：${fmt(clock())}</p><div class="actions"><button onclick="skip(1)">＋2時間</button><button onclick="skip(6)">＋12時間</button><button onclick="skip(12)">＋1日</button><button onclick="skip(84)">＋7日</button></div><p class="muted">2週間を進める場合は「＋7日」を2回押してください。</p></section>
 <section class="panel"><h2>💾 セーブ管理</h2><p class="small">状態変更ごとに自動保存します。同じ端末・ブラウザで続きから遊べます。</p><div class="actions"><button onclick="exportSave()">バックアップ書き出し</button><label class="secondary" style="padding:11px;border-radius:12px">読み込み <input type="file" accept="application/json" onchange="importSave(event)" style="font-size:11px;max-width:160px"></label><button class="danger" onclick="resetGame()">初期化</button></div></section>
 <section class="panel"><h2>📜 開発ログ</h2><div class="log">${state.history.map(t=>`<div>${esc(t)}</div>`).join('')||'<p>まだ記録はありません</p>'}</div></section><section class="panel"><h2>試作版の範囲</h2><p class="small">序盤の操作・時間処理検証用です。未実装のアビリティや施設、草原Normalの新キャラ・ボス、勧誘救済、詳細な進行バランスがあります。正式バランスの検証には使用しないでください。</p></section>`}
function render(){sync();const res=state.resources;let content=tab==='home'?home():tab==='explore'?explore():tab==='party'?party():tab==='units'?unitsView():settings();$('app').innerHTML=`<div class="app"><header class="top"><h1>🌿 魔物娘 放置探索</h1><div class="sub">プレイ可能な試作版 v0.1　${fmt(clock())}</div><div class="res"><span class="pill">💎 強化の石 ${res[0]}</span><span class="pill">🪵 拠点資材 ${res[1]}</span><span class="pill">✨ 飛躍の石 ${res[2]}</span></div></header>${content}</div><nav class="footer"><div class="footinner">${[['home','🏠 ホーム'],['explore','🗺️ 探索'],['party','🧭 編成'],['units','🌱 育成'],['settings','⚙️ 設定']].map(([id,t])=>`<button class="nav ${id===tab?'on':''}" onclick="go('${id}')">${t}</button>`).join('')}</div></nav>${modal?modalHtml():''}`}
function modalHtml(){const m=modal;if(m.kind==='ability'){return `<div class="modal"><div class="dialog"><h2>${esc(m.name)}の固有アビリティ</h2><p class="detail">① ${esc(m.abilities[0])}\n\n② ${esc(m.abilities[1])}</p><p class="muted">試作版では一部のアビリティが未実装・暫定処理です。</p><button onclick="closeModal()">閉じる</button></div></div>`}
 return `<div class="modal"><div class="dialog"><h2>🎁 探索報酬を獲得！</h2><p>${m.entries.length}回の探索結果を開封しました。</p><p>💎 強化の石 <b>${m.sum[0]}</b>　🪵 資材 <b>${m.sum[1]}</b>　✨ 飛躍の石 <b>${m.sum[2]}</b></p><p>プレイヤーEXP <b>＋${m.xp}</b></p>${m.tickets?`<p>ご褒美チケット：${m.tickets}枚（管理機能は未実装）</p>`:''}<h3>新たな仲間：${m.newUnits.length}体</h3><div class="reveal">${m.newUnits.map(n=>`<div>${img(byName[n])}<span>${esc(n)}</span></div>`).join('')||'<p class="muted">今回は加入なし</p>'}</div><div class="actions"><button onclick="closeModal()">閉じる</button></div></div></div>`}
function closeModal(){modal=null;render()}
function ability(uid){const c=ch(get(uid).cid);modal={kind:'ability',name:c.name,abilities:c.abilities};render()}
function go(t){tab=t;modal=null;render()}
function selectStage(t){selected=t;render()}
function dispatch(){sync();const st=stage(selected);if(begin(st,clock())){save();render()}}
function toggleAuto(){state.auto=!state.auto;save();render()}
function setStop(){state.stopAfter=!state.stopAfter;save();render()}
function skip(units){sync();state.offset+=units*2*3600000;sync();render()}
function exportSave(){sync();let blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download='majo-save-'+Date.now()+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function importSave(e){let f=e.target.files?.[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{let v=JSON.parse(r.result);if(v.version!==1||!Array.isArray(v.units)||!Array.isArray(v.pending))throw Error();if(!confirm('現在のセーブデータを上書きしますか？'))return;state=v;sync();save();render()}catch(err){alert('この試作版に対応するセーブデータではありません')}};r.readAsText(f)}
function resetGame(){if(confirm('セーブデータを初期化します。元に戻せません。続けますか？')){def();save();tab='home';render()}}
load();render();setInterval(()=>{if(!modal&&document.visibilityState==='visible')render()},30000);
