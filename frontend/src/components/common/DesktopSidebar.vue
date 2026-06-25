<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Map, Route, AlertTriangle, Users, User, LogOut, Shield } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const showLogoutConfirm = ref(false)

const navItems = [
  { label: 'Mappa', icon: Map, path: '/map' },
  { label: 'Percorsi', icon: Route, path: '/routes' },
  { label: 'Contatti', icon: Users, path: '/contacts' },
  { label: 'Profilo', icon: User, path: '/profile' },
]

function isActive(path: string) {
  return route.path === path
}

function navigate(path: string) {
  router.push(path)
}

async function confirmLogout() {
  showLogoutConfirm.value = false
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <aside
    class="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 z-nav bg-surface-elevated dark:bg-surface-dark-elevated border-r border-border-light dark:border-border-dark"
    aria-label="Sidebar navigazione"
  >
    <!-- Logo -->
    <div class="flex items-center gap-3 h-16 px-6 border-b border-border-light dark:border-border-dark">
      <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-blue">
        <Shield :size="16" class="text-white" />
      </div>
      <span class="font-display font-bold text-lg text-text-primary dark:text-text-dark-primary">SafeRoute</span>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 px-3 py-4 space-y-1">
      <button
        v-for="item in navItems"
        :key="item.path"
        @click="navigate(item.path)"
        :class="[
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer tap-highlight-none',
          isActive(item.path)
            ? 'bg-brand-blue/10 text-brand-blue'
            : 'text-text-secondary dark:text-text-dark-secondary hover:bg-slate-100 dark:hover:bg-slate-800'
        ]"
        :aria-current="isActive(item.path) ? 'page' : undefined"
      >
        <component :is="item.icon" :size="18" />
        {{ item.label }}
      </button>

      <!-- SOS button in sidebar -->
      <button
        @click="navigate('/sos')"
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sos-red hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer tap-highlight-none"
      >
        <AlertTriangle :size="18" />
        SOS Emergenza
      </button>

      <!-- Admin link -->
      <button
        v-if="auth.isAdmin"
        @click="navigate('/admin')"
        :class="[
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer tap-highlight-none',
          isActive('/admin')
            ? 'bg-brand-blue/10 text-brand-blue'
            : 'text-text-secondary dark:text-text-dark-secondary hover:bg-slate-100 dark:hover:bg-slate-800'
        ]"
      >
        <Shield :size="18" />
        Admin Panel
      </button>
    </nav>

    <!-- User footer -->
    <div class="p-4 border-t border-border-light dark:border-border-dark">
      <div class="flex items-center gap-3 mb-3">
        <div class="flex items-center justify-center w-9 h-9 rounded-full bg-brand-blue/20 text-brand-blue font-semibold text-sm">
          {{ auth.getInitials() }}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-text-primary dark:text-text-dark-primary truncate">
            {{ auth.user?.name }}
          </p>
          <p class="text-xs text-text-secondary dark:text-text-dark-secondary truncate">
            {{ auth.user?.plan }}
          </p>
        </div>
      </div>
      <button
        @click="showLogoutConfirm = true"
        class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-secondary dark:text-text-dark-secondary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
      >
        <LogOut :size="16" />
        Esci
      </button>
    </div>
  </aside>

  <!-- Logout confirm modal -->
  <div v-if="showLogoutConfirm" class="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
    <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="showLogoutConfirm = false"></div>
    <div class="relative bg-surface-elevated dark:bg-surface-dark-elevated rounded-2xl shadow-xl p-6 w-full max-w-sm">
      <h3 class="font-display font-bold text-lg text-text-primary dark:text-text-dark-primary mb-2">Esci dall'account</h3>
      <p class="text-sm text-text-secondary dark:text-text-dark-secondary mb-6">Vuoi davvero uscire dal tuo account?</p>
      <div class="flex gap-3">
        <button @click="showLogoutConfirm = false" class="flex-1 py-3 rounded-xl border border-border-light dark:border-border-dark text-sm font-medium text-text-primary dark:text-text-dark-primary cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          Annulla
        </button>
        <button @click="confirmLogout" class="flex-1 py-3 rounded-xl bg-safety-red text-white text-sm font-semibold cursor-pointer hover:brightness-95 transition-all">
          Esci
        </button>
      </div>
    </div>
  </div>
</template>
