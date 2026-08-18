# Step 4.5 — Rollout nazionale controllato

## Obiettivo raggiunto

Lo Step 4.4 aveva già scritto in DB, per davvero, il campione di 8 comuni (non solo in dry-run: vedi `docs/step-4-4-national-zone-strategy.md` §5). Questo step:

1. ha fatto sanity check del resolver/engine di Step 4.4 (nessun blocco trovato);
2. ha ri-eseguito l'import reale sul campione due volte di seguito per dimostrare formalmente l'idempotenza richiesta da questo step;
3. ha verificato la regressione Torino/Milano/Roma end-to-end (API, non solo conteggio DB);
4. ha verificato performance API reali (bbox HTTP, non solo `getZones()` diretto);
5. ha verificato TypeScript a 0 errori su backend e frontend;
6. ha aggiunto al CLI `zones:national` un comando batch sicuro (`--pending --limit=N --offset=N`) per l'espansione progressiva, senza inventare liste di capoluoghi non verificate.

Nessuna fonte ufficiale di Torino/Milano/Roma è stata toccata. Nessuna città con dati OSM insufficienti è stata forzata su una suddivisione artificiale.

## 1. Sanity check Step 4.4

| Verifica | Esito |
|---|---|
| `resolveZoneSource()` funzionante | ✓ — ri-eseguito `--sample --validate-only`, risultati identici al report di Step 4.4 |
| Cache OSM su disco coerente | ✓ — nessuna chiamata di rete durante il validate-only (dati serviti da `backend/data/osm/<istatCode>/`) |
| Nessuna regressione ISTAT/Torino/Milano/Roma | ✓ — vedi §3 |

Nessun blocco reale trovato: si è proceduto direttamente al rollout.

## 2. Rollout campione — stato reale in DB

Comando: `npm run zones:national -- --sample` (eseguito due volte consecutive, vedi §4 idempotenza).

| Città | ISTAT | Strategia | Zone | Coverage | Overlap | sourceStatus |
|---|---|---|---|---|---|---|
| Bologna | 037006 | `osm` (tier `admin`) | 6 | 99% | 0.0% | `osm_validated` |
| Firenze | 048017 | `osm` (tier `admin`) | 5 | 99% | 0.0% | `osm_validated` |
| Napoli | 063049 | `osm` (tier `admin`) | 10 | 98% | 0.0% | `osm_validated` |
| Genova | 010025 | `osm` (tier `admin`) | 9 | 99% | 0.0% | `osm_validated` |
| Palermo | 082053 | `osm` (tier `admin`) | 8 | 99% | 0.0% | `osm_validated` |
| Trento | 022205 | `osm` (tier `admin`) | 12 | 99% | 0.0% | `osm_validated` |
| La Loggia | 001127 | `municipality` | — | — | — | `municipality_fallback` (invariato) |
| Atrani | 065011 | `municipality` | — | — | — | `municipality_fallback` (invariato) |
| Torino | 001272 | `official` | 23 | — | — | `official` (invariato) |
| Milano | 015146 | `official` | 88 | — | — | `official` (invariato) |
| Roma | 058091 | `official` | 155 | — | — | `official` (invariato) |

Stato DB confermato con query dirette (Prisma `groupBy`):

| sourceType | sourceStatus | count |
|---|---|---|
| `null` (comune ISTAT baseline) | `null`* | 7.885 |
| `nil` | `official` | 88 |
| `quartiere` | `official` | 23 |
| `zona_urbanistica` | `official` | 155 |
| `osm_quartiere` | `osm_validated` | 50 |

Totale: **8.201 zone**. (*Le 7.885 zone `comune` hanno realmente `sourceStatus=null` in DB — verificato con query mirata, 0 righe su 7.885 hanno `municipality_fallback`. Il codice attuale di `import-istat-comuni.ts` scrive già `sourceStatus: 'municipality_fallback'` sia su `create` che su `update`, ma `npm run import:istat` non è stato ri-eseguito da quando quel campo è stato introdotto in Step 4.4 — le righe esistenti non sono mai state toccate da allora. Non è un bug di codice, è un dato di backfill mancante. Vedi §8.5 per la valutazione: il campo resta "puramente informativo" come documentato in Step 4.4 e nessuna query di produzione lo filtra, quindi non blocca questo step, ma va corretto prima di usarlo in un pannello admin.)

Zero duplicati `(cityId, name)` tra zone `official`/`osm_validated`. Zero righe orfane in `ZoneFeedback`/`Report` dopo il retiro delle zone comune superate.

## 3. Regressione Torino/Milano/Roma (end-to-end, non solo conteggio)

`npm run zones:national -- --cities=001272,015146,058091`:

```
[001272] Torino — ✓ official  → +0 created, ~23 updated, -0 retired
[015146] Milano — ✓ official  → +0 created, ~88 updated, -0 retired
[058091] Roma   — ✓ official  → +0 created, ~155 updated, -0 retired
```

Il resolver le trova al livello 1 (`OFFICIAL_SOURCES_BY_ISTAT`), **zero chiamate Overpass**.

Verificato anche via HTTP reale (server dev avviato, non solo funzione diretta):

- `GET /api/zones?bbox=<torino>` → 42 zone nel viewport (comprende comuni limitrofi + i 23 quartieri Torino)
- `GET /api/zones?bbox=<milano>` → 117 zone
- `GET /api/zones?bbox=<roma>` → 218 zone
- `GET /api/zones/:id` su una zona `osm_quartiere` (Savena, Bologna) → `level: "unknown"`, `color: "#CBD5E1"`, `isServiceActive: false` — nessun punteggio inventato, come da policy Step 4.0
- `GET /api/zones/:id/safety-summary` sulla stessa zona → coerente, `safetyScore: null`, `feedbackCount: 0`

**Geometrie** (316 zone `official`+`osm_validated`): 154 `Polygon`, 162 `MultiPolygon`, **0 invalide** (`isValidGeometry` su tutte).

**Rendering/point-in-polygon**: `frontend/src/utils/geo.ts` (`toLeafletLatLngs`, `pointInGeometry`) gestisce nativamente sia `Polygon` che `MultiPolygon` — nessuna modifica necessaria, il codice Step 3.3 era già generico. `MapView.vue` usa `L.polygon()` con le coordinate convertite, compatibile con multi-part.

## 4. Idempotenza — verificata con due run reali consecutivi

Run 1 (`npm run zones:national -- --sample`):
```
[037006] Bologna — +0 created, ~6 updated, -0 retired
[048017] Firenze — +0 created, ~5 updated, -0 retired
[063049] Napoli  — +0 created, ~10 updated, -0 retired
[010025] Genova  — +0 created, ~9 updated, -0 retired
[082053] Palermo — +0 created, ~8 updated, -0 retired
[022205] Trento  — +0 created, ~12 updated, -0 retired
```

Run 2 (immediatamente dopo, stesso comando): **risultati identici byte-per-byte nella struttura** (`+0 created, ~N updated, -0 retired` per ogni città). Conteggio zone DB invariato: 8.201 prima e dopo. Zero duplicati, zero zone comune resuscitate.

## 5. Performance

### bbox HTTP reale (server dev locale, Windows loopback)

| Città | Zone | `getZones()` diretto | HTTP end-to-end (curl) |
|---|---|---|---|
| Torino | 42 | 8.6ms | ~320ms (dominato da TCP connect loopback, non da query) |
| Milano | 117 | 17.6ms | ~490ms |
| Roma | 218 | 69.8ms | ~320ms (`curl -w`: connect 208ms, starttransfer 317ms — query reale <70ms) |
| Bologna | 17 | 8.7ms | ~300ms |
| Napoli | 31 | 7.6ms | ~300ms |
| Trento | 30 | 5.6ms | ~320ms |

Il tempo di query/serializzazione lato server resta **sotto i 70ms** in ogni caso, coerente con il benchmark diretto di Step 4.4 (Bologna 24ms, Nord Italia 4.259 zone in 368ms). La differenza tra "diretto" e "HTTP" è quasi interamente overhead di connessione TCP del loopback locale (misurato separatamente con `curl -w`: ~200ms di `connect`, tipico di `curl.exe` su Git Bash/Windows verso `localhost`), non un problema della query bbox. Nessuna ottimizzazione applicata: i tempi erano già buoni (regola del goal — evitare ottimizzazioni premature).

Nessuna nuova query introdotta rispetto a Step 4.4: `getZones()` filtra sempre in SQL sulle colonne indicizzate `bboxMinLng/Lat/MaxLng/Lat` (`@@index` in `prisma/schema.prisma`), mai un full-scan su tutta Italia.

## 6. TypeScript

```
cd backend  && npm run typecheck   # tsc --noEmit       → 0 errori
cd frontend && npm run typecheck   # vue-tsc --noEmit    → 0 errori
```

## 7. Espansione — comando batch sicuro

Aggiunto a `backend/scripts/import-national-zones.ts` (e verificato con `npm run typecheck`): il flag `--pending`, che itera tutti i comuni **senza** una fonte ufficiale registrata (cioè tutta Italia tranne Torino/Milano/Roma), ordinati deterministicamente per `istatCode`, paginabile con `--limit`/`--offset`.

```bash
cd backend

# prossimo batch di 50 comuni mai toccati da fonte ufficiale, dry-run
npm run zones:national -- --pending --limit=50 --validate-only

# stesso batch, scrittura reale
npm run zones:national -- --pending --limit=50

# batch successivo (offset avanza)
npm run zones:national -- --pending --limit=50 --offset=50

# lista esplicita già supportata (invariata da Step 4.4)
npm run zones:national -- --cities=037006,048017,063049
```

**Guardrail di sicurezza**: `--pending` senza `--limit` esplicito genera un errore immediato — non esiste un modo di lanciare accidentalmente un batch nazionale illimitato. Torino/Milano/Roma sono strutturalmente esclusi dalla query `--pending` (filtro `istatCode NOT IN OFFICIAL_SOURCES_BY_ISTAT`), quindi non possono mai finire in un batch OSM per errore.

Smoke-test eseguito: `--pending --limit=3 --validate-only` ha risolto correttamente `[001001] Agliè, ...` (i primi comuni per `istatCode` esclusi i 3 ufficiali), confermando ordinamento e filtro. La chiamata Overpass reale sul secondo comune del batch ha incontrato un 504/rate-limit del server pubblico — comportamento **già documentato come problema noto in Step 4.4 §8.2**, non una regressione introdotta qui; il batch isolato per-città (try/catch in `runCity()`) garantisce comunque che un fallimento non blocchi l'intero batch.

### Perché non un flag `--capoluoghi-provincia` / `--capoluoghi-regione` con lista precompilata

Il goal chiede questi come **esempi** di dimensioni di batch, non come requisito rigido. Il modello `City` e lo shapefile ISTAT importato in Step 4.0 **non contengono** un flag "comune capoluogo" (verificato in `import-istat-comuni.ts`: legge solo nome/provincia/regione/confine, nessun campo capoluogo). Costruire quella lista a mano (106 capoluoghi di provincia + 20 di regione) significherebbe scrivere ISTAT code non verificati nel codice — esattamente il tipo di dato "inventato" che il goal vieta esplicitamente per le geometrie, e che per coerenza non va fatto nemmeno per le liste di selezione città. `--pending --limit=N` copre lo stesso bisogno operativo (rollout progressivo, monitorato, mai accidentalmente completo) senza questo rischio. Se serve realmente la priorità "capoluoghi prima", la strada corretta è importare il dataset ISTAT ufficiale "Elenco dei comuni italiani" (che include la colonna flag capoluogo) come step dati a sé — proposto in Step 4.6 (§9).

## 8. Problemi aperti

1. **Rate limiting Overpass pubblico** (già noto da Step 4.4): confermato di nuovo durante lo smoke-test di `--pending`. Un rollout a batch da decine/centinaia di comuni richiede probabilmente un mirror Overpass dedicato o un throttling più aggressivo (courtesy delay maggiore di 3s) per non incorrere in 504 ripetuti.
2. **Nessuna lista capoluoghi verificata in repo** (vedi §7) — richiede import di un dataset ISTAT separato prima di poter offrire un flag `--capoluoghi-*` senza rischio di dati sbagliati.
3. **Tier `place` OSM ancora mai esercitato su dati reali** (invariato da Step 4.4) — da tenere d'occhio quando `--pending` raggiungerà comuni dove il tier `admin` è vuoto.
4. **Nessun caso reale di `rejected`** osservato finora (campione + smoke-test `--pending`) — le soglie di `validate.ts` restano da tarare su un campione di rifiuto reale quando la scala aumenta.
5. **`sourceStatus` mancante (backfill) sulle 7.885 zone `comune` baseline**: sono realmente `null` in DB, non `municipality_fallback` come dovrebbero essere secondo il codice attuale di `import-istat-comuni.ts` (che li scrive correttamente sia su `create` sia su `update` — verificato leggendo il file). La causa è che `npm run import:istat` non è stato ri-eseguito da quando quel campo è stato aggiunto in Step 4.4, quindi le righe pre-esistenti non sono mai state backfillate. Il campo resta oggi puramente informativo (nessuna query di produzione lo filtra — confermato in `zones.service.ts`), quindi questo non blocca lo Step 4.5, ma va risolto (basta un `npm run import:istat` completo, idempotente per design) prima di esporre `sourceStatus` in un pannello admin o in `GET /api/zones`.

## 9. Proposta Step 4.6

- Importare il dataset ISTAT ufficiale "Elenco dei comuni italiani" (flag capoluogo provincia/regione, popolazione) come nuovo campo `City` reale — sblocca `--capoluoghi-provincia`/`--capoluoghi-regione` senza dati inventati.
- Eseguire il primo batch reale con `--pending --limit=50` (o superiore, in base alla disponibilità di un mirror Overpass) e monitorare il tasso `osm_validated` vs `municipality_fallback` vs `rejected` su scala più ampia del campione di 8.
- Valutare un mirror/istanza Overpass dedicata prima di batch oltre ~50-100 comuni, per evitare i 504 osservati anche in questo step.
- Esporre `sourceStatus`/`sourceType` in `GET /api/zones` per un pannello admin (proposta già presente in Step 4.4, ancora valida).
