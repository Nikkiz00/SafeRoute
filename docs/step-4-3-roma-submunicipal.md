# Step 4.3 — Suddivisioni reali: Roma

## Obiettivo raggiunto

Roma non usa più zone demo disegnate a mano. Le 12 zone `type="district"` sono state **eliminate** e sostituite da **155 zone urbanistiche reali**, la suddivisione ufficiale di Roma Capitale. Nessun motore nuovo: Roma riusa integralmente `SubMunicipalSource`/`engine.ts`/`registry.ts` (Step 4.1–4.2) — solo un file di configurazione della fonte e, per la prima volta, un piccolo miglioramento realmente necessario e generico al modulo condiviso `geo.ts` (riproiezione), non specifico di Roma.

## 1. Fonti confrontate

Prima di implementare, confrontate tre suddivisioni ufficiali di Roma Capitale, verificando ciascuna direttamente (non per sentito dire):

| Fonte | Granularità | Stato | Verdetto |
|---|---|---|---|
| **Municipi** (WFS `DIPPC:210_RomaCapitale_Municipi`) | 15 zone | Live, pubblico | Scartata: troppo grossolana per un comune di ~1.285 km² — stesso problema delle 8 circoscrizioni di Torino scartate nello Step 4.1 (in media ~85 km² a zona, impossibile distinguere Trastevere da Testaccio) |
| **"Nuova mappa urbana": 327 quartieri, 22 rioni, 104 zone funzionali** (progetto presentato nel 2025, osservazioni pubbliche aperte fino al 2026-01-15) | 327 zone | **Non ancora un dataset geografico pubblicato** | Scartata **per ora**: verificato interrogando direttamente `GetCapabilities` del WFS del geoportale — nessun layer corrispondente esiste ad oggi. Fallisce i criteri richiesti "geometrie complete" e "stabilità" (processo partecipativo, non ancora formalmente concluso in un dataset scaricabile). Vedi §9 per il piano di adozione futura. |
| **Zone urbanistiche** (WFS `DIPDIT:ZoneUrbanistiche`) | 155 zone | Live, pubblico, verificato con una richiesta `GetFeature` reale (4,5 MB GeoJSON, 155/155 feature valide) | **Scelta**: istituite nel 1977, stabili a 155 dal 1992 (secessione di Fiumicino), granularità sufficiente a separare Centro Storico/Trastevere/EUR/Parioli/Ostia (Ostia da sola è divisa in 3 zone: Ostia Nord/Sud/Antica), identificatore stabile (`ZONA_URBANISTICA`, alfanumerico, es. "10a") |

**Criteri applicati** (come richiesto): granularità utile alla sicurezza → esclude Municipi; geometrie complete e disponibili ora → esclude la nuova mappa 327 quartieri; stabilità → favorisce zone urbanistiche (48 anni di stabilità documentata) sul progetto ancora in consultazione; licenza utilizzabile → verificata (sotto); identificatori affidabili → `ZONA_URBANISTICA` verificato univoco su tutte le 155 feature.

## 2. Fonte scelta, dettagli

| Campo | Valore |
|---|---|
| Ente | Roma Capitale, Dipartimento Programmazione e Attuazione Urbanistica |
| Dataset | "Zone Urbanistiche" (layer `DIPDIT:ZoneUrbanistiche`) |
| Portale | https://geoportale.comune.roma.it/catalogo/ (TEMATISMO "LIMITI AMMINISTRATIVI", PUBBLICO "SI") |
| Accesso dati | WFS OGC standard: `https://geoportale.comune.roma.it/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=DIPDIT:ZoneUrbanistiche&outputFormat=application/json` |
| Formato | GeoJSON via WFS (confermato scaricando realmente: 4.505 KB, 155 feature) |
| CRS | **EPSG:6708** (RDN2008 / UTM zona 33N — il datum geodetico nazionale italiano corrente), dichiarato nel campo `crs` della risposta stessa. Riproiezione a WGS84 necessaria (a differenza di Torino e Milano). |
| Licenza | **Nessuna etichetta formale** (no badge IODL/CC-BY trovato). La pagina istituzionale open data di Roma Capitale dichiara testualmente: *"liberamente accessibili... il cui riutilizzo è soggetto alla sola indicazione della fonte"* (https://www.comune.roma.it/web/it/open-data.page) — riuso libero, solo attribuzione, funzionalmente equivalente a CC-BY. Citata verbatim invece di assumere un nome di licenza non verificato. |
| Aggiornamento | Nessuna data di revisione machine-readable pubblicata per questo layer (a differenza dei portali CKAN di Torino/Milano, che espongono `metadata_modified`). Le 155 zone sono stabili dal 1992 (secessione di Fiumicino) — usata questa come `sourceUpdatedAt`, dichiarato esplicitamente come limite in §8. |
| Suddivisione | Zone urbanistiche (livello sub-municipio, sovra-quartiere storico) |
| Numero geometrie | **155**, tutte `MultiPolygon` |
| Attributi | `ZONA_URBANISTICA` (codice alfanumerico stabile, es. "10a" — verificato univoco su tutte le 155) — `DENOMINAZIONE` (nome ufficiale, preso verbatim) |

Nominatim/OSM non usato né per bulk import né come fallback (fonte ufficiale sufficiente); usato solo per 8 lookup singoli di verifica punti di test.

## 3. Architettura — riuso confermato su una terza città diversa

**Nessuna modifica a `engine.ts`, `types.ts`, `registry.ts` (solo +1 riga) o al CLI.** Unico file nuovo specifico di Roma:

| File | Ruolo |
|---|---|
| `backend/src/lib/submunicipal/sources/roma-zone-urbanistiche.ts` | Implementa `SubMunicipalSource`: URL WFS, download GeoJSON, riproiezione EPSG:6708→WGS84, mapping `ZONA_URBANISTICA`/`DENOMINAZIONE` |

**Un miglioramento generico al motore condiviso, non specifico di Roma**: Roma è la prima fonte sub-comunale (dopo Torino/Milano) i cui dati **non sono già in WGS84**. Anziché duplicare la logica di riproiezione già scritta per l'importer ISTAT comuni (Step 4.0, UTM32N), è stata estratta in `backend/src/lib/geo.ts` una funzione condivisa:

```ts
export function reprojectGeometry(
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown },
  fromProj4: string
): ZoneGeometry
```

Usata da `roma-zone-urbanistiche.ts` con i parametri RDN2008/UTM33N (`+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs`, verificati contro epsg.io per EPSG:6708). L'importer ISTAT comuni (Step 4.0) **non è stato toccato** — continua a usare la propria implementazione locale con i parametri UTM32N: nessun refactor globale, solo una funzione riutilizzabile disponibile per la prossima fonte che ne avrà bisogno.

**Comando esatto di import:**

```bash
cd backend
npm run import:istat                                                  # se non già fatto — crea/adotta City Roma con istatCode
npm run import:submunicipal -- --source=comune-roma-zone-urbanistiche # importa le 155 zone urbanistiche
npm run import:submunicipal -- --list                                 # ora elenca Torino, Milano e Roma
```

### Metadata di provenienza (nessuna modifica di schema, terza volta)

```json
{
  "id": "zone_058091_comune-roma-zone-urbanistiche_10a",
  "source": "comune-roma-zone-urbanistiche",
  "sourceId": "10a",
  "sourceType": "zona_urbanistica",
  "sourceUpdatedAt": "1992-01-01T00:00:00.000Z",
  "cityIstatCode": "058091"
}
```

`sourceId` alfanumerico (`"10a"`, non solo numerico come `ID_QUART`/`ID_NIL`) — verificato che l'engine e lo schema (`sourceId String?`) lo trattano senza problemi, nessuna assunzione "solo numerico" esisteva nel codice Step 4.1/4.2.

### Sostituzione zone demo e migrazione

Stessa logica invariata: l'engine ha trovato le 12 vecchie zone `type="district"` di Roma (`type !== "zona_urbanistica"`), le ha migrate (per-overlap geometrico verso la nuova zona con maggiore intersezione) e cancellate. `City.boundaryJson` di Roma (confine ISTAT, Step 4.0) non toccato.

## 4. Risultato dell'import (eseguito realmente, DB MariaDB locale)

```
[submunicipal] import summary
  source:          comune-roma-zone-urbanistiche
  city:            Roma (istatCode=058091)
  features parsed: 155
  zones created:   155
  zones updated:   0
  zones retired:   12
  invalid geometry: 0
```

Le 12 zone retired sono `zone_rm_001`…`zone_rm_012` (`type="district"`). Verificato dopo l'import: **0 zone `type="district"` rimaste per Roma**.

## 5. Idempotenza (eseguita 3 volte)

| Run | created | updated | retired |
|---|---|---|---|
| 1° | 155 | 0 | 12 |
| 2° (cache locale) | 0 | 155 | 0 |
| 3° | 0 | 155 | 0 |

Verifica diretta su DB dopo la 3ª esecuzione: **155 zone totali**, tutte `type="zona_urbanistica"`, **0 id duplicati**, **0 `sourceId` duplicati**, metadata di provenienza stabili tra le esecuzioni.

## 6. Coverage / gap / overlap (calcolati con `@turf/turf`, dati reali da DB)

Roma ha un territorio comunale di gran lunga più esteso di Torino/Milano (~1.285 km² contro 129/181 km²) — verificato che la suddivisione scelta copra adeguatamente anche le aree esterne al centro, non solo il centro storico:

| Metrica | Valore |
|---|---|
| Area confine comunale (`City.boundaryJson`, ISTAT 2026) | 1.285,16 km² |
| Area unione delle 155 zone urbanistiche (`turf.union`) | 1.283,56 km² |
| Overlap significativo (soglia 50 m²) | **0 coppie** su **11.935 combinazioni testate** |
| Gap: territorio comunale non coperto | 8,391 km² (**0,65%**) |
| Territorio zone urbanistiche fuori dal confine comunale | 6,789 km² (**0,53%**) |
| Tipi geometria | **155 `MultiPolygon`, 0 `Polygon`** — la prima fonte dove MultiPolygon è la norma anziché l'eccezione (Torino: 2/23, Milano: 0/88) |

**Interpretazione**: gap e outside sono gli **scarti percentuali più bassi delle tre città** (0,65%/0,53% contro il 2,86%/1,02% di Torino e l'1,32%/1,64% di Milano) — coerente col fatto che entrambi i dataset (confine comunale e zone urbanistiche) sono mantenuti dallo stesso ente (Roma Capitale), quindi più internamente coerenti rispetto a datasetti di fonti/anni diversi come nei casi precedenti. 0 overlap su quasi 12.000 combinazioni conferma nessuna doppia assegnazione anche su un dataset 6-7 volte più grande dei precedenti.

## 7. Test sui punti noti (eseguiti realmente contro DB/API)

Coordinate da lookup singoli Nominatim (non bulk, solo QA):

| Punto | Coordinate | Zona trovata | Esito |
|---|---|---|---|
| Centro Storico (Pantheon) | 41.89862, 12.47683 | Centro Storico | OK |
| Trastevere | 41.88956, 12.47051 | Trastevere | OK |
| EUR | 41.83361, 12.47088 | Eur | OK |
| Ostia | 41.73260, 12.27846 | Ostia Nord | OK — Ostia è divisa in 3 zone ufficiali (Nord/Sud/Antica), il punto scelto (Lido di Ostia centrale) ricade correttamente in quella Nord |
| Parioli | 41.92368, 12.49099 | Parioli | OK |
| Periferia Est (Torre Angela) | 41.86432, 12.62574 | Torre Angela | OK |
| Periferia Nord (Prima Porta) | 42.00197, 12.48597 | Labaro | OK — Prima Porta e Labaro sono aree contigue nell'estremo nord; la zona urbanistica ufficiale che copre quel punto è "Labaro" |

Ogni punto è risultato dentro **esattamente una** zona.

**Test API reali** (server locale, `npm run dev`):

- `GET /api/zones?bbox=12.44,41.87,12.52,41.92` (centro/Trastevere) → 36 zone reali, tutte `type: "zona_urbanistica"`, geometria `MultiPolygon`.
- `GET /api/zones/zone_058091_comune-roma-zone-urbanistiche_1a/safety-summary` → "Centro Storico", `level: "unknown"`, `safetyScore: null` — nessun dato inventato.
- `GET /api/zones?bbox=12.24,41.70,12.32,41.77` (area Ostia, periferia estrema SW) → 5 zone reali restituite (Ostia Nord/Sud/Antica, Castel Fusano, Fiumicino) — conferma che il bbox funziona correttamente anche lontano dal centro, su un comune molto esteso.

## 8. Regressione Torino + Milano (eseguita realmente dopo l'import Roma)

L'import Roma opera solo su `cityId=city_rm` (associazione tramite `cityIstatCode`, mai per nome/posizione). Verificato end-to-end dopo l'import:

- **Torino**: 23 zone, tutte ancora `type="quartiere"`; 6/6 punti di test (Piazza Castello, San Salvario, Lingotto, Barriera di Milano, Vanchiglia, Crocetta) ancora corretti; API bbox (10 zone) invariata.
- **Milano**: 88 zone, tutte ancora `type="nil"`; 3/3 punti campione (Duomo, Isola, Bicocca) ancora corretti; API bbox (27 zone) invariata.
- **Roma**: bbox, detail, safety-summary tutti funzionanti (§7).

**0 regressioni** su tutte e tre le città.

## 9. Compatibilità con il resto del sistema

- **Routing safety / DashboardPage danger-alert / rendering mappa**: generici su Polygon/MultiPolygon (Step 4.0), nessun filtro su `Zone.type` — Roma (100% MultiPolygon) è il test di stress più severo finora per questo percorso di codice, e nessuna modifica è stata necessaria.
- **Feedback / report / bbox / tracking**: invariati.
- **TypeScript**: `npm run typecheck` (backend) e `npm run type-check` (frontend) → **0 errori**.

## 10. Problemi aperti

1. **Roma torna grigia ("unknown") sulla mappa** finché non arriva feedback/reportistica reale sulle 155 zone urbanistiche — stessa scelta e motivazione di Torino/Milano: nessun punteggio di sicurezza inventato.
2. **Nessuna data di aggiornamento machine-readable per il dataset**: a differenza di Torino/Milano (portali CKAN con `metadata_modified`), il geoportale di Roma non espone una data di revisione per questo layer WFS. Usata la data di stabilizzazione storica nota (1992) come `sourceUpdatedAt`, dichiarato esplicitamente qui invece di inventare una data più precisa.
3. **Nessuna licenza formale pubblicata** (solo una dichiarazione di riuso libero con attribuzione sulla pagina istituzionale) — sufficiente per procedere (fonte ufficiale, riuso esplicitamente consentito), ma meno solido legalmente della licenza CC-BY esplicita di Torino/Milano. Da rivedere se Roma Capitale pubblicherà in futuro un'etichetta di licenza formale.
4. **La "nuova mappa" (327 quartieri/22 rioni/104 zone funzionali) non è ancora utilizzabile**: nessun layer geografico pubblicato ad oggi (verificato via WFS `GetCapabilities`). Roma userà "zone urbanistiche" finché quella mappa non sarà effettivamente pubblicata come dataset scaricabile — non è un limite dell'importer, è un limite della fonte stessa.
5. **`ZONA_URBANISTICA` alfanumerico**: nessun problema riscontrato, ma è il primo `sourceId` non puramente numerico tra le fonti registrate — utile precedente per fonti future con id non numerici.
6. **Migrazione feedback/report non esercitata con dati reali**: come per Torino/Milano, il DB di sviluppo non aveva feedback/report reali sulle vecchie zone `district` di Roma.

## 11. Proposta concreta per Step 4.4 (nazionale)

Con tre città reali (Torino/quartieri, Milano/NIL, Roma/zone urbanistiche) l'architettura ha ora dimostrato di reggere: shapefile UTM-con-prj-fuorviante, GeoJSON già-WGS84, e WFS-con-riproiezione-esplicita; Polygon puro, misto, e MultiPolygon puro; `sourceId` numerico e alfanumerico. Per lo Step 4.4 propongo:

1. **Non ancora "tutta Italia" sub-comunale**: la maggior parte dei ~7.891 comuni rimanenti (Step 4.0) non ha una fonte sub-comunale ufficiale paragonabile — resta corretto che restino a zona `type="comune"` singola (Step 4.0), nessun cambiamento lì.
2. **Estendere a 3-5 altre città grandi con fonte verificabile** (es. Napoli, Torino ✓, Milano ✓, Roma ✓, Bologna, Firenze, Genova, Palermo) seguendo lo stesso processo Step 4.1–4.3: ricerca fonte → confronto granularità → 1 file `sources/<città>.ts` → registrazione. Nessuna nuova infrastruttura prevista, salvo un'eventuale funzione di riproiezione aggiuntiva se una città usa un CRS non ancora coperto da `reprojectGeometry`.
3. **Automatizzare la scoperta "quali comuni hanno già un `type='comune'` baseline ma potrebbero avere una fonte sub-comunale migliore"**: oggi è una ricerca manuale per città; si potrebbe tenere un elenco dichiarativo di "candidati noti" (nome, popolazione, presenza di un portale open data comunale) per prioritizzare — nessun codice nuovo necessario finché il numero di città resta piccolo (nell'ordine delle decine, non centinaia).
4. **Monitorare la "nuova mappa" di Roma** (327 quartieri): quando Roma Capitale pubblicherà una geometria scaricabile, valutare una migrazione da `comune-roma-zone-urbanistiche` a una nuova fonte più granulare con lo stesso pattern di sostituzione già usato per rimpiazzare le zone demo — nessuna modifica al motore richiesta anche in quel caso.
