import type { Response } from 'express'
import { sendSuccess, sendError } from '@/utils/response.utils.js'
import type { AuthenticatedRequest } from '@/middleware/auth.middleware.js'
import {
  getOverview, listUsers, getUserById, updateUserStatus, updateUserRole,
  listSOS, getSOSById, listReports, getReportById, moderateReport,
  listFeedback, listZonesAdmin, updateZoneServiceStatus, listAuditLogs,
} from './admin.service.js'

function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? '20'), 10) || 20))
  return { page, limit }
}

export async function handleGetOverview(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await getOverview()
    sendSuccess(res, data)
  } catch (err) {
    console.error('[admin] getOverview error:', err)
    sendError(res, 'Errore nel recupero panoramica', 500)
  }
}

export async function handleListUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { page, limit } = parsePagination(req.query as Record<string, unknown>)
    const role = req.query.role ? String(req.query.role) : undefined
    const includeDeleted = req.query.includeDeleted === 'true'
    const data = await listUsers({ page, limit, role, includeDeleted })
    sendSuccess(res, data)
  } catch (err) {
    console.error('[admin] listUsers error:', err)
    sendError(res, 'Errore nel recupero utenti', 500)
  }
}

export async function handleGetUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = await getUserById(req.params.id)
    if (!user) { sendError(res, 'Utente non trovato', 404); return }
    sendSuccess(res, user)
  } catch (err) {
    console.error('[admin] getUser error:', err)
    sendError(res, 'Errore nel recupero utente', 500)
  }
}

export async function handleUpdateUserStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const adminId = req.user!.id
    const action = req.body.action
    if (action !== 'delete' && action !== 'restore') { sendError(res, 'Azione non valida', 400); return }
    const ok = await updateUserStatus(adminId, req.params.id, action)
    if (!ok) { sendError(res, 'Utente non trovato', 404); return }
    sendSuccess(res, { message: action === 'delete' ? 'Utente disattivato' : 'Utente riattivato' })
  } catch (err) {
    console.error('[admin] updateUserStatus error:', err)
    sendError(res, 'Errore aggiornamento utente', 500)
  }
}

export async function handleUpdateUserRole(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const adminId = req.user!.id
    const { role } = req.body
    if (!role) { sendError(res, 'Ruolo non specificato', 400); return }
    const ok = await updateUserRole(adminId, req.params.id, role)
    if (!ok) { sendError(res, 'Utente non trovato o ruolo non valido', 404); return }
    sendSuccess(res, { message: 'Ruolo aggiornato' })
  } catch (err) {
    console.error('[admin] updateUserRole error:', err)
    sendError(res, 'Errore aggiornamento ruolo', 500)
  }
}

export async function handleListSOS(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { page, limit } = parsePagination(req.query as Record<string, unknown>)
    const status = req.query.status ? String(req.query.status) : undefined
    const data = await listSOS({ page, limit, status })
    sendSuccess(res, data)
  } catch (err) {
    console.error('[admin] listSOS error:', err)
    sendError(res, 'Errore nel recupero SOS', 500)
  }
}

export async function handleGetSOS(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await getSOSById(req.params.id)
    if (!data) { sendError(res, 'SOS non trovato', 404); return }
    sendSuccess(res, data)
  } catch (err) {
    console.error('[admin] getSOS error:', err)
    sendError(res, 'Errore nel recupero SOS', 500)
  }
}

export async function handleListReports(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { page, limit } = parsePagination(req.query as Record<string, unknown>)
    const status = req.query.status ? String(req.query.status) : undefined
    const data = await listReports({ page, limit, status })
    sendSuccess(res, data)
  } catch (err) {
    console.error('[admin] listReports error:', err)
    sendError(res, 'Errore nel recupero segnalazioni', 500)
  }
}

export async function handleGetReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await getReportById(req.params.id)
    if (!data) { sendError(res, 'Segnalazione non trovata', 404); return }
    sendSuccess(res, data)
  } catch (err) {
    console.error('[admin] getReport error:', err)
    sendError(res, 'Errore nel recupero segnalazione', 500)
  }
}

export async function handleModerateReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const adminId = req.user!.id
    const { status } = req.body
    if (status !== 'approved' && status !== 'rejected') { sendError(res, 'Status non valido', 400); return }
    const result = await moderateReport(adminId, req.params.id, status)
    if (!result.success) { sendError(res, 'Segnalazione non trovata', 404); return }
    sendSuccess(res, result)
  } catch (err) {
    console.error('[admin] moderateReport error:', err)
    sendError(res, 'Errore nella moderazione', 500)
  }
}

export async function handleListFeedback(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { page, limit } = parsePagination(req.query as Record<string, unknown>)
    const data = await listFeedback({ page, limit })
    sendSuccess(res, data)
  } catch (err) {
    console.error('[admin] listFeedback error:', err)
    sendError(res, 'Errore nel recupero feedback', 500)
  }
}

export async function handleListZones(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { page, limit } = parsePagination(req.query as Record<string, unknown>)
    const data = await listZonesAdmin({ page, limit })
    sendSuccess(res, data)
  } catch (err) {
    console.error('[admin] listZones error:', err)
    sendError(res, 'Errore nel recupero zone', 500)
  }
}

export async function handleUpdateZoneServiceStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const adminId = req.user!.id
    const { isServiceActive } = req.body
    if (typeof isServiceActive !== 'boolean') { sendError(res, 'isServiceActive deve essere boolean', 400); return }
    const ok = await updateZoneServiceStatus(adminId, req.params.id, isServiceActive)
    if (!ok) { sendError(res, 'Zona non trovata', 404); return }
    sendSuccess(res, { message: 'Stato servizio aggiornato' })
  } catch (err) {
    console.error('[admin] updateZoneServiceStatus error:', err)
    sendError(res, 'Errore aggiornamento zona', 500)
  }
}

export async function handleListAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { page, limit } = parsePagination(req.query as Record<string, unknown>)
    const data = await listAuditLogs({ page, limit })
    sendSuccess(res, data)
  } catch (err) {
    console.error('[admin] listAuditLogs error:', err)
    sendError(res, 'Errore nel recupero audit logs', 500)
  }
}
