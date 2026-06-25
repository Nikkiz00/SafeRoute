# PRD 06 - Premium e AI foundation

## Obiettivo

Preparare database e configurazioni per premium e AI senza implementare pagamenti o AI complessa.

## Premium foundation

Piani:
- FREE;
- PREMIUM.

Limiti iniziali:
- contatti emergenza FREE: 2;
- contatti emergenza PREMIUM: 5;
- storico percorsi FREE limitato;
- storico percorsi PREMIUM più ampio;
- SOS non deve mai essere bloccato per sicurezza, ma può mostrare limiti/upgrade su funzioni secondarie.

## AI foundation

Tabella/settings:
- AI_ENABLED;
- AI_PROVIDER;
- AI_MODEL;
- AI_API_KEY placeholder;
- OLLAMA_BASE_URL;

Provider previsti:
- none;
- ollama;
- openrouter;
- openai;
- anthropic.

Uso futuro:
- analisi feedback;
- classificazione segnalazioni;
- suggerimenti routing;
- report admin.

Per MVP:
- AI disattiva di default;
- codice predisposto ma non obbligatorio.
