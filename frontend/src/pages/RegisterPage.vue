<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { Shield, Eye, EyeOff, Mail } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import ThemeToggle from '@/components/common/ThemeToggle.vue'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
})

const showPassword = ref(false)
const showConfirmPassword = ref(false)
const isLoading = ref(false)
const shakeKey = ref(0)
const errorMessage = ref('')
const registrationSuccess = ref(false)

const errors = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
})

// Password strength
const passwordStrength = computed(() => {
  const pwd = form.password
  if (!pwd) return 0
  let score = 0
  if (pwd.length >= 10) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^a-zA-Z0-9]/.test(pwd)) score++
  return score
})

const strengthLabel = computed(() => {
  const labels = ['', 'Debole', 'Media', 'Forte']
  return labels[passwordStrength.value]
})

const strengthColor = computed(() => {
  const colors = ['', 'bg-safety-red', 'bg-safety-yellow', 'bg-safety-green']
  return colors[passwordStrength.value]
})

const strengthTextColor = computed(() => {
  const colors = ['', 'text-safety-red', 'text-yellow-600 dark:text-yellow-400', 'text-safety-green']
  return colors[passwordStrength.value]
})

function validateField(field: keyof typeof errors) {
  errors[field] = ''
  switch (field) {
    case 'name':
      if (!form.name || form.name.length < 2) errors.name = 'Nome minimo 2 caratteri'
      break
    case 'email':
      if (!form.email) {
        errors.email = 'Email obbligatoria'
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        errors.email = 'Email non valida'
      }
      break
    case 'password':
      if (!form.password || form.password.length < 10) errors.password = 'La password deve contenere almeno 10 caratteri'
      else if (!/[0-9]/.test(form.password)) errors.password = 'Almeno un numero richiesto'
      break
    case 'confirmPassword':
      if (form.confirmPassword !== form.password) errors.confirmPassword = 'Le password non coincidono'
      break
  }
}

const isFormValid = computed(() => {
  return (
    form.name.length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) &&
    form.password.length >= 10 &&
    /[0-9]/.test(form.password) &&
    form.confirmPassword === form.password
  )
})

async function handleSubmit() {
  // Validate all fields
  ;(['name', 'email', 'password', 'confirmPassword'] as const).forEach(validateField)

  if (!isFormValid.value) {
    shakeKey.value++
    return
  }

  errorMessage.value = ''
  isLoading.value = true
  try {
    await auth.register(form.name, form.email, form.password)
    registrationSuccess.value = true
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Errore durante la registrazione'
    shakeKey.value++
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-surface-base dark:bg-surface-dark flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between p-4">
      <button @click="router.push('/')" class="flex items-center gap-2 cursor-pointer">
        <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-blue">
          <Shield :size="16" class="text-white" />
        </div>
        <span class="font-display font-bold text-text-primary dark:text-text-dark-primary">SafeRoute</span>
      </button>
      <ThemeToggle />
    </div>

    <!-- Post-registrazione: schermata verifica email -->
    <div v-if="registrationSuccess" class="flex-1 flex items-center justify-center px-4 py-8">
      <div class="w-full max-w-md text-center">
        <div class="w-20 h-20 mx-auto mb-6 rounded-full bg-brand-blue/10 flex items-center justify-center">
          <Mail :size="40" class="text-brand-blue" />
        </div>
        <h2 class="font-display text-2xl font-bold text-text-primary dark:text-text-dark-primary mb-3">
          Controlla la tua email
        </h2>
        <p class="text-text-secondary dark:text-text-dark-secondary mb-2">
          Abbiamo inviato un link di verifica a
        </p>
        <p class="font-semibold text-text-primary dark:text-text-dark-primary mb-6">{{ form.email }}</p>
        <p class="text-sm text-text-secondary dark:text-text-dark-secondary mb-8">
          Clicca il link nell'email per attivare il tuo account. Controlla anche la cartella spam.
        </p>
        <button @click="router.push('/onboarding')" class="w-full py-3 rounded-xl bg-brand-blue text-white font-semibold mb-3 cursor-pointer hover:bg-blue-700 transition-colors">
          Continua senza verificare
        </button>
        <p class="text-xs text-text-secondary dark:text-text-dark-secondary">
          Puoi verificare l'email in qualsiasi momento dalle impostazioni profilo
        </p>
      </div>
    </div>

    <!-- Form -->
    <div v-else class="flex-1 flex items-center justify-center px-4 py-8">
      <div class="w-full max-w-md">
        <div class="bg-surface-elevated dark:bg-surface-dark-elevated rounded-2xl shadow-lg p-8">
          <h1 class="font-display text-2xl font-bold text-text-primary dark:text-text-dark-primary mb-2">
            Crea il tuo account
          </h1>
          <p class="text-text-secondary dark:text-text-dark-secondary text-sm mb-8">
            Hai già un account?
            <button @click="router.push('/login')" class="text-brand-blue hover:underline cursor-pointer">Accedi</button>
          </p>

          <!-- Error message -->
          <div
            v-if="errorMessage"
            class="mb-4 p-3 rounded-xl bg-safety-red/10 border border-safety-red/20 text-safety-red text-sm"
            role="alert"
          >
            {{ errorMessage }}
          </div>

          <form
            @submit.prevent="handleSubmit"
            :key="shakeKey"
            :class="errorMessage ? 'animate-shake' : ''"
            novalidate
          >
            <!-- Name -->
            <div class="mb-4">
              <label for="reg-name" class="block text-sm font-medium text-text-primary dark:text-text-dark-primary mb-1.5">
                Nome completo
              </label>
              <input
                id="reg-name"
                v-model="form.name"
                type="text"
                autocomplete="name"
                placeholder="Mario Rossi"
                @blur="validateField('name')"
                :class="[
                  'w-full px-4 py-3 rounded-xl border bg-surface-base dark:bg-surface-dark text-text-primary dark:text-text-dark-primary placeholder:text-text-secondary dark:placeholder:text-text-dark-secondary text-sm transition-all',
                  errors.name
                    ? 'border-safety-red focus:shadow-[0_0_0_3px_rgba(239,68,68,0.2)]'
                    : 'border-border-light dark:border-border-dark focus:border-brand-blue focus:shadow-[0_0_0_3px_rgba(37,99,235,0.2)]'
                ]"
              />
              <p v-if="errors.name" class="mt-1.5 text-xs text-safety-red">{{ errors.name }}</p>
            </div>

            <!-- Email -->
            <div class="mb-4">
              <label for="reg-email" class="block text-sm font-medium text-text-primary dark:text-text-dark-primary mb-1.5">
                Email
              </label>
              <input
                id="reg-email"
                v-model="form.email"
                type="email"
                autocomplete="email"
                placeholder="tu@esempio.com"
                @blur="validateField('email')"
                :class="[
                  'w-full px-4 py-3 rounded-xl border bg-surface-base dark:bg-surface-dark text-text-primary dark:text-text-dark-primary placeholder:text-text-secondary dark:placeholder:text-text-dark-secondary text-sm transition-all',
                  errors.email
                    ? 'border-safety-red focus:shadow-[0_0_0_3px_rgba(239,68,68,0.2)]'
                    : 'border-border-light dark:border-border-dark focus:border-brand-blue focus:shadow-[0_0_0_3px_rgba(37,99,235,0.2)]'
                ]"
              />
              <p v-if="errors.email" class="mt-1.5 text-xs text-safety-red">{{ errors.email }}</p>
            </div>

            <!-- Password -->
            <div class="mb-4">
              <label for="reg-password" class="block text-sm font-medium text-text-primary dark:text-text-dark-primary mb-1.5">
                Password
              </label>
              <div class="relative">
                <input
                  id="reg-password"
                  v-model="form.password"
                  :type="showPassword ? 'text' : 'password'"
                  autocomplete="new-password"
                  placeholder="Minimo 10 caratteri"
                  @blur="validateField('password')"
                  :class="[
                    'w-full px-4 py-3 pr-12 rounded-xl border bg-surface-base dark:bg-surface-dark text-text-primary dark:text-text-dark-primary placeholder:text-text-secondary dark:placeholder:text-text-dark-secondary text-sm transition-all',
                    errors.password
                      ? 'border-safety-red focus:shadow-[0_0_0_3px_rgba(239,68,68,0.2)]'
                      : 'border-border-light dark:border-border-dark focus:border-brand-blue focus:shadow-[0_0_0_3px_rgba(37,99,235,0.2)]'
                  ]"
                />
                <button
                  type="button"
                  @click="showPassword = !showPassword"
                  class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-secondary dark:text-text-dark-secondary cursor-pointer"
                  :aria-label="showPassword ? 'Nascondi password' : 'Mostra password'"
                >
                  <EyeOff v-if="showPassword" :size="18" />
                  <Eye v-else :size="18" />
                </button>
              </div>

              <!-- Password strength indicator -->
              <div v-if="form.password" class="mt-2">
                <div class="flex gap-1 mb-1">
                  <div
                    v-for="i in 3"
                    :key="i"
                    :class="[
                      'h-1.5 flex-1 rounded-full transition-all',
                      i <= passwordStrength ? strengthColor : 'bg-slate-200 dark:bg-slate-700'
                    ]"
                  ></div>
                </div>
                <p :class="['text-xs font-medium', strengthTextColor]">{{ strengthLabel }}</p>
              </div>
              <p v-if="errors.password" class="mt-1.5 text-xs text-safety-red">{{ errors.password }}</p>
            </div>

            <!-- Confirm password -->
            <div class="mb-6">
              <label for="reg-confirm" class="block text-sm font-medium text-text-primary dark:text-text-dark-primary mb-1.5">
                Conferma password
              </label>
              <div class="relative">
                <input
                  id="reg-confirm"
                  v-model="form.confirmPassword"
                  :type="showConfirmPassword ? 'text' : 'password'"
                  autocomplete="new-password"
                  placeholder="Ripeti la password"
                  @blur="validateField('confirmPassword')"
                  :class="[
                    'w-full px-4 py-3 pr-12 rounded-xl border bg-surface-base dark:bg-surface-dark text-text-primary dark:text-text-dark-primary placeholder:text-text-secondary dark:placeholder:text-text-dark-secondary text-sm transition-all',
                    errors.confirmPassword
                      ? 'border-safety-red focus:shadow-[0_0_0_3px_rgba(239,68,68,0.2)]'
                      : 'border-border-light dark:border-border-dark focus:border-brand-blue focus:shadow-[0_0_0_3px_rgba(37,99,235,0.2)]'
                  ]"
                />
                <button
                  type="button"
                  @click="showConfirmPassword = !showConfirmPassword"
                  class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-secondary dark:text-text-dark-secondary cursor-pointer"
                  :aria-label="showConfirmPassword ? 'Nascondi password' : 'Mostra password'"
                >
                  <EyeOff v-if="showConfirmPassword" :size="18" />
                  <Eye v-else :size="18" />
                </button>
              </div>
              <p v-if="errors.confirmPassword" class="mt-1.5 text-xs text-safety-red">{{ errors.confirmPassword }}</p>
            </div>

            <!-- Submit -->
            <p class="text-xs text-text-secondary dark:text-text-dark-secondary text-center mt-2 mb-3">
              Registrandoti accetti i
              <RouterLink to="/terms" class="underline hover:text-text-primary dark:hover:text-text-dark-primary">Termini di utilizzo</RouterLink>
              e la
              <RouterLink to="/privacy" class="underline hover:text-text-primary dark:hover:text-text-dark-primary">Privacy Policy</RouterLink>.
            </p>
            <button
              type="submit"
              :disabled="isLoading || !isFormValid"
              class="w-full py-3 rounded-xl bg-brand-blue text-white font-semibold text-base hover:bg-blue-700 hover:-translate-y-px transition-all duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
            >
              <span v-if="isLoading" class="inline-flex items-center gap-2">
                <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Creazione account...
              </span>
              <span v-else>Crea account</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
