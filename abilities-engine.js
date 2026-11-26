'use strict';
/* v0.6.2: 53種の固有能力106枠。ゲーム固有の端数・同率処理は README の仮ルール参照。 */
const ABILITY_ENGINE=(()=>{
 const minute=60000;
 const count=(members,n)=>members.filter(u=>ch(u.cid).name===n).length;
 const name=u=>ch(u.cid).name;
 // 固有②のみ、先頭本人の追加適用回数。固有①・カスタムは複製しない。
 const copies2=(members,u)=>1+(u===members[0]&&name(u)!=="テーラーアラクネ"?count(members,"テーラーアラクネ"):0);
 const count2=(members,n)=>members.reduce((a,u)=>a+(name(u)===n?copies2(members,u):0),0);
 const tribe=u=>ch(u.cid).tribe;
 const foxOnly=members=>members.length>0&&members.every(u=>ch(u.cid).subtribe==='妖狐');
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const extraCost=(members,u)=>Math.ceil((count(members,'モス娘')?10:20)*(1-cv(u,'extra')/100));
 const isTop=(totals,i)=>totals[i]>=Math.max(...totals);
 const night=ts=>{const h=new Date(ts).getHours();return h>=18||h<6};
 function targetsForAlraune(members){
  const copies=count2(members,'アルラウネ');if(!copies)return [[]];
  const min=Math.min(...members.map(u=>u.level));
  const eligible=members.filter(u=>u.level===min).map(u=>u.uid);
  let combos=[[]];for(let i=0;i<copies;i++)combos=combos.flatMap(path=>eligible.map(uid=>[...path,uid]));
  return combos;
 }
 function evaluate(members,stage,ts,alrauneTargets=[],base={}){
  const item=base.item||"", sum=id=>members.reduce((n,u)=>n+cv(u,id,stage.area),0), raw=members.map(baseStats), totals=[0,0,0];
  raw.forEach(s=>s.forEach((v,i)=>totals[i]+=v));
  const leaders=raw.map(s=>s[0]),species=new Set(members.map(tribe)).size;
  const num=n=>count(members,n),num2=n=>count2(members,n),names=members.map(name);
  const baseLuck=members.reduce((sum,u)=>sum+luckOf(u),0), allHigh=members.every(u=>u.energy/maxEnergy(u)>=.8),lowCount=members.filter(u=>u.energy/maxEnergy(u)<=.5).length;
  const poison=num("ポイズンスライム娘")+num("ポイズンアラクネ");
  const addMod=raw.map(()=>[0,0,0]),addFlat=raw.map(()=>[0,0,0]);
  const effects=[],snapshotEnergy=members.map(u=>u.energy);
  const abilityCount=num('アラクネ'),ghostCount=num('ゴースト娘');
  const allowedAl=targetsForAlraune(members);
  const actualAl=Array.isArray(alrauneTargets)&&allowedAl.some(x=>JSON.stringify(x)===JSON.stringify(alrauneTargets))?alrauneTargets:allowedAl[0];
  const basicCosts=members.map(u=>Math.ceil(Math.max(0,20*(1+abilityCount*.1+ghostCount*.2+.5*num('シスターサキュバス')+(name(u)==='ヴァンパイア'?1:0)+.5*(poison-(['ポイズンスライム娘','ポイズンアラクネ'].includes(name(u))?1:0)))
   -(name(u)==='マイコニド'&&['森林','洞窟'].includes(stage.area)?10*copies2(members,u):0)
   -10*actualAl.filter(id=>id===u.uid).length-cv(u,"basic"))));
  const afterBasic=members.map((u,i)=>u.energy-basicCosts[i]);
  const silphyExtra=extraCost(members,members[0]||{});
  let silphyActive=0, silphyCost=0;
  for(const u of members){if(name(u)==='シルフィ'&&members.length){if(afterBasic[0]>=silphyExtra){afterBasic[0]-=silphyExtra;silphyCost+=silphyExtra;silphyActive++;
      effects.push(`シルフィ：先頭の元気${silphyExtra}消費、攻撃・魔法+20%／防御-20%`)}
    else effects.push('シルフィ：先頭の元気不足で固有①は不発') }}
  const extraCosts=members.map((u,i)=>i===0?silphyCost:0),richActive=[];
  members.forEach((u,i)=>{if(name(u)!=='フォレストリッチ')return;const cost=extraCost(members,u);if(afterBasic[i]>=cost){afterBasic[i]-=cost;extraCosts[i]+=cost;richActive.push(u.uid);effects.push(`フォレストリッチ：自身の元気${cost}消費、大成功時報酬倍率+30ポイント`)}else effects.push('フォレストリッチ：元気不足で固有①は不発')});
  // シルフィ、フォレストリッチ、カーミラの順に追加消費。幸運は探索内のみ。
  const carmillaActive=[];
  members.forEach((u,i)=>{if(name(u)!=='カーミラ')return;const cost=extraCost(members,u);if(afterBasic[i]>=cost){afterBasic[i]-=cost;extraCosts[i]+=cost;carmillaActive.push(u.uid);effects.push(`カーミラ：自身の元気${cost}消費、全員の幸運+5（探索中）`)}else effects.push('カーミラ：元気不足で固有①は不発')});
  const luck=baseLuck+5*members.length*carmillaActive.length;
  const allCosts=basicCosts.map((c,i)=>c+extraCosts[i]);
  // 先頭の追加コストは探索基本消費を確保した残りから判定。通常探索開始判定には追加コストを要求しない。
  const canStart=members.length===4&&members.every((u,i)=>u.energy>=basicCosts[i]);
  const dcount=num2('ドリアード'),mc=num('マイコニド'),ar=num2('アラクネ'),go=num2('ゴーレム娘'),doCount=num2('土偶娘'),al=num('アルラウネ');
  for(let j=0;j<members.length;j++){
   const u=members[j],n=name(u),t=tribe(u),s=raw[j],mod=addMod[j],flat=addFlat[j],k2=copies2(members,u);
   for(let k=0;k<3;k++)mod[k]+=(cv(u,"stat"+k)+cv(u,"areaStat"+k,stage.area))/100;
   mod[1]+=.05*mc-.05*num('ノーブルローズ')-(names[0]==='エビルアルラウネ'?.05*copies2(members,members[0]):0);
   if(j===0&&n==='エビルアルラウネ')mod[0]+=.2*k2;mod[0]-=.05*al;
   if(n==='ラミア'&&u.energy>=100)mod[0]+=.1*k2;
   if(t==='虫')mod[1]+=.05*ar;
   if(t==='物質'){mod[1]+=.05*(go+num2('オーパーツ'));mod[0]+=.05*num2('マッドゴーレム娘');}
   if(t==='物質'||t==='アンデッド')mod[1]+=.05*doCount;
   if(stage.area==='森林'&&t==='植物')mod[2]+=.2*dcount;
   // 自身の固有能力
   if(n==='ゴブリン娘'&&s[0]>=Math.max(...leaders))mod[0]+=.1;
   if(n==='犬娘')flat[0]+=species*k2;
   if(n==='スライムベス娘')mod[0]+=.05*members.filter(x=>tribe(x)==='スライム').length;
   if(n==='モス娘'&&members.some(x=>x.uid!==u.uid&&name(x)!=='モス娘'&&tribe(x)==='虫'))mod[1]+=.1*k2;
   if(n==='フクロウ娘'&&night(ts))mod[0]+=.1*k2,mod[1]+=.1*k2,mod[2]+=.1*k2;
   if(n==='ナメクジ娘'&&u.energy===maxEnergy(u))mod[1]+=.3*k2;
   if(n==='ワーバット'&&stage.area==='洞窟')mod[2]+=.5;
   if(n==='ワーバット'&&members.some(x=>tribe(x)==='アンデッド'))mod[2]+=.2*k2;
   if((n==='ゴーレム娘'||n==='マッドゴーレム娘')&&j===0)mod[1]+=.1;
   if(n==='ポイズンスライム娘'&&luck<=40){mod[1]+=.2*k2;mod[2]+=.2*k2;}
   if(n==='モモイロナメクジ'&&allHigh)mod[1]+=.4*k2;
   if(n==='オーパーツ'&&u.energy>=100){mod[0]+=.06;mod[1]+=.06;}
   if(n==='黒土偶'&&j===0){mod[0]+=.15;mod[1]+=.15;}
   if(n==='枯木の精'&&luck<=40)mod[0]+=.5*k2;
  }
  for(const u of members){if(name(u)==='フクロウ娘')members.forEach((x,i)=>{if(snapshotEnergy[i]<=50)addMod[i]=addMod[i].map(v=>v+.1)})}
  // 最も高い能力が同値なら、攻撃→防御→魔法の順で1つ選ぶ（仮ルール）。
  if(members.length){
   const lead=raw[0],index=lead.indexOf(Math.max(...lead));
   addMod[0][index]+=.1*num('デーモン')+.3*num('テーラーアラクネ');
   addMod[0][0]+=.1*num('ハンマーゴブリン');
   if(num('テーラーアラクネ')&&names[0]!=='テーラーアラクネ')effects.push(`テーラーアラクネ：先頭 ${names[0]} の固有②を${copies2(members,members[0])}回適用`);
   addMod[0][0]+=.2*silphyActive;
   addMod[0][1]-=.2*silphyActive;
   addMod[0][2]+=.2*silphyActive;
  }
  if(members.length){const target=raw.findIndex(v=>v[2]===Math.max(...raw.map(x=>x[2])));addMod[target][2]+=.1*num('中級妖狐');}
  let great=.2+(base.monument||0),recruit=.35,bossRecruit=.03,stoneMod=0,shorten=0;
  const greatStoneMod=.15*num2('ハンマーゴブリン'),resourceMod=.3*num2('ミミック娘');
  const stoneOnly=names[0]==='ノーブルローズ';
  for(let i=0;i<members.length;i++){
   const u=members[i],n=name(u),k2=copies2(members,u);
   if(n==='グリーンバット'){if(stage.area==='森林')great+=.15;if(members.some(x=>tribe(x)==='アンデッド'))great+=.15*k2}
   if(n==='エビルアルラウネ')great-=.05;
   if(n==='スライム娘'){const totalEnergy=members.reduce((s,x)=>s+x.energy,0);if(totalEnergy>=300)great+=.1*k2;if(totalEnergy>=400)great+=.1*k2}
   if(n==='フェアリー')great+=members.filter(x=>tribe(x)==='神秘').length*.04*k2;
   if(n==='スライムベス娘'&&isTop(totals,0))great+=.1*k2;
   if(n==='ドリアード'&&stage.area==='森林')great+=.2;
   if(n==='妖狐'){if(i===0){stoneMod-=.1;recruit+=.1}if(species>=4||foxOnly(members))great+=.1*k2}
   if(n==='土偶娘'&&i===0)great+=.15;
   if(n==='ウサギ娘'){recruit+=.05;bossRecruit+=.02*k2}
   if(n==='ゴブリン娘')stoneMod+=.05*k2;
   if(n==='メイドデビル')stoneMod+=species*.03;
   if(n==='ノーブルローズ')stoneMod+=.1+(i===0?.2*k2:0);
   if(n==='ミツバチ娘'&&members.filter(x=>tribe(x)==='虫').length>=2)shorten+=.1*k2;
   if(n==='シルバースライム')shorten+=.2*k2;
   if(n==='ポダルゲ'&&luck>=50)great+=.2;
   if(n==='ハーピー'){shorten+=.1;if(u.energy>=50)shorten+=.1*k2}
   if(n==='シルフィ')shorten+=.1*k2;
   if(n==='エルフ'&&isTop(totals,0))shorten+=.1;
   if(n==='アラクネ')shorten+=.15;
   if(n==='ゴースト娘'){shorten+=.15;if(i===0){shorten+=.15*k2;recruit-=.1*k2}}
   if(n==='ポイズンアラクネ'&&lowCount>=2)great+=.15*k2;
   if(n==='サキュバット'){if(silphyActive||richActive.length||carmillaActive.length)recruit+=.2;if(members.some(x=>tribe(x)==='アンデッド'))recruit+=.15*k2;}
   if(n==='ミミック娘')recruit-=.5*k2;
   if(n==='レイヴン'){const h=members.filter(x=>tribe(x)==='ハーピー').length;shorten+=h>=3?.2:h>=2?.15:0;}
   if(n==='黒土偶'&&i===0)shorten-=.2;
   if(n==='シスターサキュバス')great+=.2;
  }
  shorten+=(sum('fast')-sum('slow'))/100+(item==='speed'?.3:item==='slow'?-.3:0);
  const netShorten=clamp(shorten,-.5,.75),duration=Math.round(120*minute*(1-netShorten)/1000)*1000;
  great+=sum('great')/100+members.reduce((a,u)=>{const q=cv(u,'quick'),c=cv(u,'careful');return a+(q?(.5+.5*q)*Math.max(0,netShorten)*10:0)+(c?(c+1)*Math.max(0,-netShorten)*10:0)},0)/100;
  if(duration<=96*minute)great+=.15*num2('ポダルゲ');
  if(duration>=120*minute)great+=(duration>=180*minute?.25:.05)*num2('黒土偶');
  great+=item==='zeal'?.3:0;if(item==='superZeal')great=1;
  const silkyActive=great>=.5-1e-10; if(silkyActive)great+=.15*num2('シルキー');
  const rate=clamp(great,0,1);
  members.forEach((u,i)=>{if(name(u)==='レイヴン'&&duration<=96*minute){addMod[i][0]+=.1*copies2(members,u);addMod[i][2]+=.1*copies2(members,u);}if(name(u)==='枯木の精'&&rate<=.4+1e-10)addMod[i][2]+=1;});
  const adjusted=raw.map((v,i)=>v.map((x,k)=>(x+addFlat[i][k])*(1+addMod[i][k])));
  let ep=0; const individualEP=[];
  members.forEach((u,i)=>{
   let value=adjusted[i].reduce((sum,v,k)=>sum+v*stage.mods[k],0);
   if(stage.tribes.includes(tribe(u)))value*=1.1;
   value*=1+(base.training?.[tribe(u)]||0);
   const innateEP=name(u)==='ヴァンパイア'?30:name(u)==='ラミア'&&members.some(x=>maxEnergy(x)<100)?8:0;
   const fraction=u.energy/maxEnergy(u), same=members.filter(x=>x.uid!==u.uid&&tribe(x)===tribe(u)).length;
   const unity=cv(u,'unity'),careful=cv(u,'careful');
   const customEP=cv(u,'ep')+cv(u,'areaEp',stage.area)+4*cv(u,'full')*fraction+5*cv(u,'low')*(1-fraction)+(unity?(unity+1)*same:0)+(same?0:3*cv(u,'solo'))+([0,3,5,8][careful]||0)*Math.max(0,-netShorten)*10;
   value*=1+(innateEP+customEP)/100; individualEP.push(value); ep+=value;
  });
  const preSleepEP=individualEP.slice();let sleepTarget=null;
  if(names[0]==='スリーピィ'){sleepTarget=individualEP.indexOf(Math.max(...individualEP));individualEP.forEach((v,i)=>individualEP[i]=i===sleepTarget?0:v*1.35);ep=individualEP.reduce((a,b)=>a+b,0);effects.push(`スリーピィ：${sleepTarget+1}番 ${names[sleepTarget]} のEPを0、他のキャラのEP+35%`)}
  ep*=1+.1*num('ポイズンアラクネ')-(names[0]==='土偶娘'?.1:0);
  if(item==='support')ep*=1.2;
  const thresholdFactor=1-(sum('threshold')+5*num('ポイズンスライム娘')+5*num('エビルアルラウネ')+((species>=4||foxOnly(members))?5*num2('中級妖狐'):0)+(item==='cheat'?20:0))/100;
  const grade=stage.thresholds.reduce((g,t,i)=>ep>=t*thresholdFactor?i:g,-1);
  recruit+=sum('recruit')/100+luck*.002+(item==='friend'?.3:0);if(['sureFriend','fate'].includes(item))recruit=1;
  bossRecruit+=sum('boss')/100+luck*.0001;stoneMod+=sum('stone')/100;
  const fisherCount=num2('フィッシャースライム'),normalDropRate=stoneOnly||grade<0?0:clamp(.1*(grade+1)+.3*num('ミミック娘'),0,1),greatRecruit=grade<0?0:clamp(recruit+.2*fisherCount,0,1);
  const additionalRecruit=grade<0?0:clamp([0,.05,.1,.15,.2][grade]+(grade>=2?.2*num('シルバースライム'):0)+sum('additional')/100+luck*.001,0,1);
  return {ep:Math.floor(ep),rawEp:ep,individualEP,preSleepEP,sleepTarget,silkyActive,richActive,carmillaActive,baseLuck,luck,fisherCount,greatRecruit,grade,thresholdFactor,rate,additionalRecruit,stoneOnly,recruit:grade<0?0:clamp(recruit,0,1),bossRecruit:clamp(bossRecruit,0,1),stoneMod,greatStoneMod,resourceMod,normalDropRate,normalDropBonus:.3*num('ミミック娘'),materialMod:sum('material')/100,greatMultiplier:1.5+(sum('greatReward')+30*richActive.length+50*num('シスターサキュバス'))/100,item,customRecovery:members.map(u=>({uid:u.uid,normal:cv(u,'recover'),great:cv(u,'greatRecover')})),
   shorten:netShorten,duration,rawTotals:totals,adjusted,raw,basicCosts,extraCosts,costs:allCosts,
   alrauneTargets:actualAl,alrauneCandidates:allowedAl,silphyActive,canStart,abilityLog:effects};
 }
 function statuses(members,stage,ts,info){
  const raw=info.raw||members.map(baseStats),total=info.rawTotals||[0,0,0];
  const species=new Set(members.map(tribe)).size,lead=members[0],energy=members.reduce((sum,u)=>sum+u.energy,0);
  const names=members.map(name),n=x=>count(members,x),tribeCount=t=>members.filter(u=>tribe(u)===t).length;
  const result=[];let syl=0,al=0;
  for(let i=0;i<members.length;i++){
   const u=members[i],nm=name(u),first=i===0;
   const add=(slot,active,effect,condition='')=>result.push({uid:u.uid,name:nm,position:i+1,slot,copies:slot===2?copies2(members,u):1,status:active,effect,condition});
   const A=(active,effect,condition)=>add(1,active,effect,condition), B=(active,effect,condition)=>add(2,active,effect,condition);
   switch(nm){
    case 'スライム娘': A('end','自身と部隊内の他の1人を各10回復（均等抽選）'); B(energy>=300,`大成功率 +${energy>=400?20:10}ポイント`,`部隊元気合計 ${energy} / 300・400以上`);break;
    case 'ゴブリン娘': A(raw[i][0]>=Math.max(...raw.map(x=>x[0])),'自身の攻撃力 +10%','補正前の部隊内攻撃力が最大');B(true,'強化の石獲得量 +5%');break;
    case 'マイコニド':A(true,'部隊全員の防御力 +5%');B(['森林','洞窟'].includes(stage.area),'自身の通常消費元気 −10','森林・洞窟限定');break;
    case '犬娘':A('end','追加報酬を1回抽選：拠点資材1（50%）、強化の石10（40%）、飛躍の石1（8%）、ご褒美チケット1（2%）');B(true,`自身の攻撃力 +${species}（固定値）`,`部隊の種族数 ${species}`);break;
    case 'フェアリー':A('end','部隊内の他の元気20以下の1人を50回復。対象なしなら不発');B(true,`大成功率 +${tribeCount('神秘')*4}ポイント`,`神秘族 ${tribeCount('神秘')}人`);break;
    case 'スライムベス娘':A(true,`自身の攻撃力 +${tribeCount('スライム')*5}%`,`スライム族 ${tribeCount('スライム')}人`);B(isTop(total,0),'大成功率 +10ポイント','補正前の部隊攻撃力合計が最大');break;
    case 'アルラウネ':{A(true,'部隊全員の攻撃力 −5%／終了時、全員の元気 +5');const targets=(info.alrauneTargets||[]).slice(al,al+copies2(members,u)).map(id=>members.find(x=>x.uid===id)).filter(Boolean);al+=copies2(members,u);B(true,'最低Lvの1人の通常消費元気 −10',targets.length?`この計算例の対象：${targets.map(target=>`${members.indexOf(target)+1}番 ${name(target)}（Lv.${target.level}）`).join('、')}。出発時に抽選`:'最低Lvの対象を出発時に抽選');break;}
    case 'ウサギ娘':A(true,'基本勧誘率 +5ポイント');B(!!stage.boss,'ボス基本勧誘率 +2ポイント','ボスのいる探索先');break;
    case 'ハーピー':A(true,'探索時間 −10%');B(u.energy>=50,'探索時間 −10%',`開始前元気 ${u.energy} / 50以上`);break;
    case 'モス娘':A(info.silphyActive>0||info.richActive?.length>0||info.carmillaActive?.length>0?true:names[0]==='フォレストリッチ'?'end':false,'アビリティ追加消費 −50%','シルフィ・フォレストリッチ・カーミラの追加消費に適用。複数でも半減は一度');B(members.some(x=>name(x)!=='モス娘'&&tribe(x)==='虫'),'自身の防御力 +10%','モス娘以外の虫族がいる');break;
    case 'エルフ':A(isTop(total,0),'探索時間 −10%','補正前の部隊攻撃力合計が最大');B(isTop(total,2)?'end':false,'終了時、自身の元気 +10','補正前の部隊魔法力合計が最大');break;
    case 'フクロウ娘':A(members.some(x=>x.energy<=50),'対象の攻撃・防御・魔法 +10%',`開始前元気50以下：${members.filter(x=>x.energy<=50).map(x=>`${members.indexOf(x)+1}番 ${name(x)}`).join('、')||'なし'}`);B(night(ts),'自身の攻撃・防御・魔法 +10%','18:00以上・翌06:00未満');break;
    case 'シルフィ':A(syl++<info.silphyActive,`先頭の元気 −${Math.ceil((n('モス娘')?10:20)*(1-cv(members[0]||{},'extra')/100))}（追加）／攻撃・魔法 +20%、防御 −20%`,'通常消費を確保した後、追加元気が足りる場合');B(true,'探索時間 −10%');break;
    case 'ドリアード':A(stage.area==='森林','大成功率 +20ポイント','森林限定');B(stage.area==='森林','部隊内の植物族の魔法力 +20%','森林限定');break;
    case 'ナメクジ娘':A('end','50%の確率で自身の元気 +20');B(u.energy===maxEnergy(u),'自身の防御力 +30%',`開始前元気 ${u.energy} / ${maxEnergy(u)}（満タン条件）`);break;
    case 'ワーバット':A(stage.area==='洞窟','自身の魔法力 +50%','洞窟限定');B(tribeCount('アンデッド')>0,'自身の魔法力 +20%','部隊にアンデッド族がいる');break;
    case 'アラクネ':A(true,'部隊全員の通常消費元気 +10%／探索時間 −15%');B(true,'部隊内の虫族の防御力 +5%');break;
    case 'ゴーレム娘':A(first,'自身の防御力 +10%','先頭配置');B(true,'部隊内の物質族の防御力 +5%');break;
    case 'デーモン':A(true,`先頭の${['攻撃力','防御力','魔法力'][raw[0].indexOf(Math.max(...raw[0]))]} +10%`,'先頭の補正前最大ステータス（同率は攻撃→防御→魔法）');B('end','部隊内の元気0の1人を20回復（自身も対象）');break;
    case 'ロイド':A('end','部隊全員の元気 +10','個体・能力別12時間制限');B('end','自身の元気 +20','終了時元気50以下、個体・能力別12時間制限');break;
    case '妖狐':A(first,'強化の石獲得量 −10%／基本勧誘率 +10ポイント','先頭配置');B(species>=4||foxOnly(members),'大成功率 +10ポイント',`4種族以上（現在${species}）または妖狐のみ`);break;
    case 'ゴースト娘':A(true,'部隊全員の通常消費元気 +20%／探索時間 −15%');B(first,'基本勧誘率 −10ポイント／探索時間 −15%','先頭配置');break;
    case '土偶娘':A(first,'部隊実効EP −10%／大成功率 +15ポイント','先頭配置');B(true,'部隊内の物質・アンデッド族の防御力 +5%');break;
    case 'ラミア':A(members.some(x=>maxEnergy(x)<100),'自身の実効EP +8%','最大元気100未満の仲間がいる');B(u.energy>=100,'自身の攻撃力 +10%',`開始前元気 ${u.energy} / 100以上`);break;
    case 'メイドデビル':A(true,`強化の石獲得量 +${species*3}%`,`部隊の種族数 ${species}`);B('end','他のランダムな1人を15回復','大成功時');break;
    case 'ノーブルローズ':A(true,'部隊全員の防御力 −5%／強化の石獲得量 +10%');B(first,'強化の石 +20%／他の通常報酬を無効化','先頭配置。固有能力・ボス報酬は対象外');break;
    case 'ミツバチ娘':A('end','20%で甘い蜜1個');B(tribeCount('虫')>=2,'探索時間 −10%',`虫族 ${tribeCount('虫')}人 / 2人以上`);break;
    case 'ポダルゲ':{const luck=info.luck??members.reduce((sum,x)=>sum+luckOf(x),0);A(luck>=50,'大成功率 +20ポイント',`合計幸運 ${luck} / 50以上`);B(info.duration<=96*minute,'大成功率 +15ポイント','最終探索時間96分以下');break;}
    case 'シルバースライム':A(info.grade>=2,'追加勧誘率 +20ポイント','到達度B以上');B(true,'探索時間 −20%');break;
    case 'メイドミノタウロス':A(info.grade>=4?'end':false,'10%でおいしいミルク1個','到達度S');B('end','部隊全員の元気 +7','大成功時');break;
    case 'グリーンバット':A(stage.area==='森林','大成功率 +15ポイント','森林限定');B(tribeCount('アンデッド')>0,'大成功率 +15ポイント','アンデッド族がいる');break;
    case 'シルキー':A('end','先頭の元気 +10（自身も対象）');B(info.silkyActive,'大成功率 +15ポイント','全シルキーの固有②を除いた大成功率50%以上');break;
    case 'フォレストメイジ':A('end','元気最小の1人を50回復（自身含む・同率抽選）','大成功時・回復前の元気実数');B(true,'部隊全員の固有・カスタムによる回復量 +20%','アイテム・自然回復は対象外、複数加算');break;
    case 'スリーピィ':A(first,'最大EPの1人を0にし、他のキャラのEP +35%',first&&info.sleepTarget!=null?`対象：${info.sleepTarget+1}番 ${names[info.sleepTarget]}（同率は編成順優先）`:'先頭配置');B(info.individualEP?.some(v=>v===0)?'end':false,'実効EP0のキャラの元気 +50','出発時の確定EPを参照');break;
    case 'フォレストリッチ':A(info.richActive?.includes(u.uid)||false,`自身の元気 −${extraCost(members,u)}（追加）／大成功時報酬倍率 +30ポイント`,'通常消費とシルフィ分を確保した後に判定');B(first?'end':false,'他の1人から元気20（軽減可）を消費、自身の元気 +20','先頭・回復前元気50以下・軽減後の消費を支払える対象のみ');break;
    case 'エビルアルラウネ':A(true,'大成功率 −5ポイント／到達度要求EP −5%','ボス条件は軽減しない');B(first,'全員の防御力 −5%／自身の攻撃力 +20%','先頭配置');break;
    case 'フィッシャースライム':A('end','固有追加アイテム1個（探索セット50%、チケット20%、メダル20%、時計10%）','大成功時、通常ドロップと独立');B(info.grade>=0?'end':false,'基本勧誘率 +20ポイント','大成功時・D以上');break;
    case 'ポイズンスライム娘':A(true,'他の全員の通常消費+50%／到達度要求EP−5%');B((info.luck??members.reduce((a,x)=>a+luckOf(x),0))<=40,'自身の防御・魔法 +20%','合計幸運40以下');break;
    case 'モモイロナメクジ':A('end','全員元気+5（通常50%・大成功確定）');B(members.every(x=>x.energy/maxEnergy(x)>=.8),'自身の防御 +40%','開始前全員元気80%以上');break;
    case 'ポイズンアラクネ':A(true,'他の全員の通常消費+50%／部隊EP+10%');B(members.filter(x=>x.energy/maxEnergy(x)<=.5).length>=2,'大成功率 +15ポイント','開始前元気50%以下が2人以上');break;
    case 'ハンマーゴブリン':A(true,'先頭の攻撃 +10%');B('end','強化の石獲得量 +15%','大成功時・通常資源のみ');break;
    case 'マッドゴーレム娘':A(first,'自身の防御 +10%','先頭配置');B(true,'物質族全員の攻撃 +5%');break;
    case 'サキュバット':A(!!(info.silphyActive||info.richActive?.length||info.carmillaActive?.length),'基本勧誘率 +20ポイント','開始時の追加元気消費型能力が発動');B(tribeCount('アンデッド')>0,'基本勧誘率 +15ポイント','アンデッド族がいる');break;
    case 'ミミック娘':A(info.grade>=0&&!info.stoneOnly,'通常アイテム獲得率 +30ポイント','D以上・通常アイテム枠');B(true,'基本勧誘率 −50ポイント／基本資源 +30%');break;
    case 'テーラーアラクネ':A(true,`先頭の${['攻撃力','防御力','魔法力'][raw[0].indexOf(Math.max(...raw[0]))]} +30%`,'補正前最大・同率は攻撃→防御→魔法');B(!first&&names[0]!=='テーラーアラクネ','先頭キャラ本人の固有②を追加適用','固有①・カスタムは対象外');break;
    case 'レイヴン':{const h=tribeCount('ハーピー');A(h>=2,`探索時間 −${h>=3?20:15}%`,`ハーピー族 ${h}人`);B(info.duration<=96*minute,'自身の攻撃・魔法 +10%','最終探索時間96分以下');break;}
    case 'オーパーツ':A(u.energy>=100,'自身の攻撃・防御 +6%',`開始前元気 ${u.energy} / 100以上`);B(true,'物質族全員の防御 +5%');break;
    case '中級妖狐':{const target=raw.findIndex(v=>v[2]===Math.max(...raw.map(x=>x[2])));A(true,`${target+1}番 ${names[target]} の魔法 +10%`,'補正前最大・同率は編成順');B(species>=4||foxOnly(members),'到達度要求EP −5%','4種族以上または妖狐のみ（ボス条件は軽減しない）');break;}
    case '黒土偶':A(first,'探索時間 +20%／自身の攻撃・防御 +15%','先頭配置');B(info.duration>=120*minute,`大成功率 +${info.duration>=180*minute?25:5}ポイント`,'最終探索時間120分以上／180分で最大');break;
    case '枯木の精':A(info.rate<=.4+1e-10,'自身の魔法 +100%',`最終大成功率 ${Math.round(info.rate*10000)/100}% / 40%以下`);B((info.luck??members.reduce((a,x)=>a+luckOf(x),0))<=40,'自身の攻撃 +50%','探索中合計幸運40以下');break;
    case 'カーミラ':A(info.carmillaActive?.includes(u.uid)||false,`自身の元気 −${extraCost(members,u)}（追加）／全員の幸運 +5`,'通常消費・シルフィ・フォレストリッチ分を確保後');B('end','自身の元気 +20','1体以上加入（通常・救済・特殊・ボス）、探索につき1回');break;
    case 'シスターサキュバス':A(true,'全員の通常消費 +50%／大成功率 +20ポイント／大成功報酬倍率 +50ポイント');B('end','元気50%以下の1人を最大まで回復','大成功時・終了時回復前・自身含む・均等抽選');break;
    case 'ヴァンパイア':A(true,'自身の通常消費元気 +100%／自身の実効EP +30%');B('end','自身の元気 +20','大成功時のみ');break;
   }
  }return result;
 }
 function recoverAtEnd(members,info,ts,great,rng=Math.random,recruited=[]){
  const energyBefore=Object.fromEntries(members.map(u=>[u.uid,u.energy]));const effects=[],outcomes=[],costs=[];
  const pick=a=>a[Math.floor(rng()*a.length)];const add=(u,n,source)=>effects.push({uid:u.uid,amount:n,source});const miss=(u,reason)=>outcomes.push(`${members.indexOf(u)+1}番 ${name(u)}：${reason}`);
  const statsTotal=info.rawTotals||members.reduce((v,u)=>{baseStats(u).forEach((x,i)=>v[i]+=x);return v},[0,0,0]);
  for(const u of members){const n=name(u),k2=copies2(members,u);
   if(n==='スライム娘'){add(u,10,n);const others=members.filter(x=>x.uid!==u.uid);if(others.length)add(pick(others),10,n)}
   if(n==='フェアリー'){const eligible=members.filter(x=>x.uid!==u.uid&&energyBefore[x.uid]<=20);if(eligible.length)add(pick(eligible),50,n);else miss(u,'固有① 対象者なし')}
   if(n==='アルラウネ')members.forEach(x=>add(x,5,n));
   if(n==='エルフ'){if(isTop(statsTotal,2))add(u,10*k2,n);else miss(u,'固有② 条件不成立')}
   if(n==='ナメクジ娘'){if(rng()<.5)add(u,20,n);else miss(u,'固有① 50%抽選不成立')}
   if(n==='デーモン')for(let k=0;k<k2;k++){const eligible=members.filter(x=>energyBefore[x.uid]===0);if(eligible.length)add(pick(eligible),20,n);else miss(u,'固有② 対象者なし')}
   if(n==='ロイド'){
    u.cooldowns ||= {};
    if(u.cooldowns.a==null||ts-u.cooldowns.a>=12*3600000){members.forEach(x=>add(x,10,n+'①'));u.cooldowns.a=ts}else miss(u,'固有① 12時間制限中')
    if(energyBefore[u.uid]<=50&&(u.cooldowns.b==null||ts-u.cooldowns.b>=12*3600000)){add(u,20*k2,n+'②');u.cooldowns.b=ts}else miss(u,energyBefore[u.uid]>50?'固有② 元気50以下の条件不成立':'固有② 12時間制限中')
   }
   if(n==='メイドデビル')for(let k=0;k<k2;k++){const others=members.filter(x=>x.uid!==u.uid);if(great&&others.length)add(pick(others),15,n);else miss(u,'固有② 大成功条件不成立')}
   if(n==='メイドミノタウロス'){if(great)members.forEach(x=>add(x,7*k2,n));else miss(u,'固有② 大成功条件不成立')}
   if(n==='シルキー'&&members.length)add(members[0],10,n);
   if(n==='フォレストメイジ'){if(great){const min=Math.min(...members.map(x=>energyBefore[x.uid]));add(pick(members.filter(x=>energyBefore[x.uid]===min)),50,n+'①')}else miss(u,'固有① 大成功条件不成立')}
   if(n==='スリーピィ'){const zero=members.filter((x,i)=>info.individualEP?.[i]===0);if(zero.length)zero.forEach(x=>add(x,50*k2,n));else miss(u,'固有② 実効EP0の対象なし')}
   if(n==='フォレストリッチ'&&u===members[0])for(let k=0;k<k2;k++){if(energyBefore[u.uid]<=50){const eligible=members.filter(x=>x!==u&&energyBefore[x.uid]+costs.filter(e=>e.uid===x.uid).reduce((a,e)=>a+e.amount,0)>=extraCost(members,x));if(eligible.length){const x=pick(eligible),cost=extraCost(members,x);costs.push({uid:x.uid,amount:-cost,source:n+'②'});add(u,20,n+'②')}else miss(u,'固有② 追加元気を支払える対象なし')}else miss(u,'固有② 元気50以下の条件不成立')}
   if(n==='モモイロナメクジ'){if(great||rng()<.5)members.forEach(x=>add(x,5,n));else miss(u,'固有① 50%抽選不成立')}
   if(n==='カーミラ'){if(recruited.length)add(u,20*k2,n+'②');else miss(u,'固有② 勧誘成功なし');}
   if(n==='シスターサキュバス')for(let k=0;k<k2;k++){const eligible=members.filter(x=>energyBefore[x.uid]/maxEnergy(x)<=.5);if(great&&eligible.length){const x=pick(eligible);add(x,maxEnergy(x)-energyBefore[x.uid],n+'②')}else miss(u,great?'固有② 対象者なし':'固有② 大成功条件不成立');}
   if(n==='ヴァンパイア'){if(great)add(u,20*k2,n);else miss(u,'固有② 大成功条件不成立')}
  }
  for(const c of info.customRecovery||[]){const u=members.find(x=>x.uid===c.uid);if(u){if(c.normal)add(u,c.normal,"カスタム：終了時回復");if(great&&c.great)add(u,c.great,"カスタム：大成功時回復")}}
  // 全回復対象は、同時に発生した吸収消費も含めて最大まで戻す。
  for(const uid of new Set(effects.filter(e=>e.source==='シスターサキュバス②').map(e=>e.uid))){const spent=-costs.filter(e=>e.uid===uid).reduce((a,e)=>a+e.amount,0);if(spent)effects.find(e=>e.uid===uid&&e.source==='シスターサキュバス②').amount+=spent;}
  const mageCount=count2(members,'フォレストメイジ');
  if(mageCount){for(const u of members){const total=effects.filter(e=>e.uid===u.uid).reduce((a,e)=>a+e.amount,0);const bonus=Math.floor(total*mageCount/5);if(bonus)add(u,bonus,'フォレストメイジ②（回復量強化）')}}
  effects.push(...costs);
  if(["rest","luxRest"].includes(info.item))members.forEach(u=>add(u,info.item==="rest"?10:20,ITEMS[info.item].name));
  const sums={};effects.forEach(e=>sums[e.uid]=(sums[e.uid]||0)+e.amount);
  members.forEach(u=>{u.energy=Math.max(0,Math.min(maxEnergy(u),u.energy+(sums[u.uid]||0)));u.regenAt=ts});
  return {effects,outcomes,energyBefore,energyAfter:Object.fromEntries(members.map(u=>[u.uid,u.energy]))};
 }
 return {evaluate,recoverAtEnd,targetsForAlraune,statuses};
})();
