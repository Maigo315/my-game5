'use strict';
/* v0.2: Easy24種の固有能力48枠。ゲーム固有の端数・同率処理は README の仮ルール参照。 */
const ABILITY_ENGINE=(()=>{
 const minute=60000;
 const count=(members,n)=>members.filter(u=>ch(u.cid).name===n).length;
 const name=u=>ch(u.cid).name;
 const tribe=u=>ch(u.cid).tribe;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const isTop=(totals,i)=>totals[i]>=Math.max(...totals);
 const night=ts=>{const h=new Date(ts).getHours();return h>=18||h<6};
 function targetsForAlraune(members){
  const copies=count(members,'アルラウネ');if(!copies)return [[]];
  const min=Math.min(...members.map(u=>u.level));
  const eligible=members.filter(u=>u.level===min).map(u=>u.uid);
  let combos=[[]];for(let i=0;i<copies;i++)combos=combos.flatMap(path=>eligible.map(uid=>[...path,uid]));
  return combos;
 }
 function evaluate(members,stage,ts,alrauneTargets=[],base={}){
  const raw=members.map(baseStats), totals=[0,0,0];
  raw.forEach(s=>s.forEach((v,i)=>totals[i]+=v));
  const leaders=raw.map(s=>s[0]),species=new Set(members.map(tribe)).size;
  const num=n=>count(members,n),names=members.map(name);
  const addMod=raw.map(()=>[0,0,0]),addFlat=raw.map(()=>[0,0,0]);
  const effects=[],snapshotEnergy=members.map(u=>u.energy);
  const abilityCount=num('アラクネ'),ghostCount=num('ゴースト娘');
  const allowedAl=targetsForAlraune(members);
  const actualAl=Array.isArray(alrauneTargets)&&allowedAl.some(x=>JSON.stringify(x)===JSON.stringify(alrauneTargets))?alrauneTargets:allowedAl[0];
  const basicCosts=members.map(u=>Math.ceil(Math.max(0,20*(1+abilityCount*.1+ghostCount*.2+(name(u)==='ヴァンパイア'?1:0))
   -(name(u)==='マイコニド'&&['森林','洞窟'].includes(stage.area)?10:0)
   -10*actualAl.filter(id=>id===u.uid).length)));
  const afterBasic=members.map((u,i)=>u.energy-basicCosts[i]);
  const silphyExtra=members.some(u=>name(u)==='モス娘')?10:20;
  let silphyActive=0, silphyCost=0;
  for(const u of members){if(name(u)==='シルフィ'&&members.length){if(afterBasic[0]>=silphyExtra){afterBasic[0]-=silphyExtra;silphyCost+=silphyExtra;silphyActive++;
      effects.push(`シルフィ：先頭の元気${silphyExtra}消費、攻撃・魔法+20%／防御-20%`)}
    else effects.push('シルフィ：先頭の元気不足で固有①は不発') }}
  const allCosts=basicCosts.map((c,i)=>c+(i===0?silphyCost:0));
  // 先頭の追加コストは探索基本消費を確保した残りから判定。通常探索開始判定には追加コストを要求しない。
  const canStart=members.length===4&&members.every((u,i)=>u.energy>=basicCosts[i]);
  const dcount=num('ドリアード'),mc=num('マイコニド'),ar=num('アラクネ'),go=num('ゴーレム娘'),doCount=num('土偶娘'),al=num('アルラウネ');
  for(let j=0;j<members.length;j++){
   const u=members[j],n=name(u),t=tribe(u),s=raw[j],mod=addMod[j],flat=addFlat[j];
   mod[1]+=.05*mc;mod[0]-=.05*al;
   if(t==='虫')mod[1]+=.05*ar;
   if(t==='物質')mod[1]+=.05*go;
   if(t==='物質'||t==='アンデッド')mod[1]+=.05*doCount;
   if(stage.area==='森林'&&t==='植物')mod[2]+=.2*dcount;
   // 自身の固有能力
   if(n==='ゴブリン娘'&&s[0]>=Math.max(...leaders))mod[0]+=.1;
   if(n==='犬娘')flat[0]+=species;
   if(n==='スライムベス娘')mod[0]+=.05*members.filter(x=>tribe(x)==='スライム').length;
   if(n==='モス娘'&&members.some(x=>x.uid!==u.uid&&name(x)!=='モス娘'&&tribe(x)==='虫'))mod[1]+=.1;
   if(n==='フクロウ娘'&&night(ts))mod[0]+=.1,mod[1]+=.1,mod[2]+=.1;
   if(n==='ナメクジ娘'&&u.energy===100)mod[1]+=.3;
   if(n==='ワーバット'&&stage.area==='洞窟')mod[2]+=.5;
   if(n==='ワーバット'&&members.some(x=>tribe(x)==='アンデッド'))mod[2]+=.2;
   if(n==='ゴーレム娘'&&j===0)mod[1]+=.1;
  }
  for(const u of members){if(name(u)==='フクロウ娘')members.forEach((x,i)=>{if(snapshotEnergy[i]<=50)addMod[i]=addMod[i].map(v=>v+.1)})}
  // 最も高い能力が同値なら、攻撃→防御→魔法の順で1つ選ぶ（仮ルール）。
  if(members.length){
   const lead=raw[0],index=lead.indexOf(Math.max(...lead));
   addMod[0][index]+=.1*num('デーモン');
   addMod[0][0]+=.2*silphyActive;
   addMod[0][1]-=.2*silphyActive;
   addMod[0][2]+=.2*silphyActive;
  }
  const adjusted=raw.map((v,i)=>v.map((x,k)=>(x+addFlat[i][k])*(1+addMod[i][k])));
  let ep=0;
  members.forEach((u,i)=>{
   let value=adjusted[i].reduce((sum,v,k)=>sum+v*stage.mods[k],0);
   if(stage.tribes.includes(tribe(u)))value*=1.1;
   value*=1+(base.training?.[tribe(u)]||0);
   if(name(u)==='ヴァンパイア')value*=1.3;
   ep+=value;
  });
  if(members.length&&name(members[0])==='土偶娘')ep*=.9;
  let great=.2+(base.monument||0),recruit=.35,bossRecruit=.03,stoneMod=0,shorten=0;
  for(let i=0;i<members.length;i++){
   const u=members[i],n=name(u);
   if(n==='スライム娘'){const totalEnergy=members.reduce((s,x)=>s+x.energy,0);if(totalEnergy>=300)great+=.1;if(totalEnergy>=400)great+=.1}
   if(n==='フェアリー')great+=members.filter(x=>tribe(x)==='神秘').length*.04;
   if(n==='スライムベス娘'&&isTop(totals,0))great+=.1;
   if(n==='ドリアード'&&stage.area==='森林')great+=.2;
   if(n==='妖狐'){if(i===0){stoneMod-=.1;recruit+=.1}if(species>=4||members.every(x=>name(x)==='妖狐'))great+=.1}
   if(n==='土偶娘'&&i===0)great+=.15;
   if(n==='ウサギ娘'){recruit+=.05;bossRecruit+=.02}
   if(n==='ゴブリン娘')stoneMod+=.05;
   if(n==='ハーピー'){shorten+=.1;if(u.energy>=50)shorten+=.1}
   if(n==='シルフィ')shorten+=.1;
   if(n==='エルフ'&&isTop(totals,0))shorten+=.1;
   if(n==='アラクネ')shorten+=.15;
   if(n==='ゴースト娘'){shorten+=.15;if(i===0){shorten+=.15;recruit-=.1}}
  }
  const rate=clamp(great,0,1),grade=stage.thresholds.reduce((g,t,i)=>ep>=t?i:g,-1);
  const duration=Math.round(120*minute*(1-clamp(shorten,0,.75))/1000)*1000;
  return {ep:Math.floor(ep),rawEp:ep,grade,rate,recruit:clamp(recruit,0,1),bossRecruit:clamp(bossRecruit,0,1),stoneMod,
   shorten:clamp(shorten,0,.75),duration,rawTotals:totals,adjusted,raw,basicCosts,extraCosts:[silphyCost,...Array(Math.max(0,members.length-1)).fill(0)],costs:allCosts,
   alrauneTargets:actualAl,alrauneCandidates:allowedAl,silphyActive,canStart,abilityLog:effects};
 }
 function statuses(members,stage,ts,info){
  const raw=info.raw||members.map(baseStats),total=info.rawTotals||[0,0,0];
  const species=new Set(members.map(tribe)).size,lead=members[0],energy=members.reduce((sum,u)=>sum+u.energy,0);
  const names=members.map(name),n=x=>count(members,x),tribeCount=t=>members.filter(u=>tribe(u)===t).length;
  const result=[];let syl=0,al=0;
  for(let i=0;i<members.length;i++){
   const u=members[i],nm=name(u),first=i===0;
   const add=(slot,active,effect,condition='')=>result.push({uid:u.uid,name:nm,position:i+1,slot,status:active,effect,condition});
   const A=(active,effect,condition)=>add(1,active,effect,condition), B=(active,effect,condition)=>add(2,active,effect,condition);
   switch(nm){
    case 'スライム娘': A('end','自身と部隊内の他の1人を各10回復（均等抽選）'); B(energy>=300,`大成功率 +${energy>=400?20:10}ポイント`,`部隊元気合計 ${energy} / 300・400以上`);break;
    case 'ゴブリン娘': A(raw[i][0]>=Math.max(...raw.map(x=>x[0])),'自身の攻撃力 +10%','補正前の部隊内攻撃力が最大');B(true,'強化の石獲得量 +5%');break;
    case 'マイコニド':A(true,'部隊全員の防御力 +5%');B(['森林','洞窟'].includes(stage.area),'自身の通常消費元気 −10','森林・洞窟限定');break;
    case '犬娘':A('end','追加報酬を1回抽選：拠点資材1（50%）、強化の石10（40%）、飛躍の石1（8%）、ご褒美チケット1（2%）');B(true,`自身の攻撃力 +${species}（固定値）`,`部隊の種族数 ${species}`);break;
    case 'フェアリー':A('end','部隊内の他の元気20以下の1人を50回復。対象なしなら不発');B(true,`大成功率 +${tribeCount('神秘')*4}ポイント`,`神秘族 ${tribeCount('神秘')}人`);break;
    case 'スライムベス娘':A(true,`自身の攻撃力 +${tribeCount('スライム')*5}%`,`スライム族 ${tribeCount('スライム')}人`);B(isTop(total,0),'大成功率 +10ポイント','補正前の部隊攻撃力合計が最大');break;
    case 'アルラウネ':{A(true,'部隊全員の攻撃力 −5%／終了時、全員の元気 +5');const target=members.find(x=>x.uid===info.alrauneTargets?.[al++]);B(true,'最低Lvの1人の通常消費元気 −10',target?`この計算例の対象：${members.indexOf(target)+1}番 ${name(target)}（Lv.${target.level}）。出発時に抽選`:'最低Lvの対象を出発時に抽選');break;}
    case 'ウサギ娘':A(true,'基本勧誘率 +5ポイント');B('future','ボス基本勧誘率 +2ポイント','ボス戦は未実装');break;
    case 'ハーピー':A(true,'探索時間 −10%');B(u.energy>=50,'探索時間 −10%',`開始前元気 ${u.energy} / 50以上`);break;
    case 'モス娘':A(info.silphyActive>0,'追加消費だけ −50%（シルフィ20→10）','シルフィの追加消費が発生した場合。重複しても半減のまま（仮）');B(members.some(x=>name(x)!=='モス娘'&&tribe(x)==='虫'),'自身の防御力 +10%','モス娘以外の虫族がいる');break;
    case 'エルフ':A(isTop(total,0),'探索時間 −10%','補正前の部隊攻撃力合計が最大');B(isTop(total,2)?'end':false,'終了時、自身の元気 +10','補正前の部隊魔法力合計が最大');break;
    case 'フクロウ娘':A(members.some(x=>x.energy<=50),'対象の攻撃・防御・魔法 +10%',`開始前元気50以下：${members.filter(x=>x.energy<=50).map(x=>`${members.indexOf(x)+1}番 ${name(x)}`).join('、')||'なし'}`);B(night(ts),'自身の攻撃・防御・魔法 +10%','18:00以上・翌06:00未満');break;
    case 'シルフィ':A(syl++<info.silphyActive,`先頭の元気 −${n('モス娘')?10:20}（追加）／攻撃・魔法 +20%、防御 −20%`,'通常消費を確保した後、追加元気が足りる場合');B(true,'探索時間 −10%');break;
    case 'ドリアード':A(stage.area==='森林','大成功率 +20ポイント','森林限定');B(stage.area==='森林','部隊内の植物族の魔法力 +20%','森林限定');break;
    case 'ナメクジ娘':A('end','50%の確率で自身の元気 +20');B(u.energy===100,'自身の防御力 +30%',`開始前元気 ${u.energy} / 100`);break;
    case 'ワーバット':A(stage.area==='洞窟','自身の魔法力 +50%','洞窟限定');B(tribeCount('アンデッド')>0,'自身の魔法力 +20%','部隊にアンデッド族がいる');break;
    case 'アラクネ':A(true,'部隊全員の通常消費元気 +10%／探索時間 −15%');B(true,'部隊内の虫族の防御力 +5%');break;
    case 'ゴーレム娘':A(first,'自身の防御力 +10%','先頭配置');B(true,'部隊内の物質族の防御力 +5%');break;
    case 'デーモン':A(true,`先頭の${['攻撃力','防御力','魔法力'][raw[0].indexOf(Math.max(...raw[0]))]} +10%`,'先頭の補正前最大ステータス（同率は攻撃→防御→魔法）');B('end','部隊内の元気0の1人を20回復（自身も対象）');break;
    case 'ロイド':A('end','部隊全員の元気 +10','個体・能力別12時間制限');B('end','自身の元気 +20','終了時元気50以下、個体・能力別12時間制限');break;
    case '妖狐':A(first,'強化の石獲得量 −10%／基本勧誘率 +10ポイント','先頭配置');B(species>=4||names.every(x=>x==='妖狐'),'大成功率 +10ポイント',`4種族以上（現在${species}）または妖狐のみ`);break;
    case 'ゴースト娘':A(true,'部隊全員の通常消費元気 +20%／探索時間 −15%');B(first,'基本勧誘率 −10ポイント／探索時間 −15%','先頭配置');break;
    case '土偶娘':A(first,'部隊実効EP −10%／大成功率 +15ポイント','先頭配置');B(true,'部隊内の物質・アンデッド族の防御力 +5%');break;
    case 'ヴァンパイア':A(true,'自身の通常消費元気 +100%／自身の実効EP +30%');B('end','自身の元気 +20','大成功時のみ');break;
   }
  }return result;
 }
 function recoverAtEnd(members,info,ts,great,rng=Math.random){
  const energyBefore=Object.fromEntries(members.map(u=>[u.uid,u.energy]));const effects=[],outcomes=[];
  const pick=a=>a[Math.floor(rng()*a.length)];const add=(u,n,source)=>effects.push({uid:u.uid,amount:n,source});const miss=(u,reason)=>outcomes.push(`${members.indexOf(u)+1}番 ${name(u)}：${reason}`);
  const statsTotal=info.rawTotals||members.reduce((v,u)=>{baseStats(u).forEach((x,i)=>v[i]+=x);return v},[0,0,0]);
  for(const u of members){const n=name(u);
   if(n==='スライム娘'){add(u,10,n);const others=members.filter(x=>x.uid!==u.uid);if(others.length)add(pick(others),10,n)}
   if(n==='フェアリー'){const eligible=members.filter(x=>x.uid!==u.uid&&energyBefore[x.uid]<=20);if(eligible.length)add(pick(eligible),50,n);else miss(u,'固有① 対象者なし')}
   if(n==='アルラウネ')members.forEach(x=>add(x,5,n));
   if(n==='エルフ'){if(isTop(statsTotal,2))add(u,10,n);else miss(u,'固有② 条件不成立')}
   if(n==='ナメクジ娘'){if(rng()<.5)add(u,20,n);else miss(u,'固有① 50%抽選不成立')}
   if(n==='デーモン'){const eligible=members.filter(x=>energyBefore[x.uid]===0);if(eligible.length)add(pick(eligible),20,n);else miss(u,'固有② 対象者なし')}
   if(n==='ロイド'){
    u.cooldowns ||= {};
    if(u.cooldowns.a==null||ts-u.cooldowns.a>=12*3600000){members.forEach(x=>add(x,10,n+'①'));u.cooldowns.a=ts}else miss(u,'固有① 12時間制限中')
    if(energyBefore[u.uid]<=50&&(u.cooldowns.b==null||ts-u.cooldowns.b>=12*3600000)){add(u,20,n+'②');u.cooldowns.b=ts}else miss(u,energyBefore[u.uid]>50?'固有② 元気50以下の条件不成立':'固有② 12時間制限中')
   }
   if(n==='ヴァンパイア'){if(great)add(u,20,n);else miss(u,'固有② 大成功条件不成立')}
  }
  const sums={};effects.forEach(e=>sums[e.uid]=(sums[e.uid]||0)+e.amount);
  members.forEach(u=>{u.energy=Math.min(ch(u.cid).lv1[4],u.energy+(sums[u.uid]||0));u.regenAt=ts});
  return {effects,outcomes,energyBefore,energyAfter:Object.fromEntries(members.map(u=>[u.uid,u.energy]))};
 }
 return {evaluate,recoverAtEnd,targetsForAlraune,statuses};
})();
