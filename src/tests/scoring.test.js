import test from 'node:test';
import assert from 'node:assert/strict';
import items from '../assessment/items.json' with { type:'json' };
import { evaluateAssessment, HeuristicScreeningModel, ASSESSMENT_VERSION, SCORING_VERSION } from '../assessment/scoring.js';
import en from '../i18n/en.json' with { type:'json' };
import de from '../i18n/de.json' with { type:'json' };
import enItems from '../i18n/items-en.json' with { type:'json' };
import deItems from '../i18n/items-de.json' with { type:'json' };
import { translate } from '../i18n/translate.js';

function profile({domains={},child=0,current=0,unknown=0,missing=[],validQuality=true}={}) {
  const answers={};
  for(const item of items){
    if(missing.includes(item.id))continue;
    if(item.type==='development'){
      const childhoodIndex=Number(item.id.slice(3))-1;
      answers[item.id]={childhood:childhoodIndex<unknown?null:child,current};
      if(childhoodIndex<unknown)answers[item.id].childhoodUnknown=true;
      continue;
    }
    const desired=domains[item.domain]??0;
    answers[item.id]={value:item.reverse?4-desired:desired};
  }
  // Attention and semantic checks use the response direction that should agree with their comparison items.
  const rawForScored=(id,scored)=>{const item=items.find(entry=>entry.id===id);answers[id]={value:item.reverse?4-scored:scored};};
  const scoreOf=id=>{const item=items.find(entry=>entry.id===id);const raw=answers[id]?.value;return item.reverse?4-raw:raw;};
  const mean=ids=>ids.map(scoreOf).reduce((a,b)=>a+b,0)/ids.length;
  answers.quality01={value:Math.round(4-mean(['sc07','sc08']))};
  answers.quality02={value:Math.round(4-mean(['same01','same02','same03']))};
  answers.quality03={value:4-scoreOf('sen01')};
  answers.quality04={value:4-scoreOf('mask01')};
  answers.quality05={value:validQuality?2:0};answers.quality06={value:validQuality?1:4};
  return answers;
}
const highDomains={socialReciprocity:4,nonverbalCommunication:4,relationships:4,repetitiveBehaviour:4,sameness:4,focusedInterests:4,sensory:4,functionalImpact:4};
const highMask={...highDomains,masking:4};
const lowDomains={socialReciprocity:0,nonverbalCommunication:0,relationships:0,repetitiveBehaviour:0,sameness:0,focusedInterests:0,sensory:0,masking:0,functionalImpact:0};

test('item bank contains the 100 stable IDs exactly once and translation keys match',()=>{
  assert.equal(items.length,100);assert.equal(new Set(items.map(x=>x.id)).size,100);
  assert.deepEqual(Object.keys(enItems).sort(),items.map(x=>x.id).sort());assert.deepEqual(Object.keys(deItems).sort(),items.map(x=>x.id).sort());
  assert.deepEqual(Object.keys(en).sort(),Object.keys(de).sort());
  assert.ok(Array.isArray(translate(en,'method.sections')));assert.equal(translate(de,'actions.begin'),'Screening beginnen');
});
test('every reverse-coded item reverses before its domain average',()=>{
  const reversed=items.filter(item=>item.reverse);assert.ok(reversed.length>0);
  for(const item of reversed){
    const answers=profile({domains:{...lowDomains}});answers[item.id]={value:0};
    const result=evaluateAssessment(items,answers);const count=items.filter(x=>x.domain===item.domain).length;
    assert.equal(result.domains[item.domain].score,Math.round(100/count),item.id);
  }
});
test('reverse scoring and domain averaging use a 0–100 mean',()=>{
  const answers=profile({domains:{socialReciprocity:0}});answers.sc02={value:0};
  const result=evaluateAssessment(items,answers);
  assert.equal(result.domains.socialReciprocity.score,17); // one reversed item contributes 4; five contribute 0
});
test('missing answers are not treated as zero; exactly 20% missing remains partial',()=>{
  const answers=profile();delete answers.adhd01;
  let result=evaluateAssessment(items,answers);assert.equal(result.domains.adhd.score,0);assert.equal(result.domains.adhd.partial,true);
  delete answers.adhd02;result=evaluateAssessment(items,answers);assert.equal(result.domains.adhd.score,null);
});
test('developmental don’t-remember is missing, not a zero, and weak history is uncertain',()=>{
  const answers=profile({domains:highDomains,child:4,current:4,unknown:7});
  const result=evaluateAssessment(items,answers);
  assert.equal(result.developmental.uncertain,true);assert.equal(result.domains.developmentChildhood.score,null);
  assert.equal(result.developmental.childhoodAnswered,5);assert.equal(result.developmental.consistency,null);
});
test('an unfinished dual-time item does not count as complete until both periods are answered',()=>{
  const answers=profile({domains:lowDomains});answers.dev12={childhoodUnknown:true};
  const result=evaluateAssessment(items,answers);assert.equal(result.quality.answered,99);assert.equal(result.quality.completion,0.99);
});
test('developmental consistency uses overlap across known childhood/current pairs',()=>{
  const answers=profile({domains:highDomains,child:4,current:2});
  const result=evaluateAssessment(items,answers);assert.equal(result.developmental.consistency,50);
  assert.equal(result.domains.developmentChildhood.score,100);assert.equal(result.domains.developmentCurrent.score,50);
});
test('social and repetitive patterns require separate elevated subdomains',()=>{
  const elevated=evaluateAssessment(items,profile({domains:highDomains,child:4,current:4}));
  assert.equal(elevated.features.socialPattern,true);assert.equal(elevated.features.rrbPattern,true);assert.equal(elevated.classification,'elevated');
});
test('differential context stays parallel and never subtracts autism-related domains',()=>{
  const baseline=evaluateAssessment(items,profile({domains:{...lowDomains,adhd:4}}));
  const noContext=evaluateAssessment(items,profile({domains:lowDomains}));
  assert.equal(baseline.domains.socialReciprocity.score,noContext.domains.socialReciprocity.score);
  assert.equal(baseline.domains.adhd.score,100);assert.ok(baseline.features.differential.includes('adhd'));assert.equal(baseline.classification,'mixed');
});
test('high masking is contextual and can be interpreted with moderate social domains',()=>{
  const result=evaluateAssessment(items,profile({domains:{...lowDomains,socialReciprocity:2,masking:4}}));
  assert.equal(result.domains.socialReciprocity.score,50);assert.equal(result.domains.masking.score,100);assert.equal(result.features.maskingInterpretation,true);
});
test('attention checks contribute to response quality without treating one failed check as invalid',()=>{
  const answers=profile({domains:highDomains,child:4,current:4,validQuality:false});
  const result=evaluateAssessment(items,answers);assert.equal(result.quality.level,'moderate');assert.equal(result.quality.attentionPass,0);
});
test('semantic consistency checks identify disagreement without claiming intent',()=>{
  const answers=profile({domains:lowDomains});answers.quality01={value:0};
  const result=evaluateAssessment(items,answers);assert.equal(result.quality.inconsistencyCount,1);assert.equal(result.quality.level,'moderate');
});
test('consistency checks and completion classify limited responses cautiously',()=>{
  const answers=profile({domains:highDomains,child:4,current:4});
  for(const item of items.slice(0,30))delete answers[item.id];
  const result=evaluateAssessment(items,answers);assert.equal(result.quality.level,'limited');assert.equal(result.classification,'mixed');
});
test('synthetic profiles A–G produce expected contextual outputs',()=>{
  const A=evaluateAssessment(items,profile({domains:highDomains,child:4,current:4}));assert.equal(A.classification,'elevated');
  const B=evaluateAssessment(items,profile({domains:{...lowDomains,socialAnxiety:4}}));assert.equal(B.classification,'mixed');
  const C=evaluateAssessment(items,profile({domains:{...lowDomains,adhd:4}}));assert.equal(C.classification,'mixed');
  const D=evaluateAssessment(items,profile({domains:{...lowDomains,socialReciprocity:2,masking:4}}));assert.equal(D.features.maskingInterpretation,true);
  const E=evaluateAssessment(items,profile({domains:highDomains,child:4,current:4,unknown:8}));assert.equal(E.developmental.uncertain,true);assert.equal(E.classification,'elevated');
  const F=evaluateAssessment(items,profile({domains:highDomains,child:4,current:4,unknown:7}));assert.equal(F.developmental.childhoodAnswered,5);assert.equal(F.developmental.uncertain,true);
  const sparse=profile({domains:highDomains,child:4,current:4});for(const item of items.slice(0,30))delete sparse[item.id];
  const G=evaluateAssessment(items,sparse);assert.equal(G.quality.level,'limited');assert.equal(G.classification,'mixed');
});
test('screening model can be replaced behind the same feature interface',()=>{
  const replacement={version:'fixture-model-2',evaluate:features=>({classification:'mixed',features:{receivedDomains:Object.keys(features.domains).length}})};
  const result=evaluateAssessment(items,profile({domains:highDomains,child:4,current:4}),replacement);
  assert.equal(result.scoringVersion,'fixture-model-2');assert.equal(result.classification,'mixed');
  assert.ok(new HeuristicScreeningModel().version===SCORING_VERSION);
});
test('assessment and scoring versions are stored with every evaluated result',()=>{
  const result=evaluateAssessment(items,profile({domains:highDomains,child:4,current:4}));
  assert.equal(result.assessmentVersion,'aspect-items-0.1.0');assert.equal(result.scoringVersion,'aspect-score-0.1.0');
  assert.equal(result.assessmentVersion,ASSESSMENT_VERSION);assert.equal(result.scoringVersion,SCORING_VERSION);
});
test('saved-run restoration validates stable ID keyed answers and version',()=>{
  const store= new Map();globalThis.localStorage={setItem:(k,v)=>store.set(k,String(v)),getItem:k=>store.get(k)??null,removeItem:k=>store.delete(k)};
  return import('../storage/store.js').then(({saveRun,readRun,clearLocalData})=>{
    const run={assessmentVersion:ASSESSMENT_VERSION,currentIndex:37,answers:{sc01:{value:3},dev01:{childhood:2,current:3}}};
    assert.equal(saveRun(run),true);assert.deepEqual(readRun(),run);assert.equal(readRun().answers.dev01.current,3);clearLocalData();assert.equal(readRun(),null);delete globalThis.localStorage;
  });
});
test('saved results carry their assessment and scoring version independently',()=>{
  const result=evaluateAssessment(items,profile({domains:highDomains,child:4,current:4}));
  const saved={id:'fixture',completedAt:'2026-09-27T12:00:00.000Z',answers:{sc01:{value:3}},...result};
  assert.equal(saved.assessmentVersion,ASSESSMENT_VERSION);assert.equal(saved.scoringVersion,SCORING_VERSION);assert.deepEqual(saved.answers,{sc01:{value:3}});
});
