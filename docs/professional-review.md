# Professional Review - SafeRoute after Day 8

Data review: 2026-06-22

## Executive summary

SafeRoute dopo Day 8 non è un prototipo vuoto: ha una base prodotto credibile, un backend reale, autenticazione funzionante, tracking live, SOS, moderazione admin e una documentazione migliore della media di un progetto scolastico.

Non è però pronta per un deploy pubblico reale. Oggi il prodotto è presentabile a giuria e scuola come MVP tecnico avanzato, ma non è ancora presentabile a utenti reali o investitori come servizio affidabile e responsabile.

Valutazione netta:

- Scuola / maturità: sì, molto presentabile.
- Giuria hackathon / concorso: sì, con buon impatto.
- Demo a investitori: sì, ma solo come pre-MVP con onestà sui limiti.
- Deploy pubblico con utenti reali: no, non ancora.

## 1. Cosa rende già SafeRoute professionale

- Architettura separata e leggibile: frontend, backend, database, documentazione e moduli distinti.
- Backend reale con TypeScript, Prisma, validazione input e gestione ruoli.
- Autenticazione con access token + refresh token hashati e rotazione refresh.
- Verifica email introdotta anche come gate su funzioni sensibili (`routes`, `sos`).
- Tracking live pubblico con SSE e fallback polling: buona scelta tecnica per l’uso previsto.
- SOS collegato a contatti reali via email/SMS abstraction e logging degli invii.
- Modello dati già più maturo di una demo standard: utenti, sessioni route, ping posizione, feedback, report, audit log.
- Admin panel reale con overview, utenti, zone, report, SOS, feedback, audit log.
- Safety score e moderazione report già collegati a logica applicativa, non solo UI.
- Documentazione di architettura, database, deploy e QA sopra la media per un progetto Day 8.

## 2. Cosa la fa ancora sembrare una demo

- Copertura geografica estremamente limitata: seed reale di sole 2 città e poche zone demo.
- Routing basato su servizi pubblici gratuiti (`OSRM demo`, `Nominatim`) senza SLA e senza controllo del dato.
- Il routing non è davvero “safe routing”: calcola un percorso stradale, ma non risulta un motore che penalizza davvero le zone rischiose.
- SMS non pronti: il provider Twilio è ancora uno stub strutturale, non un invio reale.
- Email opzionali: se SMTP non è configurato, parti importanti del prodotto degradano o saltano.
- Admin “settings” è placeholder, quindi la piattaforma non è ancora governabile come prodotto.
- Assenza di pagine pubbliche fondamentali: privacy, termini, supporto, contatti, legal disclaimer visibile.
- Manca una vera strategia operativa: monitoring, backup, retention, incident handling, support workflow.
- Alcuni documenti descrivono capacità future come se fossero presenti; questo aumenta il rischio di overclaim in demo.

## 3. Problemi UX/UI rimasti

### Bloccante prima del deploy

- Il fallback del routing a linea retta può essere frainteso come percorso reale. Per un prodotto safety questo è pericoloso.
- Non emerge con sufficiente forza un disclaimer contestuale: il percorso è orientativo, non garantisce sicurezza reale.
- La UX admin è solo desktop. Non è un problema per la demo, ma limita l’operatività reale in emergenza.

### Importante ma non bloccante

- La percezione di affidabilità resta fragile: se email/SMS non partono, l’utente non ha una UX di fallback davvero robusta.
- La verifica email e i blocchi account esistono, ma la comunicazione prodotto non è ancora abbastanza chiara e rassicurante.
- Manca una sezione pubblica “come funziona / limiti del servizio / cosa fare in emergenza reale”.
- Le città e zone disponibili sembrano ancora “dataset demo”, non copertura reale.
- La dashboard admin mostra dati utili, ma non ancora strumenti operativi completi per triage veloce e gestione casi.

### Futuro

- Storico percorsi e feedback più leggibile per l’utente.
- Migliore gestione accessibilità e stati offline/degraded.
- Funnel onboarding più esplicito su privacy, contatti e affidabilità del tracking.

## 4. Problemi sicurezza/account rimasti

### Bloccante prima del deploy

- I token auth sono in `localStorage`. Per un prodotto con tracking, SOS e dati sensibili è una scelta debole contro XSS/session theft.
- Il tracking pubblico usa token shareable a lunga durata; se il link viene inoltrato o esposto, la posizione resta accessibile fino a scadenza.
- Lo stream SSE imposta `Access-Control-Allow-Origin: *`, troppo permissivo per dati di tracking.
- Non esiste una gestione sessioni/dispositivi visibile all’utente: nessun elenco sessioni attive, revoca mirata, alert accessi sospetti.

### Importante ma non bloccante

- Password policy minima: 8 caratteri è poco per un prodotto safety.
- Nessuna 2FA o step-up auth per operazioni critiche.
- Rate limiting globale presente, ma mancano controlli più specifici su endpoint sensibili non-SOS.
- Nessun hardening evidente su auditing accessi admin, IP logging di sicurezza, anomaly detection.
- Soft delete account esiste, ma non coincide ancora con una vera chiusura di account “security complete”.

### Futuro

- Device/session management.
- 2FA email/TOTP.
- Alert sicurezza su login da nuovo dispositivo o posizione anomala.

## 5. Problemi privacy/GDPR rimasti

### Bloccante prima del deploy

- Mancano privacy policy, termini d’uso, base giuridica, informativa tracking e informativa per contatti di emergenza.
- La retention documentata non risulta operativa: i job di cancellazione/anonymization non sono realmente implementati.
- Non c’è un flusso completo per data subject rights: export dati, cancellazione completa, prova di avvenuta cancellazione, rettifica.
- SafeRoute tratta geolocalizzazione sensibile e dati di terzi (contatti emergenza), ma manca la governance privacy minima.

### Importante ma non bloccante

- Soft delete non basta per GDPR se i dati restano indefinitamente nei record correlati.
- Notification logs, ping e audit log possono contenere dati personali senza una retention chiaramente applicata.
- Il tracking pubblico richiede una migliore minimizzazione: scadenze più strette, revoca manuale, watermark UX più chiaro.
- Non è visibile un meccanismo di consenso informato per aggiungere contatti e condividere link live.

### Futuro

- DPA/registro trattamenti se il progetto evolve in partnership B2B.
- Data retention configurabile per tenant/ente.

## 6. Problemi tecnici/architetturali rimasti

### Bloccante prima del deploy

- Dipendenza critica da servizi gratuiti pubblici per core flow (`OSRM demo`, `Nominatim`).
- Mancano structured logging, monitoring centralizzato, alerting e runbook operativo.
- Caching, Redis e retention sono molto documentati ma non realmente operativi: il sistema è meno production-ready di quanto appare.
- Il routing “safe” non è ancora coerente con la promessa di prodotto; oggi è soprattutto routing standard + visual safety layer.

### Importante ma non bloccante

- Safety score aggiornato in modo sincrono in alcuni flussi, mentre la documentazione parla di aggiornamento asincrono/queue.
- Nessuna coda/job infrastructure per task di ricalcolo, retention, notifiche o cleanup.
- Bounding box filtering applicato lato applicazione e non via spatial query: accettabile ora, debole in scala.
- Nessuna evidenza di backup/restore testati, SLO o piano di continuità.
- Documentazione e implementazione non sono sempre allineate; questo è un rischio anche verso investitori.

### Futuro

- Spatial indexing reale.
- Queue/job worker.
- Redis per cache/session/tracking.
- Self-hosted routing/geocoding o provider con SLA.

## 7. Funzioni mancanti per MVP pubblico

### Bloccante prima del deploy

- SMS reale funzionante e verificato end-to-end.
- Policy privacy, termini, disclaimer safety e pagina supporto.
- Retention e cancellazione dati realmente implementate.
- Revoca tracking link e scadenze più controllabili.
- Chiarezza UX sul fatto che il percorso fallback non è un percorso affidabile.
- Verifica operativa del delivery channel principale: se email/SMS falliscono, il prodotto deve dirlo in modo comprensibile.

### Importante ma non bloccante

- Storico percorso/SOS lato utente.
- Gestione migliore errori e stati degraded dei provider esterni.
- Copertura geografica almeno credibile per una singola città pilota.
- Admin workflow più completo per moderazione e incident review.

### Futuro

- Login Google/Apple.
- Notifiche push.
- Maggiore internazionalizzazione.

## 8. Funzioni mancanti per versione business/investitori

### Importante ma non bloccante per demo investitori

- Dashboard KPI veramente business: retention, attivazioni SOS, conversione, engagement, città attive.
- Configurazione admin vera di provider, limiti, retention e policy operative.
- Tracciamento eventi prodotto e analytics affidabili.
- Piano di rollout città-by-città con sourcing dati e qualità del dato.
- Support workflow e modello operativo per incidenti/segnalazioni.

### Futuro

- Multi-tenant / enti / scuole / comuni.
- Ruoli enterprise più granulari.
- SLA, audit exports, reportistica partner.
- Monetizzazione chiara: premium, B2B scuola/comune, bundle sicurezza.

## 9. Priorità prossimi interventi

### Bloccante prima del deploy

1. Chiudere i buchi privacy/GDPR minimi: informativa, termini, retention reale, cancellazione reale.
2. Mettere in sicurezza auth e tracking: ridurre esposizione token, restringere tracking share, eliminare permissività inutile.
3. Rendere affidabile il canale emergenza: SMS reale, verifica invii, fallback chiaro.
4. Correggere la promessa prodotto: non vendere “safe routing” finché non esiste davvero una pesatura sicurezza sul percorso.
5. Introdurre logging/monitoring operativo minimo e gestione errori di produzione.

### Importante ma non bloccante

1. Allineare documentazione e implementazione reale.
2. Completare settings/admin operativi.
3. Preparare una città pilota con dataset più credibile.
4. Rafforzare UX di trust, legal e trasparenza.

### Futuro

1. Queue/Redis/spatial improvements.
2. Analytics business.
3. Enterprise readiness.

## 10. Roadmap consigliata dopo Day 8

### Fase 1 - Hardening minimo pre-pubblico

- Privacy policy, termini, disclaimer e support page.
- Retention reale per `LocationPing`, log e dati utente cancellati.
- Tracking link più sicuro: revoca, scadenze più corte, controllo migliore della condivisione.
- SMS reale e test operativo provider.
- Logging strutturato + error reporting + basic monitoring.

### Fase 2 - Correzione promessa prodotto

- Decidere una verità di prodotto:
- Opzione A: presentarlo come “tracking + SOS + safety awareness”.
- Opzione B: implementare davvero un routing penalizzato per zone rischiose.
- In questa fase va anche eliminato ogni messaggio ambiguo sul fallback a linea retta.

### Fase 3 - MVP pubblico credibile per una città pilota

- Una sola città servita bene è meglio di più città seedate male.
- Dataset zone più serio, moderazione operativa, QA sul campo, demo utenti reali controllati.
- Migliorare onboarding, fiducia, recovery da errori provider.

### Fase 4 - Preparazione investitori / B2B

- KPI, analytics, funnel, costi provider, unit economics iniziali.
- Admin settings veri.
- Piano di rollout operativo e governance dati.

## Conclusione

SafeRoute oggi è un ottimo progetto tecnico di maturità scolastica e una buona demo di prodotto early-stage.

Non è ancora un servizio pubblico pronto. I limiti principali non sono “mancano feature fighe”, ma quattro aree più serie: affidabilità dell’emergenza, sicurezza del tracking/account, compliance privacy e coerenza tra promessa di prodotto e implementazione reale del routing.

Se l’obiettivo immediato è fare bella figura a scuola o in giuria, la base è già forte.

Se l’obiettivo è pubblicarla davvero, prima serve hardening, non altro frontend.
