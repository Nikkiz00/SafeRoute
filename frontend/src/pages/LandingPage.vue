<script setup lang="ts">
import { useRouter, RouterLink } from 'vue-router'
import { Shield, MapPin, AlertTriangle, Navigation, ChevronRight } from 'lucide-vue-next'
import ThemeToggle from '@/components/common/ThemeToggle.vue'

const router = useRouter()

const features = [
  {
    icon: MapPin,
    color: 'text-safety-green',
    borderColor: 'border-safety-green',
    bg: 'bg-safety-green/10',
    title: 'Mappa sicurezza',
    description: 'Zone colorate in base ai dati reali della community. Sai sempre dove ti trovi.',
  },
  {
    icon: AlertTriangle,
    color: 'text-safety-red',
    borderColor: 'border-safety-red',
    bg: 'bg-safety-red/10',
    title: 'SOS immediato',
    description: 'Un pulsante. La tua posizione ai tuoi contatti in secondi. Nessun limite di invio.',
  },
  {
    icon: Navigation,
    color: 'text-brand-cyan',
    borderColor: 'border-brand-cyan',
    bg: 'bg-brand-cyan/10',
    title: 'Tracking live',
    description: 'I tuoi cari ti seguono in tempo reale, senza installare nulla. Solo un link.',
  },
]
</script>

<template>
  <div class="min-h-screen bg-surface-base dark:bg-surface-dark">
    <!-- Navbar -->
    <header class="sticky top-0 z-nav bg-surface-base/95 dark:bg-surface-dark/95 backdrop-blur-sm border-b border-border-light dark:border-border-dark">
      <div class="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <!-- Logo -->
        <div class="flex items-center gap-2.5">
          <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-blue">
            <Shield :size="16" class="text-white" />
          </div>
          <span class="font-display font-bold text-lg text-text-primary dark:text-text-dark-primary">SafeRoute</span>
        </div>

        <!-- Nav actions -->
        <div class="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <button
            @click="router.push('/login')"
            class="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-text-secondary dark:text-text-dark-secondary hover:text-text-primary dark:hover:text-text-dark-primary transition-colors cursor-pointer"
          >
            Accedi
          </button>
          <button
            @click="router.push('/register')"
            class="px-3 sm:px-4 py-2 rounded-xl bg-brand-blue text-white text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            Inizia gratis
          </button>
        </div>
      </div>
    </header>

    <!-- Hero Section -->
    <section class="relative min-h-[85vh] flex items-center justify-center overflow-hidden bg-brand-navy">
      <!-- Background zone circles visual -->
      <div class="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div class="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-safety-green/20 blur-3xl"></div>
        <div class="absolute top-1/3 right-1/3 w-48 h-48 rounded-full bg-safety-yellow/15 blur-2xl"></div>
        <div class="absolute bottom-1/4 right-1/4 w-56 h-56 rounded-full bg-safety-red/20 blur-3xl"></div>
        <div class="absolute bottom-1/3 left-1/3 w-40 h-40 rounded-full bg-safety-purple/15 blur-2xl"></div>
        <!-- Grid of zone circles -->
        <div class="absolute inset-0 grid grid-cols-8 grid-rows-6 gap-2 p-8 opacity-30">
          <div v-for="i in 48" :key="i"
            class="rounded-xl"
            :class="[
              i % 7 === 0 ? 'bg-safety-purple' :
              i % 5 === 0 ? 'bg-safety-red' :
              i % 3 === 0 ? 'bg-safety-yellow' :
              'bg-safety-green'
            ]"
          ></div>
        </div>
        <div class="absolute inset-0 bg-brand-navy/60"></div>
      </div>

      <!-- Hero content -->
      <div class="relative z-10 text-center px-4 max-w-3xl mx-auto">
        <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white/80 text-sm mb-8 backdrop-blur-sm">
          <span class="w-2 h-2 rounded-full bg-safety-green animate-pulse"></span>
          Progetto in sviluppo attivo
        </div>

        <h1 class="font-display text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 leading-tight">
          Muoviti in città<br />con più
          <span class="text-brand-cyan"> sicurezza</span>
        </h1>

        <p class="text-lg md:text-xl text-slate-300 max-w-xl mx-auto mb-10">
          Zone colorate, tracking live, SOS immediato. SafeRoute ti tiene al sicuro quando ti muovi da solo.
        </p>

        <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            @click="router.push('/register')"
            class="w-full sm:w-auto px-8 py-4 rounded-xl bg-brand-blue text-white font-semibold text-lg hover:bg-blue-700 hover:-translate-y-0.5 transition-all duration-150 cursor-pointer shadow-lg"
          >
            Inizia gratis
          </button>
          <button
            @click="router.push('/login')"
            class="w-full sm:w-auto px-8 py-4 rounded-xl border border-white/40 text-white font-semibold text-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            Accedi
          </button>
        </div>

        <p class="text-xs text-slate-400 mt-4">
          SafeRoute fornisce dati orientativi basati sulla community. Non sostituisce i servizi di emergenza. In caso di pericolo, chiama il 112.
        </p>

        <!-- Stats bar -->
        <div class="mt-16 flex flex-wrap items-center justify-center gap-8 text-sm text-slate-400">
          <span>342 zone monitorate</span>
          <span class="hidden sm:inline text-slate-600">·</span>
          <span>Sicuro e gratuito</span>
          <span class="hidden sm:inline text-slate-600">·</span>
          <span>Open community</span>
        </div>
      </div>
    </section>

    <!-- Feature Cards -->
    <section class="py-20 px-4">
      <div class="max-w-6xl mx-auto">
        <div class="text-center mb-12">
          <h2 class="font-display text-3xl md:text-4xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
            Tutto quello che ti serve
          </h2>
          <p class="text-text-secondary dark:text-text-dark-secondary text-lg max-w-xl mx-auto">
            Strumenti semplici per spostamenti più sicuri
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div
            v-for="feature in features"
            :key="feature.title"
            :class="['p-6 rounded-2xl shadow-md border-l-4 bg-surface-elevated dark:bg-surface-dark-elevated', feature.borderColor]"
          >
            <div :class="['inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4', feature.bg]">
              <component :is="feature.icon" :size="24" :class="feature.color" />
            </div>
            <h3 class="font-semibold text-lg text-text-primary dark:text-text-dark-primary mb-2">
              {{ feature.title }}
            </h3>
            <p class="text-text-secondary dark:text-text-dark-secondary text-sm leading-relaxed">
              {{ feature.description }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Come funziona -->
    <section class="py-20 px-4 bg-surface-elevated dark:bg-surface-dark-elevated border-y border-border-light dark:border-border-dark">
      <div class="max-w-6xl mx-auto">
        <div class="text-center mb-12">
          <h2 class="font-display text-3xl md:text-4xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
            Come funziona
          </h2>
          <p class="text-text-secondary dark:text-text-dark-secondary text-lg max-w-xl mx-auto">
            Quattro passi per muoverti in modo piu sicuro
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div class="flex flex-col items-start gap-4 p-6 rounded-2xl bg-surface-base dark:bg-surface-dark border border-border-light dark:border-border-dark">
            <div class="flex items-center justify-center w-10 h-10 rounded-full bg-brand-blue text-white font-display font-bold text-lg shrink-0">
              1
            </div>
            <div>
              <h3 class="font-semibold text-text-primary dark:text-text-dark-primary mb-2">Configura i contatti di emergenza</h3>
              <p class="text-text-secondary dark:text-text-dark-secondary text-sm leading-relaxed">
                Aggiungi nome, telefono o email di chi ti deve raggiungere in caso di bisogno.
              </p>
            </div>
          </div>

          <div class="flex flex-col items-start gap-4 p-6 rounded-2xl bg-surface-base dark:bg-surface-dark border border-border-light dark:border-border-dark">
            <div class="flex items-center justify-center w-10 h-10 rounded-full bg-brand-blue text-white font-display font-bold text-lg shrink-0">
              2
            </div>
            <div>
              <h3 class="font-semibold text-text-primary dark:text-text-dark-primary mb-2">Avvia un percorso</h3>
              <p class="text-text-secondary dark:text-text-dark-secondary text-sm leading-relaxed">
                Seleziona la destinazione e parti. SafeRoute inizia a tracciare il tuo cammino.
              </p>
            </div>
          </div>

          <div class="flex flex-col items-start gap-4 p-6 rounded-2xl bg-surface-base dark:bg-surface-dark border border-border-light dark:border-border-dark">
            <div class="flex items-center justify-center w-10 h-10 rounded-full bg-brand-blue text-white font-display font-bold text-lg shrink-0">
              3
            </div>
            <div>
              <h3 class="font-semibold text-text-primary dark:text-text-dark-primary mb-2">Condividi il tracking</h3>
              <p class="text-text-secondary dark:text-text-dark-secondary text-sm leading-relaxed">
                Invia il link di tracking ai tuoi contatti. Lo aprono sul browser, senza app.
              </p>
            </div>
          </div>

          <div class="flex flex-col items-start gap-4 p-6 rounded-2xl bg-surface-base dark:bg-surface-dark border border-border-light dark:border-border-dark">
            <div class="flex items-center justify-center w-10 h-10 rounded-full bg-safety-red text-white font-display font-bold text-lg shrink-0">
              4
            </div>
            <div>
              <h3 class="font-semibold text-text-primary dark:text-text-dark-primary mb-2">SOS in emergenza</h3>
              <p class="text-text-secondary dark:text-text-dark-secondary text-sm leading-relaxed">
                Premi il tasto SOS. I tuoi contatti ricevono la tua posizione e il link di tracking in pochi secondi.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Social proof / honest messaging -->
    <section class="py-16 px-4 bg-surface-base dark:bg-surface-dark border-y border-border-light dark:border-border-dark">
      <div class="max-w-3xl mx-auto text-center">
        <h2 class="font-display text-2xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
          Un progetto reale, pensato per te
        </h2>
        <p class="text-text-secondary dark:text-text-dark-secondary mb-8">
          SafeRoute non promette sicurezza assoluta. Offre dati orientativi, feedback reali e strumenti rapidi di emergenza.
          Le zone si colorano con l'uso: più la community cresce, più i dati diventano precisi.
        </p>
        <button
          @click="router.push('/register')"
          class="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-blue text-white font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
        >
          Unisciti alla community
          <ChevronRight :size="18" />
        </button>
      </div>
    </section>

    <!-- Footer -->
    <footer class="py-10 px-4 border-t border-border-light dark:border-border-dark">
      <div class="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
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
