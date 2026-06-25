# PRD 03 - Routing, feedback e safety score

## Obiettivo

Consentire all'utente di creare un percorso e raccogliere feedback di sicurezza per aggiornare le zone.

## Funzioni routing

- partenza/destinazione;
- modalità più veloce;
- modalità più sicura;
- modalità compromesso;
- evitare zone viola quando possibile;
- mostra tempo stimato.

Per MVP è accettabile simulare il peso sicurezza sopra routing OpenStreetMap/Leaflet.

## Feedback

Dopo percorso o dopo uso in zona:
Messaggio:
"Come ti sei sentito in questa zona/percorso?"

Rating 1-5:
- 1 molto insicuro;
- 2 insicuro;
- 3 neutro;
- 4 sicuro;
- 5 molto sicuro.

Regola anti-abuso:
- un utente può influenzare stessa zona massimo 1 volta ogni 30 giorni;
- se percorre realmente una zona può lasciare feedback;
- admin vede autore, pubblico no.

## Safety score base

Algoritmo iniziale senza AI:
- rating basso abbassa score;
- rating alto alza score;
- SOS reale abbassa molto score;
- falso allarme non penalizza o penalizza pochissimo;
- percorso completato senza problemi aumenta lievemente.

## AI opzionale futura

Se AI enabled:
- analizza descrizioni feedback;
- classifica gravità;
- suggerisce modifica score.

Se AI disabled:
- algoritmo classico.

## Criteri accettazione

- Avvio percorso;
- completamento percorso;
- richiesta feedback;
- score zona aggiornato;
- anti-abuso applicato.
