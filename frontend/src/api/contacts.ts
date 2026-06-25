import { api } from './client'
import type { EmergencyContact } from '@/types'

export interface CreateContactInput {
  name: string
  phone: string | null
  email: string | null
  isPrimary?: boolean
  notifiedOnAdd?: boolean
}

export interface UpdateContactInput {
  name?: string
  phone?: string | null
  email?: string | null
  isPrimary?: boolean
}

export function listContacts(): Promise<{ contacts: EmergencyContact[] }> {
  return api.get<{ contacts: EmergencyContact[] }>('/api/emergency-contacts')
}

export function createContact(data: CreateContactInput): Promise<{ contact: EmergencyContact }> {
  return api.post<{ contact: EmergencyContact }>('/api/emergency-contacts', data)
}

export function updateContact(id: string, data: UpdateContactInput): Promise<{ contact: EmergencyContact }> {
  return api.patch<{ contact: EmergencyContact }>(`/api/emergency-contacts/${id}`, data)
}

export function deleteContact(id: string): Promise<void> {
  return api.delete<void>(`/api/emergency-contacts/${id}`)
}
