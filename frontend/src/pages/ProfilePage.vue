<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  User as UserIcon, Mail, Calendar, Crown, ArrowLeft, Pencil, Check, X,
  AlertCircle, Loader2, ShieldCheck, ShieldAlert, ChevronDown, Trash2
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { getProfile, updateProfile, changeEmail, changePassword, deleteAccount, resendVerification } from '@/api/profile'
import AppShell from '@/components/common/AppShell.vue'
import type { User } from '@/types'

const router = useRouter()
const auth = useAuthStore()

const isLoading = ref(false)
const isSaving = ref(false)
const fetchError = ref('')
const saveError = ref('')
const saveSuccess = ref(false)

const isEditing = ref(false)
const editName = ref('')

const user = computed(() => auth.user)

const formattedDate = computed(() => {
  if (!user.value?.createdAt) return '—'
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(user.value.createdAt))
})

async function loadProfile() {
  isLoading.value = true
  fetchError.value = ''
  try {
    const { user: serverUser } = await getProfile()
    auth.updateUser({
      name: serverUser.name,
      email: serverUser.email,
      role: serverUser.role as User['role'],
      plan: serverUser.plan as User['plan'],
      emailVerified: serverUser.emailVerified,
      emailVerifiedAt: serverUser.emailVerifiedAt,
    })
  } catch (err) {
    fetchError.value = err instanceof Error ? err.message : 'Errore nel caricamento del profilo'
  } finally {
    isLoading.value = false
  }
}

function startEdit() {
  editName.value = user.value?.name ?? ''
  isEditing.value = true
  saveError.value = ''
  saveSuccess.value = false
}

function cancelEdit() {
  isEditing.value = false
  editName.value = ''
  saveError.value = ''
}

async function handleSave() {
  const trimmed = editName.value.trim()
  if (!trimmed || trimmed.length < 2) {
    saveError.value = 'Il nome deve avere almeno 2 caratteri'
    return
  }

  isSaving.value = true
  saveError.value = ''
  saveSuccess.value = false

  try {
    const { user: updatedUser } = await updateProfile({ name: trimmed })
    auth.updateUser({
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role as User['role'],
      plan: updatedUser.plan as User['plan'],
    })
    isEditing.value = false
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 3000)
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : 'Errore nel salvataggio'
  } finally {
    isSaving.value = false
  }
}

// Sections accordion
type Section = 'email' | 'password' | null
const activeSection = ref<Section>(null)
function toggleSection(s: Section) {
  activeSection.value = activeSection.value === s ? null : s
  sectionError.value.email = ''
  sectionError.value.password = ''
  sectionSuccess.value.email = ''
  sectionSuccess.value.password = ''
}

// Section state
const isSavingSection = ref({ email: false, password: false })
const sectionError = ref({ email: '', password: '' })
const sectionSuccess = ref({ email: '', password: '' })

// Change email
const changeEmailForm = ref({ newEmail: '', password: '' })
async function handleChangeEmail() {
  if (!changeEmailForm.value.newEmail || !changeEmailForm.value.password) {
    sectionError.value.email = 'Compila tutti i campi'
    return
  }
  isSavingSection.value.email = true
  sectionError.value.email = ''
  try {
    const { user: updated } = await changeEmail(changeEmailForm.value)
    auth.updateUser({ email: updated.email, emailVerified: updated.emailVerified })
    sectionSuccess.value.email = 'Email aggiornata. Controlla la tua casella per verificarla.'
    changeEmailForm.value = { newEmail: '', password: '' }
    toggleSection(null)
  } catch (err) {
    sectionError.value.email = err instanceof Error ? err.message : 'Errore'
  } finally {
    isSavingSection.value.email = false
  }
}

// Change password
const changePasswordForm = ref({ currentPassword: '', newPassword: '', confirmPassword: '' })
async function handleChangePassword() {
  if (!changePasswordForm.value.currentPassword || !changePasswordForm.value.newPassword) {
    sectionError.value.password = 'Compila tutti i campi'
    return
  }
  if (changePasswordForm.value.newPassword !== changePasswordForm.value.confirmPassword) {
    sectionError.value.password = 'Le password non coincidono'
    return
  }
  if (changePasswordForm.value.newPassword.length < 10) {
    sectionError.value.password = 'La password deve contenere almeno 10 caratteri'
    return
  }
  isSavingSection.value.password = true
  sectionError.value.password = ''
  try {
    await changePassword({
      currentPassword: changePasswordForm.value.currentPassword,
      newPassword: changePasswordForm.value.newPassword,
    })
    sectionSuccess.value.password = 'Password aggiornata con successo'
    changePasswordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' }
    setTimeout(() => toggleSection(null), 2000)
  } catch (err) {
    sectionError.value.password = err instanceof Error ? err.message : 'Errore'
  } finally {
    isSavingSection.value.password = false
  }
}

// Delete account
const showDeleteConfirm = ref(false)
const deletePassword = ref('')
const deleteError = ref('')
const isDeletingAccount = ref(false)
async function handleDeleteAccount() {
  if (!deletePassword.value) { deleteError.value = 'Inserisci la password'; return }
  isDeletingAccount.value = true
  deleteError.value = ''
  try {
    await deleteAccount({ password: deletePassword.value })
    await auth.logout()
    router.push('/login')
  } catch (err) {
    deleteError.value = err instanceof Error ? err.message : 'Errore'
  } finally {
    isDeletingAccount.value = false
  }
}

// Resend verification
const isResending = ref(false)
const resendCooldown = ref(0)
const resendMessage = ref('')
const resendOk = ref(false)
async function handleResendVerification() {
  isResending.value = true
  resendMessage.value = ''
  try {
    const result = await resendVerification()
    resendOk.value = true
    resendMessage.value = result.skipped
      ? 'SMTP non configurato — verifica in console (dev)'
      : 'Email inviata! Controlla la tua casella.'
    resendCooldown.value = 60
    const timer = setInterval(() => {
      resendCooldown.value--
      if (resendCooldown.value <= 0) clearInterval(timer)
    }, 1000)
  } catch (err) {
    resendOk.value = false
    resendMessage.value = err instanceof Error ? err.message : 'Errore durante l\'invio'
  } finally {
    isResending.value = false
  }
}

onMounted(() => {
  loadProfile()
})
</script>

<template>
  <AppShell>
    <div class="flex-1 overflow-y-auto pb-24 md:pb-8">
      <!-- Header -->
      <div class="sticky top-0 bg-surface-base dark:bg-surface-dark border-b border-border-light dark:border-border-dark z-nav px-4 h-16 flex items-center gap-4">
        <button
          @click="router.push('/map')"
          class="md:hidden p-2 rounded-xl text-text-secondary dark:text-text-dark-secondary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Torna alla mappa"
        >
          <ArrowLeft :size="20" />
        </button>
        <h1 class="font-display text-xl font-bold text-text-primary dark:text-text-dark-primary flex-1">
          Il mio profilo
        </h1>
      </div>

      <!-- Loading skeleton -->
      <div v-if="isLoading" class="max-w-2xl mx-auto px-4 py-6 space-y-4" aria-busy="true" aria-label="Caricamento profilo">
        <div class="flex items-center gap-4 p-5 bg-surface-elevated dark:bg-surface-dark-elevated rounded-2xl animate-pulse">
          <div class="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0"></div>
          <div class="flex-1 space-y-2">
            <div class="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700"></div>
            <div class="h-3 w-48 rounded bg-slate-200 dark:bg-slate-700"></div>
          </div>
        </div>
        <div class="space-y-3">
          <div class="h-16 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse"></div>
          <div class="h-16 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse"></div>
          <div class="h-16 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse"></div>
        </div>
      </div>

      <!-- Fetch error -->
      <div v-else-if="fetchError" class="max-w-2xl mx-auto px-4 py-6">
        <div class="flex items-start gap-3 p-4 rounded-xl bg-safety-red/10 border border-safety-red/20 text-safety-red" role="alert">
          <AlertCircle :size="18" class="shrink-0 mt-0.5" />
          <div>
            <p class="font-medium text-sm">Impossibile caricare il profilo</p>
            <p class="text-sm mt-0.5 opacity-80">{{ fetchError }}</p>
            <button
              @click="loadProfile"
              class="mt-2 text-sm underline cursor-pointer hover:no-underline"
            >
              Riprova
            </button>
          </div>
        </div>
      </div>

      <!-- Profile content -->
      <div v-else-if="user" class="max-w-2xl mx-auto px-4 py-6 space-y-4">

        <!-- Save success banner -->
        <Transition name="fade-in">
          <div
            v-if="saveSuccess"
            class="flex items-center gap-2 p-3 rounded-xl bg-safety-green/10 border border-safety-green/30 text-safety-green text-sm"
            role="status"
          >
            <Check :size="16" />
            Profilo aggiornato con successo
          </div>
        </Transition>

        <!-- Avatar + name card -->
        <div class="bg-surface-elevated dark:bg-surface-dark-elevated rounded-2xl p-5 shadow-sm border border-border-light dark:border-border-dark">
          <div class="flex items-center gap-4">
            <!-- Avatar circle -->
            <div
              class="w-16 h-16 rounded-full bg-brand-blue flex items-center justify-center text-white font-bold text-xl shrink-0"
              aria-hidden="true"
            >
              {{ auth.getInitials() }}
            </div>

            <!-- Name + edit -->
            <div class="flex-1 min-w-0">
              <!-- View mode -->
              <template v-if="!isEditing">
                <div class="flex items-center gap-2">
                  <p class="font-display text-lg font-bold text-text-primary dark:text-text-dark-primary truncate">
                    {{ user.name }}
                  </p>
                  <button
                    @click="startEdit"
                    class="p-1.5 rounded-lg text-text-secondary dark:text-text-dark-secondary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                    aria-label="Modifica nome"
                  >
                    <Pencil :size="14" />
                  </button>
                </div>
                <p class="text-sm text-text-secondary dark:text-text-dark-secondary truncate">{{ user.email }}</p>
              </template>

              <!-- Edit mode -->
              <template v-else>
                <div class="space-y-2">
                  <input
                    v-model="editName"
                    type="text"
                    autocomplete="name"
                    placeholder="Il tuo nome"
                    class="w-full px-3 py-2 rounded-xl border border-border-light dark:border-border-dark bg-surface-base dark:bg-surface-dark text-text-primary dark:text-text-dark-primary text-sm focus:border-brand-blue focus:shadow-[0_0_0_3px_rgba(37,99,235,0.2)] transition-all"
                    :aria-invalid="saveError ? true : undefined"
                    aria-label="Nuovo nome"
                    @keyup.enter="handleSave"
                    @keyup.escape="cancelEdit"
                  />
                  <p v-if="saveError" class="text-xs text-safety-red">{{ saveError }}</p>
                  <div class="flex items-center gap-2">
                    <button
                      @click="handleSave"
                      :disabled="isSaving"
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-blue text-white text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Loader2 v-if="isSaving" :size="12" class="animate-spin" />
                      <Check v-else :size="12" />
                      Salva
                    </button>
                    <button
                      @click="cancelEdit"
                      :disabled="isSaving"
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-light dark:border-border-dark text-text-secondary dark:text-text-dark-secondary text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      <X :size="12" />
                      Annulla
                    </button>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- Info rows -->
        <div class="bg-surface-elevated dark:bg-surface-dark-elevated rounded-2xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden">
          <!-- Email row -->
          <div class="flex items-center gap-4 px-5 py-4 border-b border-border-light dark:border-border-dark">
            <div class="w-9 h-9 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0">
              <Mail :size="16" class="text-brand-blue" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs text-text-secondary dark:text-text-dark-secondary">Email</p>
              <p class="text-sm font-medium text-text-primary dark:text-text-dark-primary truncate">{{ user.email }}</p>
            </div>
          </div>

          <!-- Plan row -->
          <div class="flex items-center gap-4 px-5 py-4 border-b border-border-light dark:border-border-dark">
            <div class="w-9 h-9 rounded-xl bg-safety-yellow/10 flex items-center justify-center shrink-0">
              <Crown :size="16" class="text-yellow-600 dark:text-yellow-400" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs text-text-secondary dark:text-text-dark-secondary">Piano</p>
              <div class="flex items-center gap-2 mt-0.5">
                <span
                  :class="[
                    'text-sm font-semibold',
                    user.plan === 'PREMIUM' ? 'text-yellow-600 dark:text-yellow-400' : 'text-text-primary dark:text-text-dark-primary'
                  ]"
                >
                  {{ user.plan }}
                </span>
                <span
                  v-if="user.plan === 'PREMIUM'"
                  class="text-xs px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 font-medium"
                >
                  Attivo
                </span>
              </div>
            </div>
          </div>

          <!-- Member since row -->
          <div class="flex items-center gap-4 px-5 py-4">
            <div class="w-9 h-9 rounded-xl bg-safety-green/10 flex items-center justify-center shrink-0">
              <Calendar :size="16" class="text-safety-green" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs text-text-secondary dark:text-text-dark-secondary">Membro da</p>
              <p class="text-sm font-medium text-text-primary dark:text-text-dark-primary">{{ formattedDate }}</p>
            </div>
          </div>
        </div>

        <!-- Email verification status -->
        <div class="bg-surface-elevated dark:bg-surface-dark-elevated rounded-2xl shadow-sm border border-border-light dark:border-border-dark p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                 :class="user.emailVerified ? 'bg-safety-green/10' : 'bg-safety-yellow/10'">
              <ShieldCheck v-if="user.emailVerified" :size="16" class="text-safety-green" />
              <ShieldAlert v-else :size="16" class="text-safety-yellow" />
            </div>
            <div>
              <p class="text-sm font-medium text-text-primary dark:text-text-dark-primary">
                Email {{ user.emailVerified ? 'verificata' : 'non verificata' }}
              </p>
              <p class="text-xs text-text-secondary dark:text-text-dark-secondary">
                {{ user.emailVerified ? 'Il tuo account è verificato' : 'Verifica la tua email per maggiore sicurezza' }}
              </p>
            </div>
          </div>
          <button
            v-if="!user.emailVerified"
            @click="handleResendVerification"
            :disabled="isResending || resendCooldown > 0"
            class="w-full py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer border border-border-light dark:border-border-dark hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Loader2 v-if="isResending" :size="14" class="inline animate-spin mr-1" />
            {{ isResending ? 'Invio...' : resendCooldown > 0 ? `Riprova tra ${resendCooldown}s` : 'Reinvia email di verifica' }}
          </button>
          <p v-if="resendMessage" class="mt-2 text-xs" :class="resendOk ? 'text-safety-green' : 'text-safety-red'">
            {{ resendMessage }}
          </p>
        </div>

        <!-- Change email -->
        <div class="bg-surface-elevated dark:bg-surface-dark-elevated rounded-2xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden">
          <button
            @click="toggleSection('email')"
            class="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <div class="flex items-center gap-3">
              <Mail :size="16" class="text-text-secondary dark:text-text-dark-secondary" />
              <span class="text-sm font-medium text-text-primary dark:text-text-dark-primary">Cambia email</span>
            </div>
            <ChevronDown :size="16" class="text-text-secondary dark:text-text-dark-secondary transition-transform" :class="activeSection === 'email' ? 'rotate-180' : ''" />
          </button>

          <div v-if="activeSection === 'email'" class="px-5 pb-5 space-y-3 border-t border-border-light dark:border-border-dark pt-4">
            <input v-model="changeEmailForm.newEmail" type="email" placeholder="Nuova email"
                   class="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-transparent text-text-primary dark:text-text-dark-primary text-sm focus:border-brand-blue focus:shadow-[0_0_0_3px_rgba(37,99,235,0.2)] transition-all" />
            <input v-model="changeEmailForm.password" type="password" placeholder="Password attuale"
                   class="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-transparent text-text-primary dark:text-text-dark-primary text-sm focus:border-brand-blue focus:shadow-[0_0_0_3px_rgba(37,99,235,0.2)] transition-all" />
            <p v-if="sectionError.email" class="text-xs text-safety-red">{{ sectionError.email }}</p>
            <p v-if="sectionSuccess.email" class="text-xs text-safety-green">{{ sectionSuccess.email }}</p>
            <div class="flex gap-2">
              <button @click="handleChangeEmail" :disabled="isSavingSection.email"
                      class="flex-1 py-2.5 rounded-xl bg-brand-blue text-white text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50">
                {{ isSavingSection.email ? 'Salvataggio...' : 'Salva' }}
              </button>
              <button @click="toggleSection(null)" class="px-4 py-2.5 rounded-xl border border-border-light dark:border-border-dark text-sm text-text-secondary dark:text-text-dark-secondary cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                Annulla
              </button>
            </div>
          </div>
        </div>

        <!-- Change password -->
        <div class="bg-surface-elevated dark:bg-surface-dark-elevated rounded-2xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden">
          <button
            @click="toggleSection('password')"
            class="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <div class="flex items-center gap-3">
              <ShieldCheck :size="16" class="text-text-secondary dark:text-text-dark-secondary" />
              <span class="text-sm font-medium text-text-primary dark:text-text-dark-primary">Cambia password</span>
            </div>
            <ChevronDown :size="16" class="text-text-secondary dark:text-text-dark-secondary transition-transform" :class="activeSection === 'password' ? 'rotate-180' : ''" />
          </button>

          <div v-if="activeSection === 'password'" class="px-5 pb-5 space-y-3 border-t border-border-light dark:border-border-dark pt-4">
            <input v-model="changePasswordForm.currentPassword" type="password" placeholder="Password attuale"
                   class="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-transparent text-text-primary dark:text-text-dark-primary text-sm focus:border-brand-blue focus:shadow-[0_0_0_3px_rgba(37,99,235,0.2)] transition-all" />
            <input v-model="changePasswordForm.newPassword" type="password" placeholder="Nuova password (min 10 caratteri)"
                   class="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-transparent text-text-primary dark:text-text-dark-primary text-sm focus:border-brand-blue focus:shadow-[0_0_0_3px_rgba(37,99,235,0.2)] transition-all" />
            <input v-model="changePasswordForm.confirmPassword" type="password" placeholder="Conferma nuova password"
                   class="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-transparent text-text-primary dark:text-text-dark-primary text-sm focus:border-brand-blue focus:shadow-[0_0_0_3px_rgba(37,99,235,0.2)] transition-all" />
            <p v-if="sectionError.password" class="text-xs text-safety-red">{{ sectionError.password }}</p>
            <p v-if="sectionSuccess.password" class="text-xs text-safety-green">{{ sectionSuccess.password }}</p>
            <div class="flex gap-2">
              <button @click="handleChangePassword" :disabled="isSavingSection.password"
                      class="flex-1 py-2.5 rounded-xl bg-brand-blue text-white text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50">
                {{ isSavingSection.password ? 'Salvataggio...' : 'Salva' }}
              </button>
              <button @click="toggleSection(null)" class="px-4 py-2.5 rounded-xl border border-border-light dark:border-border-dark text-sm text-text-secondary dark:text-text-dark-secondary cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                Annulla
              </button>
            </div>
          </div>
        </div>

        <!-- Delete account -->
        <div class="bg-surface-elevated dark:bg-surface-dark-elevated rounded-2xl shadow-sm border border-safety-red/20 p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-9 h-9 rounded-xl bg-safety-red/10 flex items-center justify-center shrink-0">
              <Trash2 :size="16" class="text-safety-red" />
            </div>
            <div>
              <p class="text-sm font-semibold text-safety-red">Elimina account</p>
              <p class="text-xs text-text-secondary dark:text-text-dark-secondary">Questa azione è irreversibile</p>
            </div>
          </div>
          <button @click="showDeleteConfirm = true"
                  class="w-full py-2.5 rounded-xl border border-safety-red/40 text-safety-red text-sm font-medium hover:bg-safety-red/5 transition-colors cursor-pointer">
            Elimina account
          </button>
        </div>

        <!-- Delete confirm modal -->
        <div v-if="showDeleteConfirm" class="fixed inset-0 z-modal flex items-center justify-center px-4"
             @click.self="showDeleteConfirm = false">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          <div class="relative bg-surface-elevated dark:bg-surface-dark-elevated rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 class="font-display font-bold text-lg text-text-primary dark:text-text-dark-primary mb-2">
              Conferma eliminazione
            </h3>
            <p class="text-sm text-text-secondary dark:text-text-dark-secondary mb-4">
              Inserisci la tua password per confermare. L'account sarà disattivato e non potrai più accedere.
            </p>
            <input v-model="deletePassword" type="password" placeholder="Password attuale"
                   class="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-transparent text-text-primary dark:text-text-dark-primary text-sm mb-3" />
            <p v-if="deleteError" class="text-xs text-safety-red mb-3">{{ deleteError }}</p>
            <div class="flex gap-2">
              <button @click="showDeleteConfirm = false; deletePassword = ''; deleteError = ''"
                      class="flex-1 py-3 rounded-xl border border-border-light dark:border-border-dark text-sm font-medium cursor-pointer">
                Annulla
              </button>
              <button @click="handleDeleteAccount" :disabled="isDeletingAccount"
                      class="flex-1 py-3 rounded-xl bg-safety-red text-white text-sm font-semibold hover:brightness-95 cursor-pointer disabled:opacity-50">
                {{ isDeletingAccount ? 'Eliminazione...' : 'Elimina' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Upgrade Premium -->
        <div
          v-if="user.plan === 'FREE'"
          class="bg-surface-elevated dark:bg-surface-dark-elevated rounded-2xl shadow-sm border border-border-light dark:border-border-dark p-5"
        >
          <div class="flex items-start gap-3 mb-4">
            <Crown :size="20" class="text-yellow-500 shrink-0 mt-0.5" />
            <div>
              <p class="font-semibold text-text-primary dark:text-text-dark-primary">Passa a Premium</p>
              <p class="text-sm text-text-secondary dark:text-text-dark-secondary mt-0.5">
                Sblocca contatti illimitati, notifiche avanzate e altro.
              </p>
            </div>
          </div>
          <button
            disabled
            class="w-full py-3 rounded-xl bg-yellow-400/40 text-yellow-700 dark:text-yellow-400 font-semibold text-sm opacity-50 cursor-not-allowed"
            aria-label="Upgrade a Premium non disponibile"
          >
            Premium — in arrivo
          </button>
        </div>

        <!-- Account section: user id for debug (DEV only) -->
        <div v-if="false" class="text-xs text-text-secondary dark:text-text-dark-secondary px-1">
          ID: {{ user?.id }}
        </div>

        <!-- Role badge if admin/staff -->
        <div
          v-if="user.role !== 'USER'"
          class="flex items-center gap-2 px-5 py-3 bg-brand-blue/5 dark:bg-brand-blue/10 rounded-2xl border border-brand-blue/20"
        >
          <UserIcon :size="16" class="text-brand-blue" />
          <span class="text-sm font-medium text-brand-blue">Ruolo: {{ user.role }}</span>
        </div>
      </div>
    </div>
  </AppShell>
</template>
