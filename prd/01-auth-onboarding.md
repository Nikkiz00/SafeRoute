# PRD 01 - Auth, ruoli e onboarding

## Obiettivo

Permettere all'utente di creare account, restare loggato e configurare contatti emergenza iniziali.

## Funzioni

- Registrazione email/password;
- login email/password;
- predisposizione login Google/Apple come provider futuri;
- JWT con persistenza sessione;
- logout;
- ruoli: USER, ADMIN, STAFF, FAMILY;
- piani: FREE, PREMIUM;
- onboarding dopo primo login.

## Onboarding

Step:
1. Benvenuto;
2. abilita posizione;
3. aggiungi contatti emergenza;
4. spiega SOS;
5. spiega feedback sicurezza;
6. entra nella mappa.

## Limiti contatti

- FREE: massimo 2;
- PREMIUM: massimo 5.

## Criteri accettazione

- Utente registra account;
- rimane loggato dopo refresh;
- aggiunge contatti emergenza;
- onboarding non ricompare se completato;
- admin può essere previsto nel DB.
