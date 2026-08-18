/**
 * Step 5.0 — writes baselineSafetyScore (+ finalSafetyScore recombination) onto real
 * Zone rows from the cached ISTAT crime-rate data. See
 * docs/step-5-0-safety-data-baseline.md for the full methodology.
 *
 * Pipeline: cached ISTAT CRIMET CSVs (istat-crime-source.ts) -> category-weighted,
 * multi-year-smoothed rate per territory -> national percentile rank within
 * territoryType, separately for comuni and province (baseline-calculator.ts) ->
 * upsert CrimeBaseline (versioned by referenceYear, never overwritten) -> for every
 * City resolved to that territory (territory-resolver.ts), copy the baseline onto
 * every one of its Zone rows and recombine finalSafetyScore via the same
 * combineFinalScore() used by score.service.ts's live-feedback path — so a zone
 * that already has real feedback/reports is never silently reset to pure baseline.
 *
 * Idempotent: percentile ranks and CrimeBaseline rows are recomputed identically
 * from the same cached CSVs on every run; re-running never duplicates rows
 * (unique on territoryType+territoryCode+referenceYear) and never touches
 * liveSafetyScore/feedback-derived data.
 *
 * Usage:
 *   npm run safety:baseline -- --pilot                       # Step 5.0 pilot set (8 comuni)
 *   npm run safety:baseline -- --city=<istatCode>
 *   npm run safety:baseline -- --cities=<istat1,istat2,...>
 *   npm run safety:baseline -- --pilot --validate-only        # compute + print, write nothing
 *
 * Requires: npm run import:istat (City rows must exist) and the cached CSVs in
 * backend/data/istat-crime-*-national-raw.csv (see docs §2 for the refresh procedure).
 */
import { PrismaClient } from '@prisma/client'
import { computeWeightedRate, loadComuniCrimeSeries, loadProvinceCrimeSeries } from '../src/lib/safety/istat-crime-source.js'
import { computePercentileBaselines, type TerritoryScore } from '../src/lib/safety/baseline-calculator.js'
import { resolveTerritory } from '../src/lib/safety/territory-resolver.js'
import { combineFinalScore, computeLiveSafetyScore } from '../src/modules/zones/score.service.js'

const prisma = new PrismaClient()

// Step 5.0 pilot set: Torino/Milano/Roma (official sub-municipal sources, Step 4.1-4.3),
// Bologna/Napoli/Genova (OSM-validated, Step 4.4-4.5, also "grandi comuni" crime data),
// La Loggia + Atrani (small comuni, province-only fallback) — matches the goal's list.
const PILOT_CITIES: { istatCode: string; label: string }[] = [
  { istatCode: '001272', label: 'Torino' },
  { istatCode: '015146', label: 'Milano' },
  { istatCode: '058091', label: 'Roma' },
  { istatCode: '037006', label: 'Bologna' },
  { istatCode: '063049', label: 'Napoli' },
  { istatCode: '010025', label: 'Genova' },
  { istatCode: '001127', label: 'La Loggia (piccolo comune)' },
  { istatCode: '065011', label: 'Atrani (piccolo comune)' },
]

function parseArgs() {
  const args = process.argv.slice(2)
  const validateOnly = args.includes('--validate-only')
  if (args.includes('--pilot')) return { cities: PILOT_CITIES.map((c) => c.istatCode), validateOnly }
  const cityArg = args.find((a) => a.startsWith('--city='))
  if (cityArg) return { cities: [cityArg.split('=')[1]], validateOnly }
  const citiesArg = args.find((a) => a.startsWith('--cities='))
  if (citiesArg) return { cities: citiesArg.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean), validateOnly }
  return { cities: [], validateOnly }
}

function colorFor(score: number | null): string {
  if (score === null) return 'bianco/grigio (dati insufficienti)'
  if (score >= 75) return 'verde'
  if (score >= 50) return 'giallo'
  if (score >= 25) return 'rosso'
  return 'viola'
}

/** Computes national percentile baselines for every territory in a series (not just the pilot) — percentile rank needs the full distribution to be meaningful. */
function scoreAllTerritories(
  series: Map<string, { territoryCode: string; ratesByCategoryYear: Map<string, Map<number, number>> }>
): { scores: Map<string, TerritoryScore>; rawByTerritory: Map<string, { rawCategoryRates: Record<string, number>; referenceYear: number }> } {
  const inputs: { territoryCode: string; weightedRatePer100k: number }[] = []
  const rawByTerritory = new Map<string, { rawCategoryRates: Record<string, number>; referenceYear: number }>()

  for (const [territoryCode, ts] of series) {
    const result = computeWeightedRate(ts)
    if (!result) continue
    inputs.push({ territoryCode, weightedRatePer100k: result.weightedRatePer100k })
    rawByTerritory.set(territoryCode, { rawCategoryRates: result.rawCategoryRates, referenceYear: result.referenceYear })
  }

  const scored = computePercentileBaselines(inputs)
  const scores = new Map(scored.map((s) => [s.territoryCode, s]))
  return { scores, rawByTerritory }
}

async function main() {
  const { cities, validateOnly } = parseArgs()
  if (cities.length === 0) {
    console.log('Usage: npm run safety:baseline -- --pilot | --city=<istatCode> | --cities=<istat1,istat2,...> [--validate-only]')
    process.exitCode = 1
    return
  }

  console.log(`[crime-baseline] scoring national reference data (percentile needs the full distribution, not just the requested comuni)...`)
  const provinceScored = scoreAllTerritories(loadProvinceCrimeSeries())
  const comuniScored = scoreAllTerritories(loadComuniCrimeSeries())
  console.log(`[crime-baseline] provinces scored: ${provinceScored.scores.size}, grandi comuni scored: ${comuniScored.scores.size}`)

  console.log(`\n[crime-baseline] resolving ${cities.length} comune(s)${validateOnly ? ' (validate-only, no writes)' : ''}...`)

  for (const istatCode of cities) {
    const city = await prisma.city.findUnique({ where: { istatCode } })
    if (!city) {
      console.log(`\n[${istatCode}] ERROR: no City found — run "npm run import:istat" first`)
      continue
    }

    const territory = resolveTerritory(city)
    if (territory.territoryType === 'unresolved') {
      console.log(`\n[${istatCode}] ${city.name} — UNRESOLVED: ${territory.reason}`)
      continue
    }

    const { scores, rawByTerritory } = territory.territoryType === 'comune' ? comuniScored : provinceScored
    const score = scores.get(territory.territoryCode)
    const raw = rawByTerritory.get(territory.territoryCode)
    if (!score || !raw) {
      console.log(`\n[${istatCode}] ${city.name} — UNRESOLVED: no ISTAT crime data cached for territory ${territory.territoryCode}`)
      continue
    }

    const territoryLabel = territory.territoryType === 'comune' ? city.name : (territory as { territoryName: string }).territoryName
    const scoreSource = `istat-crime-${territory.territoryType}-${raw.referenceYear}`

    console.log(`\n[${istatCode}] ${city.name}`)
    console.log(`    fonte: ISTAT CRIMET (${territory.territoryType}: ${territoryLabel}, ${territory.territoryCode}), anno riferimento ${raw.referenceYear}`)
    console.log(`    dato grezzo (rate/100k, media ${raw.referenceYear - 2}-${raw.referenceYear}): ${JSON.stringify(raw.rawCategoryRates)}`)
    console.log(`    tasso pesato composito: ${score.weightedRatePer100k}`)
    console.log(`    percentile nazionale (rischio, 0=più sicuro, 100=più rischioso): ${score.percentileNational}`)
    console.log(`    baselineSafetyScore: ${score.baselineScore}`)

    if (validateOnly) {
      console.log(`    colore (baseline-only): ${colorFor(score.baselineScore)}`)
      continue
    }

    const zones = await prisma.zone.findMany({ where: { cityId: city.id } })
    for (const zone of zones) {
      // isServiceActive gates map color (getSafetyLevel forces 'unknown'/gray when
      // false, regardless of score) — it starts false at zone creation per the
      // Step 4.0/4.4 "no invented score" policy. This is the step that policy was
      // waiting for: once a real, traceable baseline exists, the zone should no
      // longer render white, so every zone that gets a real baseline is activated.
      // Known limitation (documented in docs/step-5-0-safety-data-baseline.md §9):
      // there is no dedicated flag today to distinguish "never activated" from "an
      // admin explicitly deactivated this zone" — a future admin override would be
      // re-activated by the next ISTAT refresh run. Fixing that properly needs a
      // separate `serviceActiveOverridden` column, out of scope for this step since
      // no admin override has ever been exercised in this dataset.
      await prisma.zone.update({
        where: { id: zone.id },
        data: {
          baselineSafetyScore: score.baselineScore,
          scoreSource,
          scoreReferenceYear: raw.referenceYear,
          scoreUpdatedAt: new Date(),
          isServiceActive: true,
        },
      })
    }

    // Recombine finalSafetyScore for every zone, preserving any real live feedback
    // already accumulated (recalculateZoneScore reads the baseline just written above
    // and the zone's current feedback/reports — never resets live data).
    let sampleFinal: { finalScore: number | null; confidence: number } | null = null
    for (const zone of zones) {
      const [feedback, approvedReportsCount] = await Promise.all([
        prisma.zoneFeedback.findMany({
          where: { zoneId: zone.id, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
          select: { rating: true },
        }),
        prisma.report.count({
          where: { zoneId: zone.id, status: 'approved', createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        }),
      ])
      const { score: liveScore, observationCount } = computeLiveSafetyScore(feedback.map((f) => f.rating), approvedReportsCount)
      const combined = combineFinalScore(score.baselineScore, liveScore, observationCount)
      const nextSource = observationCount > 0 ? `${scoreSource}+live(n=${observationCount})` : scoreSource
      await prisma.zone.update({
        where: { id: zone.id },
        data: { liveSafetyScore: liveScore, finalSafetyScore: combined.finalScore, scoreConfidence: combined.confidence, scoreSource: nextSource },
      })
      if (zone.id === zones[0].id) sampleFinal = combined
    }

    console.log(`    zone aggiornate: ${zones.length}`)
    console.log(`    finalSafetyScore (zona campione "${zones[0]?.name}"): ${sampleFinal?.finalScore} (confidence=${sampleFinal?.confidence})`)
    console.log(`    colore finale: ${colorFor(sampleFinal?.finalScore ?? null)}`)

    await prisma.crimeBaseline.upsert({
      where: { territoryType_territoryCode_referenceYear: { territoryType: territory.territoryType, territoryCode: territory.territoryCode, referenceYear: raw.referenceYear } },
      update: {
        territoryName: territoryLabel,
        rawCategoryRates: raw.rawCategoryRates,
        weightedRatePer100k: score.weightedRatePer100k,
        percentileNational: score.percentileNational,
        baselineScore: score.baselineScore,
        source: 'ISTAT DCCV_DELITTIPS (CRIMET, esploradati.istat.it)',
      },
      create: {
        territoryType: territory.territoryType,
        territoryCode: territory.territoryCode,
        territoryName: territoryLabel,
        referenceYear: raw.referenceYear,
        rawCategoryRates: raw.rawCategoryRates,
        weightedRatePer100k: score.weightedRatePer100k,
        percentileNational: score.percentileNational,
        baselineScore: score.baselineScore,
        source: 'ISTAT DCCV_DELITTIPS (CRIMET, esploradati.istat.it)',
      },
    })
  }
}

main()
  .catch((e) => {
    console.error('[crime-baseline] failed:', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
