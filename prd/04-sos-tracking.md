# PRD 04 - SOS e tracking live

## Obiettivo

Consentire invio rapido di emergenza tramite SMS/email con posizione reale e tracking live.

## SOS flow

1. Utente preme SOS.
2. App non chiede testo obbligatorio.
3. Invia subito SMS/email ai contatti configurati.
4. Messaggio include:
   - richiesta aiuto;
   - posizione GPS;
   - link tracking live;
   - invito a contattare 112/numero emergenza locale se necessario.
5. Dopo un tempo prestabilito mostra:
   "Ora sei al sicuro?"
6. Se sì/no, richiede feedback opzionale:
   - falso allarme;
   - pericolo reale;
   - descrizione.

## Messaggi predefiniti

L'utente può scegliere tra 3 messaggi rapidi oppure lasciare vuoto.
Esempio:
- "Ho bisogno di aiuto, questa è la mia posizione."
- "Mi sento in pericolo, seguimi da questo link."
- "Emergenza SafeRoute: contatta il 112 se non rispondo."

## Tracking live

Parte automaticamente quando viene attivato SOS.
Durata default:
- 24 ore massimo;
- admin può modificare.

## Provider

Email:
- SMTP configurabile.

SMS:
- provider configurabile;
- app non deve crashare se non configurato;
- log invio notifiche.

## Criteri accettazione

- SOS crea alert;
- salva posizione;
- manda email se configurata;
- manda SMS se configurato;
- crea link tracking;
- tracking mostra posizione aggiornata.
