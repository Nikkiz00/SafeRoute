import { z } from 'zod'

export const triggerSOSSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().positive().optional(),
  message: z.string().max(500).optional(),
  routeSessionId: z.string().optional(),
})

export const sosFollowupSchema = z.object({
  response: z.enum(['false_alarm', 'resolved', 'still_danger', 'no_response']),
  notes: z.string().max(500).optional(),
})

export type TriggerSOSInput = z.infer<typeof triggerSOSSchema>
export type SOSFollowupInput = z.infer<typeof sosFollowupSchema>
