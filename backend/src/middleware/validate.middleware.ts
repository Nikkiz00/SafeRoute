import type { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'
import { sendError } from '@/utils/response.utils.js'

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      return sendError(res, result.error.errors[0]?.message ?? 'Input non valido', 422)
    }
    req.body = result.data
    next()
  }
}
