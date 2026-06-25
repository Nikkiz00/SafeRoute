<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { Shield, Eye, EyeOff } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import ThemeToggle from '@/components/common/ThemeToggle.vue'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({
  email: '',
  password: '',
})

const showPassword = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')
const shakeKey = ref(0)

const errors = reactive({
  email: '',
  password: '',
})

function validate(): boolean {
  errors.email = ''
  errors.password = ''
  let valid = true

  if (!form.email) {
    errors.email = 'Email obbligatoria'
    valid = false
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Email non valida'
    valid = false
  }

  if (!form.password) {
    errors.password = 'Password obbligatoria'
    valid = false
  }

  return valid
}

async function handleSubmit() {
  errorMessage.value = ''
  if (!validate()) {
    shakeKey.value++
    return
  }

  isLoading.value = true
  try {
    await auth.login(form.email, form.password)
    if (!auth.hasCompletedOnboarding) {
      router.push('/onboarding')
    } else {
      router.push('/map')
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('non raggiungibile')) {
      errorMessage.value = err.message
    } else {
      errorMessage.value = 'Credenziali non valide. Riprova.'
    }
    shakeKey.value++
  } finally {
    isLoading.value = false
  }
}

function loginAsDemo() {
  auth.loginAsMockUser()
  router.push('/map')
}

function loginAsAdmin() {
  auth.loginAsMockAdmin()
  router.push('/map')
}

const isDev = import.meta.env.DEV
</script>

<template>
  <div class="min-h-screen bg-surface-base dark:bg-surface-dark flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between p-4">
      <button
        @click="router.push('/')"
        class="flex items-center gap-2 cursor-pointer"
      >
        <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-blue">
          <Shield :size="16" class="text-white" />
        </div>
        <span class="font-display font-bold text-text-primary dark:text-text-dark-primary">SafeRoute</span>
      </button>
      <ThemeToggle />
    </div>

    <!-- Centered form -->
    <div class="flex-1 flex items-center justify-center px-4 py-8">
      <div class="w-full max-w-md">
        <div class="bg-surface-elevated dark:bg-surface-dark-elevated rounded-2xl shadow-lg p-8">
          <!-- Title -->
          <h1 class="font-display text-2xl font-bold text-text-primary dark:text-text-dark-primary mb-2">
            Accedi al tuo account
          </h1>
          <p class="text-text-secondary dark:text-text-dark-secondary text-sm mb-8">
            Non hai un account?
            <button @click="router.push('/register')" class="text-brand-blue hover:underline cursor-pointer">Registrati</button>
          </p>

          <!-- Error message -->
          <div
            v-if="errorMessage"
            class="mb-4 p-3 rounded-xl bg-safety-red/10 border border-safety-red/20 text-safety-red text-sm"
            role="alert"
          >
            {{ errorMessage }}
          </div>

          <!-- Form -->
          <form
            @submit.prevent="handleSubmit"
            :key="shakeKey"
            :class="errorMessage ? 'animate-shake' : ''"
            novalidate
          >
            <!-- Email -->
            <div class="mb-4">
              <label for="email" class="block text-sm font-medium text-text-primary dark:text-text-dark-primary mb-1.5">
                Email
              </label>
              <input
                id="email"
                v-model="form.email"
                type="email"
                autocomplete="email"
                placeholder="tu@esempio.com"
                :class="[
                  'w-full px-4 py-3 rounded-xl border bg-surface-base dark:bg-surface-dark text-text-primary dark:text-text-dark-primary placeholder:text-text-secondary dark:placeholder:text-text-dark-secondary text-sm transition-all',
                  errors.email
                    ? 'border-safety-red focus:border-safety-red focus:shadow-[0_0_0_3px_rgba(239,68,68,0.2)]'
                    : 'border-border-light dark:border-border-dark focus:border-brand-blue focus:shadow-[0_0_0_3px_rgba(37,99,235,0.2)]'
                ]"
                :aria-describedby="errors.email ? 'email-error' : undefined"
                :aria-invalid="!!errors.email"
              />
              <p v-if="errors.email" id="email-error" class="mt-1.5 text-xs text-safety-red">{{ errors.email }}</p>
            </div>

            <!-- Password -->
            <div class="mb-6">
              <div class="flex items-center justify-between mb-1.5">
                <label for="password" class="block text-sm font-medium text-text-primary dark:text-text-dark-primary">
                  Password
                </label>
                <button type="button" class="text-xs text-text-secondary dark:text-text-dark-secondary hover:text-brand-blue transition-colors cursor-pointer">
                  Password dimenticata?
                </button>
              </div>
              <div class="relative">
                <input
                  id="password"
                  v-model="form.password"
                  :type="showPassword ? 'text' : 'password'"
                  autocomplete="current-password"
                  placeholder="••••••••"
                  :class="[
                    'w-full px-4 py-3 pr-12 rounded-xl border bg-surface-base dark:bg-surface-dark text-text-primary dark:text-text-dark-primary placeholder:text-text-secondary dark:placeholder:text-text-dark-secondary text-sm transition-all',
                    errors.password
                      ? 'border-safety-red focus:border-safety-red focus:shadow-[0_0_0_3px_rgba(239,68,68,0.2)]'
                      : 'border-border-light dark:border-border-dark focus:border-brand-blue focus:shadow-[0_0_0_3px_rgba(37,99,235,0.2)]'
                  ]"
                  :aria-describedby="errors.password ? 'password-error' : undefined"
                  :aria-invalid="!!errors.password"
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
              <p v-if="errors.password" id="password-error" class="mt-1.5 text-xs text-safety-red">{{ errors.password }}</p>
            </div>

            <!-- Submit -->
            <button
              type="submit"
              :disabled="isLoading"
              class="w-full py-3 rounded-xl bg-brand-blue text-white font-semibold text-base hover:bg-blue-700 hover:-translate-y-px transition-all duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
            >
              <span v-if="isLoading" class="inline-flex items-center gap-2">
                <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Accesso in corso...
              </span>
              <span v-else>Accedi</span>
            </button>
          </form>

          <!-- Demo buttons (DEV only) -->
          <div v-if="isDev" class="mt-6 pt-6 border-t border-border-light dark:border-border-dark">
            <p class="text-xs text-text-secondary dark:text-text-dark-secondary text-center mb-3">Accesso rapido demo</p>
            <div class="flex gap-2">
              <button
                @click="loginAsDemo"
                class="flex-1 py-2.5 rounded-xl border border-border-light dark:border-border-dark text-sm font-medium text-text-secondary dark:text-text-dark-secondary hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Utente demo
              </button>
              <button
                @click="loginAsAdmin"
                class="flex-1 py-2.5 rounded-xl border border-brand-blue/40 bg-brand-blue/5 text-sm font-medium text-brand-blue hover:bg-brand-blue/10 transition-colors cursor-pointer"
              >
                Admin demo
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
