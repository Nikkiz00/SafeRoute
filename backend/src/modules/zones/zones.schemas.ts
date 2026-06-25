import { z } from 'zod'

export const zonesQuerySchema = z.object({
  cityId: z.string().optional(),
  bbox: z.string().optional(), // "minLng,minLat,maxLng,maxLat"
})

export type ZonesQuery = z.infer<typeof zonesQuerySchema>
