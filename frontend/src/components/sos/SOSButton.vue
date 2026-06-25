<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { AlertTriangle } from 'lucide-vue-next'

const emit = defineEmits<{
  activated: []
}>()

// Progress state (0–100)
const progress = ref(0)
const isPressed = ref(false)
const LONG_PRESS_DURATION = 1500
const INTERVAL_MS = 15

let intervalId: ReturnType<typeof setInterval> | null = null
const circumference = 2 * Math.PI * 28 // radius 28

const dashOffset = ref(circumference)

function startPress() {
  if (intervalId) return
  isPressed.value = true
  progress.value = 0

  intervalId = setInterval(() => {
    progress.value += (INTERVAL_MS / LONG_PRESS_DURATION) * 100
    dashOffset.value = circumference - (circumference * progress.value) / 100

    if (progress.value >= 100) {
      clearPress()
      triggerSOS()
    }
  }, INTERVAL_MS)
}

function clearPress() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
  isPressed.value = false
  progress.value = 0
  dashOffset.value = circumference
}

function cancelPress() {
  clearPress()
}

function triggerSOS() {
  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200])
  }
  emit('activated')
}

onUnmounted(() => {
  clearPress()
})
</script>

<template>
  <button
    @pointerdown.prevent="startPress"
    @pointerup="cancelPress"
    @pointerleave="cancelPress"
    @pointercancel="cancelPress"
    class="relative flex items-center justify-center w-16 h-16 rounded-full bg-sos-red text-white cursor-pointer tap-highlight-none select-none touch-none"
    :class="isPressed ? 'scale-110' : 'animate-pulse-sos hover:scale-105 transition-transform duration-150'"
    style="box-shadow: 0 0 0 8px rgba(239,68,68,0.25), 0 8px 25px rgba(220,38,38,0.5)"
    aria-label="Attiva emergenza SOS, tieni premuto 1.5 secondi"
    role="button"
    :aria-pressed="isPressed"
  >
    <!-- Progress ring SVG -->
    <svg
      class="absolute inset-0 -rotate-90"
      width="64"
      height="64"
      viewBox="0 0 64 64"
      aria-hidden="true"
    >
      <!-- Background circle -->
      <circle
        cx="32" cy="32" r="28"
        fill="none"
        stroke="rgba(255,255,255,0.3)"
        stroke-width="4"
      />
      <!-- Progress circle -->
      <circle
        cx="32" cy="32" r="28"
        fill="none"
        stroke="#FCA5A5"
        stroke-width="4"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="dashOffset"
        style="transition: stroke-dashoffset 0.015s linear"
      />
    </svg>

    <AlertTriangle :size="28" class="relative z-10" />
    <span class="sr-only">SOS</span>
  </button>
</template>
