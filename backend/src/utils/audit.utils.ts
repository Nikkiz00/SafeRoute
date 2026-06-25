import { prisma } from '@/config/database.js'

export type AuditAction =
  | 'report_approve'
  | 'report_reject'
  | 'user_role_change'
  | 'user_status_change'
  | 'zone_service_status_change'
  | 'sos_resolve'
  | 'zone_score_override'

export async function createAuditLog(params: {
  adminId: string
  action: AuditAction
  targetType: 'report' | 'user' | 'zone' | 'sos_alert' | 'setting'
  targetId: string
  previousValue?: unknown
  newValue?: unknown
}): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        previousValue: params.previousValue !== undefined ? (params.previousValue as any) : undefined,
        newValue: params.newValue !== undefined ? (params.newValue as any) : undefined,
      },
    })
  } catch (err) {
    // Audit log failure must NEVER block the main operation
    console.error('[audit] failed to create audit log:', err)
  }
}
