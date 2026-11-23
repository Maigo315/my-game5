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
 function evaluate(members,stage,ts,alrauneTargets=[]){
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
   if(name(u)==='ヴァンパイア')value*=1.3;
   ep+=value;
  });
  if(members.length&&name(members[0])==='土偶娘')ep*=.9;
  let great=.2,recruit=.35,bossRecruit=.03,stoneMod=0,shorten=0;
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
  const raw=members.map(baseStats),total=[0,0,0];raw.forEach(a=>a.forEach((x,i)=>total[i]+=x));
  const n=x=>count(members,x),allTribes=new Set(members.map(tribe)).size,lead=members[0],isLeader=u=>u.uid===lead?.uid;
  const R=[];const add=(u,a,b)=>{R.push({name:name(u),slot:1,status:a});R.push({name:name(u),slot:2,status:b})};
  for(let i=0;i<members.length;i++){
    const u=members[i],nm=name(u);let a=false,b=false;
    switch(nm){
      case 'スライム娘':a='終了時に回復';b=members.reduce((sum,x)=>sum+x.energy,0)>=300;break;
      case 'ゴブリン娘':a=raw[i][0]>=Math.max(...raw.map(x=>x[0]));b=true;break;
      case 'マイコニド':a=true;b=['森林','洞窟'].includes(stage.area);break;
      case '犬娘':a='終了時に追加抽選';b=true;break;
      case 'フェアリー':a='終了時に対象を判定';b=true;break;
      case 'スライムベス娘':a=true;b=isTop(total,0);break;
      case 'アルラウネ':a=true;b=true;break;
      case 'ウサギ娘':a=true;b='ボス戦で適用（現版はボス未実装）';break;
      case 'ハーピー':a=true;b=u.energy>=50;break;
      case 'モス娘':a=members.some(x=>name(x)==='シルフィ');b=members.some(x=>x.uid!==u.uid&&name(x)!=='モス娘'&&tribe(x)==='虫');break;
      case 'エルフ':a=isTop(total,0);b=isTop(total,2)?'終了時に回復':false;break;
      case 'フクロウ娘':a=members.some(x=>x.energy<=50);b=night(ts);break;
      case 'シルフィ':a=info.silphyActive>0;b=true;break;
      case 'ドリアード':a=stage.area==='森林';b=a;break;
      case 'ナメクジ娘':a='終了時に50%抽選';b=u.energy===100;break;
      case 'ワーバット':a=stage.area==='洞窟';b=members.some(x=>tribe(x)==='アンデッド');break;
      case 'アラクネ':a=true;b=members.some(x=>tribe(x)==='虫');break;
      case 'ゴーレム娘':a=isLeader(u);b=members.some(x=>tribe(x)==='物質');break;
      case 'デーモン':a=true;b='終了時に元気0を判定';break;
      case 'ロイド':a='終了時に12時間制限を判定';b='終了時に元気・12時間制限を判定';break;
      case '妖狐':a=isLeader(u);b=allTribes>=4||members.every(x=>name(x)==='妖狐');break;
      case 'ゴースト娘':a=true;b=isLeader(u);break;
      case '土偶娘':a=isLeader(u);b=members.some(x=>['物質','アンデッド'].includes(tribe(x)));break;
      case 'ヴァンパイア':a=true;b='大成功した場合に終了時回復';break;
    }
    add(u,a,b);
  }
  return R;
 }
 function recoverAtEnd(members,info,ts,great,rng=Math.random){
  const energyBefore=Object.fromEntries(members.map(u=>[u.uid,u.energy]));const effects=[];
  const pick=a=>a[Math.floor(rng()*a.length)];const add=(u,n,source)=>effects.push({uid:u.uid,amount:n,source});
  const statsTotal=info.rawTotals||members.reduce((v,u)=>{baseStats(u).forEach((x,i)=>v[i]+=x);return v},[0,0,0]);
  for(const u of members){const n=name(u);
   if(n==='スライム娘'){add(u,10,n);const others=members.filter(x=>x.uid!==u.uid);if(others.length)add(pick(others),10,n)}
   if(n==='フェアリー'){const eligible=members.filter(x=>x.uid!==u.uid&&energyBefore[x.uid]<=20);if(eligible.length)add(pick(eligible),50,n)}
   if(n==='アルラウネ')members.forEach(x=>add(x,5,n));
   if(n==='エルフ'&&isTop(statsTotal,2))add(u,10,n);
   if(n==='ナメクジ娘'&&rng()<.5)add(u,20,n);
   if(n==='デーモン'){const eligible=members.filter(x=>energyBefore[x.uid]===0);if(eligible.length)add(pick(eligible),20,n)}
   if(n==='ロイド'){
    u.cooldowns ||= {};
    if(u.cooldowns.a==null||ts-u.cooldowns.a>=12*3600000){members.forEach(x=>add(x,10,n+'①'));u.cooldowns.a=ts}
    if(energyBefore[u.uid]<=50&&(u.cooldowns.b==null||ts-u.cooldowns.b>=12*3600000)){add(u,20,n+'②');u.cooldowns.b=ts}
   }
   if(n==='ヴァンパイア'&&great)add(u,20,n);
  }
  const sums={};effects.forEach(e=>sums[e.uid]=(sums[e.uid]||0)+e.amount);
  members.forEach(u=>{u.energy=Math.min(ch(u.cid).lv1[4],u.energy+(sums[u.uid]||0));u.regenAt=ts});
  return {effects,energyBefore,energyAfter:Object.fromEntries(members.map(u=>[u.uid,u.energy]))};
 }
 return {evaluate,recoverAtEnd,targetsForAlraune,statuses};
})();
