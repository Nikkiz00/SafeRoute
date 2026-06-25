<script setup lang="ts">
import { ref } from 'vue'
import { Shield, ChevronDown } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import ThemeToggle from '@/components/common/ThemeToggle.vue'

interface FaqItem {
  question: string
  answer: string
  open: boolean
}

const faqs = ref<FaqItem[]>([
  {
    question: 'Come funziona il tracking live?',
    answer: 'Quando avvii un percorso, puoi condividere un link con i tuoi contatti. Chiunque abbia il link vede la tua posizione aggiornata in tempo reale, senza installare nulla. Il link scade dopo 24 ore o alla fine del percorso.',
    open: false,
  },
  {
    question: 'Non ho ricevuto la notifica SOS — cosa e successo?',
    answer: 'Le notifiche dipendono da provider email e SMS esterni. Se il servizio email non e configurato o il numero non e raggiungibile, la notifica puo fallire. Controlla che i contatti abbiano email o telefono validi. Per una verifica manuale, scrivi a support@saferoute.app.',
    open: false,
  },
  {
    question: 'Il GPS e impreciso — cosa faccio?',
    answer: 'La precisione GPS varia in base al dispositivo e all\'ambiente (interni, aree urbane dense). SafeRoute filtra automaticamente i ping con accuratezza superiore a 50 metri. In ambienti chiusi, il tracking potrebbe essere meno preciso. Usa il dispositivo in un\'area aperta per risultati migliori.',
    open: false,
  },
  {
    question: 'Come elimino il mio account?',
    answer: 'Vai su Profilo > Sicurezza account > Elimina account. La cancellazione e immediata e disabilita l\'accesso. I dati vengono rimossi progressivamente nei giorni successivi.',
    open: false,
  },
  {
    question: 'I miei dati di posizione sono condivisi con terzi?',
    answer: 'No. I dati di posizione sono usati solo per il tracking live con i tuoi contatti e per la funzione SOS. Non li vendiamo ne li condividiamo con terzi. Vedi la Privacy Policy per i dettagli.',
    open: false,
  },
  {
    question: 'Cosa significa che una zona e "grigia"?',
    answer: 'Una zona grigia significa che non ci sono ancora dati sufficienti dalla community. Le zone si colorano man mano che gli utenti inviano feedback. Puoi essere il primo a contribuire.',
    open: false,
  },
])

function toggleFaq(index: number): void {
  faqs.value[index].open = !faqs.value[index].open
}
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
      <!-- Intro -->
      <div class="mb-12">
        <h1 class="font-display text-3xl md:text-4xl font-extrabold text-text-primary dark:text-text-dark-primary mb-4">
          Supporto
        </h1>
        <p class="text-text-secondary dark:text-text-dark-secondary text-lg leading-relaxed">
          Hai una domanda o un problema? Siamo qui.
        </p>
      </div>

      <!-- Contatti -->
      <section class="mb-12">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="p-5 rounded-2xl bg-surface-elevated dark:bg-surface-dark-elevated border border-border-light dark:border-border-dark">
            <p class="text-sm font-semibold text-text-primary dark:text-text-dark-primary mb-1">Supporto generale</p>
            <a href="mailto:support@saferoute.app" class="text-brand-blue hover:underline text-sm">support@saferoute.app</a>
          </div>
          <div class="p-5 rounded-2xl bg-surface-elevated dark:bg-surface-dark-elevated border border-border-light dark:border-border-dark">
            <p class="text-sm font-semibold text-text-primary dark:text-text-dark-primary mb-1">Privacy e dati</p>
            <a href="mailto:privacy@saferoute.app" class="text-brand-blue hover:underline text-sm">privacy@saferoute.app</a>
          </div>
        </div>
        <p class="mt-4 text-sm text-text-secondary dark:text-text-dark-secondary">
          I tempi di risposta sono di solito 2-3 giorni lavorativi.
        </p>
      </section>

      <!-- Divider -->
      <div class="h-px bg-border-light dark:bg-border-dark mb-12"></div>

      <!-- FAQ -->
      <section>
        <h2 class="font-display text-2xl font-bold text-text-primary dark:text-text-dark-primary mb-6">
          Domande frequenti
        </h2>

        <div class="space-y-3">
          <div
            v-for="(faq, index) in faqs"
            :key="index"
            class="rounded-2xl border border-border-light dark:border-border-dark bg-surface-elevated dark:bg-surface-dark-elevated overflow-hidden"
          >
            <button
              type="button"
              class="w-full flex items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer hover:bg-surface-base/50 dark:hover:bg-surface-dark/50 transition-colors"
              :aria-expanded="faq.open"
              @click="toggleFaq(index)"
            >
              <span class="font-semibold text-text-primary dark:text-text-dark-primary text-sm leading-snug">
                {{ faq.question }}
              </span>
              <ChevronDown
                :size="18"
                class="shrink-0 text-text-secondary dark:text-text-dark-secondary transition-transform duration-200"
                :class="{ 'rotate-180': faq.open }"
              />
            </button>
            <div
              v-show="faq.open"
              class="px-5 pb-4"
            >
              <p class="text-text-secondary dark:text-text-dark-secondary text-sm leading-relaxed">
                {{ faq.answer }}
              </p>
            </div>
          </div>
        </div>
      </section>
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
