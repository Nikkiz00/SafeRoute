<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Users, X, ArrowLeft } from 'lucide-vue-next'
import { useContactsStore } from '@/stores/contacts'
import { useAuthStore } from '@/stores/auth'
import EmergencyContactCard from '@/components/contacts/EmergencyContactCard.vue'
import AppShell from '@/components/common/AppShell.vue'

const router = useRouter()
const contactsStore = useContactsStore()
const auth = useAuthStore()

const showAddModal = ref(false)
const newContact = reactive({
  name: '',
  phone: '',
  email: '',
  isPrimary: false,
  notifiedOnAdd: true,
})

const formError = ref('')
const isSubmitting = ref(false)

onMounted(() => {
  contactsStore.fetchContacts()
})

function openModal() {
  showAddModal.value = true
  newContact.name = ''
  newContact.phone = ''
  newContact.email = ''
  newContact.isPrimary = false
  newContact.notifiedOnAdd = true
  formError.value = ''
}

function closeModal() {
  showAddModal.value = false
}

async function handleSave() {
  formError.value = ''
  if (!newContact.name.trim()) {
    formError.value = 'Il nome è obbligatorio'
    return
  }
  if (!newContact.phone.trim() && !newContact.email.trim()) {
    formError.value = 'Inserisci almeno un telefono o email'
    return
  }
  // Valida formato email se presente
  if (newContact.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newContact.email.trim())) {
    formError.value = 'Formato email non valido'
    return
  }

  isSubmitting.value = true
  try {
    const added = await contactsStore.add({
      name: newContact.name.trim(),
      phone: newContact.phone || null,
      email: newContact.email || null,
      isPrimary: newContact.isPrimary,
      notifiedOnAdd: newContact.notifiedOnAdd,
    })

    if (!added) {
      formError.value = contactsStore.error ?? 'Limite contatti raggiunto per il piano attuale'
      return
    }

    closeModal()
  } finally {
    isSubmitting.value = false
  }
}

async function handleDelete(id: string) {
  await contactsStore.remove(id)
}
</script>

<template>
  <AppShell>
    <div class="flex-1 overflow-y-auto pb-24 md:pb-8">
      <!-- Header -->
      <div class="sticky top-0 bg-surface-base dark:bg-surface-dark border-b border-border-light dark:border-border-dark z-nav px-4 h-16 flex items-center gap-4">
        <button
          @click="router.push('/map')"
          class="md:hidden p-3 rounded-xl text-text-secondary dark:text-text-dark-secondary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Torna alla mappa"
        >
          <ArrowLeft :size="20" />
        </button>
        <h1 class="font-display text-xl font-bold text-text-primary dark:text-text-dark-primary flex-1">
          Contatti emergenza
        </h1>

        <!-- Plan badge -->
        <span
          :class="[
            'text-xs px-3 py-1 rounded-full font-medium',
            auth.user?.plan === 'PREMIUM'
              ? 'bg-safety-green/20 text-green-700 dark:text-green-300'
              : 'bg-safety-yellow/20 text-yellow-700 dark:text-yellow-300'
          ]"
        >
          {{ auth.user?.plan }} — {{ contactsStore.contacts.length }}/{{ contactsStore.maxContacts }}
        </span>
      </div>

      <!-- Loading state -->
      <div v-if="contactsStore.isLoading" class="flex justify-center py-8">
        <svg class="animate-spin h-6 w-6 text-brand-blue" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      </div>

      <!-- Error state -->
      <div v-if="contactsStore.error" class="mx-4 mt-4 p-3 rounded-xl bg-safety-red/10 text-safety-red text-sm">
        {{ contactsStore.error }}
      </div>

      <div class="max-w-2xl mx-auto px-4 py-6">
        <!-- Empty state -->
        <div
          v-if="contactsStore.contacts.length === 0 && !contactsStore.isLoading"
          class="flex flex-col items-center py-16 text-center"
        >
          <div class="w-16 h-16 mb-4 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <Users :size="32" class="text-text-secondary dark:text-text-dark-secondary" />
          </div>
          <p class="font-semibold text-text-primary dark:text-text-dark-primary mb-2">Nessun contatto di emergenza</p>
          <p class="text-sm text-text-secondary dark:text-text-dark-secondary mb-6">
            Aggiungine uno per essere più sicuro.
          </p>
          <button
            @click="openModal"
            class="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-blue text-white font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Plus :size="18" />
            Aggiungi il primo contatto
          </button>
        </div>

        <!-- Contact list -->
        <template v-else>
          <div class="space-y-3 mb-6">
            <EmergencyContactCard
              v-for="contact in contactsStore.contacts"
              :key="contact.id"
              :contact="contact"
              @delete="handleDelete"
            />
          </div>

          <!-- Add button or limit banner -->
          <div v-if="contactsStore.canAddMore">
            <button
              @click="openModal"
              class="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-blue text-white font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <Plus :size="18" />
              Aggiungi contatto
            </button>
          </div>
          <div
            v-else
            class="p-4 rounded-xl bg-safety-yellow/10 border border-safety-yellow/30 text-sm text-amber-800 dark:text-amber-300"
          >
            Hai raggiunto il limite di {{ contactsStore.maxContacts }} contatti per il piano gratuito.
            <button disabled class="ml-1 text-brand-blue opacity-50 cursor-not-allowed pointer-events-none">Premium — in arrivo</button>
          </div>
        </template>
      </div>
    </div>

    <!-- Add Contact Modal -->
    <Transition name="backdrop">
      <div
        v-if="showAddModal"
        class="fixed inset-0 z-modal bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
        @click.self="closeModal"
      >
        <Transition name="sheet">
          <div
            v-if="showAddModal"
            class="w-full max-w-md bg-surface-elevated dark:bg-surface-dark-elevated rounded-t-3xl md:rounded-2xl shadow-xl p-6"
          >
            <div class="flex items-center justify-between mb-6">
              <h2 class="font-display text-xl font-bold text-text-primary dark:text-text-dark-primary">
                Aggiungi contatto
              </h2>
              <button
                @click="closeModal"
                class="p-2 rounded-full text-text-secondary dark:text-text-dark-secondary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Chiudi"
              >
                <X :size="18" />
              </button>
            </div>

            <div v-if="formError" class="mb-4 p-3 rounded-xl bg-safety-red/10 text-safety-red text-sm">
              {{ formError }}
            </div>

            <div class="p-3 bg-brand-blue/5 dark:bg-brand-blue/10 border border-brand-blue/20 rounded-lg mb-4">
              <p class="text-sm text-text-secondary dark:text-text-dark-secondary leading-relaxed">
                I contatti che aggiungi riceveranno una notifica email o SMS se attivi un SOS.
                Aggiungi solo persone di cui hai il consenso. I loro dati sono usati esclusivamente per le notifiche di emergenza.
              </p>
            </div>

            <div class="space-y-4">
              <div>
                <label for="new-name" class="block text-sm font-medium text-text-primary dark:text-text-dark-primary mb-1.5">Nome *</label>
                <input
                  id="new-name"
                  v-model="newContact.name"
                  type="text"
                  placeholder="Nome del contatto"
                  class="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-surface-base dark:bg-surface-dark text-text-primary dark:text-text-dark-primary text-sm focus:border-brand-blue focus:shadow-[0_0_0_3px_rgba(37,99,235,0.2)] transition-all"
                />
              </div>
              <div>
                <label for="new-phone" class="block text-sm font-medium text-text-primary dark:text-text-dark-primary mb-1.5">Telefono</label>
                <input
                  id="new-phone"
                  v-model="newContact.phone"
                  type="tel"
                  placeholder="+39 333 1234567"
                  class="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-surface-base dark:bg-surface-dark text-text-primary dark:text-text-dark-primary text-sm focus:border-brand-blue focus:shadow-[0_0_0_3px_rgba(37,99,235,0.2)] transition-all"
                />
              </div>
              <div>
                <label for="new-email" class="block text-sm font-medium text-text-primary dark:text-text-dark-primary mb-1.5">Email</label>
                <input
                  id="new-email"
                  v-model="newContact.email"
                  type="email"
                  placeholder="contatto@esempio.com"
                  class="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-surface-base dark:bg-surface-dark text-text-primary dark:text-text-dark-primary text-sm focus:border-brand-blue focus:shadow-[0_0_0_3px_rgba(37,99,235,0.2)] transition-all"
                />
              </div>

              <div class="flex flex-col gap-3 pt-1">
                <label class="flex items-center gap-3 cursor-pointer">
                  <input v-model="newContact.isPrimary" type="checkbox" class="w-4 h-4 rounded accent-brand-blue" />
                  <span class="text-sm text-text-secondary dark:text-text-dark-secondary">Contatto principale</span>
                </label>
                <label class="flex items-center gap-3 cursor-pointer">
                  <input v-model="newContact.notifiedOnAdd" type="checkbox" class="w-4 h-4 rounded accent-brand-blue" />
                  <span class="text-sm text-text-secondary dark:text-text-dark-secondary">Avvisa questo contatto dell'aggiunta</span>
                </label>
              </div>
            </div>

            <div class="flex gap-3 mt-6">
              <button
                @click="closeModal"
                class="flex-1 py-3 rounded-xl border border-border-light dark:border-border-dark text-text-secondary dark:text-text-dark-secondary font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                @click="handleSave"
                :disabled="isSubmitting"
                class="flex-1 py-3 rounded-xl bg-brand-blue text-white font-semibold hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-60"
              >
                <span v-if="isSubmitting" class="inline-flex items-center gap-2">
                  <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Salvataggio...
                </span>
                <span v-else>Salva</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </AppShell>
</template>
