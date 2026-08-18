# Step 5.0 — Safety Score nazionale basato su dati reali

## Obiettivo raggiunto

Le zone SafeRoute non partono più tutte bianche. Un **baseline statistico ufficiale** (crimine denunciato ISTAT, normalizzato per popolazione, pesato per categoria) viene combinato con i segnali live di SafeRoute (feedback, segnalazioni) tramite uno shrinkage bayesiano che dà sempre priorità al baseline finché non ci sono abbastanza osservazioni reali. Testato su un pilot reale di 8 comuni (Torino, Milano, Roma, Bologna, Napoli, Genova, La Loggia, Atrani): **293 zone attivate con punteggio reale**, zero punteggi inventati, zero differenze artificiali tra quartieri della stessa città.

## 1. Fonti trovate

| Fonte | Usata? | Perché |
|---|---|---|
| **ISTAT — "Delitti denunciati dalle forze di polizia all'autorità giudiziaria"** (dataset `73_67` / codice storico `DCCV_DELITTIPS`, indicatore `CRIMET`) | ✅ **sì, fonte primaria** | Unica fonte istituzionale con serie storica annuale (dal 2004), granularità provinciale + comunale per i 12 comuni maggiori, ~90 categorie di reato, licenza aperta, accessibile via API SDMX. Dati originati dal sistema SDI del Ministero dell'Interno (soddisfa anche la priorità 2 del goal). |
| ISTAT — "Popolazione residente" (per normalizzazione) | ⚠️ non scaricata separatamente | **Non necessaria**: l'indicatore `CRIMET` di ISTAT è già "delitti per 100.000 abitanti", calcolato e pubblicato direttamente da ISTAT. Normalizzare di nuovo per popolazione sarebbe stato ridondante — vedi §3. |
| Ministero dell'Interno — Cruscotto Statistico | ❌ scartata | Portale interattivo JS-based, nessuna API pubblica documentata per l'estrazione bulk; i suoi dati confluiscono comunque nel dataset ISTAT sopra (stessa fonte primaria, SDI). |
| Open data regionali/comunali su criminalità | ❌ nessuna trovata con copertura nazionale comparabile | Nessun dataset comunale/regionale ufficiale con serie storica e categorizzazione comparabile a quello ISTAT è stato trovato per i comuni del pilot. |
| Classifiche giornalistiche (Il Sole 24 Ore "Indice della criminalità", ecc.) | ❌ esplicitamente esclusa | Vietato dal goal come fonte primaria — usano comunque dati ISTAT/Interno come input, quindi usare direttamente la fonte ISTAT è più tracciabile. |

### Dettagli tecnici della fonte usata

- **Endpoint**: `https://esploradati.istat.it/SDMXWS/rest/data/IT1,<flowId>,1.0/<key>` (SDMX 2.1 REST, formato CSV). Il vecchio portale `dati.istat.it` è dismesso (redirect a un avviso statico) — verificato durante la ricerca.
- **Flow usati**: `73_67_DF_DCCV_DELITTIPS_9` ("Tasso di delittuosità - prov", 100 province via codici NUTS3 `IT[A-Z]\d\d`) e `73_67_DF_DCCV_DELITTIPS_8` ("Tasso di delittuosità - grandi comuni", 12 comuni: Torino, Genova, Milano, Trieste, Venezia, Bologna, Firenze, Roma, Napoli, Bari, Palermo, Cagliari — elenco reale estratto da una query live, non inventato).
- **Indicatore**: `CRIMET` = delitti denunciati per 100.000 abitanti (già normalizzato da ISTAT). Confrontato con `CRIMEN` (conteggio grezzo) per verifica di coerenza.
- **Anni disponibili**: serie annuale continua; usati 2022-2024 (ultimi 3 anni completi al momento della ricerca, 2026-08-17).
- **Categorie**: codelist `CL_REATI_PS`, ~90 codici (omicidi, rapine, furti per sottotipo, danneggiamenti, reati contro la PA, ecc.) — vedi §4 per il sottoinsieme usato.
- **Licenza**: dati ISTAT, riuso libero con attribuzione (policy standard ISTAT).
- **Rate limit**: 5 query/minuto per IP (documentato da ISTAT) — rispettato con pause tra le chiamate durante la ricerca.
- **Aggiornabilità**: query ripetibili, cache locale su disco (vedi §7).

## 2. Granularità effettiva

| Livello | Copertura | Comuni pilot coperti |
|---|---|---|
| **Comune** (`73_67_DF_DCCV_DELITTIPS_8`) | Solo 12 grandi comuni — un elenco fisso ISTAT, non estendibile | Torino, Milano, Roma, Bologna, Napoli, Genova (**tutti e 6** i comuni "grandi" del pilot) |
| **Provincia** (`73_67_DF_DCCV_DELITTIPS_9`) | 100/107 province (NUTS3) | La Loggia → provincia di Torino; Atrani → provincia di Salerno |
| **Sub-comunale (quartiere)** | ❌ non esiste in nessuna fonte ufficiale trovata | — |

**Nessun dato è mai sub-comunale.** Questo è il vincolo fondamentale del goal ("non assumere che un dato provinciale/comunale descriva un singolo quartiere") applicato correttamente: **tutte** le zone di una stessa città ricevono lo **stesso** `baselineSafetyScore` — verificato con query diretta sul DB (23 quartieri di Torino → un solo valore distinto di `baselineSafetyScore`, idem per Milano/88, Roma/155, ecc.). Le uniche differenze possibili tra quartieri della stessa città vengono, come richiesto, solo da feedback/report/SOS reali via `liveSafetyScore`.

3 province (Sud Sardegna e affini, codici `IT108/109/110`) usano uno schema di codifica diverso da quello NUTS3 standard nel codelist ISTAT usato — non risolte in questo step, comuni di quelle province resterebbero senza baseline finché non si aggiunge quella mappatura (vedi §9).

## 3. Perché non serve un dataset di popolazione separato

L'indicatore `CRIMET` di ISTAT è già "delitti per 100.000 abitanti" — la normalizzazione per popolazione è fatta a monte da ISTAT stesso, con gli stessi identificatori territoriali (NUTS3 per provincia, codice ISTAT a 6 cifre per comune) già usati nel resto di SafeRoute (`City.istatCode`). Scaricare popolazione comunale/provinciale separatamente e ricalcolare il tasso avrebbe introdotto una fonte in più senza guadagno (stesso risultato, doppio rischio di disallineamento).

## 4. Categorie di reato e pesi

Sottoinsieme curato di `CL_REATI_PS` (12 categorie su ~90), **solo categorie di primo livello** (mai un sottotipo insieme al suo genitore — es. `ROBBER` sì, `STREETROB`/`BANKROB` no — per non contare due volte lo stesso reato). Configurazione in `backend/src/lib/safety/crime-categories.ts`:

| Livello | Peso | Categorie (codice ISTAT → italiano) |
|---|---|---|
| **Alto** | 3.0 | `INTENHOM` omicidi volontari, `ATTEMPHOM` tentati omicidi, `RAPE` violenze sessuali, `ROBBER` rapine, `KIDNAPP` sequestri di persona, `EXTORT` estorsioni |
| **Medio** | 1.5 | `THEFT` furti, `CULPINJU` lesioni dolose, `STALK` stalking, `MENACE` minacce |
| **Basso** | 1.0 | `DAMAGE` danneggiamenti, `ARSON` incendi |

**Categorie deliberatamente escluse** (documentate nel codice, non solo qui):
- `DRUG` (stupefacenti): riflette l'intensità dei controlli di polizia più che il rischio reale per un pedone — confondimento noto in criminologia.
- Reati contro la Pubblica Amministrazione (corruzione, peculato, ~20 codici `CP3xx`), `CYBERCRIM`, `COUNTER`, `MONEYLAU`, `USURY`: reati economico-amministrativi, non pertinenti alla sicurezza pedonale.
- `MASSMURD`/`MAFIAHOM`/`TERRORHOM`: valori quasi-zero ovunque a questa granularità — rumore, non segnale.
- **Etnia, nazionalità, presenza straniera o religione**: mai usate come proxy, né disponibili nell'indicatore `CRIMET` usato (che non ha quella dimensione).

`TOT` (totale complessivo) viene comunque scaricato e salvato come controllo di coerenza in `CrimeBaseline.rawCategoryRates`, ma **non entra nel calcolo pesato** — includerlo avrebbe fatto ricontare reati già pesati sopra più reati esclusi (droga, PA, ecc.) con peso implicito 1, contraddicendo la richiesta esplicita di pesare diversamente.

## 5. Formula completa

```
1. Per ogni territorio T (provincia o "grande comune") e ogni categoria C:
   smoothedRate[T,C] = media(CRIMET[T,C,2022], CRIMET[T,C,2023], CRIMET[T,C,2024])
   // smoothing su 3 anni — riduce il rumore di un singolo anno anomalo

2. weightedRate[T] = Σ_C ( peso[C] × smoothedRate[T,C] )   // §4, solo le 12 categorie curate

3. percentileNational[T] = rank(weightedRate[T]) / (N-1) × 100
   // calcolato SEPARATAMENTE tra province (N=100) e tra grandi comuni (N=12) —
   // mai mischiati, perché non sono sulla stessa scala (il centro urbano concentra
   // più reati della provincia che lo contiene: confrontarli direttamente farebbe
   // sembrare una piccola provincia più sicura di una grande città solo per
   // effetto del livello di aggregazione, non per rischio reale)
   // 0 = tasso più basso nel gruppo, 100 = tasso più alto

4. baselineSafetyScore[T] = round(100 - percentileNational[T])
   // 100 = più sicuro (rischio percentile 0), 0 = più rischioso (percentile 100)

5. liveSafetyScore (invariato dallo score.service.ts pre-Step-5.0):
   se (feedback 30gg + segnalazioni approvate 30gg) < 3 → null
   altrimenti: rating medio normalizzato 0-100, meno penalità segnalazioni (max -25)

6. combineFinalScore(baseline, live, n_osservazioni):
   liveWeight = n_osservazioni / (n_osservazioni + K)     // K = 8, vedi sotto
   finalSafetyScore = round(baseline × (1-liveWeight) + live × liveWeight)
   scoreConfidence = liveWeight
   // se live è null (< 3 osservazioni) → finalSafetyScore = baseline, confidence = 0
   // se baseline è null (territorio non ancora coperto) → finalSafetyScore = live
```

### Perché percentile rank e non z-score/min-max

Scelto come "normalizzazione robusta" richiesta dal goal perché:
- è già delimitato 0-100 per costruzione (nessun clamp aggiuntivo necessario);
- immune a un singolo outlier estremo (a differenza di min-max, che un solo valore anomalo può schiacciare);
- non assume una distribuzione normale (a differenza dello z-score) — i tassi di criminalità sono tipicamente asimmetrici (molte province con tassi bassi, poche metropoli con tassi molto alti), esattamente il caso osservato nei dati reali (§8).

### Perché shrinkage bayesiano con K=8

`K` è il numero di osservazioni live alle quali baseline e live pesano uguale. È una **costante scelta e documentata**, non stimata sui dati (il goal chiede "la soluzione più semplice ma statisticamente difendibile", non un fitting complesso su un campione di 0 feedback reali oggi). Verificato con test diretto (`combineFinalScore`, baseline=27):

| n osservazioni live | finalScore (live=10) | confidence |
|---|---|---|
| 0 | 27 (= baseline puro) | 0% |
| 1 | 25 | 11% |
| 3 | 22 | 27% |
| 8 (=K) | 19 | 50% |
| 20 | 15 | 71% |
| 50 | 12 | 86% (si avvicina asintoticamente a live, non lo raggiunge mai) |

**Verifica diretta del requisito "una zona con 1 report non deve diventare improvvisamente rossa"**: inserito 1 feedback reale (rating=1, il più negativo possibile) su una zona di Torino (baseline=27, già "rosso"); poiché `computeLiveSafetyScore` richiede **almeno 3** osservazioni prima di produrre un punteggio (soglia invariata dalla versione pre-Step-5.0), il risultato con 1 sola osservazione resta `liveScore=null` → `finalSafetyScore` rimane **esattamente 27**, il punteggio non si è mosso di un solo punto. Il meccanismo a due soglie (minimo 3 osservazioni + shrinkage progressivo oltre K=8) rende impossibile un salto improvviso di livello da un singolo segnale.

## 6. Provenienza — schema Prisma

Aggiunto a `Zone` (`backend/prisma/schema.prisma`, applicato con `prisma db push`, nessuna migrazione distruttiva — `safetyScore` non aveva mai valori non-null in nessuna zona esistente prima di questo step):

| Campo | Tipo | Significato |
|---|---|---|
| `baselineSafetyScore` | `Float?` | Punteggio statistico puro (passo 4 sopra) |
| `liveSafetyScore` | `Float?` | Punteggio da feedback/report SafeRoute (passo 5) |
| `finalSafetyScore` | `Float?` | **Il punteggio che tutto il resto deve usare** (passo 6) — rinomina di `safetyScore`, letto da routing/colore/API |
| `scoreConfidence` | `Float?` | 0 (baseline puro) → 1 (dominato da segnali live) |
| `scoreSource` | `String?` | Es. `istat-crime-comune-2024` o `istat-crime-provincia-2024+live(n=12)` |
| `scoreReferenceYear` | `Int?` | Anno più recente dei dati ISTAT usati |
| `scoreUpdatedAt` | `DateTime?` | Diverso da `updatedAt` (che cambia per QUALSIASI modifica alla zona) |

Nuova tabella `CrimeBaseline` (`crime_baselines`): una riga per `(territoryType, territoryCode, referenceYear)`, versionata per anno (mai sovrascritta — un futuro import con dati 2025 crea una nuova riga, non cancella il 2024), con `rawCategoryRates` (i tassi grezzi per categoria, per debug/ri-derivazione senza richiamare ISTAT) e `weightedRatePer100k`/`percentileNational`/`baselineScore` già calcolati.

## 7. Importer — pipeline riutilizzabile

```
backend/src/lib/safety/
├── crime-categories.ts      — pesi per categoria (documentati, configurabili)
├── istat-crime-source.ts    — legge la cache CSV su disco, calcola tasso pesato+smussato
├── baseline-calculator.ts   — percentile nazionale → baselineScore 0-100
└── territory-resolver.ts    — City → comune (12 grandi comuni) o provincia (sigla → NUTS3)

backend/scripts/
└── import-crime-baseline.ts — CLI: calcola su TUTTI i territori disponibili (per un
                                percentile nazionale corretto), scrive solo sui comuni richiesti
```

**Nessuna chiamata di rete a runtime**: l'app legge solo dal DB. I CSV ISTAT sono cache locali in `backend/data/istat-crime-*-national-raw.csv` (gitignored, come tutta `backend/data/`, coerente con Step 4.0/4.4).

**Comandi**:
```bash
cd backend

npm run safety:baseline -- --pilot                     # 8 comuni del pilot Step 5.0
npm run safety:baseline -- --city=<istatCode>
npm run safety:baseline -- --cities=<istat1,istat2,...>
npm run safety:baseline -- --pilot --validate-only      # calcola e stampa, non scrive
```

**Refresh dei dati grezzi** (quando ISTAT pubblica un nuovo anno — nessuno script automatico per rispettare il rate limit 5/min):
```bash
CATS="TOT+INTENHOM+ATTEMPHOM+RAPE+ROBBER+KIDNAPP+EXTORT+THEFT+CULPINJU+STALK+MENACE+DAMAGE+ARSON"
curl "https://esploradati.istat.it/SDMXWS/rest/data/IT1,73_67_DF_DCCV_DELITTIPS_9,1.0/A..CRIMET.$CATS.9.YRDUR?startPeriod=<anno-2>&endPeriod=<anno>" \
  -H "Accept: application/vnd.sdmx.data+csv;version=1.0.0" -o backend/data/istat-crime-province-national-raw.csv
# stessa query su 73_67_DF_DCCV_DELITTIPS_8 per i grandi comuni -> istat-crime-comuni-national-raw.csv
```
Poi aggiornare `SMOOTHING_YEARS` in `istat-crime-source.ts` e rilanciare `npm run safety:baseline`.

**Idempotenza verificata**: `--pilot` eseguito 3 volte consecutive → stessi 8 `CrimeBaseline` (nessun duplicato, vincolo unique su territoryType+territoryCode+referenceYear), stessi punteggi, **8.201 zone totali invariate** prima/dopo, nessun feedback/report toccato (0/0 in entrambi i casi).

## 8. Risultati pilot (dati reali, 2026-08-17)

| Città | Fonte | Tasso pesato composito | Percentile rischio | baselineSafetyScore | Zone attivate | Colore |
|---|---|---|---|---|---|---|
| Torino | comune (001272) | 8994.63 | 72.73 | 27 | 23 | 🔴 rosso |
| Milano | comune (015146) | 11938.57 | 100.00 | 0 | 88 | 🟣 viola |
| Roma | comune (058091) | 8091.45 | 54.55 | 45 | 155 | 🔴 rosso |
| Bologna | comune (037006) | 8617.78 | 63.64 | 36 | 6 | 🔴 rosso |
| Napoli | comune (063049) | 6312.02 | 27.27 | 73 | 10 | 🟡 giallo |
| Genova | comune (010025) | 4873.13 | 9.09 | 91 | 9 | 🟢 verde |
| La Loggia | provincia Torino (ITC11) | 5391.32 | 95.96 | 4 | 1 | 🟣 viola |
| Atrani | provincia Salerno (ITF35) | 2771.75 | 55.56 | 44 | 1 | 🔴 rosso |

Dato grezzo di esempio (Torino, media 2022-2024, rate/100k): `THEFT=4074.6, DAMAGE=1676.03, ROBBER=177.43, MENACE=137.53, CULPINJU=182.8, EXTORT=34.6, RAPE=23.1, KIDNAPP=2.83, ATTEMPHOM=2.9, INTENHOM=0.4, ARSON=2.4`.

**Verifica di plausibilità (senza modifiche manuali, come richiesto dal goal)**:
- Milano baseline=0 (peggiore assoluto tra i 12 grandi comuni): trainato da `THEFT=6213/100k`, coerente con la reputazione nota di Milano per furti/borseggi (alta densità turistica/commerciale, metropolitana estesa). Non è stato aggiustato.
- Napoli baseline=73 (giallo, più sicura di Torino/Bologna/Roma in questo indicatore): risultato che contraddice lo stereotipo comune, ma è il dato ISTAT reale — non modificato. Vedi §9 per il limite di interpretazione (denunce ≠ criminalità reale).
- La provincia di Torino risulta tra le più rischiose a livello nazionale (percentile 95.96): coerente con il pattern noto nei dati ISTAT "denunciati" di concentrazione nel Nord urbanizzato/industriale.

Tutti i valori sono stati letti direttamente dall'output del CLI e dal DB, non calcolati a mano né corretti dopo la prima esecuzione.

## 9. Cosa NON è possibile determinare dai dati disponibili

1. **Differenze tra quartieri della stessa città**: nessuna fonte ufficiale trovata scende sotto il livello comunale. Ogni differenza tra quartieri di Torino/Milano/Roma/ecc. può venire **solo** da feedback/report/SOS reali (`liveSafetyScore`), mai dal baseline — verificato: tutti i quartieri di una città condividono lo stesso `baselineSafetyScore`.
2. **Criminalità reale vs. criminalità denunciata**: `CRIMET` conta i delitti *denunciati*. Il tasso di denuncia varia per territorio, tipo di reato e fattori culturali/sociali — un limite noto e ampiamente documentato nella letteratura criminologica italiana, non correggibile con i dati disponibili. Il risultato di Napoli (§8) va letto con questo limite in mente.
3. **Causalità**: un tasso alto non distingue tra "più reati commessi" e "più efficacia nel far emergere/registrare i reati" (pattugliamento intenso, alta fiducia nelle forze dell'ordine, ecc.).
4. **Province con codifica non risolta**: ~3 province (area sarda, codici `IT108/109/110`) non hanno una corrispondenza nel codelist NUTS3 usato — i loro comuni restano senza baseline finché non si aggiunge quella mappatura.
5. **Percentile del livello "comune"**: calcolato su soli 12 territori (l'elenco fisso ISTAT dei "grandi comuni") — grezzo per costruzione (~8 punti percentuali per gradino), ma è l'intera popolazione disponibile a quel livello, non un campione ridotto artificialmente.
6. **Fattori non di criminalità**: illuminazione pubblica, presenza di trasporto notturno, densità pedonale — menzionati nella vision del prodotto (`docs/prd/PRD-SafeRoute.md`) ma non coperti da questo step, che si limita al segnale di criminalità denunciata.

## 10. Compatibilità SafeRoute — verificato

- **Feedback/reports**: 0 righe in DB prima e dopo (ambiente di sviluppo) — nessuna perdita; logica di combinazione testata con un inserimento reale (rating=1) + pulizia, comportamento shrinkage confermato (§5).
- **Routing**: `frontend/src/composables/useRouting.ts` (`zoneScore()`) ora legge `finalSafetyScore`, non più `safetyScore` grezzo — verificato via typecheck e lettura codice.
- **bbox**: nessuna query aggiuntiva introdotta; stesse colonne indicizzate di Step 4.0/4.4.
- **Polygon/MultiPolygon**: nessuna modifica alla geometria — il rendering (`toLeafletLatLngs`) e il point-in-polygon (`pointInGeometry`) restano quelli di Step 3.3/4.4, non toccati da questo step.
- **TypeScript**: `npm run typecheck` — **0 errori** backend e frontend, verificato più volte durante lo sviluppo.
- **UI reale** (Playwright headless contro `npm run dev` di frontend+backend, sessione DEV mock): mappa di Milano ora renderizza le 88 zone NIL in viola reale (`#8B5CF6`, non più `#CBD5E1` grigio); pannello di dettaglio zona mostra punteggio "0/100" e badge "Molto pericoloso" invece del placeholder "Sii il primo!" per punteggio nullo. **Bug reale trovato e corretto durante questo step**: `isServiceActive` restava `false` anche con un baseline reale scritto (policy ereditata da Step 4.0/4.4 "nessun punteggio inventato" — corretta, ma non più necessaria una volta che il punteggio è reale), il che teneva le zone grigie nonostante il punteggio fosse popolato — corretto attivando `isServiceActive: true` alla prima scrittura di un baseline reale.
- **Testo disclaimer**: trovato e corretto un secondo bug reale — il pannello zona dichiarava sempre "i dati si basano sui feedback della community", falso per una zona con `scoreConfidence=0` (100% baseline ISTAT, zero feedback). Ora il testo dipende da `scoreConfidence` (`frontend/src/components/map/ZoneDetailsPanel.vue`).

## 11. Strategia di aggiornamento

- **Dati ISTAT**: annuale (ISTAT pubblica `CRIMET` con cadenza annuale). Refresh: ri-eseguire le query SDMX documentate in §7 (rispettando il rate limit), poi `npm run safety:baseline`. Idempotente per design — una nuova riga `CrimeBaseline` per anno, mai sovrascritta.
- **Segnali live**: già automatici — `recalculateZoneScore()` (`score.service.ts`) gira ad ogni nuovo feedback/segnalazione approvata, combinando col baseline più recente già in DB.
- **isServiceActive**: nessun meccanismo per distinguere "mai attivata" da "disattivata manualmente da un admin" (nessuna azione admin di questo tipo mai eseguita finora) — limite noto, da risolvere con un campo dedicato se/quando servirà davvero (vedi §9 di `docs/step-4-5-controlled-national-rollout.md` per lo stesso pattern di "non risolvere prematuramente senza un caso reale").

## 12. Proposta Step 5.1

- Estendere il baseline a tutti i comuni con fonte sub-comunale reale già importata (Step 4.4/4.5 OSM-validated: Firenze, Palermo, Trento e le prossime città `--pending`) — già coperti da comune o provincia in questo step's infrastruttura, basta lanciare `npm run safety:baseline -- --cities=...`.
- Import dell'elenco ufficiale ISTAT "Comuni capoluogo" (con flag capoluogo provincia/regione) per sbloccare `--capoluoghi-provincia`/`--capoluoghi-regione` sia per `zones:national` (Step 4.5 §7) sia per `safety:baseline`, senza inventare liste.
- Risolvere la mappatura mancante per le ~3 province con codice non-NUTS3 (area sarda).
- Valutare se esporre `scoreConfidence`/`scoreSource` anche in un pannello admin dedicato (oggi solo `finalSafetyScore` è mostrato in `AdminDashboardPage.vue`).
- Rollout nazionale controllato del baseline (tutti i ~7.900 comuni), riusando `territory-resolver.ts` così com'è — richiede solo eseguire l'importer su liste più ampie, nessuna modifica architetturale.
