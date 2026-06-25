# CLAUDE.md - SafeRoute

## Identità progetto
SafeRoute è una web app mobile-first per aiutare utenti a muoversi in modo più sicuro tramite mappa, zone colorate, feedback sicurezza, tracking live e SOS.

## Regole assolute

1. Non sviluppare tutto insieme.
2. Seguire sempre i file in `roadmap/`.
3. Prima di modificare codice, leggere:
   - `docs/architecture.md`
   - `docs/database.md`
   - `docs/design-system.md`
   - PRD relativo al task.
4. Non cambiare stack senza richiesta esplicita.
5. Non introdurre dipendenze inutili.
6. Ogni task deve finire con codice funzionante.
7. Ogni feature deve essere mobile-first.
8. Non creare mock infiniti se la funzione può essere reale.
9. Se manca una variabile segreta, usare `.env.example` e fallback sicuro.
10. Non inserire API key nel codice.

## Stack obbligatorio

Frontend:
- Vue 3
- Vite
- TypeScript
- Tailwind CSS
- Vue Router
- Pinia
- Leaflet

Backend:
- Node.js
- Express
- TypeScript
- Prisma ORM
- MariaDB
- JWT

## Design

Design stile startup / Life360 inspired:
- mobile-first;
- mappa protagonista;
- UI pulita;
- bottom sheet;
- dark/light mode;
- colori sicurezza: verde, giallo, rosso, viola, bianco/grigio.

## Skill da considerare

Integrare mentalmente queste skill, se installate nell'ambiente Claude:
- ui-ux-pro-max
- animated-component-libraries
- motion-framer
- shadcn/ui inspiration, adattata a Vue
- frontend-design Anthropic
- web-accessibility
- impeccable

## Comportamento richiesto

Per ogni task:
1. Leggi contesto minimo.
2. Spiega in 5 righe cosa farai.
3. Implementa.
4. Esegui controllo statico o test possibile.
5. Riporta file modificati.
6. Suggerisci commit message.

## Cosa NON fare

- Non creare tutto il backend in un solo file.
- Non creare componenti enormi.
- Non usare dati sensibili reali.
- Non implementare pagamenti reali ora.
- Non rendere l'AI obbligatoria.
- Non bloccare l'app se SMS/email non sono configurati.
