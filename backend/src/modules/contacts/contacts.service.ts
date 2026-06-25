import { prisma } from '@/config/database.js'
import type { CreateContactInput, UpdateContactInput } from './contacts.schemas.js'

export async function getContacts(userId: string) {
  return prisma.emergencyContact.findMany({
    where: { userId },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  })
}

export async function createContact(userId: string, plan: string, input: CreateContactInput) {
  const count = await prisma.emergencyContact.count({ where: { userId } })
  const limit = plan === 'PREMIUM' ? 5 : 2

  if (count >= limit) {
    throw new Error('Limite contatti raggiunto per il tuo piano')
  }

  const { name, phone, email, isPrimary = false, notifiedOnAdd = false } = input

  if (isPrimary) {
    await prisma.emergencyContact.updateMany({
      where: { userId },
      data: { isPrimary: false },
    })
  }

  const contact = await prisma.emergencyContact.create({
    data: {
      userId,
      name,
      phone: phone || null,
      email: email || null,
      isPrimary,
      notifiedOnAdd,
    },
  })

  // Send notification email if requested and contact has email
  if (notifiedOnAdd && email) {
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
      .then(async (user) => {
        if (user) {
          const { sendContactAddedEmail } = await import('../sos/notifications/email.provider.js')
          sendContactAddedEmail({ to: email, contactName: name, addedByName: user.name })
            .catch(e => console.error('[contacts] notification email error:', e))
        }
      })
      .catch(() => {})
  }

  return contact
}

export async function updateContact(userId: string, contactId: string, input: UpdateContactInput) {
  const existing = await prisma.emergencyContact.findFirst({
    where: { id: contactId, userId },
  })

  if (!existing) {
    throw new Error('Contatto non trovato')
  }

  if (input.isPrimary === true) {
    await prisma.emergencyContact.updateMany({
      where: { userId },
      data: { isPrimary: false },
    })
  }

  return prisma.emergencyContact.update({
    where: { id: contactId },
    data: { ...input },
  })
}

export async function deleteContact(userId: string, contactId: string) {
  const existing = await prisma.emergencyContact.findFirst({
    where: { id: contactId, userId },
  })

  if (!existing) {
    throw new Error('Contatto non trovato')
  }

  await prisma.emergencyContact.delete({ where: { id: contactId } })
}
