import { Router } from 'express'
import { requireAuth } from '@/middleware/auth.middleware.js'
import { requireAdmin, requireAdminOrStaff } from '@/middleware/admin.middleware.js'
import {
  handleGetOverview, handleListUsers, handleGetUser, handleUpdateUserStatus, handleUpdateUserRole,
  handleListSOS, handleGetSOS,
  handleListReports, handleGetReport, handleModerateReport,
  handleListFeedback, handleListZones, handleUpdateZoneServiceStatus,
  handleListAuditLogs,
} from './admin.controller.js'

const router = Router()

// All admin routes require auth first
router.use(requireAuth)

// Overview (ADMIN + STAFF can view)
router.get('/overview', requireAdminOrStaff, handleGetOverview)

// Users (ADMIN-only for writes, ADMIN+STAFF for reads)
router.get('/users', requireAdminOrStaff, handleListUsers)
router.get('/users/:id', requireAdminOrStaff, handleGetUser)
router.patch('/users/:id/status', requireAdmin, handleUpdateUserStatus)
router.patch('/users/:id/role', requireAdmin, handleUpdateUserRole)

// SOS (ADMIN + STAFF can view)
router.get('/sos', requireAdminOrStaff, handleListSOS)
router.get('/sos/:id', requireAdminOrStaff, handleGetSOS)

// Reports (ADMIN can moderate; STAFF can view)
router.get('/reports', requireAdminOrStaff, handleListReports)
router.get('/reports/:id', requireAdminOrStaff, handleGetReport)
router.patch('/reports/:id/status', requireAdmin, handleModerateReport)

// Feedback (ADMIN + STAFF)
router.get('/feedback', requireAdminOrStaff, handleListFeedback)

// Zones (ADMIN can toggle service; STAFF can view)
router.get('/zones', requireAdminOrStaff, handleListZones)
router.patch('/zones/:id/service-status', requireAdmin, handleUpdateZoneServiceStatus)

// Audit logs (ADMIN only)
router.get('/audit-logs', requireAdmin, handleListAuditLogs)

export default router
