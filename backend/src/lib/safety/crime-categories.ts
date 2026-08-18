/**
 * Crime-category weights for the Step 5.0 statistical safety baseline
 * (docs/step-5-0-safety-data-baseline.md §4). Source of the category codes/labels:
 * ISTAT codelist CL_REATI_PS (dataset "Delitti denunciati dalle forze di polizia
 * all'autorità giudiziaria", flow 73_67, indicator CRIMET = rate per 100,000
 * residents — already population-normalized by ISTAT, see istat-crime-source.ts).
 *
 * Only a curated subset of CL_REATI_PS's ~90 codes is used, and only top-level
 * categories (never a subtype alongside its parent — e.g. ROBBER, not also
 * STREETROB/BANKROB/HOUSEROB — to avoid double-counting the same reported crime).
 * Categories deliberately excluded, and why (see also docs §9 "cosa NON è
 * possibile determinare"):
 *   - DRUG (stupefacenti): reflects policing/checkpoint intensity more than
 *     victim risk — a well-known confound, not a personal-safety signal.
 *   - Public-official corruption (CP314-335 and friends), CYBERCRIM, COUNTER,
 *     MONEYLAU, USURY: financial/administrative crime, not relevant to a
 *     pedestrian safety app.
 *   - MASSMURD/MAFIAHOM/TERRORHOM: statistically ~zero in almost every
 *     territory at this granularity — would add noise, not signal.
 *   - Ethnicity/nationality/religion of offenders or victims: never used as a
 *     safety proxy, per the goal's explicit rule — and ISTAT's CRIMET rate
 *     indicator doesn't carry that dimension anyway.
 *
 * Weights are a documented, chosen (not statistically fitted) 3-tier scale
 * matching the goal's guidance: aggression/robbery/violence high, theft/threats
 * medium, property damage low. Configurable here — change only in this file.
 */

export type CrimeWeightTier = 'high' | 'medium' | 'low'

export interface CrimeCategoryWeight {
  /** ISTAT CL_REATI_PS code, e.g. "THEFT". */
  code: string
  /** Italian label, copied verbatim from CL_REATI_PS for traceability. */
  label: string
  tier: CrimeWeightTier
  weight: number
}

export const CRIME_CATEGORY_WEIGHTS: CrimeCategoryWeight[] = [
  // High: violence, robbery, aggression against a person
  { code: 'INTENHOM', label: 'omicidi volontari consumati', tier: 'high', weight: 3.0 },
  { code: 'ATTEMPHOM', label: 'tentati omicidi', tier: 'high', weight: 3.0 },
  { code: 'RAPE', label: 'violenze sessuali', tier: 'high', weight: 3.0 },
  { code: 'ROBBER', label: 'rapine', tier: 'high', weight: 3.0 },
  { code: 'KIDNAPP', label: 'sequestri di persona', tier: 'high', weight: 3.0 },
  { code: 'EXTORT', label: 'estorsioni', tier: 'high', weight: 3.0 },
  // Medium: theft and threats
  { code: 'THEFT', label: 'furti', tier: 'medium', weight: 1.5 },
  { code: 'CULPINJU', label: 'lesioni dolose', tier: 'medium', weight: 1.5 },
  { code: 'STALK', label: 'stalking', tier: 'medium', weight: 1.5 },
  { code: 'MENACE', label: 'minacce', tier: 'medium', weight: 1.5 },
  // Low: property damage / degrado
  { code: 'DAMAGE', label: 'danneggiamenti', tier: 'low', weight: 1.0 },
  { code: 'ARSON', label: 'incendi', tier: 'low', weight: 1.0 },
]

/** All ISTAT category codes the importer needs to fetch, plus TOT as a sanity cross-check. */
export const FETCH_CATEGORY_CODES = ['TOT', ...CRIME_CATEGORY_WEIGHTS.map((c) => c.code)]

export function weightFor(code: string): number {
  return CRIME_CATEGORY_WEIGHTS.find((c) => c.code === code)?.weight ?? 0
}
