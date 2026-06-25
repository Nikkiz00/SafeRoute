<script setup lang="ts">
import { Sun, Moon } from 'lucide-vue-next'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()
</script>

<template>
  <button
    @click="themeStore.toggle"
    class="inline-flex items-center justify-center w-10 h-10 rounded-xl text-text-secondary dark:text-text-dark-secondary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer tap-highlight-none"
    :aria-label="themeStore.isDark ? 'Passa alla modalità chiara' : 'Passa alla modalità scura'"
  >
    <Sun v-if="themeStore.isDark" :size="20" />
    <Moon v-else :size="20" />
  </button>
</template>
