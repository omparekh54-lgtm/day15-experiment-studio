export type ExperimentRow = {
  variant: string;
  converted: number;
  userId?: string;
  segment?: string;
};

export type VariantSummary = {
  variant: string;
  n: number;
  conversions: number;
  rate: number;
};

export type ExperimentResult = {
  control: VariantSummary;
  treatment: VariantSummary;
  absoluteLift: number;
  relativeLift: number | null;
  z: number;
  pValue: number;
  ciLow: number;
  ciHigh: number;
  significant: boolean;
  srmPValue: number;
  srmFlag: boolean;
  observedPower: number;
};

function erf(x: number) {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return sign * y;
}

function normalCdf(x: number) { return 0.5 * (1 + erf(x / Math.sqrt(2))); }

export function parseCsv(text: string): ExperimentRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const parseLine = (line: string) => {
    const out: string[] = []; let cur = ""; let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
        else quoted = !quoted;
      } else if (c === ',' && !quoted) { out.push(cur.trim()); cur = ""; }
      else cur += c;
    }
    out.push(cur.trim()); return out;
  };
  const headers = parseLine(lines[0]).map(h => h.toLowerCase());
  const idx = (names: string[]) => headers.findIndex(h => names.includes(h));
  const variantIdx = idx(["variant", "group", "arm"]);
  const convertedIdx = idx(["converted", "conversion", "outcome", "success"]);
  const userIdx = idx(["user_id", "userid", "id"]);
  const segmentIdx = idx(["segment", "country", "device", "plan"]);
  if (variantIdx < 0 || convertedIdx < 0) throw new Error("CSV needs variant and converted columns.");
  return lines.slice(1).map(parseLine).map(cols => ({
    variant: cols[variantIdx]?.trim() || "",
    converted: /^(1|true|yes|converted|success)$/i.test(cols[convertedIdx] || "") ? 1 : 0,
    userId: userIdx >= 0 ? cols[userIdx] : undefined,
    segment: segmentIdx >= 0 ? cols[segmentIdx] : undefined
  })).filter(r => r.variant);
}

export function summarize(rows: ExperimentRow[]): VariantSummary[] {
  const map = new Map<string, {n:number; c:number}>();
  rows.forEach(r => { const v = map.get(r.variant) || {n:0,c:0}; v.n++; v.c += r.converted; map.set(r.variant, v); });
  return [...map.entries()].map(([variant, v]) => ({variant, n:v.n, conversions:v.c, rate:v.n ? v.c/v.n : 0})).sort((a,b)=>b.n-a.n);
}

export function analyze(rows: ExperimentRow[], controlName?: string, treatmentName?: string): ExperimentResult {
  const sums = summarize(rows);
  if (sums.length < 2) throw new Error("At least two experiment variants are required.");
  const control = sums.find(s=>s.variant===controlName) || sums[0];
  const treatment = sums.find(s=>s.variant===treatmentName && s.variant!==control.variant) || sums.find(s=>s.variant!==control.variant)!;
  const pPool = (control.conversions + treatment.conversions)/(control.n+treatment.n);
  const se = Math.sqrt(Math.max(1e-12, pPool*(1-pPool)*(1/control.n+1/treatment.n)));
  const absoluteLift = treatment.rate-control.rate;
  const z = absoluteLift/se;
  const pValue = 2*(1-normalCdf(Math.abs(z)));
  const seUnpooled = Math.sqrt(control.rate*(1-control.rate)/control.n + treatment.rate*(1-treatment.rate)/treatment.n);
  const ciLow = absoluteLift - 1.96*seUnpooled;
  const ciHigh = absoluteLift + 1.96*seUnpooled;
  const total = control.n+treatment.n;
  const expected = total/2;
  const chi2 = ((control.n-expected)**2)/expected + ((treatment.n-expected)**2)/expected;
  const srmPValue = 2*(1-normalCdf(Math.sqrt(chi2)));
  const effectZ = Math.abs(absoluteLift)/(seUnpooled || 1e-9);
  const observedPower = Math.max(0, Math.min(1, normalCdf(effectZ-1.96)+normalCdf(-effectZ-1.96)));
  return { control, treatment, absoluteLift, relativeLift: control.rate ? absoluteLift/control.rate : null, z, pValue, ciLow, ciHigh, significant:pValue<0.05, srmPValue, srmFlag:srmPValue<0.01, observedPower };
}

export function sampleSizePerVariant(baselineRate: number, relativeMde: number, alpha=0.05, power=0.8) {
  const p1 = baselineRate; const p2 = baselineRate*(1+relativeMde);
  if (!(p1>0 && p1<1 && p2>0 && p2<1)) throw new Error("Rates must stay between 0 and 1.");
  const zAlpha = alpha===0.01 ? 2.576 : 1.96;
  const zPower = power>=0.9 ? 1.282 : 0.842;
  const pBar=(p1+p2)/2;
  const numerator = (zAlpha*Math.sqrt(2*pBar*(1-pBar)) + zPower*Math.sqrt(p1*(1-p1)+p2*(1-p2)))**2;
  return Math.ceil(numerator/((p2-p1)**2));
}

export function detectableRelativeLift(baselineRate:number, nPerVariant:number) {
  let lo=0.001, hi=Math.min(3, 0.999/baselineRate-1);
  for(let i=0;i<50;i++){ const mid=(lo+hi)/2; const n=sampleSizePerVariant(baselineRate, mid); if(n>nPerVariant) lo=mid; else hi=mid; }
  return hi;
}

export function segmentResults(rows: ExperimentRow[]) {
  const segments=[...new Set(rows.map(r=>r.segment).filter(Boolean))] as string[];
  return segments.map(segment=>{
    const subset=rows.filter(r=>r.segment===segment);
    try { const result=analyze(subset); return {segment, n:subset.length, lift:result.absoluteLift, pValue:result.pValue}; }
    catch { return null; }
  }).filter(Boolean) as {segment:string;n:number;lift:number;pValue:number}[];
}

export function exportDecisionMemo(result: ExperimentResult, meta: {name:string; hypothesis:string; primaryMetric:string}) {
  const decision = result.srmFlag ? "INVESTIGATE RANDOMIZATION" : result.significant && result.ciLow>0 ? "SHIP / CONSIDER ROLLOUT" : result.significant && result.ciHigh<0 ? "DO NOT SHIP" : "INCONCLUSIVE";
  return [
    `Experiment: ${meta.name}`,
    `Hypothesis: ${meta.hypothesis}`,
    `Primary metric: ${meta.primaryMetric}`,
    `Control: ${(result.control.rate*100).toFixed(2)}% (n=${result.control.n})`,
    `Treatment: ${(result.treatment.rate*100).toFixed(2)}% (n=${result.treatment.n})`,
    `Absolute lift: ${(result.absoluteLift*100).toFixed(2)} pp`,
    `95% CI: ${(result.ciLow*100).toFixed(2)} to ${(result.ciHigh*100).toFixed(2)} pp`,
    `p-value: ${result.pValue.toFixed(4)}`,
    `SRM p-value: ${result.srmPValue.toFixed(4)}`,
    `Decision: ${decision}`,
    `Evidence note: Statistical significance is not business impact or guaranteed causal lift beyond this randomized experiment. Segment results are exploratory unless pre-specified.`
  ].join("\n");
}
