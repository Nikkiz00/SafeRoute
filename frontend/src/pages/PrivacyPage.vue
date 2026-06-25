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
          Privacy e dati personali
        </h1>
        <p class="text-text-secondary dark:text-text-dark-secondary text-lg leading-relaxed">
          SafeRoute raccoglie solo i dati necessari a fornire le funzioni di sicurezza descritte in questa pagina. Non vendiamo dati a terzi. Non utilizziamo pubblicità.
        </p>
      </div>

      <div class="space-y-10">
        <!-- Sezione 1 -->
        <section>
          <h2 class="font-display text-xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
            1. Dati che raccogliamo
          </h2>
          <div class="space-y-4 text-text-secondary dark:text-text-dark-secondary leading-relaxed">
            <p>
              <span class="font-semibold text-text-primary dark:text-text-dark-primary">Dati di account</span> — nome, email, password (in forma hashata, mai in chiaro). Necessari per autenticazione e identificazione in caso di emergenza.
            </p>
            <p>
              <span class="font-semibold text-text-primary dark:text-text-dark-primary">Posizione GPS</span> — raccolta solo durante un percorso attivo, con il tuo consenso esplicito. Inviata ogni 15 secondi al server per consentire il tracking live.
            </p>
            <p>
              <span class="font-semibold text-text-primary dark:text-text-dark-primary">Contatti di emergenza</span> — nome, telefono o email dei tuoi contatti. Usati solo per inviare notifiche SOS.
            </p>
            <p>
              <span class="font-semibold text-text-primary dark:text-text-dark-primary">Feedback e segnalazioni</span> — valutazioni zone (1-5 stelle) e segnalazioni di categoria. Associati al tuo account per prevenire abusi.
            </p>
            <p>
              <span class="font-semibold text-text-primary dark:text-text-dark-primary">Log notifiche</span> — registriamo se una notifica SOS è stata inviata e il suo esito (inviata / fallita / non configurata). Non conserviamo il contenuto degli SMS.
            </p>
            <p>
              <span class="font-semibold text-text-primary dark:text-text-dark-primary">Sessioni route</span> — ora di inizio e fine, posizione iniziale e destinazione (se inserita). Conservate per 30 giorni.
            </p>
          </div>
          <div class="mt-6 h-px bg-border-light dark:bg-border-dark"></div>
        </section>

        <!-- Sezione 2 -->
        <section>
          <h2 class="font-display text-xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
            2. Come usiamo i dati
          </h2>
          <div class="space-y-3 text-text-secondary dark:text-text-dark-secondary leading-relaxed">
            <p>I dati raccolti vengono usati per mostrare la mappa di sicurezza comunitaria, permettere il tracking live ai tuoi contatti tramite link, inviare notifiche di emergenza via email o SMS e calcolare il punteggio di sicurezza delle zone in modo anonimizzato.</p>
          </div>
          <div class="mt-6 h-px bg-border-light dark:bg-border-dark"></div>
        </section>

        <!-- Sezione 3 -->
        <section>
          <h2 class="font-display text-xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
            3. Tracking e link condivisi
          </h2>
          <p class="text-text-secondary dark:text-text-dark-secondary leading-relaxed">
            Il link di tracking è accessibile a chiunque ne sia in possesso, senza login. Scade automaticamente dopo 24 ore o alla fine del percorso. Puoi interrompere il tracking in qualsiasi momento dall'app. Non condividere il link con persone di cui non ti fidi.
          </p>
          <div class="mt-6 h-px bg-border-light dark:bg-border-dark"></div>
        </section>

        <!-- Sezione 4 -->
        <section>
          <h2 class="font-display text-xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
            4. Conservazione dei dati
          </h2>
          <div class="space-y-3 text-text-secondary dark:text-text-dark-secondary leading-relaxed">
            <p>I ping di posizione vengono eliminati 7 giorni dopo la fine del percorso. I dati account sono conservati finché l'account è attivo — puoi eliminare l'account dal profilo. I log notifiche sono conservati per 90 giorni. Feedback e segnalazioni restano attivi finché l'account è attivo.</p>
            <p class="text-sm bg-surface-elevated dark:bg-surface-dark-elevated rounded-xl p-4 border border-border-light dark:border-border-dark">
              Nota: i job di eliminazione automatica sono in fase di implementazione. Alcune categorie di dati potrebbero essere conservate per un periodo più lungo durante questa fase.
            </p>
          </div>
          <div class="mt-6 h-px bg-border-light dark:bg-border-dark"></div>
        </section>

        <!-- Sezione 5 -->
        <section>
          <h2 class="font-display text-xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
            5. I tuoi diritti
          </h2>
          <p class="text-text-secondary dark:text-text-dark-secondary leading-relaxed">
            Puoi eliminare il tuo account dalla sezione Profilo. La cancellazione disabilita immediatamente l'accesso e avvia la rimozione progressiva dei dati. Per richieste specifiche su accesso, rettifica o cancellazione dati, scrivi a <a href="mailto:privacy@saferoute.app" class="text-brand-blue hover:underline">privacy@saferoute.app</a>.
          </p>
          <div class="mt-6 h-px bg-border-light dark:bg-border-dark"></div>
        </section>

        <!-- Sezione 6 -->
        <section>
          <h2 class="font-display text-xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
            6. Sicurezza
          </h2>
          <p class="text-text-secondary dark:text-text-dark-secondary leading-relaxed">
            I dati sono trasmessi tramite HTTPS. Le password sono archiviate in forma hashata con bcrypt. I token di sessione sono firmati con JWT.
          </p>
          <div class="mt-6 h-px bg-border-light dark:bg-border-dark"></div>
        </section>

        <!-- Sezione 7 -->
        <section>
          <h2 class="font-display text-xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
            7. Servizi di emergenza
          </h2>
          <div class="bg-safety-red/10 border border-safety-red/30 rounded-xl p-4">
            <p class="text-text-primary dark:text-text-dark-primary leading-relaxed font-medium">
              SafeRoute non e un servizio di emergenza e non sostituisce il 112. In caso di pericolo reale, chiama sempre il 112.
            </p>
          </div>
          <div class="mt-6 h-px bg-border-light dark:bg-border-dark"></div>
        </section>

        <!-- Sezione 8 -->
        <section>
          <h2 class="font-display text-xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
            8. Contatti
          </h2>
          <div class="text-text-secondary dark:text-text-dark-secondary leading-relaxed space-y-2">
            <p>Per domande su questa informativa: <a href="mailto:privacy@saferoute.app" class="text-brand-blue hover:underline">privacy@saferoute.app</a></p>
            <p>Per supporto generale: <a href="mailto:support@saferoute.app" class="text-brand-blue hover:underline">support@saferoute.app</a></p>
          </div>
        </section>

        <p class="text-sm text-text-secondary dark:text-text-dark-secondary pt-4">
          Data ultimo aggiornamento: giugno 2026
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
