/**
 * Sub-municipal boundaries importer — generic CLI over any registered
 * SubMunicipalSource (see src/lib/submunicipal/).
 *
 * Usage:
 *   npm run import:submunicipal -- --source=comune-torino-quartieri
 *   npm run import:submunicipal -- --source=comune-torino-quartieri --fresh
 *   npm run import:submunicipal -- --list
 *
 * Requires the parent comune to already exist as a City (run `npm run
 * import:istat` first) — this importer never creates cities, only zones.
 */
import { PrismaClient } from '@prisma/client'
import { importSubMunicipalSource } from '../src/lib/submunicipal/engine.js'
import { SUBMUNICIPAL_SOURCES } from '../src/lib/submunicipal/registry.js'

const prisma = new PrismaClient()

function parseArgs() {
  const args = process.argv.slice(2)
  const sourceArg = args.find((a) => a.startsWith('--source='))
  return {
    source: sourceArg?.split('=')[1],
    fresh: args.includes('--fresh'),
    list: args.includes('--list'),
  }
}

async function main(): Promise<void> {
  const { source: sourceId, fresh, list } = parseArgs()

  if (list || !sourceId) {
    console.log('[submunicipal] available sources:')
    for (const s of Object.values(SUBMUNICIPAL_SOURCES)) {
      console.log(`  - ${s.id}  (${s.label}, cityIstatCode=${s.cityIstatCode}, type=${s.sourceType})`)
    }
    if (!sourceId) {
      console.log('\nUsage: npm run import:submunicipal -- --source=<id>')
      process.exitCode = list ? 0 : 1
    }
    return
  }

  const source = SUBMUNICIPAL_SOURCES[sourceId]
  if (!source) {
    console.error(`[submunicipal] unknown source "${sourceId}". Run with --list to see available sources.`)
    process.exitCode = 1
    return
  }

  console.log(`[submunicipal] importing ${source.label} ...`)
  const stats = await importSubMunicipalSource(prisma, source, { fresh })

  console.log('\n[submunicipal] import summary')
  console.log(`  source:          ${stats.source}`)
  console.log(`  city:            ${stats.cityName} (istatCode=${stats.cityIstatCode})`)
  console.log(`  features parsed: ${stats.featuresParsed}`)
  console.log(`  zones created:   ${stats.zonesCreated}`)
  console.log(`  zones updated:   ${stats.zonesUpdated}`)
  console.log(`  zones retired:   ${stats.zonesRetired}`)
  console.log(`  invalid geometry: ${stats.invalidGeometry.length}`)
  for (const err of stats.invalidGeometry) {
    console.log(`    - ${err.name} (${err.sourceId}): ${err.reason}`)
  }
}

main()
  .catch((e) => {
    console.error('[submunicipal] import failed:', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
