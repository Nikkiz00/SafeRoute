/**
 * Applies administrative-changes.ts (mergers/incorporations/renames) on its own,
 * without re-running the full ISTAT shapefile import. Useful when a new change is
 * added to the registry and you don't want to re-parse/re-upsert all ~7896 comuni.
 *
 * `npm run import:istat` already runs this automatically at the end.
 *
 * Usage: npm run reconcile:admin
 */
import { PrismaClient } from '@prisma/client'
import { applyAdministrativeChanges } from '../src/lib/administrative-reconciliation.js'

const prisma = new PrismaClient()

async function main(): Promise<void> {
  console.log('[reconcile] applying administrative-changes.ts rules...')
  const stats = await applyAdministrativeChanges(prisma)

  console.log(`\n[reconcile] applied: ${stats.applied.length}`)
  stats.applied.forEach((r) => console.log(`  - ${r}`))
  console.log(`[reconcile] skipped (already applied): ${stats.skipped.length}`)
  stats.skipped.forEach((r) => console.log(`  - ${r}`))
  console.log(`[reconcile] errors: ${stats.errors.length}`)
  stats.errors.forEach((e) => console.log(`  - ${e.rule}: ${e.reason}`))

  if (stats.errors.length > 0) process.exitCode = 1
}

main()
  .catch((e) => {
    console.error('[reconcile] failed:', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
