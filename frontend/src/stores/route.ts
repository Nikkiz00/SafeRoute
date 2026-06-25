import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RouteSession } from '@/types'

export const useRouteStore = defineStore('route', () => {
  const activeSession = ref<RouteSession | null>(null)
  const lastPosition = ref<{ lat: number; lng: number; accuracy?: number } | null>(null)
  const isTracking = ref(false)
  const error = ref<string | null>(null)
  const destinationName = ref<string | null>(null)
  const routePreference = ref<'safe' | 'balanced' | 'fast'>('balanced')
  const routeDistanceKm = ref<number | null>(null)
  const routeDurationMin = ref<number | null>(null)

  function setActiveSession(session: RouteSession | null) {
    activeSession.value = session
    if (session?.latestPosition) {
      lastPosition.value = {
        lat: session.latestPosition.lat,
        lng: session.latestPosition.lng,
        accuracy: session.latestPosition.accuracy ?? undefined,
      }
    }
  }

  function setLastPosition(pos: { lat: number; lng: number; accuracy?: number }) {
    lastPosition.value = pos
  }

  function setTracking(val: boolean) {
    isTracking.value = val
  }

  function setError(msg: string | null) {
    error.value = msg
  }

  function setDestinationName(name: string | null) {
    destinationName.value = name
  }

  function setRoutePreference(pref: 'safe' | 'balanced' | 'fast') {
    routePreference.value = pref
  }

  function setRouteInfo(distanceKm: number | null, durationMin: number | null) {
    routeDistanceKm.value = distanceKm
    routeDurationMin.value = durationMin
  }

  function clearRoute() {
    activeSession.value = null
    lastPosition.value = null
    isTracking.value = false
    error.value = null
    destinationName.value = null
    routePreference.value = 'balanced'
    routeDistanceKm.value = null
    routeDurationMin.value = null
  }

  return {
    activeSession,
    lastPosition,
    isTracking,
    error,
    destinationName,
    routePreference,
    routeDistanceKm,
    routeDurationMin,
    setActiveSession,
    setLastPosition,
    setTracking,
    setError,
    setDestinationName,
    setRoutePreference,
    setRouteInfo,
    clearRoute,
  }
})
