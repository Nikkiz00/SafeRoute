/**
 * Declarative registry of Italian municipal administrative changes that post-date
 * the ISTAT shapefile snapshot used by the importer (see docs/step-4-0-*.md).
 *
 * ISTAT republishes updated shapefiles roughly once a year, so changes effective
 * mid-year (mergers, incorporations, renames) have to be reconciled by hand until
 * the next official release catches up. To add a new one: append a rule here with
 * its real ISTAT codes and a source citation — no importer/reconciliation code changes.
 */

export interface CityRef {
  istatCode: string
  name: string
}

export interface IncorporationRule {
  type: 'incorporation'
  effectiveDate: string // YYYY-MM-DD
  source: CityRef // comune soppresso, assorbito interamente dal target
  target: CityRef // comune che mantiene identità e codice ISTAT
  note: string
}

export interface MergeRule {
  type: 'merge'
  effectiveDate: string
  sources: CityRef[] // comuni soppressi (almeno 2)
  result: { istatCode: string; name: string; province: string; region: string }
  note: string
}

export interface RenameRule {
  type: 'rename'
  effectiveDate: string
  istatCode: string
  newName: string
  note: string
}

export type AdministrativeChangeRule = IncorporationRule | MergeRule | RenameRule

export const ADMINISTRATIVE_CHANGES: AdministrativeChangeRule[] = [
  {
    type: 'incorporation',
    effectiveDate: '2026-01-31',
    source: { istatCode: '018082', name: 'Lirio' },
    target: { istatCode: '018094', name: 'Montalto Pavese' },
    note:
      'Legge Regionale Lombardia n. 1 del 28/01/2026, efficacia dal 31/01/2026 ' +
      '(Agenzia delle Entrate, risoluzione n. 6 del 04/02/2026). Montalto Pavese mantiene ' +
      'identità e codice amministrativo (F417) invariati.',
  },
  {
    type: 'merge',
    effectiveDate: '2026-02-21',
    sources: [
      { istatCode: '024027', name: 'Castegnero' },
      { istatCode: '024071', name: 'Nanto' },
    ],
    result: { istatCode: '024129', name: 'Castegnero Nanto', province: 'VI', region: 'Veneto' },
    note:
      'Legge Regionale Veneto n. 1 del 17/02/2026, istituzione dal 21/02/2026, ' +
      'codice amministrativo nazionale M439. Referendum consultivo 18-19/01/2026 (76,25% favorevoli). ' +
      'Codice ISTAT del nuovo comune (024129) non ancora presente nello shapefile ISTAT ' +
      '(pubblicato prima della fusione) — verificato su fonte secondaria (tuttitalia.it), da ' +
      'confermare contro il prossimo aggiornamento ufficiale ISTAT.',
  },
]
