# Step 4.0 — Base geografica Italia con ISTAT

## Obiettivo raggiunto

Le zone comunali demo/hardcoded sono ora affiancate da una base geografica nazionale reale: **7.896 comuni italiani** con confini ufficiali ISTAT, importati e verificati end-to-end (bbox map, point-in-polygon, routing safety score, API zone).

## 1. Analisi struttura esistente (pre-import)

- `City` → `Zone` (1:N), `Zone.geometryJson` è un blob `Json` con `{ type: 'Polygon'|'MultiPolygon', coordinates }`.
- I dati esistenti (Milano/Torino/Roma, 28 zone totali in `prisma/seed.ts`) sono poligoni di quartiere disegnati a mano, **non** confini comunali.
- Bug trovati durante l'analisi, tutti dovuti ad assunzioni "solo Polygon" mai verificate contro dati reali:
  - `zones.service.ts`: bbox filtering leggeva **tutte** le zone dal DB e filtrava in JS (`getGeometryBBox` usava solo `coordinates[0]`, ignorando MultiPolygon) — non scalabile a migliaia di comuni.
  - `MapView.vue`: `renderZones` passava a Leaflet solo `geometry.coordinates[0]`, quindi ogni zona `MultiPolygon` sarebbe stata disegnata in modo corrotto o non disegnata.
  - `useRouting.ts` e `DashboardPage.vue`: la point-in-polygon per il safety score lungo il percorso e per l'alert "zona a rischio" facevano `if (zone.geometry.type !== 'Polygon') continue` — **ignoravano completamente** le zone MultiPolygon.
  - Nessun `istatCode` o identificatore stabile su `City`.

Questi limiti sarebbero stati invisibili con Milano/Torino/Roma (tutte Polygon) ma bloccanti con l'Italia intera: **436 comuni su 7.896 (5,5%)** hanno geometria `MultiPolygon` (isole, exclave, arcipelaghi — es. Isole Tremiti, Campione d'Italia).

## 2. Fonte dati

**ISTAT — Confini delle unità amministrative a fini statistici**, edizione generalizzata WGS84, aggiornamento 01/01/2026.

- Archivio ufficiale: https://www.istat.it/it/archivio/222527
- URL diretto usato dall'importer: `https://www.istat.it/storage/cartografia/confini_amministrativi/generalizzati/2026/Limiti01012026_g.zip` (10,4 MB)
- Contiene 4 shapefile: `Com01012026_g` (comuni, geometria), `ProvCM01012026_g` (province/città metropolitane, per sigla e denominazione), `Reg01012026_g` (regioni, per denominazione), `RipGeo01012026_g` (non usato).
- **Attenzione CRS**: nonostante il nome file (`_WGS84.shp`) e il nome cartella ("generalizzati"), il `.prj` dichiara una proiezione `Transverse_Mercator` (UTM32N unico nazionale, non EPSG:4326). Verificato leggendo il `.prj` e validato riproiettando coordinate note (Torino, Milano, Roma) prima di fidarsi del dataset — l'importer riproietta sempre in WGS84 con `proj4` usando i parametri esatti del `.prj`.
- Nomi/sigle provincia e regione **non sono inventati**: vengono letti dagli shapefile ufficiali `ProvCM` (`SIGLA`, `DEN_UTS`) e `Reg` (`DEN_REG`), stessa fonte ISTAT, join tramite `COD_UTS`/`COD_REG` presenti anche nel file comuni.

## 3. Architettura importer

`backend/scripts/import-istat-comuni.ts`, eseguibile con:

```bash
cd backend
npm run import:istat                # download (se non in cache) + import di tutti i comuni
npm run import:istat -- --limit=50  # smoke test su 50 feature
npm run import:istat -- --fresh     # forza ri-download dello zip ISTAT
```

Pipeline:

```
ISTAT zip (cache locale in backend/data/istat/, gitignored)
  → estrazione (adm-zip)
  → parsing shapefile (Com/ProvCM/Reg via libreria "shapefile")
  → riproiezione UTM32N → WGS84 (proj4, parametri letti dal .prj)
  → validazione geometria (backend/src/lib/geo.ts: isValidGeometry — tipo, anelli ≥4 punti, range lat/lng)
  → mapping COD_REG/COD_UTS → nome regione / sigla provincia (join sulle tabelle ISTAT Reg/ProvCM)
  → upsert City (chiave: istatCode univoco) + Zone baseline (type="comune")
  → log: creati / aggiornati / saltati / geometrie non valide
```

**Idempotenza**: `City.istatCode` è univoco. Al primo run senza corrispondenza per `istatCode`, l'importer cerca una città legacy per nome (`istatCode IS NULL`) prima di crearne una nuova — questo evita di duplicare Milano/Torino/Roma già presenti da `seed.ts`, adottandole invece (assegna loro `istatCode`, `boundaryJson`, provincia/regione corrette). Ai run successivi il match è diretto su `istatCode` → sempre `update`, mai `create` duplicato.

**Non distruttivo**: se una città ha già zone con `type != 'comune'` (i quartieri disegnati a mano di Milano/Torino/Roma, con feedback/report reali collegati), l'importer **non tocca le zone esistenti** — aggiorna solo i metadati della città (nome, provincia, regione, `istatCode`, `boundaryJson`). Per tutti gli altri comuni crea/aggiorna una singola zona `type="comune"` che copre l'intero confine comunale.

**Il runtime dell'app non chiama mai ISTAT**: il download avviene solo eseguendo esplicitamente lo script, con cache locale su disco; l'app legge sempre e solo dal database.

## 4. Modifiche al DB (schema.prisma)

```prisma
model City {
  ...
  istatCode    String? @unique   // PRO_COM_T ISTAT, es. "001272" per Torino
  boundaryJson Json?             // confine comunale completo (indipendente dalle Zone)
}

model Zone {
  ...
  bboxMinLng Float?
  bboxMinLat Float?
  bboxMaxLng Float?
  bboxMaxLat Float?
  // + indici su ciascuna colonna bbox
}
```

Perché le colonne bbox: con 7.896 comuni, il filtro bbox della mappa **non può** più caricare tutte le zone e filtrare in JS (avrebbe significato scaricare l'intera geometria nazionale ad ogni pan/zoom). `zones.service.ts` ora costruisce il filtro bbox direttamente in SQL (`bboxMinLng <= maxLng AND bboxMaxLng >= minLng AND ...`), usando colonne indicizzate calcolate una volta in fase di scrittura (importer + `seed.ts`, tramite `computeBBox()` condiviso in `backend/src/lib/geo.ts`). Aggiunta anche una cap di sicurezza (`UNSCOPED_QUERY_LIMIT = 500`) se `/api/zones` viene chiamato senza `cityId` né `bbox`.

Nessuna migrazione distruttiva: colonne nuove, tutte nullable, nessuna colonna rimossa. Il progetto usa `prisma db push` (nessuna cartella `migrations/` preesistente).

## 5. Altre modifiche necessarie per compatibilità geometrica

Giustificate dal fatto che 436 comuni reali sono MultiPolygon (prima non gestiti da nessun consumer):

- `backend/src/lib/geo.ts` (nuovo): `ZoneGeometry` come union discriminata Polygon/MultiPolygon, `computeBBox()`, `isValidGeometry()` — condiviso da importer, seed e `zones.service.ts`.
- `frontend/src/utils/geo.ts` (nuovo): `pointInGeometry()`, `findContainingZone()`, `toLeafletLatLngs()` — sostituiscono la logica ray-casting duplicata in `useRouting.ts` e `DashboardPage.vue`, ora corretta anche per MultiPolygon.
- `frontend/src/components/map/MapView.vue`: rendering poligoni ora usa `toLeafletLatLngs()` invece di `coordinates[0]` → MultiPolygon disegnati correttamente (Leaflet supporta nativamente `LatLng[][][]`).
- `frontend/src/types/index.ts` e `backend/src/modules/zones/zones.types.ts`: `ZoneGeometry` è ora union discriminata (`Polygon` → `number[][][]`, `MultiPolygon` → `number[][][][]`) invece di un tipo unico impreciso.
- `backend/src/modules/cities/cities.service.ts` **non modificato**: i comuni importati hanno `isActive=false` di default, quindi `getCities()` (usato per i picker "città attive") resta a sole 3 righe (Milano/Torino/Roma) invece di 7.896 — vedi "Problemi aperti".

Nessun'altra modifica al routing OSRM, allo score engine o al modello di feedback/report.

## 6. Test eseguiti (reali, contro DB MariaDB locale)

Import completo: **7.896 comuni parsati, 0 geometrie invalide, ~16s di esecuzione.**

| Run | città create | città aggiornate | zone create | zone aggiornate | saltate (zone custom) |
|---|---|---|---|---|---|
| 1° (`npm run import:istat`) | 7.868 | 28 | 7.868 | 25 | 3 |
| 2° (stesso comando, verifica idempotenza) | **0** | 7.896 | **0** | 7.893 | 3 |

- **Torino, Milano, Roma**: adottate correttamente (stesso `id` legacy `city_mi`/`city_to`/`city_rm`, `isActive` preservato a `true`, ora con `istatCode`/provincia/regione corretti). Le 28 zone `district` esistenti **non toccate**, 0 duplicati.
- **La Loggia** (comune esplicitamente richiesto): importato come nuovo comune (`city_istat_001127`), geometria Polygon valida, anello chiuso, bbox corretto.
- **Comune piccolo**: individuato via bbox più piccolo tra tutti i comuni importati → **Atrani** (il comune più piccolo d'Italia per superficie, ~0,12 km²) — coerenza con dato reale noto.
- **MultiPolygon**: **Isole Tremiti** (arcipelago, Puglia) → 5 anelli su più parti, point-in-polygon testato positivo su San Domino e negativo in mare aperto lontano dalle isole.
- **bbox map**: chiamate reali a `GET /api/zones?bbox=...` per Torino, La Loggia, Isole Tremiti → risultati corretti (zone comunali circostanti incluse, filtro SQL funzionante).
- **point-in-polygon / routing safety**: replicata la logica di `useRouting.ts`/`DashboardPage.vue` contro geometrie reali da API — corretta sia su Polygon (Piazza Castello dentro "Centro Storico" di Torino) sia su MultiPolygon (San Domino dentro "Isole Tremiti").
- **zone detail + safety-summary**: `GET /api/zones/zone_istat_001127` e `/safety-summary` rispondono correttamente (comune nuovo → `level: "unknown"`, nessun crash).
- **`/api/zones` senza filtri**: cap di sicurezza verificato, risposta limitata a 500 righe invece di 7.921.
- **`/api/cities`**: resta a 3 righe (solo città attive), nessun impatto sull'onboarding/city picker esistente.
- **Feedback/report esistenti**: 0 righe presenti nel DB di sviluppo corrente (nessun dato da perdere); il codice dell'importer non referenzia mai `zoneFeedback`/`report`, quindi non può cancellarli.
- **TypeScript**: `npm run typecheck` (backend) e `vue-tsc --noEmit` (frontend) → **0 errori** dopo tutte le modifiche.

## 7. Problemi aperti

1. **Comuni importati sono `isActive=false`**: scelta intenzionale per non riversare 7.893 comuni grezzi nei picker "città attive" esistenti (onboarding, dashboard) che oggi assumono poche righe. Vanno attivati esplicitamente (o va introdotta una ricerca server-side paginata) quando si vuole esporli in UI oltre alla mappa/bbox.
2. **Zone `type="comune"` sono sempre `isServiceActive=false`, `safetyScore=null`**: nessun punteggio di sicurezza inventato — corretto per onestà dei dati, ma significa che l'intera Italia (tranne MI/TO/RM) appare grigia/"unknown" sulla mappa finché non arriva feedback reale o un processo di scoring dedicato.
3. **Holes (anelli interni) non gestiti** in `pointInGeometry`/`toLeafletLatLngs` oltre al primo anello per-parte: nessun comune italiano noto ha un vero "buco" (enclave di un altro comune), ma se dovesse servire va esteso.
4. **Import full-Italia richiede una risorsa di sviluppo con accesso a `istat.it`**: se l'ambiente di deploy non ha accesso a Internet in uscita, l'import va eseguito da una macchina che ce l'ha e il DB risultante replicato, oppure va scaricato manualmente lo zip indicato sopra e posizionato in `backend/data/istat/Limiti01012026_g.zip` prima di lanciare `npm run import:istat` (usa la cache locale, nessun retry di rete necessario).
5. **URL ISTAT hardcoded per l'anno 2026**: al prossimo aggiornamento annuale ISTAT il nome file cambia (`Limiti010120XX_g.zip`). Configurabile via env `ISTAT_ZIP_URL` senza toccare codice.

## 8. Preparazione per Step 4.1 (quartieri/circoscrizioni)

- `City.boundaryJson` conserva il confine comunale ISTAT **indipendentemente** dalle `Zone`, quindi resta disponibile come riferimento anche quando una città avrà zone più fini.
- Il pattern "salta se esistono zone `type != 'comune'`" nell'importer è lo stesso che andrà usato in Step 4.1: quando si importeranno quartieri/circoscrizioni per una città grande, basterà scrivere zone con un nuovo `type` (es. `"quartiere"`) — l'importer ISTAT comunale continuerà a riconoscerle come "zone custom" e non sovrascriverà più quella città a livello comunale.
- `bboxMinLng/Lat/MaxLng/Lat` e `computeBBox()` sono già generici Polygon/MultiPolygon: nessuna modifica necessaria per geometrie di quartiere.
- `istatCode` del comune resta la chiave stabile per collegare i futuri quartieri (es. dataset ISTAT "basi territoriali censuarie" per le sezioni di censimento) al comune padre.
