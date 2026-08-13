import { z } from 'zod'

export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Nome minimo 2 caratteri').max(100).optional(),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

export const changeEmailSchema = z.object({
  newEmail: z.string().email('Email non valida'),
  password: z.string().min(1, 'Password richiesta'),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Password attuale richiesta'),
  newPassword: z.string()
    .min(10, 'La password deve contenere almeno 10 caratteri')
    .regex(/[A-Z]/, 'La password deve contenere almeno una lettera maiuscola')
    .regex(/[0-9]/, 'La password deve contenere almeno un numero'),
})

export type ChangeEmailInput = z.infer<typeof changeEmailSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
