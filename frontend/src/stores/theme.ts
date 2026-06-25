import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  const stored = localStorage.getItem('saferoute_theme')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

  const isDark = ref(stored === 'dark' || (!stored && prefersDark))

  function apply() {
    if (isDark.value) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  function toggle() {
    isDark.value = !isDark.value
    localStorage.setItem('saferoute_theme', isDark.value ? 'dark' : 'light')
  }

  watch(isDark, apply, { immediate: true })

  return { isDark, toggle }
})
