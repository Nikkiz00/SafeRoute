<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Map, Route, AlertTriangle, Users, User } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

const navItems = [
  { label: 'Mappa', icon: Map, path: '/map' },
  { label: 'Percorsi', icon: Route, path: '/routes' },
  { label: 'SOS', icon: AlertTriangle, path: '/sos', isSOS: true },
  { label: 'Contatti', icon: Users, path: '/contacts' },
  { label: 'Profilo', icon: User, path: '/profile' },
]

function isActive(path: string) {
  return route.path === path
}

function navigate(path: string) {
  router.push(path)
}
</script>

<template>
  <nav
    class="fixed bottom-0 left-0 right-0 z-nav bg-surface-elevated dark:bg-surface-dark-elevated border-t border-border-light dark:border-border-dark"
    style="padding-bottom: env(safe-area-inset-bottom)"
    aria-label="Navigazione principale"
  >
    <div class="flex items-center justify-around h-18">
      <template v-for="item in navItems" :key="item.path">
        <!-- SOS central button -->
        <button
          v-if="item.isSOS"
          @click="navigate(item.path)"
          class="relative flex flex-col items-center justify-center cursor-pointer tap-highlight-none -mt-4"
          :aria-label="item.label"
          :aria-current="isActive(item.path) ? 'page' : undefined"
        >
          <span class="flex items-center justify-center w-14 h-14 rounded-full bg-sos-red shadow-sos text-white">
            <component :is="item.icon" :size="24" />
          </span>
          <span class="text-xs mt-1 font-medium text-sos-red">{{ item.label }}</span>
        </button>

        <!-- Regular nav item -->
        <button
          v-else
          @click="navigate(item.path)"
          class="relative flex flex-col items-center justify-center min-w-[64px] min-h-[48px] gap-1 cursor-pointer tap-highlight-none"
          :aria-label="item.label"
          :aria-current="isActive(item.path) ? 'page' : undefined"
        >
          <component
            :is="item.icon"
            :size="22"
            :class="isActive(item.path) ? 'text-brand-blue' : 'text-text-secondary dark:text-text-dark-secondary'"
          />
          <span
            :class="[
              'text-xs font-medium',
              isActive(item.path) ? 'text-brand-blue' : 'text-text-secondary dark:text-text-dark-secondary'
            ]"
          >
            {{ item.label }}
          </span>
          <!-- Active dot indicator -->
          <span
            v-if="isActive(item.path)"
            class="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-blue"
            aria-hidden="true"
          ></span>
        </button>
      </template>
    </div>
  </nav>
</template>
