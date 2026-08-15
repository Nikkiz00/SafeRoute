# Step 4.1 — Quartieri reali: pilot Torino

## Obiettivo raggiunto

Torino non usa più quartieri disegnati a mano. Le 8 zone demo (`type="district"`, poligoni approssimati a mano, punteggi di sicurezza inventati) sono state **eliminate** e sostituite da **23 quartieri reali**, con geometrie provenienti dal portale open data ufficiale del Comune di Torino. È stata costruita una pipeline generica (`SubMunicipalSource`) pensata per essere riusata da qualunque futura città, non solo Torino.

## 1. Fonte scelta e perché

**aperTO — portale open data del Comune di Torino**, dataset "Quartieri":

| Campo | Valore |
|---|---|
| Portale | https://aperto.comune.torino.it/dataset/quartieri (CKAN) |
| Download diretto | `https://risorse.comune.torino.it/opendata/geodata/quartieri.zip` |
| Formato | ESRI Shapefile (`.shp`/`.dbf`/`.shx`/`.prj`), zippato |
| CRS | WGS84 / EPSG:4326 (verificato leggendo il `.prj`: `GCS_WGS_1984` — nessuna riproiezione necessaria, a differenza dell'importer ISTAT comuni che usa UTM32N) |
| Licenza | Creative Commons Attribution (`license_id: "cc-by"`, verificato via API CKAN `package_show`) |
| Ultimo aggiornamento dataset | 2019-10-17 (metadato `metadata_modified` del pacchetto CKAN, non la data di questo import) |
| Suddivisione | 23 "quartieri" — livello **più fine** delle due suddivisioni ufficiali di Torino (8 circoscrizioni vs 23 quartieri). I nomi (San Salvario, Vanchiglia, Crocetta, Barriera di Milano, Centro, ...) corrispondono ai quartieri effettivamente usati nel linguaggio comune — lo stesso che le vecchie zone demo cercavano di approssimare a mano. |
| Attributi shapefile | `ID_QUART` (id stabile per quartiere), `DENOM` (denominazione ufficiale, presa verbatim, mai corretta a mano) |

**Perché questa fonte e non altre**: rispetta l'ordine di priorità richiesto — è la fonte ufficiale del Comune (non un fallback OSM), disponibile in formato geografico scaricabile direttamente (non serve scraping), con licenza esplicita e verificabile via API. Alternativa scartata: dataset "Carta delle circoscrizioni" (8 circoscrizioni, anch'esso ufficiale) — troppo grossolano: 8 zone per l'intera città non avrebbero permesso di distinguere quartieri come San Salvario da Crocetta, entrambi punti di test richiesti. Nominatim/OSM **non è stato usato** né per il bulk import né come fallback, perché la fonte ufficiale copre pienamente il bisogno; è stato usato *solo* per verifica puntuale (6 lookup singoli, non bulk) delle coordinate dei punti di test richiesti.

## 2. Architettura

Pipeline generica, indipendente da Torino, in `backend/src/lib/submunicipal/`:

```
SubMunicipalSource (config dichiarativa: id, cityIstatCode, sourceType, license, sourceUpdatedAt, fetch(), parse())
  → fetch/download (cache locale idempotente, come l'importer ISTAT)
  → parse (shapefile → SubMunicipalFeature[], geometria già normalizzata WGS84)
  → validate geometry (isValidGeometry, riusato da geo.ts — Step 4.0)
  → associate City (lookup per cityIstatCode — mai per nome, mai hardcoded)
  → upsert Zone (type = sourceType, + metadata di provenienza)
  → retire zone superseded (comune baseline + eventuali zone hand-drawn legacy),
    migrando feedback/report/routeZoneCrossing verso la zona nuova con maggiore overlap geometrico
```

File creati:

| File | Ruolo |
|---|---|
| `backend/src/lib/submunicipal/types.ts` | Contratto `SubMunicipalSource` / `SubMunicipalFeature` — nessun riferimento a città specifiche |
| `backend/src/lib/submunicipal/engine.ts` | Motore generico: upsert + retire, riusabile da qualunque fonte registrata |
| `backend/src/lib/submunicipal/sources/torino-quartieri.ts` | **Unico file specifico di Torino**: URL, parsing shapefile, mapping campi |
| `backend/src/lib/submunicipal/registry.ts` | Mappa `id → SubMunicipalSource`; aggiungere una città = un file + una riga qui |
| `backend/scripts/import-submunicipal.ts` | CLI generica, nessun riferimento a Torino |
| `backend/src/types/shapefile.d.ts` | Dichiarazione ambient minimale (il pacchetto `shapefile` non pubblica tipi) |

**Comando esatto di import:**

```bash
cd backend
npm run import:istat                                            # se non già fatto — crea/adotta City Torino con istatCode
npm run import:submunicipal -- --source=comune-torino-quartieri # importa i 23 quartieri
npm run import:submunicipal -- --list                           # elenca le fonti registrate
```

### Metadata di provenienza (schema.prisma)

Aggiunti a `Zone`, tutti nullable (nessuna migrazione distruttiva, `prisma db push`):

```prisma
model Zone {
  ...
  source          String?   // es. "comune-torino-quartieri"
  sourceId        String?   // id stabile nel dataset sorgente, es. "18" (ID_QUART)
  sourceType      String?   // "quartiere" | "circoscrizione" | "nil" | ...
  sourceUpdatedAt DateTime? // data di aggiornamento del *dataset*, non dell'import
  cityIstatCode   String?   // denormalizzato da City.istatCode, per audit senza join
}
```

`Zone.type` continua a guidare il comportamento applicativo (routing, rendering — è una stringa libera, nessun consumer la vincola a un enum, verificato via grep in frontend/backend). `sourceType` è la controparte "di provenienza", pensata per audit: per Torino i due valori coincidono (`"quartiere"`), ma potrebbero divergere in futuro (es. una fonte NIL che SafeRoute vuole comunque esporre come `type="district"` per coerenza UI).

### Le tre entità richieste, distinte chiaramente

1. **Confine comunale** → `City.boundaryJson` (Step 4.0, ISTAT) — invariato, indipendente dalle Zone.
2. **Suddivisione interna reale** → `Zone.geometryJson` con `sourceType="quartiere"` — geometria del quartiere così come pubblicata dal Comune, non modificata.
3. **Zona SafeRoute** → la riga `Zone` stessa (safetyScore, isServiceActive, feedback, report, routing) — la stessa tabella, ma il quartiere reale *è* la zona di sicurezza: nessuna tabella-ponte separata, per non introdurre un livello di indirection non richiesto da nessun consumer esistente (feedback/report/routing sono già chiavati su `zoneId`).

### Sostituzione della zona comunale e delle zone hand-drawn

L'engine, dopo aver scritto i 23 nuovi `Zone` (`type="quartiere"`), cerca tutte le zone esistenti per quella città con `type` diverso da `"quartiere"` — questo intercetta *sia* l'eventuale zona baseline `type="comune"` (Step 4.0) *sia* le vecchie zone `type="district"` disegnate a mano — e per ciascuna:

1. calcola, tra le 23 nuove, quella con **maggiore area di intersezione geometrica** (fallback: centroide più vicino, se per qualche motivo non c'è overlap reale);
2. migra `zoneFeedback` / `report` / `routeZoneCrossing` verso quella nuova zona (`updateMany`, dentro una transazione);
3. elimina la vecchia zona.

Nessuna geometria comunale-vs-quartiere resta duplicata sulla mappa (evita il doppio conteggio nel point-in-polygon).

## 3. Risultato dell'import (eseguito realmente, DB MariaDB locale)

```
[submunicipal] import summary
  source:          comune-torino-quartieri
  city:            Torino (istatCode=001272)
  features parsed: 23
  zones created:   23
  zones updated:   0
  zones retired:   8
  invalid geometry: 0
```

Le 8 zone retired sono esattamente le vecchie `zone_to_001`…`zone_to_008` (`type="district"`). Verificato dopo l'import: **0 zone `type="district"` rimaste per Torino**.

**Idempotenza verificata**: rieseguendo lo stesso comando (`npm run import:submunicipal -- --source=comune-torino-quartieri`), usando la cache locale (`backend/data/submunicipal/torino-quartieri/`, gitignored come `backend/data/istat/`):

```
zones created:   0
zones updated:   23
zones retired:   0
```

## 4. Coverage / gap / overlap (calcolati con `@turf/turf`, dati reali da DB)

| Metrica | Valore |
|---|---|
| Area confine comunale (`City.boundaryJson`, ISTAT 2026) | 129.81 km² |
| Area unione dei 23 quartieri (`turf.union`) | 127.41 km² |
| Overlap significativo tra quartieri (soglia 50 m², rumore di bordo escluso) | **0 coppie** su 253 combinazioni testate |
| Gap: territorio dentro il confine comunale non coperto da alcun quartiere | 3.715 km² (**2.86%**) |
| Territorio dei quartieri fuori dal confine comunale | 1.319 km² (**1.02%**) |
| Tipi geometria | 21 `Polygon` + 2 `MultiPolygon` (Regio Parco, Mirafiori Sud) |

**Interpretazione del gap/outside**: 0 overlap conferma che i 23 quartieri non si sovrappongono tra loro (nessun punto assegnato a più zone senza motivo). Il gap del 2,86% e l'eccedenza dell'1,02% sono spiegati dal fatto che le due geometrie provengono da **fonti ufficiali indipendenti e di anni diversi**: il confine comunale è ISTAT 01/01/2026 (Step 4.0), i quartieri sono aperTO 2019. Piccoli disallineamenti di bordo (argini del Po, aree industriali dismesse non riassegnate) sono attesi tra dataset non coordinati tra loro e non sono stati corretti a mano — farlo avrebbe significato inventare geometria, esplicitamente vietato dal task.

## 5. Test sui punti noti (eseguiti realmente contro l'API/DB, non simulati)

Coordinate ottenute con lookup singoli Nominatim (non bulk — solo per QA):

| Punto | Coordinate | Zona attesa | Zona trovata | Esito |
|---|---|---|---|---|
| Piazza Castello | 45.07025, 7.68680 | Centro | Centro | OK |
| San Salvario | 45.05495, 7.68015 | San Salvario | San Salvario | OK |
| Lingotto | 45.03140, 7.66688 | Nizza Millefonti* | Nizza millefonti | OK |
| Barriera di Milano | 45.09239, 7.69532 | Barriera di Milano | Barriera di Milano | OK |
| Vanchiglia | 45.07044, 7.69847 | Vanchiglia | Vanchiglia | OK |
| Crocetta | 45.05792, 7.66497 | Crocetta | Crocetta | OK |

\* Lingotto non è un quartiere a sé nella suddivisione ufficiale in 23 quartieri (lo storico stabilimento Fiat/Lingotto Fiere ricade amministrativamente in "Nizza Millefonti") — confermato incrociando anche la risposta di reverse-geocoding OSM, che etichetta lo stesso punto "Nizza Millefonti". Comportamento corretto, non un bug: SafeRoute ora riflette la suddivisione reale invece del nome popolare.

Ogni punto è risultato dentro **esattamente una** zona (nessuna assegnazione multipla).

**Test API reali** (server locale, `npm run dev`):

- `GET /api/zones?bbox=7.66,45.06,7.71,45.08` → 10 quartieri reali restituiti, tutti `type: "quartiere"`, geometria `Polygon` corretta.
- `GET /api/zones/zone_001272_comune-torino-quartieri_18` → dettaglio "Barriera di Milano", `level: "unknown"` (nessun punteggio inventato).
- `GET /api/zones/zone_001272_comune-torino-quartieri_18/safety-summary` → risponde correttamente, `safetyScore: null`, `feedbackCount: 0`.

## 6. Compatibilità con il resto del sistema

- **Routing safety / DashboardPage danger-alert**: entrambi leggono `zone.geometry` in modo generico (Polygon/MultiPolygon, `frontend/src/utils/geo.ts` — Step 4.0) e non filtrano mai su `zone.type`; verificato via grep, nessun consumer frontend/backend vincola `Zone.type` a un enum chiuso.
- **Feedback / report / bbox / tracking**: chiavati su `zoneId`, invariati — i 23 nuovi `Zone` sono righe `Zone` a tutti gli effetti, nessuna API ha dovuto cambiare.
- **TypeScript**: `npm run typecheck` (backend) e `npm run type-check` (frontend, `vue-tsc --noEmit`) → **0 errori** dopo tutte le modifiche.

## 7. Perché nessun punteggio di sicurezza inventato

Le 23 nuove zone nascono con `isServiceActive=false`, `safetyScore=null` — stessa policy delle zone comunali baseline di Step 4.0. Le vecchie zone demo avevano invece punteggi hardcoded (22–80) inventati per rendere la mappa "colorata": eliminati insieme alla geometria, perché entrambi violavano la stessa regola (dati non reali). Un admin può attivare una zona via `PATCH /api/admin/zones/:id/service-status` (già esistente) quando arriveranno feedback reali.

## 8. Problemi aperti

1. **Torino torna grigia ("unknown") sulla mappa** finché non arriva feedback/reportistica reale sui 23 quartieri — regressione visiva rispetto alla demo colorata, ma conseguenza diretta e voluta della rimozione dei punteggi inventati (vedi §7).
2. **Gap/outside geometrico 2,86%/1,02%** tra confine comunale (ISTAT 2026) e quartieri (aperTO 2019) — non correggibile senza inventare geometria; si risolverà naturalmente se/quando il Comune di Torino ripubblicherà i quartieri su una vintage più recente.
3. **Dataset quartieri fermo al 2019**: nessun meccanismo di rilevamento automatico di un aggiornamento aperTO (a differenza di `administrative-changes.ts` per i comuni, qui non ci sono variazioni amministrative note post-2019 per i quartieri di Torino). Se aperTO pubblica una revisione, basta ririlanciare l'import (idempotente) — nessun problema noto, solo assenza di un trigger automatico.
4. **Migrazione feedback/report non esercitata con dati reali**: il DB di sviluppo aveva 0 righe di feedback/report sulle vecchie zone `district` di Torino (stesso stato riportato in Step 4.0.1 per i comuni ISTAT), quindi il meccanismo di migrazione per-overlap non è stato validato contro dati veri, solo verificato come codice (stesso pattern, già in produzione logica, di `administrative-reconciliation.ts`).
5. **`shapefile` non pubblica tipi**: aggiunta una dichiarazione ambient minimale (`backend/src/types/shapefile.d.ts`) — nessun impatto funzionale, ma da tenere a mente se il pacchetto cambia API in futuro.

## 9. Strategia proposta per Step 4.2 (Milano)

L'architettura è già pronta: per Milano basta

1. individuare la fonte ufficiale dei NIL (Nuclei di Identità Locale) sul portale open data del Comune di Milano (dati.comune.milano.it), verificarne formato/licenza/CRS con lo stesso procedimento di §1;
2. scrivere `backend/src/lib/submunicipal/sources/milano-nil.ts` (fetch + parse, stesso contratto `SubMunicipalSource`);
3. registrarlo in `registry.ts`;
4. `npm run import:submunicipal -- --source=<id-milano>` — nessuna modifica a `engine.ts`, allo schema, o al CLI.

Le 8 zone demo `district` di Milano verranno automaticamente sostituite dal motore di retirement esistente, con la stessa migrazione feedback/report per-overlap. Roma segue lo stesso schema quando sarà identificata la fonte ufficiale (municipi/quartieri storici). Per comuni senza suddivisione affidabile, resta valida la singola zona `type="comune"` già prodotta da Step 4.0 — nessun cambiamento necessario lì.
