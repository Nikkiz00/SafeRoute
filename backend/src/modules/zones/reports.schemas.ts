import { z } from 'zod'

// Categories as defined in Day 5 spec
export const REPORT_CATEGORIES = [
  'aggression',
  'harassment',
  'theft',
  'dark_area',
  'suspicious_groups',
  'degradation',
  'other',
] as const

export type ReportCategory = (typeof REPORT_CATEGORIES)[number]

export const createReportSchema = z.object({
  category: z.enum(REPORT_CATEGORIES),
  description: z.string().max(1000).optional(),
})

export type CreateReportInput = z.infer<typeof createReportSchema>
