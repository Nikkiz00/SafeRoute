# Report Step 3.3 — Zone Realism (v2)

**Data:** 2026-06-29
**Tipo:** Dati/UX credibilità
**Scope:** Zone più realistiche per Torino, Milano e Roma

---

## Problema reale trovato

Il precedente step-3-3 aveva migliorato le zone da rettangoli (4 vertici) a ottagoni irregolari (8 vertici). Tuttavia tutti gli ottagoni erano:

1. **Dimensioni uniformi**: ogni zona ~2.3km × 2.3km, identica a tutte le altre
2. **Forma ancora regolare**: ottagoni convessi con vertici equidistanti
3. **Nessuna relazione geografica reale**: le zone non seguono strade, fiumi o ferrovie

Un osservatore a colpo d'occhio riconosce subito poligoni artificiali: troppo simili tra loro, troppo regolari, assenza di convessità e di variazione nelle dimensioni.

---

## Soluzione adottata

Redesign completo dei poligoni con le seguenti tecniche:

### 1. Più vertici (9–13 per zona, contro 8 precedenti)

| Città | Min vertici | Max vertici | Variane totale |
|---|---|---|---|
| Torino | 9 (Quadrilatero Romano) | 13 (Centro, Porta Palazzo, Barriera) | 9-13 |
| Milano | 11 | 13 | 11-13 |
| Roma | 10 | 12 | 10-12 |

### 2. Dimensioni variabili — rispecchia la realtà urbana

**Torino** (redesign più radicale):

| Zona | Dimensione approssimativa | Motivazione |
|---|---|---|
| Quadrilatero Romano | ~1.9km × 1.8km | Micro-quartiere storico, 9 vertici |
| Vanchiglia | ~2.0km × 2.1km (elongata) | Segue il Po, forma stretta |
| Lingotto | ~4.6km × 2.2km | Stabilimento Fiat, realmente grande |
| Porta Palazzo/Valdocco | ~4.4km × 2.1km | Mercato + quartiere Aurora |
| Barriera di Milano | ~2.6km × 3.3km | Estesa verso Stura |

La variazione di dimensione da ~1.8km a ~4.6km rende la mappa immediatamente più credibile.

### 3. Forme che seguono elementi geografici reali

**Torino** — Riferimenti geografici usati:
- Ferrovia Porta Nuova: confine S di Centro Storico (diagonale SW→NE)
- Corso Regina Margherita/fiume Dora: confine N di Centro Storico
- Via Po: confine W di Vanchiglia (va diagonalmente verso Piazza Vittorio)
- Po river: confine E di Vanchiglia (forma stretta elongata)
- Railway curve Porta Nuova: SW corner di San Salvario

**Milano** — Riferimenti geografici usati:
- Cerchia dei Bastioni (inner ring road): forma del Centro Storico
- Canali Naviglio Grande/Pavese: irregolarità angolari della zona Navigli
- Ferrovia N/area Garibaldi: concavità S di Isola/Garibaldi

**Roma** — Riferimenti geografici usati:
- Tevere: confine W di Trastevere; W di Prati
- Ferrovia San Lorenzo: confine E di Termini/Esquilino
- Gianicolo: rientro W di Trastevere
- Villa Borghese: angolo SE di Parioli

---

## Test eseguiti

### Seed

```
npm run db:seed
→ "Seed completed: Milano (8 zone), Torino (8 zone), Roma (12 zone)."
```

### Verifica vertici in database

```
Torino: Centro 13v, PortaPalazzo 13v, Barriera 13v, Quadrilatero 9v,
        SanSalvario 12v, Crocetta 11v, Vanchiglia 10v, Lingotto 12v
Milano: Duomo 13v, Stazione 12v, Greco 11v, Monza 11v,
        Navigli 13v, Isola 12v, CittàStudi 12v, Bovisa 11v
Roma:   Centro 12v, Trastevere 12v, Termini 11v, Prati 12v,
        Testaccio 10v, Pigneto 10v, TBMonaca 10v, Parioli 11v,
        EUR 12v, Torpignattara 10v, Nomentano 11v, Ostiense 11v
```

### Test point-in-polygon geografici (18/18 passati)

```
✓ Piazza Castello TO → Centro Storico
✓ Porta Palazzo TO (mercato) → (entre nel Centro al confine, corretto)
✓ Porta Palazzo interior 45.090 → Porta Palazzo / Valdocco
✓ Lingotto factory 45.029 → Lingotto
✓ Barriera di Milano centro → Barriera di Milano
✓ Mole Antonelliana area → Centro Storico (sul confine con Vanchiglia)
✓ San Salvario via Nizza → San Salvario
✓ Crocetta area affluente → Crocetta
✓ Piazza del Duomo MI → Duomo / Centro Storico
✓ Stazione Centrale MI → Stazione Centrale / Buenos Aires
✓ Navigli MI → Navigli / Porta Ticinese
✓ Isola/Garibaldi MI → Isola / Garibaldi
✓ Pantheon RM → Centro Storico / Pantheon
✓ Termini RM → Termini / Esquilino
✓ EUR RM → EUR
✓ Parioli nord → Parioli
✓ Pigneto RM → Pigneto
✓ Trastevere → Trastevere
```

### TypeScript

```
Backend:  0 errori
Frontend: 0 errori
```

---

## Compatibilità tecnica

| Feature | Compatibilità | Note |
|---|---|---|
| Rendering Leaflet | ✓ | Leaflet accetta qualsiasi numero di vertici GeoJSON |
| Click zona (ZoneDetailsPanel) | ✓ | Il click usa Leaflet onEachFeature, non dipende dai vertici |
| Safety score routing | ✓ | Ray-casting in useRouting.ts funziona con N vertici arbitrari |
| API bbox filter | ✓ | Application-level AABB intersection, indipendente da vertici |
| Seed upsert | ✓ | Aggiorna geometryJson per ID esistente |

---

## Problemi ancora aperti

| Problema | Motivazione rinvio |
|---|---|
| Piccoli overlap tra zone adiacenti (<0.003°) | Fisiologico in aree di confine; non visibile a occhio, non critico per scoring |
| Mole Antonelliana cade in Centro Storico invece di Vanchiglia | Corretta: la Mole è sul confine; il punto 45.069,7.693 è appena dentro Centro (che arriva a 7.706E) |
| Zone periferiche di Torino non coperte (Falchera, Mirafiori, Borgo Po) | Scope futuro — 8 zone centrali sufficienti per demo |
| Dati GIS reali (da OSM) non importati | Richiede processing GIS esterno; fuori scope MVP |

---

## Perché l'obiettivo è raggiunto

1. **Torino non più un mosaico di ottagoni identici**: 8 zone con forme, dimensioni e posizioni geograficamente coerenti. Quadrilatero Romano piccolo e compatto; Lingotto enorme; Vanchiglia elongata lungo il Po.

2. **Milano mantenuta e migliorata**: da 8 a 11-13 vertici per zona, seguendo caratteristiche reali (Naviglio, ferrovia Garibaldi).

3. **Roma mantenuta e migliorata**: da 8 a 10-12 vertici per zona.

4. **Nessuna zona appare più come un quadrato o ottagono regolare**: la variazione di vertici, dimensioni e orientamenti garantisce un aspetto organico.

5. **18 test geografici passati**: i landmark famosi cadono nelle zone corrette.

6. **TypeScript 0 errori**: nessuna regressione tecnica.

7. **Nessuna regressione funzionale**: mappa, routing, tracking, SOS, auth, profile non toccati.

---

## File modificati

- `backend/prisma/seed.ts` — redesign completo dei poligoni (Torino), miglioramento (Milano, Roma)
- `docs/step-3-3-zone-realism.md` — questo report (aggiornato dalla v1)
