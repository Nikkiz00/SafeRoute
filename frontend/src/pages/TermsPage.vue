<script setup lang="ts">
import { Shield } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
</script>

<template>
  <div class="min-h-screen bg-surface-base dark:bg-surface-dark">
    <!-- Navbar minimal -->
    <header class="sticky top-0 z-nav bg-surface-base/95 dark:bg-surface-dark/95 backdrop-blur-sm border-b border-border-light dark:border-border-dark">
      <div class="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <RouterLink to="/" class="flex items-center gap-2.5">
          <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-blue">
            <Shield :size="16" class="text-white" />
          </div>
          <span class="font-display font-bold text-lg text-text-primary dark:text-text-dark-primary">SafeRoute</span>
        </RouterLink>
        <div class="flex items-center gap-3">
          <ThemeToggle />
          <RouterLink
            to="/"
            class="text-sm font-medium text-text-secondary dark:text-text-dark-secondary hover:text-text-primary dark:hover:text-text-dark-primary transition-colors"
          >
            Torna al sito
          </RouterLink>
        </div>
      </div>
    </header>

    <!-- Content -->
    <main class="max-w-3xl mx-auto px-4 py-12 md:py-20">
      <div class="mb-12">
        <h1 class="font-display text-3xl md:text-4xl font-extrabold text-text-primary dark:text-text-dark-primary mb-4">
          Termini di utilizzo
        </h1>
        <p class="text-text-secondary dark:text-text-dark-secondary text-lg leading-relaxed">
          Usando SafeRoute accetti questi termini. Se non li accetti, non usare il servizio.
        </p>
      </div>

      <div class="space-y-10">
        <!-- Sezione 1 -->
        <section>
          <h2 class="font-display text-xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
            1. Cos'è SafeRoute
          </h2>
          <p class="text-text-secondary dark:text-text-dark-secondary leading-relaxed">
            SafeRoute è uno strumento di supporto alla mobilità personale. Fornisce informazioni orientative sulla sicurezza percepita delle zone, basate sui feedback della community. Non è un servizio di sicurezza professionale, un sistema di sorveglianza o un sostituto dei servizi di emergenza.
          </p>
          <div class="mt-6 h-px bg-border-light dark:bg-border-dark"></div>
        </section>

        <!-- Sezione 2 -->
        <section>
          <h2 class="font-display text-xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
            2. Uso corretto
          </h2>
          <div class="space-y-4 text-text-secondary dark:text-text-dark-secondary leading-relaxed">
            <div>
              <p class="font-semibold text-text-primary dark:text-text-dark-primary mb-2">Puoi usare SafeRoute per:</p>
              <p>consultare la mappa di sicurezza comunitaria, avviare percorsi con tracking condiviso, ricevere e inviare notifiche di emergenza, segnalare situazioni di rischio nella tua zona.</p>
            </div>
            <div>
              <p class="font-semibold text-text-primary dark:text-text-dark-primary mb-2">Non puoi usare SafeRoute per:</p>
              <p>inviare segnalazioni false o abusive, condividere dati di terzi senza consenso, tentare di compromettere la sicurezza del sistema, usare il servizio per scopi commerciali non autorizzati.</p>
            </div>
          </div>
          <div class="mt-6 h-px bg-border-light dark:bg-border-dark"></div>
        </section>

        <!-- Sezione 3 -->
        <section>
          <h2 class="font-display text-xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
            3. Limiti del servizio
          </h2>
          <p class="text-text-secondary dark:text-text-dark-secondary leading-relaxed">
            Il percorso mostrato da SafeRoute è orientativo. Dipende da servizi di terze parti (OpenStreetMap, OSRM) e dalla copertura GPS del dispositivo. SafeRoute non garantisce l'accuratezza del percorso in ogni condizione, la disponibilità continua del servizio, la correttezza delle informazioni di sicurezza delle zone — che si basano su dati forniti dagli utenti — né la consegna di notifiche SMS o email, che dipendono da provider terzi.
          </p>
          <div class="mt-6 h-px bg-border-light dark:bg-border-dark"></div>
        </section>

        <!-- Sezione 4 -->
        <section>
          <h2 class="font-display text-xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
            4. Dati e zone
          </h2>
          <p class="text-text-secondary dark:text-text-dark-secondary leading-relaxed">
            I dati di sicurezza delle zone provengono da feedback volontari degli utenti. SafeRoute non verifica sul campo le segnalazioni e non garantisce la veridicità delle informazioni. Usa sempre il tuo giudizio personale.
          </p>
          <div class="mt-6 h-px bg-border-light dark:bg-border-dark"></div>
        </section>

        <!-- Sezione 5 -->
        <section>
          <h2 class="font-display text-xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
            5. Tracking e link condivisi
          </h2>
          <p class="text-text-secondary dark:text-text-dark-secondary leading-relaxed">
            Condividendo un link di tracking, rendi visibile la tua posizione a chiunque abbia quel link. SafeRoute non è responsabile dell'uso del link da parte di terzi. Il link scade automaticamente entro 24 ore.
          </p>
          <div class="mt-6 h-px bg-border-light dark:bg-border-dark"></div>
        </section>

        <!-- Sezione 6 -->
        <section>
          <h2 class="font-display text-xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
            6. Disponibilità
          </h2>
          <p class="text-text-secondary dark:text-text-dark-secondary leading-relaxed">
            SafeRoute è un servizio in sviluppo attivo. Potrebbe essere temporaneamente non disponibile per manutenzione o aggiornamenti. Non garantiamo un SLA specifico.
          </p>
          <div class="mt-6 h-px bg-border-light dark:bg-border-dark"></div>
        </section>

        <!-- Sezione 7 -->
        <section>
          <h2 class="font-display text-xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
            7. Emergenze
          </h2>
          <div class="bg-safety-red/10 border border-safety-red/30 rounded-xl p-4">
            <p class="text-text-primary dark:text-text-dark-primary leading-relaxed font-medium">
              SafeRoute non è un servizio di emergenza. Non chiamare il team SafeRoute in caso di pericolo reale. Chiama il 112.
            </p>
          </div>
          <div class="mt-6 h-px bg-border-light dark:bg-border-dark"></div>
        </section>

        <!-- Sezione 8 -->
        <section>
          <h2 class="font-display text-xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
            8. Modifiche
          </h2>
          <p class="text-text-secondary dark:text-text-dark-secondary leading-relaxed">
            Possiamo aggiornare questi termini. In caso di modifiche sostanziali, avviseremo via email.
          </p>
          <p class="mt-3 text-text-secondary dark:text-text-dark-secondary">
            Per domande: <a href="mailto:support@saferoute.app" class="text-brand-blue hover:underline">support@saferoute.app</a>
          </p>
        </section>

        <p class="text-sm text-text-secondary dark:text-text-dark-secondary pt-4">
          Data: giugno 2026
        </p>
      </div>
    </main>

    <!-- Footer -->
    <footer class="border-t border-border-light dark:border-border-dark py-8 px-4">
      <div class="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-2.5">
          <div class="flex items-center justify-center w-7 h-7 rounded-lg bg-brand-blue">
            <Shield :size="14" class="text-white" />
          </div>
          <span class="font-display font-bold text-text-primary dark:text-text-dark-primary">SafeRoute</span>
        </div>
        <div class="flex items-center gap-6 text-sm text-text-secondary dark:text-text-dark-secondary">
          <RouterLink to="/privacy" class="hover:text-text-primary dark:hover:text-text-dark-primary transition-colors">Privacy</RouterLink>
          <RouterLink to="/terms" class="hover:text-text-primary dark:hover:text-text-dark-primary transition-colors">Termini</RouterLink>
          <RouterLink to="/support" class="hover:text-text-primary dark:hover:text-text-dark-primary transition-colors">Supporto</RouterLink>
        </div>
        <p class="text-xs text-text-secondary dark:text-text-dark-secondary">
          &copy; 2026 SafeRoute. Tutti i diritti riservati.
        </p>
      </div>
    </footer>
  </div>
</template>
