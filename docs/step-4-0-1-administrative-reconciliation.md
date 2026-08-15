# Step 4.0.1 — Allineamento amministrativo comuni 2026

## Obiettivo raggiunto

La base geografica comunale (Step 4.0, shapefile ISTAT 01/01/2026) è ora riconciliata con due variazioni amministrative reali, successive alla data dello shapefile:

- **Lirio → incorporato in Montalto Pavese** (efficacia 31/01/2026)
- **Castegnero + Nanto → fusi nel nuovo comune Castegnero Nanto** (istituito 21/02/2026, codice ISTAT 024129)

Risultato finale verificato: **7.894 comuni attivi** (7.896 − 3 soppressi + 1 nuovo), geometrie unite correttamente, importer idempotente anche dopo la riconciliazione.

## 1. Analisi preliminare

- `backend/scripts/import-istat-comuni.ts` fa upsert per `City.istatCode` e crea una `Zone` `type="comune"` per ogni comune privo di zone "custom" (vedi Step 4.0).
- Lo shapefile ISTAT usato (01/01/2026) **precede** entrambe le variazioni: contiene ancora Lirio, Castegnero e Nanto come comuni separati, con le loro geometrie originali.
- Non esisteva alcun meccanismo per marcare un comune come "soppresso" né per collegarlo al comune successore: serviva un nuovo stato amministrativo, distinto dal flag `City.isActive` esistente (che in Step 4.0 controlla solo la visibilità nei picker UI, fuori scope qui).
- `Zone.geometryJson`/`bbox*` vengono riscritti ad ogni riesecuzione dell'importer base (per recepire eventuali correzioni ISTAT legittime) — questo si è rivelato un problema per i comuni target di una riconciliazione (vedi §6).

## 2. Fonti dei dati amministrativi

Verificate via ricerca web (nessun codice/data inventato):

- **Lirio → Montalto Pavese**: Legge Regionale Lombardia n. 1 del 28/01/2026, efficacia dal 31/01/2026 (Agenzia delle Entrate, risoluzione n. 6 del 04/02/2026). Montalto Pavese mantiene identità e codice amministrativo (F417) invariati. Codici ISTAT: Lirio `018082`, Montalto Pavese `018094` (entrambi già presenti nello shapefile 01/01/2026).
- **Castegnero + Nanto → Castegnero Nanto**: Legge Regionale Veneto n. 1 del 17/02/2026, istituzione dal 21/02/2026, codice amministrativo nazionale M439, referendum consultivo 18-19/01/2026 (76,25% favorevoli). Codici ISTAT sorgente: Castegnero `024027`, Nanto `024071`. Codice ISTAT del nuovo comune: **024129**, verificato su fonte secondaria (tuttitalia.it) poiché non ancora presente nello shapefile ufficiale ISTAT — da confermare contro il prossimo aggiornamento ufficiale.

## 3. Architettura

Nessuna correzione hardcoded sparsa nel codice — due nuovi moduli in `backend/src/lib/`:

### `administrative-changes.ts` — registro dichiarativo

```ts
type AdministrativeChangeRule = IncorporationRule | MergeRule | RenameRule
```

- `incorporation`: un comune soppresso assorbito interamente da un comune esistente che mantiene identità/codice.
- `merge`: N comuni soppressi sostituiti da un nuovo comune con nuovo codice ISTAT.
- `rename`: cambio nome a parità di codice ISTAT (nessun caso reale ancora, implementato per completezza).

Per aggiungere una futura variazione: si aggiunge una entry con i codici ISTAT reali e una nota di fonte — **zero modifiche** a importer o motore di riconciliazione.

### `administrative-reconciliation.ts` — motore

`applyAdministrativeChanges(prisma)` itera le regole e per ciascuna:

1. Recupera le città coinvolte per `istatCode`.
2. Calcola l'**unione geometrica** con `@turf/turf` (`turf.union`) a partire da `City.boundaryJson` (non da `Zone.geometryJson` — vedi §6).
3. Scrive la geometria unita sulla zona `type="comune"` del comune target/risultato (bbox ricalcolato con `computeBBox` da Step 4.0).
4. Migra `zoneFeedback`/`report`/`routeZoneCrossing` dalla zona del comune soppresso alla zona finale (`updateMany` per `zoneId`, dentro la stessa transazione, **prima** di eliminare la zona sorgente).
5. Elimina la zona del comune soppresso (ormai ridondante/duplicata) e marca la City sorgente `administrativeStatus = SUPPRESSED`, `succeededByCityId = <target>`, `isActive = false`. La riga `City` **non viene mai cancellata** — resta come record storico/di redirect.

Ogni passo ricontrolla lo stato corrente prima di scrivere (transazione singola per regola) → sicuro da rieseguire e da interrompere a metà.

### Schema (`schema.prisma`)

```prisma
enum AdministrativeStatus {
  ACTIVE
  SUPPRESSED
}

model City {
  ...
  administrativeStatus AdministrativeStatus @default(ACTIVE)
  succeededByCityId    String?
  succeededBy          City?  @relation("CitySuccession", fields: [succeededByCityId], references: [id])
  predecessors         City[] @relation("CitySuccession")
}
```

Nessuna colonna rimossa, nessun dato cancellato dallo schema — solo aggiunte nullable/con default.

### Comandi

```bash
cd backend
npm run import:istat          # import base ISTAT + reconciliation automatica (comando unico consigliato)
npm run reconcile:admin       # SOLO riconciliazione, senza ri-parsare i ~7896 comuni (utile aggiungendo nuove regole)
npm run import:istat -- --skip-reconciliation   # solo import base, per debug
```

## 4. Strategia merge geometrie

`turf.union` su GeoJSON `Polygon`/`MultiPolygon` reali (non bbox, non semplice concatenazione): testato su Lirio+Montalto Pavese e Castegnero+Nanto (comuni realmente adiacenti, come atteso per fusioni/incorporazioni) → risultato: un singolo `Polygon` pulito con il confine condiviso dissolto, non un `MultiPolygon` con due parti sovrapposte. Fallback: se `turf.union` fallisce o produce geometria non valida (`isValidGeometry` da Step 4.0), la regola viene registrata in `errors` e **non scrive nulla** — mai geometria corrotta nel DB.

## 5. Strategia preservazione dati

- **City**: mai cancellata. Il comune soppresso resta come riga con `administrativeStatus=SUPPRESSED` e `succeededByCityId` puntato al successore — permette in futuro di reindirizzare una ricerca per "Lirio" verso Montalto Pavese. `boundaryJson` storico preservato (mai più toccato una volta soppresso).
- **Zone**: la zona del comune soppresso viene rimossa (sarebbe un poligono duplicato/ridondante rispetto alla zona unita del successore) **solo dopo** aver migrato ogni riferimento.
- **ZoneFeedback / Report / RouteZoneCrossing**: riassegnati (`zoneId` aggiornato) al posto di essere cancellati a cascata. Verificato con un test sintetico (riga di feedback/report creata su una zona arbitraria, migrata con lo stesso pattern SQL usato dal motore, verificato il nuovo `zoneId`, poi ripulito) — nel DB di sviluppo attuale non c'erano feedback/report reali su Lirio/Castegnero/Nanto (0 righe in tutto il DB), quindi il percorso non è stato esercitato con dati reali, ma il meccanismo è verificato e transazionale.
- **Limite noto**: la migrazione usa la prima zona `type="comune"` trovata per città. Se in futuro un comune soppresso avesse anche zone `type` diverso da `"comune"` (quartieri curati), quelle non verrebbero migrate automaticamente — nessuno dei comuni coinvolti qui ne ha, ma va tenuto presente per Step 4.1.

## 6. Bug trovato e corretto durante il test di idempotenza

Il test "riesegui l'importer, verifica ancora 7.894" ha **fatto emergere un bug reale**: la prima implementazione calcolava l'unione da `Zone.geometryJson` e la considerava "già applicata" semplicemente controllando `source.administrativeStatus === SUPPRESSED`. Ma l'importer base continua — giustamente — a riscrivere `Zone.geometryJson`/`bbox` del comune **target** (Montalto Pavese) ad ogni riesecuzione, perché lo shapefile ISTAT locale non sa nulla della fusione: alla riesecuzione successiva la geometria unita veniva silenziosamente sovrascritta con la sola forma originale di Montalto Pavese, e la riconciliazione — pensando di aver già finito — non se ne accorgeva.

**Fix**: il motore ora ricalcola sempre l'unione da `City.boundaryJson` (mai riscritto una volta che il comune sorgente è `SUPPRESSED`, e comunque sempre coerente per il target) invece che da `Zone.geometryJson`, e riscrive il risultato ad ogni esecuzione invece di fare skip preventivo. Così la riconciliazione è **auto-risanante**: anche se l'importer base tocca di nuovo la zona del target, la riconciliazione successiva la ripristina correttamente. Verificato: bbox di Montalto Pavese stabile e identico su 3 esecuzioni consecutive di `npm run import:istat` dopo il fix.

## 7. Test di idempotenza (eseguiti realmente)

| Fase | Risultato |
|---|---|
| 1. `npm run import:istat` (prima applicazione riconciliazione) | applied: 2 (incorporation Lirio→Montalto Pavese, merge Castegnero+Nanto→Castegnero Nanto) |
| 2. Verifica conteggio | **ACTIVE: 7.894**, SUPPRESSED: 3, totale righe City: 7.897 |
| 3. `npm run import:istat` (riesecuzione, bug ancora presente) | ⚠️ bbox Montalto Pavese corrotto (sovrascritto dall'import base) — bug diagnosticato e corretto (§6) |
| 4. Fix applicato, `npm run reconcile:admin` | geometria auto-risanata, bbox tornato corretto |
| 5. `npm run import:istat` × 2 consecutive (post-fix) | **ACTIVE: 7.894** stabile, 0 duplicati `istatCode`, 0 zone orfane, bbox identico su entrambe le esecuzioni |
| 6. `npm run import:istat` sull'import base | `skipped (suppressed by administrative reconciliation): 3` — Lirio/Castegnero/Nanto mai ricreati come zone attive |

Test funzionali aggiuntivi (via API reale, server locale):

- `GET /api/zones?bbox=...` sull'area di Montalto Pavese/Lirio → Lirio assente, Montalto Pavese presente, geometria include l'ex territorio di Lirio.
- `GET /api/zones?bbox=...` sull'area di Castegnero/Nanto → nessuno dei due vecchi comuni, presente "Castegnero Nanto".
- Point-in-polygon (stesso algoritmo di `frontend/src/utils/geo.ts`) sul centroide storico di Lirio → risulta dentro la nuova zona di Montalto Pavese; centroidi storici di Castegnero e Nanto → risultano dentro la nuova zona di Castegnero Nanto.
- Migrazione feedback/report: testata sinteticamente con dati reali di test (utente esistente), pattern SQL verificato, dati di test rimossi a fine verifica.
- `npm run typecheck` (backend) e `vue-tsc --noEmit` (frontend): **0 errori**.

## 8. Risultato finale

- Comuni attivi: **7.894** ✓
- Lirio: `SUPPRESSED`, `succeededByCityId → Montalto Pavese`, zona rimossa, territorio unito a Montalto Pavese ✓
- Castegnero, Nanto: `SUPPRESSED`, `succeededByCityId → Castegnero Nanto`, zone rimosse, territorio unito nel nuovo comune ✓
- Geometrie unite tramite `turf.union` reale (non bbox, non concatenazione) ✓
- Importer idempotente, self-healing contro riscritture dell'import base ✓
- Nessun duplicato `istatCode`, nessuna zona orfana ✓
- Feedback/report/routeZoneCrossing: meccanismo di migrazione verificato, nessun dato reale perso (0 righe presenti da migrare nel DB corrente) ✓
- TypeScript frontend/backend: 0 errori ✓

## 9. Problemi aperti

1. **Codice ISTAT 024129 per Castegnero Nanto non ancora ufficiale nello shapefile ISTAT**: preso da fonte secondaria (tuttitalia.it), coerente con le altre fonti (Agenzia Entrate, BUR Veneto) ma da riconfermare quando ISTAT pubblicherà il prossimo aggiornamento annuale del dataset — a quel punto il comune target diventerà `istatCode` nativo del prossimo shapefile e la regola in `administrative-changes.ts` diventerà ridondante (l'importer base lo troverà già corretto); si può rimuovere la entry a quel punto senza altri effetti.
2. **Migrazione feedback/report non esercitata con dati reali**: nel DB attuale non esisteva alcun feedback/report su Lirio/Castegnero/Nanto. Il meccanismo è verificato sinteticamente ma non in produzione con dati reali.
3. **Migrazione limitata a zone `type="comune"`**: comuni soppressi con zone custom (quartieri) non verrebbero gestiti automaticamente — nessun caso reale attuale, ma da estendere se necessario in Step 4.1.
4. **`City.isActive` non tocca la semantica di "comune amministrativamente attivo"**: i comuni soppressi restano `isActive=false` (come già erano da Step 4.0) — non è stato necessario alcun cambiamento allo strato UI/picker, come richiesto dallo scope.
5. **Bug di sovrascrittura scoperto in questo step** (§6) era già latente in Step 4.0 per qualunque futura correzione di geometria "post-hoc": ora risolto in generale per i comuni target/risultato di una regola, ma se in futuro serve un meccanismo simile per correggere manualmente la geometria di un comune ISTAT ordinario (non coinvolto in una regola amministrativa), andrebbe usato lo stesso pattern (fonte di verità durevole, non `Zone.geometryJson` riscrivibile dall'import).
