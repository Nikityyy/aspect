import itemBank from './assessment/items.json' with { type: 'json' };
import { evaluateAssessment, ASSESSMENT_VERSION, SCORING_VERSION } from './assessment/scoring.js';
import en from './i18n/en.json' with { type: 'json' };
import de from './i18n/de.json' with { type: 'json' };
import itemsEn from './i18n/items-en.json' with { type: 'json' };
import itemsDe from './i18n/items-de.json' with { type: 'json' };
import { saveRun, readRun, readHistory, saveHistory, removeHistory, removeRun, clearLocalData } from './storage/store.js';
import { makeResultPng } from './export/png.js';
import { translate } from './i18n/translate.js';

const locale = { en, de };
const itemText = { en: itemsEn, de: itemsDe };
const SECTION_ORDER = ['social','communication','patterns','sensory','development','adaptation','impact','other','checks'];
const state = { lang: localStorageSafe('aspect-language') || ((navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en'), screen:'intro', index:0, answers:{}, startedAt:null, viewedResult:null, assessment:null, runId:null, saveFailed:false, advanceTimer:null, keyboardNavigation:false, keyboardNavigationTimer:null };
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const t = (key, fallback='') => translate(locale[state.lang],key,fallback);
function localStorageSafe(key) { try { return localStorage.getItem(key); } catch { return null; } }
function getQuestions() { return [...itemBank].sort((a,b) => SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section) || itemBank.indexOf(a) - itemBank.indexOf(b)); }
const questions = getQuestions();
function textFor(item) { return itemText[state.lang][item.id]; }
function setText(node, value) { node.textContent = value; }
function applyLocale() {
  document.documentElement.lang = state.lang;
  document.title = t('meta.title');
  document.querySelector('meta[name="description"]').content = t('meta.description');
  $('#adultConfirm').setAttribute('aria-label', t('consent.adultConfirm'));
  $$('[data-i18n]').forEach(node => setText(node, t(node.dataset.i18n, node.textContent)));
  $$('[data-lang]').forEach(button => { button.classList.toggle('active', button.dataset.lang === state.lang); button.setAttribute('aria-pressed', button.dataset.lang === state.lang ? 'true' : 'false'); });
  $$('[data-i18n-aria]').forEach(node => node.setAttribute('aria-label',t(node.dataset.i18nAria,node.getAttribute('aria-label')||'')));
  $('.group.connected').setAttribute('aria-label', t('aria.language'));
  $('#homeButton').setAttribute('aria-label', t('aria.home'));
  $('#progressBar').setAttribute('aria-label', t('aria.progress'));
  if (state.screen === 'quiz') renderQuestion(false);
  if (state.screen === 'results') renderResults(state.viewedResult);
  if (state.screen === 'method') renderMethod();
  if ($('#historyDrawer').open) renderHistory();
  updateResume();
}
function showScreen(name) {
  if(name!=='quiz'){window.clearTimeout(state.advanceTimer);state.advanceTimer=null;}
  state.screen = name;
  $$('.screen').forEach(screen => { screen.hidden = screen.dataset.screen !== name; });
  const quizProgress = name === 'quiz' ? progressPercent() : name === 'results' ? 100 : 0;
  $('#progressBar').value = quizProgress;
  $('#progressBar').hidden = !['quiz','results'].includes(name);
  window.scrollTo({top:0,behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
  updateResume();
}
function updateResume() {
  const saved = readRun();
  const valid = saved && saved.assessmentVersion === ASSESSMENT_VERSION && Object.keys(saved.answers || {}).length > 0 && !saved.completed;
  $('#startOverButton').hidden = !valid;
  $('#startLabel').textContent=t(valid?'actions.resume':'actions.start');
}
function startAssessment(resume=false) {
  const saved = resume ? readRun() : null;
  state.answers = saved?.answers && typeof saved.answers === 'object' ? saved.answers : {};
  state.index = saved && Number.isInteger(saved.currentIndex) ? Math.max(0,Math.min(saved.currentIndex,questions.length-1)) : 0;
  state.startedAt = saved?.startedAt || new Date().toISOString(); state.runId = saved?.id || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  state.viewedResult=null; state.saveFailed=false;
  saveCurrentRun(); renderQuestion(); showScreen('quiz');
}
function saveCurrentRun(completed=false) {
  const payload={id:state.runId,assessmentVersion:ASSESSMENT_VERSION,language:state.lang,startedAt:state.startedAt,updatedAt:new Date().toISOString(),currentIndex:state.index,answers:state.answers,completed};
  state.saveFailed=!saveRun(payload);
  $('#saveState').textContent=t(state.saveFailed?'quiz.unsaved':'quiz.saved');
  $('#saveState').classList.toggle('error-text',state.saveFailed);
}
function renderProgress() {
  const percent=progressPercent();
  setText($('#progressText'),`${percent}%`);
  $('#inlineProgress').value=percent;
  $('#progressBar').value=state.screen==='quiz'?percent:state.screen==='results'?100:0;
}
function progressPercent() {
  const complete=questions.filter(item=>{
    const answer=state.answers[item.id];if(!answer)return false;if(answer.declined)return true;
    if(item.type==='development')return numberValue(answer.current)&&(numberValue(answer.childhood)||answer.childhoodUnknown);
    return numberValue(answer.value);
  }).length;
  return Math.round((complete/questions.length)*100);
}
function renderQuestion(focusQuestion=true) {
  const item=questions[state.index]; if (!item) return;
  setText($('#questionSection'),t(`quiz.section.${item.section}`));
  setText($('#questionCount'),`${state.index+1} ${t('quiz.of')} ${questions.length}`);
  setText($('#questionText'),textFor(item));
  setText($('#questionHint'),t(item.type==='development'?'quiz.currentHelp':'quiz.sectionTip'));
  $('#backButton').disabled=state.index===0;
  renderProgress();
  setText($('#saveState'),t(state.saveFailed?'quiz.unsaved':'quiz.saved'));
  const area=$('#answerArea'); area.replaceChildren(); area.classList.remove('large-space');
  const scaleKey=item.type==='impact'?'quiz.scale.impact':'quiz.scale.frequency';
  const scaleGuide=document.createElement('p');
  scaleGuide.className='s12 s small-text secondary-text';
  scaleGuide.textContent=t(scaleKey).map((word,index)=>`${index+1} ${word}`).join(' · ')+(item.type==='development'?` · ? ${t('quiz.dontRemember')}`:'');
  area.append(scaleGuide);
  if(item.type==='development') renderDevelopment(area,item); else renderScale(area,item);
  const questionHeading=$('#questionText');
  if(focusQuestion) questionHeading.focus({preventScroll:true});
  else if(document.activeElement===questionHeading) questionHeading.blur();
}
function createScaleGroup(parent, label, values, selected, onChoose, groupName, unknown=false, groupClass='s12') {
  const group=document.createElement('fieldset'); group.className=`${groupClass} no-border no-padding`;
  const legend=document.createElement('legend'); legend.textContent=label; group.append(legend);
  const compactChoices=document.createElement('div'); compactChoices.className='grid no-space s';
  const fullChoices=document.createElement('div'); fullChoices.className='grid small-space no-margin m l';
  const labels=t(values);
  const addChoice=(container,word,value,isUnknown=false,compact=false)=>{
    const control=document.createElement('label'); control.className=compact?'radio large s2':'radio s12 m4 l3';
    const radio=document.createElement('input');radio.type='radio';radio.name=groupName;radio.value=isUnknown?'unknown':String(value);radio.id=`${groupName}-${compact?'compact':'full'}-${isUnknown?'unknown':value}`;radio.setAttribute('aria-label',isUnknown?word:`${value+1}. ${word}`);radio.checked=selected===value;
    const copy=document.createElement('span');copy.textContent=compact?(isUnknown?'?':String(value+1)):(isUnknown?word:`${value+1}. ${word}`);
    radio.addEventListener('change',()=>{if(radio.checked)onChoose(value);});
    control.append(radio,copy); container.append(control);
  };
  labels.forEach((word,value)=>{addChoice(compactChoices,word,value,false,true);addChoice(fullChoices,word,value);});
  if(unknown){const word=t('quiz.dontRemember');addChoice(compactChoices,word,null,true,true);addChoice(fullChoices,word,null,true);}
  group.append(compactChoices,fullChoices); parent.append(group);
}
function renderScale(area,item) {
  const answer=state.answers[item.id];
  createScaleGroup(area,t(item.type==='impact'?'quiz.impactInstruction':'quiz.answerInstruction'),item.type==='impact'?'quiz.scale.impact':'quiz.scale.frequency',answer?.value ?? undefined,value=>chooseValue(item,value),`answer-${item.id}`);
}
function renderDevelopment(area,item) {
  const answer=state.answers[item.id]||{};
  state.activePeriod=numberValue(answer.childhood)||answer.childhoodUnknown?'current':'childhood';
  createScaleGroup(area,t('quiz.period.childhood'),'quiz.scale.frequency',answer.childhoodUnknown?null:(answer.childhood ?? undefined),value=>choosePeriod(item,'childhood',value),`period-${item.id}-childhood`,true,'s12');
  createScaleGroup(area,t('quiz.period.current'),'quiz.scale.frequency',answer.current ?? undefined,value=>choosePeriod(item,'current',value),`period-${item.id}-current`,false,'s12');
}
function chooseValue(item,value) {
  state.answers[item.id]= {value}; saveCurrentRun(); renderProgress(); scheduleAdvance(state.keyboardNavigation?650:155,state.keyboardNavigation);
}
function choosePeriod(item,period,value) {
  const prior=state.answers[item.id]||{};
  state.answers[item.id]={...prior,[period]:value,...(period==='childhood'?{childhoodUnknown:value===null}:{})};
  state.activePeriod=period==='childhood'?'current':'childhood';
  saveCurrentRun(); renderProgress();
  const next=state.answers[item.id]; if((numberValue(next.childhood)||next.childhoodUnknown) && numberValue(next.current)) scheduleAdvance(state.keyboardNavigation?650:165,state.keyboardNavigation);
}
function numberValue(v){return Number.isInteger(v)&&v>=0&&v<=4;}
function scheduleAdvance(delay,focusQuestion=false){window.clearTimeout(state.advanceTimer);state.advanceTimer=window.setTimeout(()=>{state.advanceTimer=null;nextQuestion(focusQuestion);},delay);}
function nextQuestion(focusQuestion=true) {
  window.clearTimeout(state.advanceTimer);state.advanceTimer=null;
  if(state.index<questions.length-1){state.index++;saveCurrentRun();renderQuestion(focusQuestion);}
  else completeAssessment();
}
function goBack(){window.clearTimeout(state.advanceTimer);state.advanceTimer=null;if(state.index>0){state.index--;saveCurrentRun();renderQuestion();}}
function skipQuestion(){ const item=questions[state.index]; state.answers[item.id]={declined:true}; if(item.type==='development')state.answers[item.id]={declined:true,childhoodUnknown:false}; saveCurrentRun(); nextQuestion(); }
function completeAssessment() {
  const result=evaluateAssessment(questions,state.answers);
  const snapshot={...result,id:state.runId,completedAt:new Date().toISOString(),startedAt:state.startedAt,answers:state.answers};
  state.viewedResult=snapshot; state.assessment=result;
  saveCurrentRun(true); saveHistory(snapshot); renderResults(snapshot); showScreen('results');
}
function fmtDate(date) {return new Intl.DateTimeFormat(state.lang==='de'?'de-DE':'en-US',{year:'numeric',month:'long',day:'numeric'}).format(new Date(date));}
function scoreText(score){return score===null||score===undefined?t('results.scoreUnavailable'):`${Math.round(score)}`;}
function renderResults(snapshot=state.viewedResult) {
  if(!snapshot)return; state.viewedResult=snapshot;
  const result=snapshot.domains?snapshot: snapshot.result;
  if(!result)return;
  state.assessment=result;
  setText($('#resultTitle'),t(`results.${result.classification}`));
  setText($('#resultDate'),fmtDate(snapshot.completedAt||new Date().toISOString()));
  const strongestDomains=['socialReciprocity','nonverbalCommunication','relationships','repetitiveBehaviour','sameness','focusedInterests','sensory','developmentChildhood','masking','functionalImpact'].map(key=>({key,score:result.domains[key]?.score})).filter(item=>item.score!==null&&item.score!==undefined&&item.score>=55).sort((a,b)=>b.score-a.score).slice(0,3).map(item=>t(`domain.${item.key}`));
  const summary=t(`results.summary.${result.classification}`)+(strongestDomains.length?` ${t('results.summaryAreas')}: ${strongestDomains.join(' · ')}.`:'');
  setText($('#resultSummary'),summary);
  const domainKeys=['socialReciprocity','nonverbalCommunication','relationships','repetitiveBehaviour','sameness','focusedInterests','sensory','developmentChildhood','masking','functionalImpact'];
  const list=$('#domainList');list.replaceChildren();
  domainKeys.forEach(key=>{
    const entry=result.domains[key],row=document.createElement('tr'),title=document.createElement('th'),barCell=document.createElement('td'),scoreCell=document.createElement('td');
    title.scope='row';title.textContent=t(`domain.${key}`);
    if(entry?.partial){const marker=document.createElement('small');marker.className='small-text secondary-text';marker.textContent=` · ${t('results.partial')}`;title.append(marker);}
    const bar=document.createElement('progress');bar.className='small';bar.max=100;bar.setAttribute('aria-label',`${t(`domain.${key}`)}: ${scoreText(entry?.score)}`);
    if(entry?.score!==null&&entry?.score!==undefined)bar.value=entry.score;else bar.hidden=true;
    barCell.append(bar);scoreCell.textContent=scoreText(entry?.score);row.append(title,barCell,scoreCell);list.append(row);
  });
  const contexts=[['adhd','results.otherHigh'],['socialAnxiety','results.anxietyHigh'],['ocd','results.ocdHigh'],['depression','results.depressionHigh']]; const contextList=$('#contextList');contextList.replaceChildren();let count=0;
  contexts.forEach(([key,copyKey])=>{
    const score=result.domains[key]?.score;if(score===null||score===undefined)return;count++;
    const item=document.createElement('li'),content=document.createElement('div'),head=document.createElement('div'),name=document.createElement('span'),value=document.createElement('b'),copy=document.createElement('p');
    content.className='max';head.className='row';name.className='max';name.textContent=t(`domain.${key}`);value.textContent=scoreText(score);head.append(name,value);copy.className='small-text secondary-text';copy.textContent=t(copyKey);content.append(head,copy);item.append(content);contextList.append(item);
  });
  if(!count){const item=document.createElement('li');item.className='secondary-text';item.textContent=t('results.noContext');contextList.append(item);}
  const q=result.quality||{level:'limited'};setText($('#qualityTitle'),t(`results.quality.${q.level}`));setText($('#qualityCopy'),t(`results.quality.${q.level}Copy`));
  const dev=result.developmental||{level:'limited',uncertain:true};setText($('#childhoodTitle'),t(`results.childhood.${dev.level}`));setText($('#childhoodCopy'),dev.uncertain?t('results.devUncertain'):t(`results.childhood.${dev.level}Copy`));
  setText($('#standsOutCopy'),result.features?.maskingInterpretation?t('results.masking'):t('results.standsOutBase'));
  let complicates=t('results.complicatesBase'); if(q.level==='limited')complicates=t('results.quality.limitedCopy');else if(result.features?.informationInsufficient)complicates=t('results.complicatesMissing');setText($('#complicatesCopy'),complicates);
  setText($('#nextStepCopy'),t(`results.next${result.classification[0].toUpperCase()}${result.classification.slice(1)}`));
}
function renderMethod(){
  const root=$('#methodContent');root.replaceChildren();
  t('method.sections').forEach(section=>{
    const capability=Array.isArray(section.items),block=document.createElement('section');
    block.className='s12';
    const title=document.createElement('h2');title.className='h6';title.textContent=section.title;block.append(title);
    if(capability){const list=document.createElement('ul');list.className='horizontal-padding';for(const copy of section.items){const item=document.createElement('li');item.textContent=copy;list.append(item);}block.append(list);}
    else{const copy=document.createElement('p');copy.textContent=section.copy;block.append(copy);}
    root.append(block);
  });
}
function confirmAction(messageKey,titleKey,confirmKey) {
  const dialog=$('#confirmDialog');
  setText($('#confirmTitle'),t(titleKey));
  setText($('#confirmCopy'),t(messageKey));
  setText($('#confirmCancel'),t('actions.cancel'));
  setText($('#confirmAccept'),t(confirmKey));
  dialog.returnValue='';
  return new Promise(resolve=>{
    dialog.addEventListener('close',()=>resolve(dialog.returnValue==='confirm'),{once:true});
    try{dialog.showModal();}catch{resolve(false);}
  });
}
function notify(message){const toast=$('#toast');if(!toast)return;toast.textContent=message;toast.classList.add('active');window.setTimeout(()=>toast.classList.remove('active'),3000);}
async function exportPng(snapshot=state.viewedResult,share=false){if(!snapshot)return;try{const blob=await makeResultPng(snapshot,t,state.lang);if(share&&navigator.canShare&&navigator.canShare({files:[new File([blob],'aspect-result.png',{type:'image/png'})]})){await navigator.share({files:[new File([blob],'aspect-result.png',{type:'image/png'})],title:'Aspect'});notify(t('actions.shared'));return;}if(share){notify(t('actions.shareUnsupported'));return;}const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='aspect-screening-result.png';a.click();URL.revokeObjectURL(url);notify(t('actions.saved'));}catch{notify(t('actions.error'));}}
function getHistory(){return readHistory();}
function openHistory(open=true){const dialog=$('#historyDrawer');if(open){renderHistory();if(!dialog.open)dialog.showModal();}else if(dialog.open)dialog.close();}
function renderHistory(){
  const list=$('#historyList');list.replaceChildren();const history=getHistory();
  if(!history.length){const empty=document.createElement('li');empty.className='secondary-text';empty.textContent=t('history.empty');list.append(empty);return;}
  history.forEach(snapshot=>{
    const item=document.createElement('li');
    const info=document.createElement('div'),title=document.createElement('h3'),date=document.createElement('p'),actions=document.createElement('div');
    title.className='h6';title.textContent=t(`results.${snapshot.classification}`);date.className='small-text secondary-text';date.textContent=`${t('history.date')} · ${fmtDate(snapshot.completedAt)}`;info.append(title,date);actions.className='row wrap';
    const view=document.createElement('button');view.className='border round';view.type='button';view.textContent=t('actions.view');view.addEventListener('click',()=>{state.viewedResult=snapshot;renderResults(snapshot);showScreen('results');openHistory(false);});
    const save=document.createElement('button');save.className='border round';save.type='button';save.textContent=t('actions.savePng');save.addEventListener('click',()=>exportPng(snapshot));
    const del=document.createElement('button');del.className='border round error-text';del.type='button';del.textContent=t('actions.delete');del.addEventListener('click',async()=>{const reopen=$('#historyDrawer').open;openHistory(false);const confirmed=await confirmAction('history.removeConfirm','history.remove','actions.delete');if(confirmed)removeHistory(snapshot.id);if(reopen)openHistory();});
    actions.append(view,save,del);item.append(info,actions);list.append(item);
  });
}
async function clearData(){if(!await confirmAction('actions.deleteAllConfirm','actions.deleteDataTitle','actions.delete'))return;const cleared=clearLocalData();state.answers={};state.index=0;state.startedAt=null;state.viewedResult=null;state.assessment=null;state.runId=null;state.lang=(navigator.language||'en').toLowerCase().startsWith('de')?'de':'en';applyLocale();showScreen('intro');notify(t(cleared?'actions.deleted':'actions.deleteError'));}
async function startButtonAction(){const saved=readRun();if(saved&&saved.assessmentVersion===ASSESSMENT_VERSION&&!saved.completed&&Object.keys(saved.answers||{}).length){startAssessment(true);return;}$('#adultConfirm').checked=false;$('#beginButton').disabled=true;showScreen('consent');}
async function startOverButtonAction(){const saved=readRun();if(saved&&saved.assessmentVersion===ASSESSMENT_VERSION&&!saved.completed&&Object.keys(saved.answers||{}).length){if(!await confirmAction('actions.confirmRestart','actions.restartTitle','actions.restart'))return;}$('#adultConfirm').checked=false;$('#beginButton').disabled=true;showScreen('consent');}
$('#startButton').addEventListener('click',startButtonAction);
$('#startOverButton').addEventListener('click',startOverButtonAction);
$('#adultConfirm').addEventListener('change',e=>$('#beginButton').disabled=!e.target.checked);
$('#beginButton').addEventListener('click',()=>{if($('#adultConfirm').checked)startAssessment(false);});
$('#consentBack').addEventListener('click',()=>showScreen('intro'));
$('#homeButton').addEventListener('click',()=>showScreen('intro'));
$('#backButton').addEventListener('click',goBack);
$('#preferButton').addEventListener('click',skipQuestion);
$('#retakeButton').addEventListener('click',async()=>{if(await confirmAction('actions.newAssessment','actions.newAssessmentTitle','actions.restart')){state.answers={};state.index=0;state.startedAt=new Date().toISOString();state.runId=`${Date.now()}`;$('#adultConfirm').checked=false;$('#beginButton').disabled=true;showScreen('consent');}});
$('#savePngButton').addEventListener('click',()=>exportPng());$('#sharePngButton').addEventListener('click',()=>exportPng(state.viewedResult,true));
$('#historyButton').addEventListener('click',()=>openHistory());$('#historyCloseButton').addEventListener('click',()=>openHistory(false));
$('#deleteData').addEventListener('click',clearData);$('#confirmCancel').addEventListener('click',()=>$('#confirmDialog').close('cancel'));$('#confirmAccept').addEventListener('click',()=>$('#confirmDialog').close('confirm'));$('#methodBack').addEventListener('click',()=>showScreen('intro'));
$$('[data-open-method]').forEach(link=>link.addEventListener('click',e=>{e.preventDefault();renderMethod();showScreen('method');}));
$$('[data-lang]').forEach(button=>button.addEventListener('click',()=>{state.lang=button.dataset.lang;try{localStorage.setItem('aspect-language',state.lang);}catch{} applyLocale();if(state.screen==='quiz')saveCurrentRun();}));
document.addEventListener('keydown',event=>{
  if(state.screen!=='quiz')return;
  if(event.target instanceof HTMLInputElement&&event.target.type==='radio'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Enter'].includes(event.key)){
    state.keyboardNavigation=true;window.clearTimeout(state.keyboardNavigationTimer);
    state.keyboardNavigationTimer=window.setTimeout(()=>{state.keyboardNavigation=false;},1000);
    return;
  }
  if(event.altKey||event.ctrlKey||event.metaKey)return;
  if(/^[1-5]$/.test(event.key)){
    state.keyboardNavigation=false;window.clearTimeout(state.keyboardNavigationTimer);
    const item=questions[state.index],value=Number(event.key)-1,period=state.activePeriod||'childhood',name=item.type==='development'?`period-${item.id}-${period}`:`answer-${item.id}`,radio=document.querySelector(`input[type=radio][name=\"${name}\"][value=\"${value}\"]`);
    radio?.click();
  }
},true);
document.addEventListener('pointerdown',()=>{state.keyboardNavigation=false;window.clearTimeout(state.keyboardNavigationTimer);},true);
applyLocale();
const previous=readRun();if(previous&&previous.assessmentVersion!==ASSESSMENT_VERSION){removeRun();}
updateResume();
