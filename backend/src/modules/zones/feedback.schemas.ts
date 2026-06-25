import { z } from 'zod'

export const createFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  note: z.string().max(500).optional(),
})

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>
