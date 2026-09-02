# Day 15 — Experiment Studio

Experiment Studio is an evidence-first A/B experimentation workbench for product, growth, and operations teams. It combines **pre-registration, sample-size planning, randomization diagnostics, transparent two-proportion inference, exploratory segment analysis, and an exportable decision memo** in one browser-local workflow.

## Why this is not just another A/B test calculator

Most lightweight experimentation tools start after the experiment is over and reduce the answer to a p-value. Experiment Studio begins **before launch** and keeps methodology visible throughout the workflow. The product asks: Was the hypothesis and primary metric pre-specified? Was enough traffic planned? Is the observed allocation plausible? How uncertain is the effect? Are subgroup results exploratory? What decision can the evidence legitimately support?

The market wedge is **methodological guardrails without enterprise experimentation infrastructure**.

## Core workflow

1. Pre-register experiment name, hypothesis, and primary metric.
2. Set baseline conversion, target relative MDE, and expected traffic.
3. Upload a row-level randomized experiment CSV.
4. Review control/treatment conversion rates, absolute lift, 95% CI, and p-value.
5. Check sample-ratio mismatch (SRM) before trusting the outcome.
6. Explore optional segments with explicit exploratory labeling.
7. Export a plain-text decision memo containing result and evidence caveats.

## Input contract

Required CSV columns:

- `variant` — treatment arm name.
- `converted` — binary outcome (`1/0`, `true/false`, `yes/no`, `converted`).

Optional:

- `user_id` — row identifier.
- `segment` — subgroup such as device, country, plan, or region.

The current primary analysis uses the two largest variants and expects approximately 50/50 randomization.

## Methodology

### Planning

Two-sided two-proportion sample-size approximation using α=0.05 and approximately 80% power. MDE is entered as a relative lift over the baseline rate.

### Primary analysis

- pooled two-proportion z-test
- unpooled standard error for 95% confidence interval on absolute lift
- absolute and relative lift
- p-value at the conventional 0.05 threshold

### Experiment integrity

SRM is checked using a 1-degree-of-freedom chi-square equivalent against an expected 50/50 split. `p < 0.01` is surfaced as a strong allocation/logging warning.

### Segments

Segment results reuse the transparent primary comparison but are explicitly described as **exploratory unless pre-specified**. The app does not perform multiplicity correction or pretend post-hoc subgroup discoveries are confirmatory evidence.

## Confidence & honesty layer

- **Known from data:** sample size, variant allocation, conversions.
- **Statistical estimate:** lift, confidence interval, p-value, SRM diagnostic.
- **Heuristic:** wording such as “evidence favors treatment” or “inconclusive.”
- **Not claimed:** guaranteed business lift, long-term effect, external validity, or causal claims when assignment was not truly randomized.

## Privacy

CSV parsing and analysis happen in the browser. This project has no application database or upload API for experiment rows.

## Tests

`npm test` covers quoted CSV parsing, positive-lift detection, MDE/sample-size behavior, SRM detection, segment analysis, and decision-memo evidence language.

## Limitations

- Binary conversion outcome only in v1.
- Two-arm 50/50 primary analysis.
- No CUPED/covariate adjustment yet.
- No sequential-testing correction or always-valid p-values.
- No cluster-randomized or geo-experiment inference.
- Segment analysis is exploratory and lacks multiplicity correction.
- “Observed power” is displayed internally only and should not be used as retrospective proof of experiment quality.
- Statistical significance is not the same as material business value.

## Architecture

- Next.js 16 / React 19 / TypeScript
- Pure TypeScript analytics engine in `lib/experiment.ts`
- Browser-local CSV workflow
- Responsive interface with reduced-motion support
- No external analytics or persistence dependency required for the core workflow

## Deployment

Designed for Vercel static/server rendering. Run `npm run build` before release.
