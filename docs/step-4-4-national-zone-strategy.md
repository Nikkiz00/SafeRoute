# Step 4.4 — Strategia nazionale automatica zone

## Obiettivo raggiunto

SafeRoute non richiede più una `SubMunicipalSource` scritta a mano per ogni comune italiano. Un **source resolver** nazionale decide, comune per comune, quale fonte usare — con priorità `official` → `osm` → `municipality` — riusando integralmente l'engine/registry già esistenti da Torino/Milano/Roma (Step 4.1-4.3). Torino (23 quartieri), Milano (88 NIL) e Roma (155 zone urbanistiche) restano invariate: il resolver le trova subito al livello 1 e non tocca mai OSM per loro.

Testato su un campione reale di 8 comuni (5 capoluoghi richiesti + Trento come capoluogo medio + La Loggia e Atrani come piccoli comuni): **6 hanno ottenuto quartieri OSM validati, 2 sono rimasti sul fallback comunale ISTAT** — mai un poligono inventato.

## 1. Architettura finale

```
backend/src/lib/submunicipal/
├── types.ts              # SubMunicipalSource — + qualityStatus: 'official' | 'osm_validated'
├── engine.ts              # invariato nella logica; scrive anche Zone.sourceStatus
├── registry.ts             # + OFFICIAL_SOURCES_BY_ISTAT (lookup per istatCode)
├── source-resolver.ts      # NUOVO — resolveZoneSource(prisma, istatCode)
├── sources/                 # invariato: torino-quartieri.ts, milano-nil.ts, roma-zone-urbanistiche.ts
└── osm/                      # NUOVO — pipeline di import OSM (offline, mai a runtime)
    ├── overpass-client.ts    # fetch + cache disco + retry/backoff, mai chiamato dall'app
    ├── query-builder.ts       # Overpass QL, due query per comune (tier admin / tier place)
    ├── ring-assembly.ts        # assembla i segmenti way di una relation OSM in ring chiusi
    ├── parse.ts                 # Overpass JSON -> SubMunicipalFeature[] candidate
    ├── osm-source.ts             # sceglie il tier (admin, poi place come fallback)
    └── validate.ts                # gate automatico dataset-level (accept/reject)

backend/scripts/
└── import-national-zones.ts   # CLI — resolve (+ import) su una lista di città
```

Nessun file esistente di Torino/Milano/Roma è stato riscritto: `types.ts` ha un campo in più (`qualityStatus`), i tre `sources/*.ts` hanno una riga in più (`qualityStatus: 'official'`), `engine.ts` scrive una colonna in più. Il motore di import (`importSubMunicipalSource`) è **esattamente lo stesso** usato per Torino/Milano/Roma — anche le città OSM passano per fetch → parse → validate (interno all'engine, isValidGeometry) → upsert Zone → ritiro della zona `comune` superata → migrazione feedback/report/routeZoneCrossing.

### Perché il resolver non chiama mai l'engine per conto suo

`resolveZoneSource()` è puro rispetto al database (nessuna scrittura): decide solo la strategia e, se `osm`, costruisce un oggetto conforme a `SubMunicipalSource` che chiude sui dati già scaricati/validati (`fetch()` è un no-op, `parse()` ritorna l'array già filtrato). Chi scrive è sempre e solo `scripts/import-national-zones.ts`, chiamando lo stesso `importSubMunicipalSource()` di sempre — questo è il punto che garantisce il riuso integrale dell'architettura (obiettivo 2 del goal).

## 2. Strategia fonti — resolveZoneSource(prisma, cityIstatCode)

```ts
export async function resolveZoneSource(
  prisma: PrismaClient,
  cityIstatCode: string,
  opts: { fresh?: boolean } = {}
): Promise<SourceResolution>
```

Priorità:

1. **`official`** — `OFFICIAL_SOURCES_BY_ISTAT[cityIstatCode]` (derivato da `registry.ts`). Nessuna chiamata di rete: se esiste, si usa e basta. Questo è il livello che protegge Torino/Milano/Roma.
2. **`osm`** — nessuna fonte ufficiale: si scaricano (con cache su disco) i confini OSM in due tentativi in ordine (vedi §3), si validano (§4); se il dataset passa, diventa una `SubMunicipalSource` sintetica con `qualityStatus: 'osm_validated'`.
3. **`municipality`** — OSM assente o respinto dalla validazione: non si scrive nulla, resta la zona `type="comune"` già creata da `import:istat` (Step 4.0).

Ogni `Zone` scritta porta la metadata di tracciabilità richiesta dal goal, già esistente nello schema (Step 4.1) più un campo nuovo:

| Campo | Esempio (Bologna) | Esempio (Milano, invariato) |
|---|---|---|
| `source` | `osm-admin-037006` | `comune-milano-nil` |
| `sourceId` | `osm-relation-6603261` | `12` |
| `sourceType` | `osm_quartiere` | `nil` |
| `sourceStatus` *(nuovo)* | `osm_validated` | `official` |
| `sourceUpdatedAt` | timestamp reale Overpass (`osm3s.timestamp_osm_base`) | `2026-05-08` |
| `cityIstatCode` | `037006` | `015146` |

`sourceStatus` è il nuovo campo Prisma (`Zone.sourceStatus String?`, nullable, nessuna migrazione distruttiva) — puramente informativo/di debug per ora, nessun filtro di query lo usa ancora. Le zone `comune` da `import:istat` scrivono `sourceStatus: 'municipality_fallback'`.

## 3. Pipeline OSM — IMPORT, non runtime

**Nessuna dipendenza runtime da Overpass**: `osm/overpass-client.ts` è chiamato solo da `scripts/import-national-zones.ts`. La cache su disco (`backend/data/osm/<istatCode>/*.json`, gitignored — già copriva `backend/data/` da Step 4.0) rende ogni ri-esecuzione senza `--fresh` a costo di rete zero. L'app in produzione legge sempre e solo dal database, mai da Overpass.

### Due tier, in ordine

1. **`admin`** — `boundary=administrative` con `admin_level` 9/10/11 **e tag `name` presente**, filtrati dentro l'area del comune (`area["name"="<comune>"]["admin_level"="8"]`). Questo è il tier che ha coperto tutti i 6 capoluoghi testati (quartieri, municipalità, circoscrizioni sono quasi sempre mappati qui).
2. **`place`** — `place=suburb|quarter|neighbourhood`, **solo way o relation `type=multipolygon`, mai node**. Un nodo OSM non ha un poligono: trasformarlo in uno significherebbe inventare un confine, esplicitamente vietato dal goal. Questo tier è il fallback per comuni dove il tier `admin` è vuoto o troppo scarso (<2 candidati).

Il filtro `["name"]` sulla query stessa si è rivelato necessario nella pratica: interrogando Bologna senza quel filtro sono comparsi 21 way `admin_level=10` privi di nome (frammenti di confine condivisi tra quartieri reali, non quartieri a sé) accanto alle 6 relation nominate corrette — richiederli già a livello Overpass evita di doverli scartare a valle.

### Assemblaggio geometrico (`ring-assembly.ts`)

Una *relation* OSM di tipo boundary referenzia segmenti *way* (ruolo `outer`/`inner`), non ring già chiusi. `assembleRings()` incatena i segmenti che condividono un endpoint (in entrambe le direzioni, ricalcolando ad ogni passo) fino a chiudere uno o più ring; i segmenti che non si chiudono vengono scartati e riportati (mai richiusi a forza). I `inner` ring (buchi) vengono assegnati al ring `outer` che li contiene con un point-in-polygon (`turf.booleanPointInPolygon`), producendo `Polygon` (1 parte) o `MultiPolygon` (più parti) — verificato con dati reali: **5 delle 50 zone OSM importate nel campione sono risultate `MultiPolygon`** (relation con più way `outer` separati), non solo `Polygon` semplici.

Un *way* standalone (senza relation) è accettato solo se già chiuso (`first === last`, ≥4 punti) — altrimenti scartato.

## 4. Validazione automatica (`osm/validate.ts`)

Gate interamente offline (nessuna chiamata di rete), applicato al dataset **dopo** l'assemblaggio geometrico, nell'ordine:

1. **Geometria valida** (`isValidGeometry` + area > 0) — scarta la singola feature.
2. **Fuori dal comune**: una zona con <50% della propria area dentro il boundary ISTAT del comune viene scartata; se >30% del dataset cade in questo caso, l'intero dataset è respinto (probabile mismatch di area/nome).
3. **Duplicati**: centroide a <50m e area entro il 10% di un'altra zona già accettata → scartata (capita quando lo stesso confine è taggato sia come `boundary=administrative` sia come `place=quarter`).
4. **Numero minimo zone**: <2 zone superstiti → dataset respinto (non è una vera suddivisione).
5. **Coverage**: unione (`turf.union`) delle zone superstiti deve coprire ≥60% dell'area del boundary comunale ISTAT — altrimenti respinto.
6. **Overlap**: somma delle aree di intersezione a coppie ÷ area totale zone deve restare ≤15% — altrimenti respinto (confini duplicati/in conflitto).

Soglie scelte per essere uguali su tutta Italia (nessun tuning per singola città) e documentate qui invece che sparse nel codice. Ogni rifiuto produce una `reason` leggibile, loggata dalla CLI e salvata nel report JSON.

Stati possibili prodotti: `official`, `osm_validated`, `municipality_fallback` — **nessun `rejected` osservato nel campione testato** (vedi §5), ma il path esiste ed è stato eseguito concettualmente ogni volta che coverage/overlap/count sono stati calcolati e confrontati con le soglie.

## 5. Risultati sul campione (dati reali, 2026-08-16)

Comando eseguito: `npm run zones:national -- --sample` (poi ri-eseguito con `--validate-only` per la dry-run e una seconda volta per verificare l'idempotenza).

| Città | ISTAT | Strategia | Zone | Coverage | Overlap | Note |
|---|---|---|---|---|---|---|
| Bologna | 037006 | `osm` (tier `admin`) | 6 | 99% | 0.0% | 6 quartieri ufficiali reali (Borgo Panigale-Reno, Navile, San Donato-San Vitale, Santo Stefano, Porto-Saragozza, Savena) |
| Firenze | 048017 | `osm` (tier `admin`) | 5 | 99% | 0.0% | 5 quartieri |
| Napoli | 063049 | `osm` (tier `admin`) | 10 | 98% | 0.0% | 10 municipalità |
| Genova | 010025 | `osm` (tier `admin`) | 9 | 99% | 0.0% | 9 municipi |
| Palermo | 082053 | `osm` (tier `admin`) | 8 | 99% | 0.0% | 8 circoscrizioni |
| Trento *(capoluogo medio)* | 022205 | `osm` (tier `admin`) | 12 | 99% | 0.0% | 12 circoscrizioni |
| La Loggia *(piccolo comune)* | 001127 | `municipality` | — | — | — | nessun candidato OSM (né admin né place) → resta comune ISTAT |
| Atrani *(piccolo comune)* | 065011 | `municipality` | — | — | — | idem — comune più piccolo d'Italia per superficie |

Zero rifiuti nel campione: dove OSM aveva dati, erano già puliti (0 zone scartate per geometria/duplicati/fuori-comune in tutti e 6 i casi `osm`). Nessun poligono inventato per La Loggia/Atrani.

**Scrittura reale in DB** (non solo dry-run): ogni città `osm` ha creato N zone `type=osm_quartiere` e **ritirato esattamente 1 zona** (la `comune` ISTAT superata), con migrazione automatica di eventuali feedback/report tramite lo stesso meccanismo di `engine.ts` usato da Torino/Milano/Roma.

**Idempotenza verificata**: ri-eseguendo `--city=037006` (Bologna) sui dati già in cache/DB → `+0 created, ~6 updated, -0 retired`, nessun duplicato.

### Regressione Torino/Milano/Roma

`npm run zones:national -- --cities=001272,015146,058091`:

```
[001272] Torino — ✓ official  → +0 created, ~23 updated, -0 retired
[015146] Milano — ✓ official  → +0 created, ~88 updated, -0 retired
[058091] Roma   — ✓ official  → +0 created, ~155 updated, -0 retired
```

Il resolver le ha trovate al livello 1 (`OFFICIAL_SOURCES_BY_ISTAT`) **senza mai contattare Overpass**. Conteggi zone in DB confermati invariati: 23/88/155, `source`/`sourceType` invariati (`comune-torino-quartieri`/`comune-milano-nil`/`comune-roma-zone-urbanistiche`), `sourceStatus=official`, zero zone legacy `type=district` resuscitate.

## 6. Performance

Nessuna nuova query introdotta: le zone OSM passano dallo stesso `importSubMunicipalSource()` che scrive già `bboxMinLng/Lat/MaxLng/Lat` (Step 4.0), quindi `GET /api/zones?bbox=...` continua a filtrare in SQL sulle colonne indicizzate esistenti — nessuna modifica a `zones.service.ts`.

Benchmark reale post-import (8.201 zone totali in DB: 7.885 comune + 88 NIL + 50 osm_quartiere + 23 quartiere + 155 zona_urbanistica), chiamando `getZones()` direttamente:

| Viewport | Zone restituite | Tempo |
|---|---|---|
| Bologna (scala città) | 11 | 24ms |
| Bologna (2° chiamata) | 11 | 19ms |
| Nord Italia (viewport ampio) | 4.259 | 368ms |
| Tutta Italia (viewport quasi illimitato, caso peggiore mai reale in mappa) | 8.201 | 777ms |

Il caso reale (viewport Leaflet a scala città/quartiere) resta sotto i 25ms. Anche il caso patologico "tutta Italia in un colpo" — che la UI non genera mai, dato che Leaflet manda sempre i bound correnti — resta sotto il secondo con migliaia di zone.

## 7. Import — comandi

```bash
cd backend

# singola città
npm run zones:national -- --city=<istatCode>

# lista esplicita
npm run zones:national -- --cities=037006,048017,063049

# il campione di Step 4.4 (8 città)
npm run zones:national -- --sample

# dry-run: risolve e valida, non scrive nulla
npm run zones:national -- --sample --validate-only

# forza ri-download OSM (ignora cache disco)
npm run zones:national -- --sample --fresh
```

Ogni run scrive un report JSON completo (status/metrics/reasons per città) in `backend/data/reports/national-zones-<timestamp>.json` (gitignored, come tutto `backend/data/`).

Robustezza: il fallimento di una singola città (es. un 504 transitorio da Overpass dopo aver esaurito i retry) **non interrompe più il batch** — ogni città è isolata in un try/catch che produce uno stato `error` per quella riga e continua con le successive (bug reale trovato e corretto durante questo step: un 504 su Atrani interrompeva l'intero batch di 8 città a metà).

## 8. Problemi aperti

1. **Import nazionale completo non eseguito**: come richiesto dal goal, testato solo sul campione di 8 città — estendere a tutti i ~7.880 comuni non-MI/TO/RM richiederebbe ore di chiamate Overpass rispettose (courtesy delay 3s + retry) e andrebbe fatto a lotti, monitorando il tasso di rifiuto reale su scala nazionale prima di fidarsi ciecamente delle soglie (§4).
2. **Overpass pubblico rate-limita aggressivamente** sotto uso ravvicinato (osservato più volte durante questo step, inclusa l'interruzione di batch che ha portato al fix di §7). Per un import nazionale a lotti serve probabilmente un'istanza Overpass dedicata o mirror locale — non necessario per il campione, ma da valutare prima di Step 4.5.
3. **Tier `place` mai esercitato su dati reali**: tutti i 6 capoluoghi del campione hanno avuto abbastanza candidati nel tier `admin`. Il fallback a `place=suburb/quarter/neighbourhood` è implementato e testato solo su input sintetici nella logica, non su un comune reale — da tenere d'occhio quando l'import si estenderà a comuni dove `admin` è vuoto ma `place` no.
4. **Nessun caso reale di `rejected` osservato**: le soglie di validazione (coverage 60%, overlap 15%, ecc.) sono state scritte e sono raggiungibili nel codice, ma nel campione nessun dataset le ha toccate — quando si scalerà, monitorare i primi rifiuti reali per verificare che le soglie siano tarate bene (né troppo permissive né troppo severe).
5. **`sourceStatus` non ancora esposto in API**: il campo esiste in DB per tracciabilità/debug ma non è ancora nel payload REST di `/api/zones` (nessun consumer lo richiede oggi) — da aggiungere se admin/Step 4.5 ne avrà bisogno.
6. **Buchi (holes) OSM non assegnabili scartati silenziosamente**: se un `inner` ring non ricade in nessun `outer` ring assemblato (raro, capita con dati OSM leggermente inconsistenti), viene scartato invece di essere segnalato in log — innocuo (il poligono risulta leggermente più grande, non invalido) ma da rendere visibile se si nota in scala.

## 9. Proposta per Step 4.5

- Import a lotti di un sottoinsieme più ampio (es. tutti gli 106 capoluoghi di provincia), con throttling e monitoraggio del tasso `osm_validated` vs `municipality_fallback` vs `rejected` per calibrare le soglie di §4 su dati reali a scala maggiore prima di procedere a tutta Italia.
- Valutare un mirror/istanza Overpass dedicata se il rate-limiting pubblico diventa un collo di bottiglia per lotti più grandi del campione.
- Esporre `sourceStatus` (e magari `sourceType`) in `GET /api/zones` se serve a un pannello admin per distinguere a colpo d'occhio zone ufficiali/OSM/fallback comunale.
- Decidere se/quando attivare `isServiceActive` per le zone OSM validate (oggi restano `false`/`safetyScore: null` come da policy Step 4.0 — nessun punteggio inventato finché non arrivano feedback reali).
