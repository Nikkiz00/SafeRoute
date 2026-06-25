import type { Response } from 'express'
import * as contactsService from './contacts.service.js'
import { sendSuccess, sendError } from '@/utils/response.utils.js'
import type { AuthenticatedRequest } from '@/middleware/auth.middleware.js'

export async function list(req: AuthenticatedRequest, res: Response) {
  try {
    const contacts = await contactsService.getContacts(req.user!.id)
    return sendSuccess(res, { contacts })
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Errore nel recupero contatti')
  }
}

export async function create(req: AuthenticatedRequest, res: Response) {
  try {
    const contact = await contactsService.createContact(req.user!.id, req.user!.plan, req.body)
    return sendSuccess(res, { contact }, 201)
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Errore nella creazione del contatto')
  }
}

export async function update(req: AuthenticatedRequest, res: Response) {
  try {
    const contact = await contactsService.updateContact(req.user!.id, req.params.id, req.body)
    return sendSuccess(res, { contact })
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Errore nella modifica del contatto', 404)
  }
}

export async function remove(req: AuthenticatedRequest, res: Response) {
  try {
    await contactsService.deleteContact(req.user!.id, req.params.id)
    return res.status(204).send()
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : 'Errore nella cancellazione del contatto', 404)
  }
}
