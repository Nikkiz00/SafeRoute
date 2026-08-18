<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Users,
  Map,
  AlertTriangle,
  Star,
  ArrowLeft,
  Shield,
  Settings,
  Flag,
  Activity,
  Clock,
} from 'lucide-vue-next'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import { adminApi } from '@/api/admin'
import type {
  AdminOverview,
  AdminUserSummary,
  AdminSOSSummary,
  AdminReportSummary,
  AdminFeedbackSummary,
  AdminZoneSummary,
  AdminAuditSummary,
  PaginatedResult,
} from '@/api/admin'

const router = useRouter()

type AdminTab = 'overview' | 'users' | 'zones' | 'reports' | 'sos' | 'feedback' | 'audit' | 'settings'
const activeTab = ref<AdminTab>('overview')

// Loading / error
const isLoading = ref(false)
const error = ref<string | null>(null)

// Data per tab
const overview = ref<AdminOverview | null>(null)
const users = ref<PaginatedResult<AdminUserSummary> | null>(null)
const sosList = ref<PaginatedResult<AdminSOSSummary> | null>(null)
const reports = ref<PaginatedResult<AdminReportSummary> | null>(null)
const feedback = ref<PaginatedResult<AdminFeedbackSummary> | null>(null)
const zones = ref<PaginatedResult<AdminZoneSummary> | null>(null)
const auditLogs = ref<PaginatedResult<AdminAuditSummary> | null>(null)

// Filters
const reportStatusFilter = ref<'' | 'pending' | 'approved' | 'rejected'>('pending')
const sosStatusFilter = ref<'' | 'active' | 'resolved'>('')

// Moderation
const moderatingId = ref<string | null>(null)
const moderationError = ref<string | null>(null)

// Zone toggle
const togglingZoneId = ref<string | null>(null)

async function loadTab(tab: AdminTab) {
  if (tab === 'settings') return
  isLoading.value = true
  error.value = null
  try {
    switch (tab) {
      case 'overview':
        overview.value = await adminApi.getOverview()
        break
      case 'users':
        users.value = await adminApi.listUsers({ page: 1, limit: 20 })
        break
      case 'sos':
        sosList.value = await adminApi.listSOS({
          page: 1,
          limit: 20,
          status: sosStatusFilter.value || undefined,
        })
        break
      case 'reports':
        reports.value = await adminApi.listReports({
          page: 1,
          limit: 20,
          status: reportStatusFilter.value || undefined,
        })
        break
      case 'feedback':
        feedback.value = await adminApi.listFeedback({ page: 1, limit: 20 })
        break
      case 'zones':
        zones.value = await adminApi.listZones({ page: 1, limit: 20 })
        break
      case 'audit':
        auditLogs.value = await adminApi.listAuditLogs({ page: 1, limit: 20 })
        break
    }
  } catch (e) {
    error.value = 'Errore nel caricamento dati'
    console.error('[admin] loadTab error:', e)
  } finally {
    isLoading.value = false
  }
}

async function handleModerateReport(reportId: string, status: 'approved' | 'rejected') {
  moderatingId.value = reportId
  moderationError.value = null
  try {
    await adminApi.moderateReport(reportId, status)
    await loadTab('reports')
    if (overview.value) {
      overview.value = await adminApi.getOverview()
    }
  } catch {
    moderationError.value = 'Errore nella moderazione'
  } finally {
    moderatingId.value = null
  }
}

async function handleToggleZoneService(zoneId: string, currentStatus: boolean) {
  togglingZoneId.value = zoneId
  try {
    await adminApi.updateZoneServiceStatus(zoneId, !currentStatus)
    await loadTab('zones')
  } catch {
    // silently fail
  } finally {
    togglingZoneId.value = null
  }
}

watch(activeTab, (tab) => loadTab(tab))
watch(reportStatusFilter, () => loadTab('reports'))
watch(sosStatusFilter, () => loadTab('sos'))

onMounted(() => loadTab('overview'))

const sidebarItems: { label: string; icon: typeof Shield; tab: AdminTab }[] = [
  { label: 'Overview', icon: Shield, tab: 'overview' },
  { label: 'Utenti', icon: Users, tab: 'users' },
  { label: 'Zone', icon: Map, tab: 'zones' },
  { label: 'Segnalazioni', icon: Flag, tab: 'reports' },
  { label: 'SOS', icon: AlertTriangle, tab: 'sos' },
  { label: 'Feedback', icon: Star, tab: 'feedback' },
  { label: 'Audit Log', icon: Clock, tab: 'audit' },
  { label: 'Impostazioni', icon: Settings, tab: 'settings' },
]

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const REPORT_CATEGORY_LABELS: Record<string, string> = {
  aggression: 'Aggressione',
  harassment: 'Molestia',
  theft: 'Furto',
  dark_area: 'Zona buia',
  suspicious_groups: 'Gruppi sospetti',
  degradation: 'Degrado',
  other: 'Altro',
}

const TAB_LABELS: Record<AdminTab, string> = {
  overview: 'Panoramica',
  users: 'Utenti',
  zones: 'Zone',
  reports: 'Segnalazioni',
  sos: 'SOS',
  feedback: 'Feedback',
  audit: 'Audit Log',
  settings: 'Impostazioni',
}
</script>

<template>
  <div class="min-h-screen bg-surface-base dark:bg-surface-dark">
    <!-- Mobile: desktop-only message -->
    <div class="md:hidden flex flex-col items-center justify-center min-h-screen px-8 text-center">
      <div class="w-16 h-16 mb-4 flex items-center justify-center rounded-full bg-brand-blue/10">
        <Shield :size="32" class="text-brand-blue" />
      </div>
      <h1 class="font-display text-xl font-bold text-text-primary dark:text-text-dark-primary mb-2">
        Dashboard Admin
      </h1>
      <p class="text-text-secondary dark:text-text-dark-secondary text-sm mb-6">
        La dashboard admin è disponibile solo su desktop.
      </p>
      <button
        @click="router.push('/map')"
        class="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-blue text-white font-semibold cursor-pointer"
      >
        <ArrowLeft :size="16" />
        Torna alla mappa
      </button>
    </div>

    <!-- Desktop layout -->
    <div class="hidden md:flex h-screen overflow-hidden">
      <!-- Sidebar -->
      <aside class="w-64 h-full flex flex-col bg-brand-navy border-r border-slate-800 shrink-0">
        <!-- Logo -->
        <div class="flex items-center gap-3 h-16 px-6 border-b border-slate-800">
          <div class="flex items-center justify-center w-7 h-7 rounded-lg bg-brand-blue">
            <Shield :size="14" class="text-white" />
          </div>
          <div>
            <p class="font-display font-bold text-white text-sm">SafeRoute</p>
            <p class="text-slate-400 text-xs">Admin Panel</p>
          </div>
        </div>

        <!-- Nav -->
        <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <button
            v-for="item in sidebarItems"
            :key="item.tab"
            @click="activeTab = item.tab"
            :class="[
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer',
              activeTab === item.tab
                ? 'bg-brand-blue/20 text-brand-blue'
                : 'text-slate-400 hover:text-white hover:bg-slate-800',
            ]"
          >
            <component :is="item.icon" :size="18" />
            {{ item.label }}
          </button>
        </nav>

        <!-- Footer -->
        <div class="p-4 border-t border-slate-800">
          <button
            @click="router.push('/map')"
            class="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ArrowLeft :size="16" />
            Torna alla mappa
          </button>
        </div>
      </aside>

      <!-- Main content -->
      <main class="flex-1 overflow-y-auto">
        <!-- Top bar -->
        <div
          class="sticky top-0 bg-surface-base dark:bg-surface-dark border-b border-border-light dark:border-border-dark px-8 h-16 flex items-center justify-between z-10"
        >
          <h1 class="font-display text-xl font-bold text-text-primary dark:text-text-dark-primary">
            {{ TAB_LABELS[activeTab] }}
          </h1>
          <ThemeToggle />
        </div>

        <!-- Loading -->
        <div v-if="isLoading" class="flex items-center justify-center h-40">
          <div
            class="w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full animate-spin"
          ></div>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="p-6">
          <p class="text-safety-red text-sm">{{ error }}</p>
        </div>

        <!-- Tab content -->
        <template v-else>

          <!-- OVERVIEW -->
          <div v-if="activeTab === 'overview'" class="p-6">
            <h2 class="font-display text-xl font-bold text-text-primary dark:text-text-dark-primary mb-6">
              Panoramica
            </h2>

            <div v-if="overview" class="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <!-- Total users -->
              <div class="bg-surface-elevated dark:bg-surface-dark-elevated rounded-xl p-6 shadow-sm border-l-4 border-brand-blue">
                <div class="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-4 bg-brand-blue/10">
                  <Users :size="20" class="text-brand-blue" />
                </div>
                <p class="font-display text-2xl font-bold text-text-primary dark:text-text-dark-primary">
                  {{ overview.totalUsers }}
                </p>
                <p class="text-sm text-text-secondary dark:text-text-dark-secondary">Utenti totali</p>
              </div>

              <!-- Registered last 30d -->
              <div class="bg-surface-elevated dark:bg-surface-dark-elevated rounded-xl p-6 shadow-sm border-l-4 border-safety-green">
                <div class="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-4 bg-safety-green/10">
                  <Users :size="20" class="text-safety-green" />
                </div>
                <p class="font-display text-2xl font-bold text-text-primary dark:text-text-dark-primary">
                  {{ overview.registeredLast30d }}
                </p>
                <p class="text-sm text-text-secondary dark:text-text-dark-secondary">Nuovi utenti (30gg)</p>
              </div>

              <!-- SOS last 30d -->
              <div class="bg-surface-elevated dark:bg-surface-dark-elevated rounded-xl p-6 shadow-sm border-l-4 border-safety-red">
                <div class="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-4 bg-safety-red/10">
                  <AlertTriangle :size="20" class="text-safety-red" />
                </div>
                <p class="font-display text-2xl font-bold text-text-primary dark:text-text-dark-primary">
                  {{ overview.sosCasesLast30d }}
                </p>
                <p class="text-sm text-text-secondary dark:text-text-dark-secondary">SOS (30gg)</p>
              </div>

              <!-- Reports pending -->
              <div class="bg-surface-elevated dark:bg-surface-dark-elevated rounded-xl p-6 shadow-sm border-l-4 border-safety-yellow">
                <div class="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-4 bg-safety-yellow/10">
                  <Flag :size="20" class="text-safety-yellow" />
                </div>
                <p class="font-display text-2xl font-bold text-text-primary dark:text-text-dark-primary">
                  {{ overview.reportsPending }}
                </p>
                <p class="text-sm text-text-secondary dark:text-text-dark-secondary">Segnalazioni in attesa</p>
              </div>

              <!-- Feedback last 30d -->
              <div class="bg-surface-elevated dark:bg-surface-dark-elevated rounded-xl p-6 shadow-sm border-l-4 border-brand-blue">
                <div class="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-4 bg-brand-blue/10">
                  <Star :size="20" class="text-brand-blue" />
                </div>
                <p class="font-display text-2xl font-bold text-text-primary dark:text-text-dark-primary">
                  {{ overview.feedbackLast30d }}
                </p>
                <p class="text-sm text-text-secondary dark:text-text-dark-secondary">Feedback (30gg)</p>
              </div>

              <!-- Active zones -->
              <div class="bg-surface-elevated dark:bg-surface-dark-elevated rounded-xl p-6 shadow-sm border-l-4 border-safety-green">
                <div class="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-4 bg-safety-green/10">
                  <Map :size="20" class="text-safety-green" />
                </div>
                <p class="font-display text-2xl font-bold text-text-primary dark:text-text-dark-primary">
                  {{ overview.activeZones }}
                </p>
                <p class="text-sm text-text-secondary dark:text-text-dark-secondary">Zone attive</p>
              </div>

              <!-- Failed notifications -->
              <div class="bg-surface-elevated dark:bg-surface-dark-elevated rounded-xl p-6 shadow-sm border-l-4 border-safety-red">
                <div class="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-4 bg-safety-red/10">
                  <Activity :size="20" class="text-safety-red" />
                </div>
                <p class="font-display text-2xl font-bold text-text-primary dark:text-text-dark-primary">
                  {{ overview.failedNotificationsLast30d }}
                </p>
                <p class="text-sm text-text-secondary dark:text-text-dark-secondary">Notifiche fallite (30gg)</p>
              </div>

              <!-- Cities served -->
              <div class="bg-surface-elevated dark:bg-surface-dark-elevated rounded-xl p-6 shadow-sm border-l-4 border-slate-400">
                <div class="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-4 bg-slate-100 dark:bg-slate-800">
                  <Shield :size="20" class="text-slate-500" />
                </div>
                <p class="font-display text-2xl font-bold text-text-primary dark:text-text-dark-primary">
                  {{ overview.citiesServed }}
                </p>
                <p class="text-sm text-text-secondary dark:text-text-dark-secondary">Città coperte</p>
              </div>
            </div>

            <!-- Pending reports banner -->
            <div
              v-if="overview && overview.reportsPending > 0"
              class="mt-6 p-4 rounded-xl bg-safety-yellow/10 border border-safety-yellow/30"
            >
              <p class="text-sm font-semibold text-safety-yellow">
                ⚠️ {{ overview.reportsPending }} segnalazioni in attesa di moderazione
              </p>
              <button
                @click="activeTab = 'reports'; reportStatusFilter = 'pending'"
                class="text-xs text-brand-blue underline mt-1 cursor-pointer"
              >
                Vai alle segnalazioni →
              </button>
            </div>
          </div>

          <!-- USERS -->
          <div v-else-if="activeTab === 'users'" class="p-6">
            <h2 class="font-display text-xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
              Utenti
            </h2>
            <div v-if="users">
              <div class="overflow-x-auto bg-surface-elevated dark:bg-surface-dark-elevated rounded-xl shadow-sm">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-border-light dark:border-border-dark text-left text-text-secondary dark:text-text-dark-secondary bg-slate-50 dark:bg-slate-800">
                      <th class="px-6 py-3 font-medium text-xs uppercase tracking-wide">Nome</th>
                      <th class="px-6 py-3 font-medium text-xs uppercase tracking-wide">Email</th>
                      <th class="px-6 py-3 font-medium text-xs uppercase tracking-wide">Ruolo</th>
                      <th class="px-6 py-3 font-medium text-xs uppercase tracking-wide">Piano</th>
                      <th class="px-6 py-3 font-medium text-xs uppercase tracking-wide">Registrato</th>
                      <th class="px-6 py-3 font-medium text-xs uppercase tracking-wide">Stato</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border-light dark:divide-border-dark">
                    <tr
                      v-for="user in users.items"
                      :key="user.id"
                      class="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      :class="user.deletedAt ? 'opacity-50' : ''"
                    >
                      <td class="px-6 py-4 text-text-primary dark:text-text-dark-primary font-medium">
                        {{ user.name }}
                      </td>
                      <td class="px-6 py-4 text-text-secondary dark:text-text-dark-secondary">
                        {{ user.email }}
                      </td>
                      <td class="px-6 py-4">
                        <span
                          :class="[
                            'text-xs px-2 py-0.5 rounded-full font-medium',
                            user.role === 'ADMIN'
                              ? 'bg-brand-blue/15 text-brand-blue'
                              : user.role === 'STAFF'
                                ? 'bg-safety-yellow/15 text-safety-yellow'
                                : 'bg-slate-100 dark:bg-slate-800 text-text-secondary dark:text-text-dark-secondary',
                          ]"
                        >
                          {{ user.role }}
                        </span>
                      </td>
                      <td class="px-6 py-4 text-text-secondary dark:text-text-dark-secondary text-xs">
                        {{ user.plan }}
                      </td>
                      <td class="px-6 py-4 text-text-secondary dark:text-text-dark-secondary text-xs">
                        {{ formatDate(user.createdAt) }}
                      </td>
                      <td class="px-6 py-4">
                        <span
                          :class="[
                            'text-xs font-medium',
                            user.deletedAt ? 'text-safety-red' : 'text-safety-green',
                          ]"
                        >
                          {{ user.deletedAt ? 'Disattivato' : 'Attivo' }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div v-if="users.items.length === 0" class="text-center py-8 text-text-secondary dark:text-text-dark-secondary text-sm">
                  Nessun utente trovato.
                </div>
                <div
                  v-if="users.total > 0"
                  class="px-6 py-4 border-t border-border-light dark:border-border-dark"
                >
                  <p class="text-xs text-text-secondary dark:text-text-dark-secondary">
                    Mostrando {{ users.items.length }} di {{ users.total }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- ZONES -->
          <div v-else-if="activeTab === 'zones'" class="p-6">
            <h2 class="font-display text-xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
              Zone
            </h2>
            <div v-if="zones" class="space-y-2">
              <div
                v-for="zone in zones.items"
                :key="zone.id"
                class="flex items-center justify-between p-3 rounded-xl border border-border-light dark:border-border-dark bg-surface-elevated dark:bg-surface-dark-elevated"
              >
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-text-primary dark:text-text-dark-primary truncate">
                    {{ zone.name }}
                  </p>
                  <p class="text-xs text-text-secondary dark:text-text-dark-secondary">
                    {{ zone.cityName }} · Score: {{ zone.finalSafetyScore !== null ? zone.finalSafetyScore : '—' }}
                    · Feedback: {{ zone.feedbackCount30d }} · Segnalazioni: {{ zone.reportsCount30d }}
                  </p>
                </div>
                <button
                  @click="handleToggleZoneService(zone.id, zone.isServiceActive)"
                  :disabled="togglingZoneId === zone.id"
                  :class="[
                    'ml-3 flex-shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-50',
                    zone.isServiceActive
                      ? 'bg-safety-green/15 text-safety-green hover:bg-safety-green/25'
                      : 'bg-slate-100 dark:bg-slate-800 text-text-secondary dark:text-text-dark-secondary hover:bg-slate-200 dark:hover:bg-slate-700',
                  ]"
                >
                  {{ togglingZoneId === zone.id ? '...' : zone.isServiceActive ? '✓ Attivo' : '✗ Inattivo' }}
                </button>
              </div>
              <div v-if="zones.items.length === 0" class="text-center py-8 text-text-secondary dark:text-text-dark-secondary text-sm">
                Nessuna zona trovata.
              </div>
              <p
                v-if="zones.total > zones.limit"
                class="text-xs text-text-secondary dark:text-text-dark-secondary text-center mt-2"
              >
                Mostrando {{ zones.items.length }} di {{ zones.total }}
              </p>
            </div>
          </div>

          <!-- REPORTS -->
          <div v-else-if="activeTab === 'reports'" class="p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="font-display text-xl font-bold text-text-primary dark:text-text-dark-primary">
                Segnalazioni
              </h2>
              <select
                v-model="reportStatusFilter"
                class="text-sm px-3 py-1.5 rounded-lg border border-border-light dark:border-border-dark bg-transparent text-text-primary dark:text-text-dark-primary cursor-pointer"
              >
                <option value="">Tutte</option>
                <option value="pending">In attesa</option>
                <option value="approved">Approvate</option>
                <option value="rejected">Rifiutate</option>
              </select>
            </div>

            <div
              v-if="moderationError"
              class="mb-3 p-3 rounded-lg bg-safety-red/10 text-safety-red text-sm"
            >
              {{ moderationError }}
            </div>

            <div v-if="reports" class="space-y-3">
              <div
                v-for="report in reports.items"
                :key="report.id"
                class="p-4 rounded-xl border border-border-light dark:border-border-dark bg-surface-elevated dark:bg-surface-dark-elevated"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
                        {{ REPORT_CATEGORY_LABELS[report.category] ?? report.category }}
                      </span>
                      <span
                        :class="[
                          'text-xs px-2 py-0.5 rounded-full font-medium',
                          report.status === 'pending'
                            ? 'bg-safety-yellow/15 text-safety-yellow'
                            : report.status === 'approved'
                              ? 'bg-safety-green/15 text-safety-green'
                              : 'bg-slate-200 dark:bg-slate-700 text-text-secondary dark:text-text-dark-secondary',
                        ]"
                      >
                        {{
                          report.status === 'pending'
                            ? 'In attesa'
                            : report.status === 'approved'
                              ? 'Approvata'
                              : 'Rifiutata'
                        }}
                      </span>
                    </div>
                    <p class="text-xs text-text-secondary dark:text-text-dark-secondary">
                      {{ report.zoneName }} · {{ report.cityName }}
                    </p>
                    <p
                      v-if="report.description"
                      class="text-xs text-text-secondary dark:text-text-dark-secondary mt-1 truncate"
                    >
                      {{ report.description }}
                    </p>
                    <p class="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">
                      {{ report.userName ?? 'Anonimo' }} · {{ formatDate(report.createdAt) }}
                    </p>
                  </div>
                  <div v-if="report.status === 'pending'" class="flex gap-2 flex-shrink-0">
                    <button
                      @click="handleModerateReport(report.id, 'approved')"
                      :disabled="moderatingId === report.id"
                      class="px-3 py-1.5 rounded-lg bg-safety-green/15 text-safety-green text-xs font-semibold hover:bg-safety-green/25 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      ✓ Approva
                    </button>
                    <button
                      @click="handleModerateReport(report.id, 'rejected')"
                      :disabled="moderatingId === report.id"
                      class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-text-secondary dark:text-text-dark-secondary text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      ✗ Rifiuta
                    </button>
                  </div>
                </div>
              </div>
              <div
                v-if="reports.items.length === 0"
                class="text-center py-8 text-text-secondary dark:text-text-dark-secondary text-sm"
              >
                Nessuna segnalazione trovata.
              </div>
              <p
                v-if="reports.total > reports.limit"
                class="text-xs text-text-secondary dark:text-text-dark-secondary text-center mt-2"
              >
                Mostrando {{ reports.items.length }} di {{ reports.total }}
              </p>
            </div>
          </div>

          <!-- SOS -->
          <div v-else-if="activeTab === 'sos'" class="p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="font-display text-xl font-bold text-text-primary dark:text-text-dark-primary">
                SOS
              </h2>
              <select
                v-model="sosStatusFilter"
                class="text-sm px-3 py-1.5 rounded-lg border border-border-light dark:border-border-dark bg-transparent text-text-primary dark:text-text-dark-primary cursor-pointer"
              >
                <option value="">Tutti</option>
                <option value="active">Attivi</option>
                <option value="resolved">Risolti</option>
              </select>
            </div>
            <div v-if="sosList" class="space-y-3">
              <div
                v-for="sos in sosList.items"
                :key="sos.id"
                class="p-4 rounded-xl border border-border-light dark:border-border-dark bg-surface-elevated dark:bg-surface-dark-elevated"
              >
                <div class="flex items-center justify-between mb-1">
                  <span class="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
                    {{ sos.userName }}
                  </span>
                  <span
                    :class="[
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      sos.status === 'active'
                        ? 'bg-safety-red/15 text-safety-red'
                        : 'bg-safety-green/15 text-safety-green',
                    ]"
                  >
                    {{ sos.status === 'active' ? '🆘 Attivo' : '✓ Risolto' }}
                  </span>
                </div>
                <p class="text-xs text-text-secondary dark:text-text-dark-secondary">
                  {{ formatDate(sos.createdAt) }}
                </p>
                <p v-if="sos.message" class="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">
                  {{ sos.message }}
                </p>
                <p
                  v-if="sos.followupResponse"
                  class="text-xs text-text-secondary dark:text-text-dark-secondary mt-1"
                >
                  Follow-up: {{ sos.followupResponse }}
                </p>
              </div>
              <div
                v-if="sosList.items.length === 0"
                class="text-center py-8 text-text-secondary dark:text-text-dark-secondary text-sm"
              >
                Nessun SOS trovato.
              </div>
              <p
                v-if="sosList.total > sosList.limit"
                class="text-xs text-text-secondary dark:text-text-dark-secondary text-center mt-2"
              >
                Mostrando {{ sosList.items.length }} di {{ sosList.total }}
              </p>
            </div>
          </div>

          <!-- FEEDBACK -->
          <div v-else-if="activeTab === 'feedback'" class="p-6">
            <h2 class="font-display text-xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
              Feedback ricevuti
            </h2>
            <div v-if="feedback" class="space-y-2">
              <div
                v-for="fb in feedback.items"
                :key="fb.id"
                class="flex items-center gap-3 p-3 rounded-xl border border-border-light dark:border-border-dark bg-surface-elevated dark:bg-surface-dark-elevated"
              >
                <span
                  class="text-lg font-bold w-6 text-center"
                  :class="
                    fb.rating >= 4
                      ? 'text-safety-green'
                      : fb.rating === 3
                        ? 'text-safety-yellow'
                        : 'text-safety-red'
                  "
                >
                  {{ fb.rating }}
                </span>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-text-primary dark:text-text-dark-primary">
                    {{ fb.zoneName }}
                  </p>
                  <p class="text-xs text-text-secondary dark:text-text-dark-secondary">
                    {{ fb.userName }} · {{ formatDate(fb.createdAt) }}
                  </p>
                  <p
                    v-if="fb.note"
                    class="text-xs text-text-secondary dark:text-text-dark-secondary truncate mt-0.5"
                  >
                    {{ fb.note }}
                  </p>
                </div>
              </div>
              <div
                v-if="feedback.items.length === 0"
                class="text-center py-8 text-text-secondary dark:text-text-dark-secondary text-sm"
              >
                Nessun feedback trovato.
              </div>
              <p
                v-if="feedback.total > feedback.limit"
                class="text-xs text-text-secondary dark:text-text-dark-secondary text-center mt-2"
              >
                Mostrando {{ feedback.items.length }} di {{ feedback.total }}
              </p>
            </div>
          </div>

          <!-- AUDIT LOG -->
          <div v-else-if="activeTab === 'audit'" class="p-6">
            <h2 class="font-display text-xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
              Audit Log
            </h2>
            <div v-if="auditLogs" class="space-y-2">
              <div
                v-for="log in auditLogs.items"
                :key="log.id"
                class="p-3 rounded-xl border border-border-light dark:border-border-dark bg-surface-elevated dark:bg-surface-dark-elevated"
              >
                <div class="flex items-center justify-between">
                  <span class="text-xs font-semibold text-brand-blue font-mono">{{ log.action }}</span>
                  <span class="text-xs text-text-secondary dark:text-text-dark-secondary">
                    {{ formatDate(log.createdAt) }}
                  </span>
                </div>
                <p class="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">
                  Admin: {{ log.adminName }} · Target: {{ log.targetType }}/{{ log.targetId.slice(0, 8) }}...
                </p>
              </div>
              <div
                v-if="auditLogs.items.length === 0"
                class="text-center py-8 text-text-secondary dark:text-text-dark-secondary text-sm"
              >
                Nessun log trovato.
              </div>
              <p
                v-if="auditLogs.total > auditLogs.limit"
                class="text-xs text-text-secondary dark:text-text-dark-secondary text-center mt-2"
              >
                Mostrando {{ auditLogs.items.length }} di {{ auditLogs.total }}
              </p>
            </div>
          </div>

          <!-- SETTINGS (placeholder) -->
          <div v-else-if="activeTab === 'settings'" class="p-6">
            <h2 class="font-display text-xl font-bold text-text-primary dark:text-text-dark-primary mb-4">
              Impostazioni
            </h2>
            <div class="flex flex-col items-center justify-center py-24 text-center">
              <div class="w-12 h-12 mb-4 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                <Settings :size="24" class="text-text-secondary dark:text-text-dark-secondary" />
              </div>
              <p class="font-semibold text-text-primary dark:text-text-dark-primary mb-1">Impostazioni</p>
              <p class="text-sm text-text-secondary dark:text-text-dark-secondary">
                Impostazioni disponibili in una prossima versione
              </p>
            </div>
          </div>

        </template>
      </main>
    </div>
  </div>
</template>
