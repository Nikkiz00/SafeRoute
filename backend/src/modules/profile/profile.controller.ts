import type { Response } from 'express'
import * as profileService from './profile.service.js'
import { sendSuccess, sendError } from '@/utils/response.utils.js'
import type { AuthenticatedRequest } from '@/middleware/auth.middleware.js'

export async function getProfile(req: AuthenticatedRequest, res: Response) {
  try {
    const user = await profileService.getProfile(req.user!.id)
    return sendSuccess(res, { user })
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Errore nel recupero del profilo', 404)
  }
}

export async function updateProfile(req: AuthenticatedRequest, res: Response) {
  try {
    const user = await profileService.updateProfile(req.user!.id, req.body)
    return sendSuccess(res, { user })
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Errore nella modifica del profilo')
  }
}

export async function completeOnboarding(req: AuthenticatedRequest, res: Response) {
  try {
    const result = await profileService.completeOnboarding(req.user!.id)
    return sendSuccess(res, { message: result.message })
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Errore nel completamento onboarding')
  }
}

export async function changeEmail(req: AuthenticatedRequest, res: Response) {
  try {
    const user = await profileService.changeEmail(req.user!.id, req.body)
    return sendSuccess(res, { user })
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Errore', 400)
  }
}

export async function changePassword(req: AuthenticatedRequest, res: Response) {
  try {
    const result = await profileService.changePassword(req.user!.id, req.body)
    return sendSuccess(res, result)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Errore', 400)
  }
}

export async function deleteAccount(req: AuthenticatedRequest, res: Response) {
  try {
    const { password } = req.body as { password?: string }
    if (!password) return sendError(res, 'Password richiesta', 400)
    const result = await profileService.softDeleteAccount(req.user!.id, password)
    return sendSuccess(res, result)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Errore', 400)
  }
}
