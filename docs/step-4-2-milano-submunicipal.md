# Step 4.2 — Quartieri reali: Milano

## Obiettivo raggiunto

Milano non usa più zone demo disegnate a mano. Le 8 zone `type="district"` sono state **eliminate** e sostituite da **88 NIL (Nuclei d'Identità Locale) reali**, geometrie ufficiali del Comune di Milano. Nessun motore nuovo è stato scritto: Milano riusa integralmente `SubMunicipalSource`/`engine.ts` costruiti nello Step 4.1 — l'unico codice nuovo è un file di configurazione della fonte, esattamente come previsto dall'architettura.

## 1. Fonte scelta e perché

**dati.comune.milano.it — portale open data del Comune di Milano**, dataset "Nuclei d'Identità Locale (NIL) VIGENTI - PGT 2030":

| Campo | Valore |
|---|---|
| Portale | https://dati.comune.milano.it/dataset/ds964-nil-vigenti-pgt-2030 (CKAN) |
| Download diretto | GeoJSON — `.../ds964_nil_wm.geojson` (verificato via API CKAN `package_show`) |
| Formato | GeoJSON (disponibile anche Shapefile e CSV, scelto GeoJSON: nessun passaggio di estrazione/shapefile-parsing necessario) |
| CRS | **EPSG:4326 (WGS84)** — dichiarato esplicitamente nel campo `crs` del file stesso e verificato incrociando le coordinate campione (~9.15°E, 45.43°N, dentro il bounding box reale di Milano). Nessuna riproiezione necessaria, nonostante il nome file contenga "WM" (Web Mercator) — probabile refuso/nome storico del resource, il contenuto è comunque EPSG:4326. |
| Licenza | Creative Commons Attribution (`license_id: "cc-by"`, verificato via API CKAN) |
| Ultimo aggiornamento dataset | 2026-05-08 (`metadata_modified` CKAN — dataset molto recente) |
| Suddivisione | 88 NIL, fonte "Milano 2030 - PGT Approvato" (Piano di Governo del Territorio), tutti con `Valido_al: "Vigente"` |
| Attributi | `ID_NIL` (id stabile), `NIL` (denominazione ufficiale, presa verbatim) |

**Perché questa fonte**: è la fonte ufficiale del Comune (non fallback OSM), con licenza e data di aggiornamento verificabili via API. **Attenzione**: esiste anche un dataset esplicitamente marcato `ds61...` **"OBSOLETI"** sullo stesso portale (vecchia perimetrazione NIL) — **scartato deliberatamente** in favore di quello vigente (`ds964`, PGT 2030), per non importare geometrie superate. Nominatim/OSM non è stato usato né per il bulk import né come fallback (la fonte ufficiale copre pienamente il bisogno); usato solo per 8 lookup singoli di verifica dei punti di test richiesti (non bulk).

## 2. Architettura — riuso, non duplicazione

**Nessuna modifica a `engine.ts`, `types.ts` o al CLI.** L'unico file nuovo specifico di Milano:

| File | Ruolo |
|---|---|
| `backend/src/lib/submunicipal/sources/milano-nil.ts` | Implementa `SubMunicipalSource`: URL, download GeoJSON, mapping `ID_NIL`/`NIL` → `SubMunicipalFeature` |
| `backend/src/lib/submunicipal/registry.ts` | +1 riga: `[milanoNilSource.id]: milanoNilSource` |

Differenza pratica rispetto a Torino (che dimostra la genericità del motore): Torino scarica uno ZIP con uno shapefile UTM-friendly-ma-in-realtà-WGS84 e richiede il parser `shapefile`; Milano scarica un GeoJSON già pronto e lo fa con `fetch()` + `JSON.parse()`. Nessuna delle due differenze ha richiesto toccare `engine.ts`: la fonte è responsabile di consegnare `SubMunicipalFeature[]` con geometria già in WGS84, il motore non sa né gli importa come ci sia arrivata.

**Comando esatto di import:**

```bash
cd backend
npm run import:istat                                       # se non già fatto — crea/adotta City Milano con istatCode
npm run import:submunicipal -- --source=comune-milano-nil   # importa gli 88 NIL
npm run import:submunicipal -- --list                       # ora elenca anche Torino e Milano
```

### Metadata di provenienza (nessuna modifica di schema)

Riusati gli stessi 5 campi nullable aggiunti su `Zone` nello Step 4.1:

```json
{
  "id": "zone_015146_comune-milano-nil_1",
  "source": "comune-milano-nil",
  "sourceId": "1",
  "sourceType": "nil",
  "sourceUpdatedAt": "2026-05-08T00:00:00.000Z",
  "cityIstatCode": "015146"
}
```

`sourceType="nil"` (diverso da `"quartiere"` di Torino) dimostra perché `sourceType` è tenuto distinto da `Zone.type` fin dallo Step 4.1: entrambi valgono `"nil"`/`"quartiere"` per ora, ma sono concettualmente la classificazione-di-provenienza, non un vincolo di dominio — nessun consumer frontend/backend filtra su `Zone.type` (verificato via grep, invariato dallo Step 4.1).

### Sostituzione zone demo e migrazione

L'engine (invariato) ha retired automaticamente le 8 vecchie zone `type="district"` di Milano non appena i nuovi `type="nil"` sono stati scritti — stessa logica usata per Torino (`type !== sourceType` → superseded), stessa migrazione per-overlap di `zoneFeedback`/`report`/`routeZoneCrossing` verso il NIL con maggiore intersezione geometrica prima della cancellazione. `City.boundaryJson` di Milano (confine ISTAT, Step 4.0) non è stato toccato.

## 3. Risultato dell'import (eseguito realmente, DB MariaDB locale)

```
[submunicipal] import summary
  source:          comune-milano-nil
  city:            Milano (istatCode=015146)
  features parsed: 88
  zones created:   88
  zones updated:   0
  zones retired:   8
  invalid geometry: 0
```

Le 8 zone retired sono `zone_001`…`zone_008` (`type="district"`, le vecchie zone demo di Milano). Verificato dopo l'import: **0 zone `type="district"` rimaste per Milano**.

## 4. Idempotenza (eseguita 3 volte in totale)

| Run | created | updated | retired |
|---|---|---|---|
| 1° | 88 | 0 | 8 |
| 2° (cache locale, no ri-download) | 0 | 88 | 0 |
| 3° | 0 | 88 | 0 |

Verifica diretta su DB dopo la 3ª esecuzione: **88 zone totali** per Milano, tutte `type="nil"`, **0 id duplicati**, **0 `sourceId` duplicati**, metadata di provenienza (`source`/`sourceId`/`sourceType`/`sourceUpdatedAt`/`cityIstatCode`) identici e stabili tra le esecuzioni.

## 5. Coverage / gap / overlap (calcolati con `@turf/turf`, dati reali da DB)

| Metrica | Valore |
|---|---|
| Area confine comunale (`City.boundaryJson`, ISTAT 2026) | 180.89 km² |
| Area unione degli 88 NIL (`turf.union`) | 181.48 km² |
| Overlap significativo tra NIL (soglia 50 m²) | **0 coppie** su 3.828 combinazioni testate |
| Gap: territorio comunale non coperto da alcun NIL | 2.383 km² (**1.32%**) |
| Territorio NIL fuori dal confine comunale | 2.971 km² (**1.64%**) |
| Tipi geometria | 88 `Polygon`, 0 `MultiPolygon` nel dataset Milano (il supporto MultiPolygon resta quello generico validato con Torino — Regio Parco/Mirafiori Sud) |

**Interpretazione**: 0 overlap conferma nessuna doppia assegnazione. Gap 1,32% ed eccedenza 1,64% sono coerenti con lo stesso fenomeno osservato a Torino (§4 dello step precedente): due dataset ufficiali indipendenti, di anni diversi (confine ISTAT 2026 vs perimetrazione NIL PGT approvata prima), con piccoli disallineamenti di bordo (aree industriali/ferroviarie dismesse, parchi ai margini) mai corretti a mano.

## 6. Test sui punti noti (eseguiti realmente contro DB/API)

Coordinate ottenute con lookup singoli Nominatim (non bulk, solo QA):

| Punto | Coordinate | NIL trovato | Esito |
|---|---|---|---|
| Duomo | 45.46417, 9.19161 | DUOMO | OK |
| Navigli | 45.45018, 9.17090 | PORTA TICINESE - CONCHETTA | OK — l'area Navigli/Darsena ricade in uno dei due NIL "Porta Ticinese" ufficiali (l'altro è "PORTA TICINESE - CONCA DEL NAVIGLIO"), coerente con la mappa reale |
| Isola | 45.48761, 9.19129 | ISOLA | OK |
| Porta Romana | 45.45224, 9.20206 | PTA ROMANA | OK (denominazione ufficiale abbreviata) |
| Bicocca | 45.51514, 9.21221 | BICOCCA | OK |
| CityLife | 45.47804, 9.15658 | TRE TORRI | OK — CityLife non è un NIL a sé; ricade ufficialmente nel NIL "TRE TORRI" (le tre torri del complesso danno il nome al NIL) |
| Centrale (Stazione Centrale) | 45.48588, 9.20426 | STAZIONE CENTRALE - PONTE SEVESO | OK |

**Nota metodologica**: il primo lookup Nominatim per "Stazione Centrale, Milano" ha restituito coordinate imprecise (45.50018, 9.21922 — in realtà zona Via Padova, NIL "PADOVA - TURRO - CRESCENZAGO", risultato coerente col punto sbagliato ma segnalato come FAIL nella verifica). Rifatto il lookup con query più specifica ("Milano Centrale railway station"), ottenute le coordinate corrette (45.48588, 9.20426), verificato che ricadono in "STAZIONE CENTRALE - PONTE SEVESO" come atteso. Riportato qui per trasparenza: il fallimento era del geocoder di verifica, non della geometria importata.

Ogni punto è risultato dentro **esattamente un** NIL (nessuna assegnazione multipla).

**Test API reali** (server locale, `npm run dev`):

- `GET /api/zones?bbox=9.17,45.44,9.22,45.49` (area Duomo/centro Milano) → 27 NIL reali restituiti, tutti `type: "nil"`, geometria `Polygon`.
- `GET /api/zones/zone_015146_comune-milano-nil_1` → "DUOMO", `type: "nil"`.
- `GET /api/zones/zone_015146_comune-milano-nil_1/safety-summary` → `level: "unknown"`, `safetyScore: null`, `feedbackCount: 0` — nessun dato inventato, stessa policy di Torino/Step 4.0.

## 7. Regressione Torino (eseguita realmente dopo l'import Milano)

L'import Milano opera solo su `cityId=city_mi` (associazione tramite `cityIstatCode`, mai per nome/posizione), quindi non avrebbe dovuto toccare Torino. Verificato comunque end-to-end:

- **Conteggio zone Torino**: 23, tutte ancora `type="quartiere"` (invariato dallo Step 4.1).
- **6 punti di test Torino** (Piazza Castello, San Salvario, Lingotto, Barriera di Milano, Vanchiglia, Crocetta): **tutti ancora corretti**, stessa zona di appartenenza dello Step 4.1.
- **API bbox Torino** (`?bbox=7.66,45.06,7.71,45.08`): stesso conteggio (10 zone) di prima dell'import Milano.
- Nessuna riga `Zone` di Torino toccata (`updatedAt` invariato per le zone di Torino durante l'import Milano — l'engine filtra sempre per `cityId` derivato da `cityIstatCode` della fonte in esecuzione).

**0 regressioni.**

## 8. Compatibilità con il resto del sistema

- **Routing safety / DashboardPage danger-alert / rendering mappa**: generici su Polygon/MultiPolygon (Step 4.0), nessun filtro su `Zone.type` — invariati, nessuna modifica necessaria per Milano.
- **Feedback / report / bbox / tracking**: chiavati su `zoneId`, invariati.
- **TypeScript**: `npm run typecheck` (backend) e `npm run type-check` (frontend) → **0 errori**.

## 9. Problemi aperti

1. **Milano torna grigia ("unknown") sulla mappa** finché non arriva feedback/reportistica reale sugli 88 NIL — stessa scelta, stessa motivazione dello Step 4.1 (§7 di quel report): nessun punteggio di sicurezza inventato.
2. **Gap/outside geometrico 1,32%/1,64%** tra confine comunale (ISTAT 2026) e NIL (PGT, dataset aggiornato 2026-05-08 ma perimetrazione approvata prima) — stessa causa di Torino, non corretta a mano.
3. **Dataset "OBSOLETI" ancora pubblicato da Milano sullo stesso portale**: nessun rischio per questo importer (usa l'URL esplicito del dataset vigente, mai una ricerca automatica "prendi il primo NIL dataset trovato"), ma da tenere presente se in futuro si automatizza la scoperta di nuove fonti.
4. **88 NIL, tutti `Polygon`**: il supporto `MultiPolygon` del motore resta validato solo indirettamente (tramite Torino) per Milano — nessun NIL reale lo richiede, quindi non è un gap dell'importer Milano, solo un fatto del dataset.
5. **Migrazione feedback/report non esercitata con dati reali**: come per Torino, il DB di sviluppo non aveva feedback/report reali sulle vecchie zone `district` di Milano — meccanismo verificato come codice (stesso pattern testato in Step 4.1), non con dati di produzione.

## 10. Preparazione per Step 4.3 (Roma)

Confermato che l'architettura scala a una seconda città reale senza toccare codice condiviso. Per Roma:

1. Cercare la fonte ufficiale (Comune di Roma / Roma Capitale open data — es. Municipi o Zone Urbanistiche) con lo stesso procedimento di verifica (`package_show`/metadata, CRS, licenza, data);
2. Se la fonte è Shapefile → ricalcare `torino-quartieri.ts` (download zip + parser `shapefile`); se è GeoJSON → ricalcare `milano-nil.ts` (fetch diretto); se richiede riproiezione → riusare il pattern `proj4` già presente nell'importer ISTAT comuni (Step 4.0), non necessariamente dentro `engine.ts`;
3. Un file `backend/src/lib/submunicipal/sources/roma-<tipo>.ts` + una riga in `registry.ts`;
4. `npm run import:submunicipal -- --source=<id-roma>` — invariati engine, schema, CLI, esattamente come per Milano.

Le 12 zone demo `district` di Roma verranno sostituite automaticamente dallo stesso motore di retirement, con la stessa migrazione feedback/report per-overlap. Nessun cambiamento previsto per i comuni `type="comune"` (baseline ISTAT, Step 4.0), che restano l'esito corretto per città senza fonte sub-comunale affidabile.
