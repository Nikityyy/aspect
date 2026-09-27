export const ASSESSMENT_VERSION = 'aspect-items-0.1.0';
export const SCORING_VERSION = 'aspect-score-0.1.0';
export const THRESHOLDS = Object.freeze({
  domainElevated: 55,
  domainModerate: 40,
  childhoodSupport: 45,
  maskingContext: 65,
  differentialContext: 70,
  missingDomainMaximum: 0.2,
  minimumKnownChildhoodRatings: 6,
  strongChildhoodRatings: 9,
  qualityCompletionLimited: 0.75,
  qualityCompletionModerate: 0.9,
  semanticDiscrepancy: 2.5,
  requiredSocialSubdomains: 2,
  requiredRrbSubdomains: 2,
  expectedAttentionAnswers: Object.freeze({ quality05: 2, quality06: 1 }),
  requiredSemanticDiscrepanciesForLimited: 3
});
export const SOCIAL_DOMAINS = ['socialReciprocity', 'nonverbalCommunication', 'relationships'];
export const RRB_DOMAINS = ['repetitiveBehaviour', 'sameness', 'focusedInterests', 'sensory'];
const CONTEXT_DOMAINS = ['adhd', 'socialAnxiety', 'ocd', 'depression'];
const average = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const clamp = x => Math.max(0, Math.min(100, Math.round(x)));
const number = x => Number.isInteger(x) && x >= 0 && x <= 4;
function scoredValue(item, answer, field = 'value') {
  if (!answer || answer.declined || !number(answer[field])) return null;
  const value = answer[field];
  return item.reverse ? 4 - value : value;
}
function scoreDomain(items, answers, field = 'value') {
  const values = items.map(item => scoredValue(item, answers[item.id], field)).filter(v => v !== null);
  const missing = items.length - values.length;
  if (!items.length || missing / items.length > THRESHOLDS.missingDomainMaximum) return { score: null, partial: false, missing, total: items.length, answered: values.length };
  return { score: clamp(average(values) * 25), partial: missing > 0, missing, total: items.length, answered: values.length };
}
function getRawValue(id, answers) {
  const answer = answers[id];
  return answer && !answer.declined && number(answer.value) ? answer.value : null;
}
function qualitySummary(items, answers) {
  const countAnswered = items.filter(item => {
    const answer = answers[item.id];
    if (!answer || answer.declined) return false;
    if (item.type === 'development') return number(answer.current) && (number(answer.childhood) || answer.childhoodUnknown);
    return number(answer.value);
  }).length;
  const completion = countAnswered / items.length;
  const get = id => getRawValue(id, answers);
  const diff = [];
  // Each semantic pair is oriented so high values should agree after reverse direction is considered.
  for (const [checkId, referenceIds, reverseCheck] of [
    ['quality01', ['sc07','sc08'], true], ['quality02', ['same01','same02','same03'], true],
    ['quality03', ['sen01'], true], ['quality04', ['mask01'], true]
  ]) {
    const check = get(checkId); const references = referenceIds.map(id => ({ id, value: get(id) })).filter(entry => entry.value !== null);
    if (check === null || !references.length) continue;
    const orientedCheck = reverseCheck ? 4 - check : check;
    const orientedRefs = references.map(({id,value}) => {
      const refItem = items.find(item => item.id === id);
      return refItem?.reverse ? 4 - value : value;
    });
    diff.push(Math.abs(orientedCheck - average(orientedRefs)));
  }
  const attentionPass = (get('quality05') === THRESHOLDS.expectedAttentionAnswers.quality05 ? 1 : 0) + (get('quality06') === THRESHOLDS.expectedAttentionAnswers.quality06 ? 1 : 0);
  const inconsistencyCount = diff.filter(x => x >= THRESHOLDS.semanticDiscrepancy).length;
  let level = 'high';
  if (completion < THRESHOLDS.qualityCompletionLimited || (inconsistencyCount >= THRESHOLDS.requiredSemanticDiscrepanciesForLimited && attentionPass === 0)) level = 'limited';
  else if (completion < THRESHOLDS.qualityCompletionModerate || inconsistencyCount >= 1 || attentionPass < 2) level = 'moderate';
  return { level, completion, inconsistencyCount, attentionPass, semanticPairs: diff.length, answered: countAnswered, total: items.length };
}
/** @typedef {{ domains: Record<string, {score:number|null,partial:boolean}>, quality:{level:string}, developmental:{uncertain:boolean,contradictory:boolean} }} AssessmentFeatures */
/** @typedef {{ version:string, evaluate:(features:AssessmentFeatures)=>{classification:string,features:Record<string,unknown>} }} ScreeningModel */

export class HeuristicScreeningModel {
  constructor(){this.version=SCORING_VERSION;}
  /** @param {AssessmentFeatures} assessmentFeatures */
  evaluate(assessmentFeatures) {
    const {domains,quality,developmental} = assessmentFeatures;
    const social = SOCIAL_DOMAINS.map(key => domains[key]?.score ?? null);
    const rrb = RRB_DOMAINS.map(key => domains[key]?.score ?? null);
    const socialKnown = social.filter(x => x !== null);
    const rrbKnown = rrb.filter(x => x !== null);
    const socialPattern = socialKnown.length === SOCIAL_DOMAINS.length && social.filter(x => x >= THRESHOLDS.domainElevated).length >= THRESHOLDS.requiredSocialSubdomains && Math.min(...social) >= THRESHOLDS.domainModerate;
    const rrbPattern = rrbKnown.filter(x => x >= THRESHOLDS.domainElevated).length >= THRESHOLDS.requiredRrbSubdomains;
    const masking = domains.masking?.score ?? null;
    const developmentSupport = (domains.developmentChildhood.score ?? -1) >= THRESHOLDS.childhoodSupport || developmental.uncertain;
    const impactPresent = (domains.functionalImpact?.score ?? -1) >= THRESHOLDS.domainModerate;
    const differential = CONTEXT_DOMAINS.filter(key => (domains[key]?.score ?? -1) >= THRESHOLDS.differentialContext);
    const developmentalContradiction = developmental.contradictory;
    const informationInsufficient = [...social,...rrb].some(score => score === null);
    const onePattern = socialPattern || rrbPattern;
    const otherPatternModerate = socialKnown.some(x => x >= THRESHOLDS.domainModerate) && rrbKnown.some(x => x >= THRESHOLDS.domainModerate);
    const interpretationComplicated = developmentalContradiction || informationInsufficient || quality.level === 'limited' || differential.length > 0;
    let classification = 'lower';
    if (socialPattern && rrbPattern && (developmentSupport || masking >= THRESHOLDS.maskingContext) && !interpretationComplicated) classification = 'elevated';
    else if ((onePattern && otherPatternModerate) || interpretationComplicated) classification = 'mixed';
    const socialModerate = social.some(x => x !== null && x >= THRESHOLDS.domainModerate);
    const maskingInterpretation = masking !== null && masking >= THRESHOLDS.maskingContext && socialModerate;
    return { classification, features: { socialPattern, rrbPattern, developmentSupport, impactPresent, differential, maskingInterpretation, informationInsufficient, onePattern, otherPatternModerate } };
  }
}

export function evaluateAssessment(items, answers, model = new HeuristicScreeningModel()) {
  const domains = {};
  const regularDomains = [...new Set(items.filter(x => !['development','quality'].includes(x.domain)).map(x => x.domain))];
  for (const domain of regularDomains) domains[domain] = scoreDomain(items.filter(x => x.domain === domain), answers);
  const development = items.filter(x => x.domain === 'development');
  const childDomain = scoreDomain(development, answers, 'childhood');
  const currentDomain = scoreDomain(development, answers, 'current');
  const childValues = development.map(item => number(answers[item.id]?.childhood) ? answers[item.id].childhood : null).filter(x => x !== null);
  const currentValues = development.map(item => number(answers[item.id]?.current) ? answers[item.id].current : null).filter(x => x !== null);
  const overlapValues = development.map(item => {
    const a = answers[item.id];
    return number(a?.childhood) && number(a?.current) ? Math.min(a.childhood, a.current) : null;
  }).filter(x => x !== null);
  const childPercent = childValues.length / development.length;
  const developmentalUncertain = childValues.length < THRESHOLDS.minimumKnownChildhoodRatings;
  const consistency = overlapValues.length >= THRESHOLDS.minimumKnownChildhoodRatings ? clamp(average(overlapValues) * 25) : null;
  domains.developmentChildhood = {...childDomain, score: developmentalUncertain ? null : childDomain.score};
  domains.developmentCurrent = currentDomain;
  domains.developmentConsistency = {score:consistency, partial:overlapValues.length < development.length, answered:overlapValues.length,total:development.length,missing:development.length-overlapValues.length};
  const quality = qualitySummary(items, answers);
  const developmentalContradiction = childValues.length >= THRESHOLDS.minimumKnownChildhoodRatings && domains.developmentChildhood.score !== null && domains.developmentChildhood.score < THRESHOLDS.childhoodSupport;
  const childhoodLevel = childValues.length >= THRESHOLDS.strongChildhoodRatings ? 'strong' : childValues.length >= THRESHOLDS.minimumKnownChildhoodRatings ? 'partial' : 'limited';
  const developmental = { childhoodAnswered: childValues.length, childhoodConfidence: childPercent, currentAnswered: currentValues.length, consistency, uncertain: developmentalUncertain, contradictory: developmentalContradiction, level:childhoodLevel };
  const decision=model.evaluate({domains,quality,developmental});
  return {
    assessmentVersion: ASSESSMENT_VERSION, scoringVersion: model.version, ...decision, domains, quality, developmental
  };
}
