import { z } from 'zod'

export const startRouteSchema = z.object({
  startLat: z.number().min(-90).max(90),
  startLng: z.number().min(-180).max(180),
  endLat: z.number().min(-90).max(90).optional(),
  endLng: z.number().min(-180).max(180).optional(),
  destinationName: z.string().max(200).optional(),
})

export const updateLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().positive().optional(),
})

export type StartRouteInput = z.infer<typeof startRouteSchema>
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>
