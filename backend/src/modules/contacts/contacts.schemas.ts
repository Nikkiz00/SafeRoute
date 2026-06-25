import { z } from 'zod'

export const createContactSchema = z.object({
  name: z.string().min(1, 'Nome obbligatorio').max(100),
  phone: z.string().max(20).nullable().optional(),
  email: z.string().email('Email non valida').nullable().optional(),
  isPrimary: z.boolean().optional().default(false),
  notifiedOnAdd: z.boolean().optional().default(false),
}).refine(
  (data) => data.phone || data.email,
  { message: 'Inserisci almeno un telefono o una email' }
)

export const updateContactSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).nullable().optional(),
  email: z.string().email('Email non valida').nullable().optional(),
  isPrimary: z.boolean().optional(),
})

export type CreateContactInput = z.infer<typeof createContactSchema>
export type UpdateContactInput = z.infer<typeof updateContactSchema>
