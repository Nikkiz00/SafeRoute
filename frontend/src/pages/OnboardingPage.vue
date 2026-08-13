<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { MapPin, Users, AlertTriangle, CheckCircle, ArrowLeft, ArrowRight, Shield, Loader2 } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useContactsStore } from '@/stores/contacts'

const router = useRouter()
const auth = useAuthStore()
const contactsStore = useContactsStore()

const currentStep = ref(1)
const totalSteps = 6
const direction = ref<'forward' | 'back'>('forward')
const geoStatus = ref<'idle' | 'checking' | 'granted' | 'denied' | 'unsupported'>('idle')

const contactForm = ref({ name: '', phone: '', email: '', notifyContact: true })

function nextStep() {
  if (currentStep.value < totalSteps) {
    direction.value = 'forward'
    currentStep.value++
  }
}

function prevStep() {
  if (currentStep.value > 1) {
    direction.value = 'back'
    currentStep.value--
  }
}

function doGetPosition() {
  navigator.geolocation.getCurrentPosition(
    () => {
      geoStatus.value = 'granted'
      setTimeout(nextStep, 800)
    },
    () => {
      geoStatus.value = 'denied'
    },
  )
}

async function checkGeoPermission() {
  if (!navigator.geolocation) {
    geoStatus.value = 'unsupported'
    return
  }

  if (!navigator.permissions) {
    // fallback: show button normally
    geoStatus.value = 'idle'
    return
  }

  geoStatus.value = 'checking'
  try {
    const result = await navigator.permissions.query({ name: 'geolocation' })
    if (result.state === 'granted') {
      geoStatus.value = 'granted'
      doGetPosition()
    } else if (result.state === 'denied') {
      geoStatus.value = 'denied'
    } else {
      // 'prompt' — show button
      geoStatus.value = 'idle'
    }
  } catch {
    geoStatus.value = 'idle'
  }
}

function requestGeo() {
  if (!navigator.geolocation) {
    geoStatus.value = 'unsupported'
    return
  }
  doGetPosition()
}

function skipGeo() {
  nextStep()
}

async function saveContact() {
  if (contactForm.value.name) {
    await contactsStore.add({
      name: contactForm.value.name,
      phone: contactForm.value.phone || null,
      email: contactForm.value.email || null,
      isPrimary: contactsStore.contacts.length === 0,
      notifiedOnAdd: contactForm.value.notifyContact,
    })
  }
  nextStep()
}

async function finish() {
  await auth.completeOnboarding()
  router.push('/map')
}

watch(currentStep, (step) => {
  if (step === 3) {
    checkGeoPermission()
  }
})

const transitionName = computed(() =>
  direction.value === 'forward' ? 'step-forward' : 'step-back',
)
</script>

<template>
  <div class="min-h-screen bg-surface-base dark:bg-surface-dark flex flex-col">
    <!-- Progress bar + back button -->
    <div class="flex items-center gap-4 p-4 sticky top-0 bg-surface-base dark:bg-surface-dark z-10">
      <button
        v-if="currentStep > 1"
        @click="prevStep"
        class="p-3 rounded-xl text-text-secondary dark:text-text-dark-secondary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        aria-label="Torna al passo precedente"
      >
        <ArrowLeft :size="20" />
      </button>
      <div v-else class="w-[46px]"></div>

      <!-- Step dots -->
      <div class="flex-1 flex items-center gap-2" role="progressbar" :aria-valuenow="currentStep" :aria-valuemax="totalSteps">
        <div
          v-for="i in totalSteps"
          :key="i"
          :class="[
            'h-2 rounded-full transition-all duration-300',
            i === currentStep ? 'bg-brand-blue w-8' :
            i < currentStep ? 'bg-brand-blue/40 flex-1' :
            'bg-border-light dark:bg-border-dark flex-1'
          ]"
        ></div>
      </div>

      <span class="text-sm text-text-secondary dark:text-text-dark-secondary w-10 text-right">
        {{ currentStep }}/{{ totalSteps }}
      </span>
    </div>

    <!-- Step content -->
    <div class="flex-1 flex flex-col overflow-x-hidden">
      <Transition :name="transitionName" mode="out-in">
        <!-- Step 1: Welcome -->
        <div v-if="currentStep === 1" key="step1" class="flex-1 flex flex-col items-center justify-center px-8 py-12 text-center">
          <!-- Shield illustration -->
          <div class="w-32 h-32 mb-8 relative">
            <div class="w-full h-full rounded-full bg-brand-blue/10 flex items-center justify-center">
              <div class="w-20 h-20 rounded-full bg-brand-blue/20 flex items-center justify-center">
                <Shield :size="48" class="text-brand-blue" />
              </div>
            </div>
            <div class="absolute inset-0 rounded-full border-2 border-brand-blue/30 animate-ping"></div>
          </div>

          <h1 class="font-display text-3xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
            Benvenuto su SafeRoute
          </h1>
          <p class="text-text-secondary dark:text-text-dark-secondary text-lg max-w-sm">
            Scopri le zone sicure della tua città, imposta i tuoi contatti di emergenza e muoviti con più serenità.
          </p>

          <button
            @click="nextStep"
            class="mt-10 flex items-center gap-2 px-8 py-4 rounded-xl bg-brand-blue text-white font-semibold text-lg hover:bg-blue-700 transition-colors cursor-pointer"
          >
            Inizia
            <ArrowRight :size="20" />
          </button>
        </div>

        <!-- Step 2: Mappa e zone -->
        <div v-else-if="currentStep === 2" key="step2" class="flex-1 flex flex-col items-center justify-center px-8 py-12 text-center">
          <!-- Zone grid illustration -->
          <div class="w-24 h-24 mb-8 grid grid-cols-2 gap-2 p-3 rounded-2xl bg-surface-elevated dark:bg-surface-dark-elevated shadow-sm border border-border-light dark:border-border-dark">
            <div class="rounded-full bg-[#22C55E]"></div>
            <div class="rounded-full bg-[#FACC15]"></div>
            <div class="rounded-full bg-[#EF4444]"></div>
            <div class="rounded-full bg-[#8B5CF6]"></div>
          </div>

          <h2 class="font-display text-3xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
            Capire la mappa
          </h2>
          <p class="text-text-secondary dark:text-text-dark-secondary text-lg max-w-sm mb-8">
            Le zone si colorano in base ai dati della community
          </p>

          <!-- Zone pills: 2x2 on mobile, 4 columns on desktop -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-md mb-6">
            <!-- Sicuro -->
            <div class="flex flex-col items-start gap-1.5 px-3 py-2 rounded-xl bg-surface-elevated dark:bg-surface-dark-elevated border border-border-light dark:border-border-dark">
              <div class="flex items-center gap-2">
                <div class="rounded-full w-3 h-3 shrink-0 bg-[#22C55E]"></div>
                <span class="text-xs font-bold text-text-primary dark:text-text-dark-primary">Sicuro</span>
              </div>
              <span class="text-[10px] text-text-secondary dark:text-text-dark-secondary leading-tight">Score 80–100</span>
            </div>
            <!-- Attenzione -->
            <div class="flex flex-col items-start gap-1.5 px-3 py-2 rounded-xl bg-surface-elevated dark:bg-surface-dark-elevated border border-border-light dark:border-border-dark">
              <div class="flex items-center gap-2">
                <div class="rounded-full w-3 h-3 shrink-0 bg-[#FACC15]"></div>
                <span class="text-xs font-bold text-text-primary dark:text-text-dark-primary">Attenzione</span>
              </div>
              <span class="text-[10px] text-text-secondary dark:text-text-dark-secondary leading-tight">Score 60–79</span>
            </div>
            <!-- Pericoloso -->
            <div class="flex flex-col items-start gap-1.5 px-3 py-2 rounded-xl bg-surface-elevated dark:bg-surface-dark-elevated border border-border-light dark:border-border-dark">
              <div class="flex items-center gap-2">
                <div class="rounded-full w-3 h-3 shrink-0 bg-[#EF4444]"></div>
                <span class="text-xs font-bold text-text-primary dark:text-text-dark-primary">Pericoloso</span>
              </div>
              <span class="text-[10px] text-text-secondary dark:text-text-dark-secondary leading-tight">Score 35–59</span>
            </div>
            <!-- Critico -->
            <div class="flex flex-col items-start gap-1.5 px-3 py-2 rounded-xl bg-surface-elevated dark:bg-surface-dark-elevated border border-border-light dark:border-border-dark">
              <div class="flex items-center gap-2">
                <div class="rounded-full w-3 h-3 shrink-0 bg-[#8B5CF6]"></div>
                <span class="text-xs font-bold text-text-primary dark:text-text-dark-primary">Critico</span>
              </div>
              <span class="text-[10px] text-text-secondary dark:text-text-dark-secondary leading-tight">Score 0–34</span>
            </div>
          </div>

          <p class="text-xs text-text-secondary dark:text-text-dark-secondary mb-8">
            Zona grigia = nessun dato ancora disponibile
          </p>

          <button
            @click="nextStep"
            class="flex items-center gap-2 px-8 py-4 rounded-xl bg-brand-blue text-white font-semibold text-lg hover:bg-blue-700 transition-colors cursor-pointer"
          >
            Ho capito
            <ArrowRight :size="20" />
          </button>
        </div>

        <!-- Step 3: Geolocation -->
        <div v-else-if="currentStep === 3" key="step3" class="flex-1 flex flex-col items-center justify-center px-8 py-12 text-center">
          <div class="w-24 h-24 mb-8 flex items-center justify-center rounded-full bg-brand-blue/10">
            <MapPin :size="48" class="text-brand-blue" />
          </div>

          <h2 class="font-display text-3xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
            Dove ti trovi?
          </h2>
          <p class="text-text-secondary dark:text-text-dark-secondary text-lg max-w-sm mb-8">
            Consenti la posizione per vedere le zone di sicurezza intorno a te.
          </p>

          <!-- Checking spinner -->
          <div
            v-if="geoStatus === 'checking'"
            class="w-full max-w-sm mb-6 flex items-center justify-center gap-3"
          >
            <Loader2 :size="20" class="text-brand-blue animate-spin" />
            <p class="text-sm text-text-secondary dark:text-text-dark-secondary">Verifica permessi...</p>
          </div>

          <!-- Not supported banner -->
          <div
            v-if="geoStatus === 'unsupported'"
            class="w-full max-w-sm mb-6 p-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-border-light dark:border-border-dark text-left"
          >
            <p class="text-sm text-text-secondary dark:text-text-dark-secondary">
              Il tuo browser non supporta la geolocalizzazione. Puoi continuare senza.
            </p>
          </div>

          <!-- Geo denied banner -->
          <div
            v-if="geoStatus === 'denied'"
            class="w-full max-w-sm mb-6 p-4 rounded-xl bg-safety-yellow/10 border border-safety-yellow/30 text-left"
          >
            <p class="text-sm text-amber-800 dark:text-amber-300">
              Posizione negata — attivala dalle impostazioni del browser.
            </p>
          </div>

          <!-- Geo granted -->
          <div
            v-if="geoStatus === 'granted'"
            class="w-full max-w-sm mb-6 p-4 rounded-xl bg-safety-green/10 border border-safety-green/30 flex items-center gap-3"
          >
            <CheckCircle :size="20" class="text-safety-green shrink-0" />
            <p class="text-sm text-green-700 dark:text-green-400 font-medium">Posizione attivata!</p>
          </div>

          <div class="flex flex-col items-center gap-4 w-full max-w-sm">
            <button
              v-if="geoStatus === 'idle' || geoStatus === 'denied' || geoStatus === 'unsupported'"
              @click="requestGeo"
              :disabled="geoStatus === 'denied' || geoStatus === 'unsupported'"
              class="w-full py-4 rounded-xl bg-brand-blue text-white font-semibold text-base hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Consenti posizione
            </button>
            <button
              v-if="geoStatus !== 'granted' && geoStatus !== 'checking'"
              @click="skipGeo"
              class="text-sm text-text-secondary dark:text-text-dark-secondary hover:text-text-primary dark:hover:text-text-dark-primary transition-colors cursor-pointer"
            >
              Continua senza posizione
            </button>
          </div>
        </div>

        <!-- Step 4: Emergency contact (scrollable on small screens) -->
        <div v-else-if="currentStep === 4" key="step4" class="flex-1 overflow-y-auto">
          <div class="min-h-full flex flex-col items-center justify-center px-8 py-8">
          <div class="w-24 h-24 mb-8 flex items-center justify-center rounded-full bg-safety-green/10 mx-auto">
            <Users :size="48" class="text-safety-green" />
          </div>

          <h2 class="font-display text-3xl font-bold text-text-primary dark:text-text-dark-primary mb-2 text-center">
            Chi ti aspetta a casa?
          </h2>
          <p class="text-text-secondary dark:text-text-dark-secondary text-center mb-2">
            Aggiungi un contatto di emergenza
          </p>
          <p class="text-xs text-text-secondary dark:text-text-dark-secondary text-center mb-8">
            Potrai aggiungere fino a 2 contatti con il piano gratuito.
          </p>

          <div class="w-full max-w-sm space-y-4">
            <div>
              <label for="contact-name" class="block text-sm font-medium text-text-primary dark:text-text-dark-primary mb-1.5">
                Nome <span class="text-safety-red">*</span>
              </label>
              <input
                id="contact-name"
                v-model="contactForm.name"
                type="text"
                placeholder="Nome del contatto"
                class="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-surface-elevated dark:bg-surface-dark-elevated text-text-primary dark:text-text-dark-primary text-sm focus:border-brand-blue focus:shadow-[0_0_0_3px_rgba(37,99,235,0.2)] transition-all"
              />
            </div>
            <div>
              <label for="contact-phone" class="block text-sm font-medium text-text-primary dark:text-text-dark-primary mb-1.5">Telefono <span class="text-text-secondary dark:text-text-dark-secondary font-normal">(opzionale)</span></label>
              <input
                id="contact-phone"
                v-model="contactForm.phone"
                type="tel"
                placeholder="+39 333 1234567"
                class="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-surface-elevated dark:bg-surface-dark-elevated text-text-primary dark:text-text-dark-primary text-sm focus:border-brand-blue focus:shadow-[0_0_0_3px_rgba(37,99,235,0.2)] transition-all"
              />
            </div>
            <div>
              <label for="contact-email" class="block text-sm font-medium text-text-primary dark:text-text-dark-primary mb-1.5">Email <span class="text-text-secondary dark:text-text-dark-secondary font-normal">(opzionale)</span></label>
              <input
                id="contact-email"
                v-model="contactForm.email"
                type="email"
                placeholder="mario@esempio.it"
                class="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-surface-elevated dark:bg-surface-dark-elevated text-text-primary dark:text-text-dark-primary text-sm focus:border-brand-blue focus:shadow-[0_0_0_3px_rgba(37,99,235,0.2)] transition-all"
              />
            </div>
            <label class="flex items-center gap-3 cursor-pointer">
              <input
                v-model="contactForm.notifyContact"
                type="checkbox"
                class="w-4 h-4 rounded border-border-light accent-brand-blue"
              />
              <span class="text-sm text-text-secondary dark:text-text-dark-secondary">
                Avvisa questo contatto che lo stai aggiungendo
              </span>
            </label>

            <!-- Info note -->
            <p class="text-xs text-text-secondary dark:text-text-dark-secondary leading-relaxed px-1">
              Il contatto ricevera una notifica SOS in caso di emergenza. Se il servizio SMS non e attivo, verra usata l'email.
            </p>

            <div class="flex flex-col gap-3 pt-2">
              <button
                @click="saveContact"
                class="w-full py-3 rounded-xl bg-brand-blue text-white font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Salva contatto
              </button>
              <button
                @click="nextStep"
                class="text-sm text-text-secondary dark:text-text-dark-secondary hover:text-text-primary dark:hover:text-text-dark-primary transition-colors cursor-pointer text-center"
              >
                Aggiungi dopo
              </button>
            </div>
          </div>
          </div>
        </div>

        <!-- Step 5: SOS explanation -->
        <div v-else-if="currentStep === 5" key="step5" class="flex-1 flex flex-col items-center justify-center px-8 py-12 text-center">
          <!-- Animated SOS button demo -->
          <div class="relative mb-8">
            <div class="w-24 h-24 rounded-full bg-sos-red flex items-center justify-center shadow-sos animate-pulse-sos">
              <AlertTriangle :size="36" class="text-white" />
            </div>
          </div>

          <h2 class="font-display text-3xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
            Il tasto SOS
          </h2>
          <p class="text-text-secondary dark:text-text-dark-secondary text-lg max-w-sm mb-4">
            Tieni premuto il pulsante rosso per <strong>1,5 secondi</strong>. I tuoi contatti riceveranno la tua posizione immediatamente.
          </p>
          <p class="text-sm text-text-secondary dark:text-text-dark-secondary max-w-sm mb-10 p-4 bg-slate-100 dark:bg-slate-800 rounded-xl">
            Hai 5 secondi per annullare dopo l'attivazione.
          </p>

          <button
            @click="nextStep"
            class="flex items-center gap-2 px-8 py-4 rounded-xl bg-brand-blue text-white font-semibold text-lg hover:bg-blue-700 transition-colors cursor-pointer"
          >
            Capito!
            <ArrowRight :size="20" />
          </button>
        </div>

        <!-- Step 6: Ready -->
        <div v-else-if="currentStep === 6" key="step6" class="flex-1 flex flex-col items-center justify-center px-8 py-12 text-center">
          <div class="w-32 h-32 mb-8 flex items-center justify-center rounded-full bg-safety-green/10">
            <CheckCircle :size="64" class="text-safety-green" />
          </div>

          <h2 class="font-display text-4xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
            Sei pronto!
          </h2>
          <p class="text-text-secondary dark:text-text-dark-secondary text-lg max-w-sm mb-10">
            Esplora la mappa, segnala le zone, resta al sicuro.
          </p>

          <button
            @click="finish"
            class="flex items-center gap-2 px-10 py-4 rounded-xl bg-brand-blue text-white font-semibold text-xl hover:bg-blue-700 transition-colors cursor-pointer shadow-lg"
          >
            Apri la mappa
            <ArrowRight :size="22" />
          </button>
        </div>
      </Transition>
    </div>
  </div>
</template>
