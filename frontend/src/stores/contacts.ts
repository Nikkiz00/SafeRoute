import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { EmergencyContact } from '@/types'
import * as contactsApi from '@/api/contacts'
import { useAuthStore } from '@/stores/auth'

export const useContactsStore = defineStore('contacts', () => {
  const contacts = ref<EmergencyContact[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const maxContacts = computed(() => {
    const auth = useAuthStore()
    return auth.user?.plan === 'PREMIUM' ? 5 : 2
  })

  const canAddMore = computed(() => contacts.value.length < maxContacts.value)

  async function fetchContacts() {
    isLoading.value = true
    error.value = null
    try {
      const data = await contactsApi.listContacts()
      contacts.value = data.contacts
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Errore caricamento contatti'
    } finally {
      isLoading.value = false
    }
  }

  async function add(input: Omit<EmergencyContact, 'id' | 'userId' | 'createdAt'>): Promise<boolean> {
    error.value = null
    try {
      await contactsApi.createContact({
        name: input.name,
        phone: input.phone,
        email: input.email,
        isPrimary: input.isPrimary ?? false,
        notifiedOnAdd: input.notifiedOnAdd,
      })
      // Ricarica la lista dal server (è la fonte di verità)
      await fetchContacts()
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Errore aggiunta contatto'
      return false
    }
  }

  async function remove(id: string) {
    error.value = null
    try {
      await contactsApi.deleteContact(id)
      contacts.value = contacts.value.filter((c) => c.id !== id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Errore eliminazione contatto'
    }
  }

  async function setPrimary(id: string) {
    error.value = null
    try {
      await contactsApi.updateContact(id, { isPrimary: true })
      await fetchContacts() // Ricarica per avere lo stato corretto (altri tornano a isPrimary: false)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Errore aggiornamento contatto'
    }
  }

  function clear() {
    contacts.value = []
  }

  return { contacts, maxContacts, canAddMore, isLoading, error, fetchContacts, add, remove, setPrimary, clear }
})
