import { z } from 'zod'

export const registerSchema = z.object({
  name: z.string().min(2, 'Nome troppo corto').max(100),
  email: z.string().email('Email non valida'),
  password: z.string()
    .min(10, 'La password deve contenere almeno 10 caratteri')
    .regex(/[A-Z]/, 'La password deve contenere almeno una lettera maiuscola')
    .regex(/[0-9]/, 'La password deve contenere almeno un numero'),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
