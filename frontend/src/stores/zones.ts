import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Zone } from '@/types'
import { fetchZones } from '@/api/zones'
import { ApiError } from '@/api/client'

export const useZonesStore = defineStore('zones', () => {
  const zones = ref<Zone[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const lastBbox = ref<string | null>(null)

  async function loadZones(opts?: { cityId?: string; bbox?: string }) {
    // Avoid refetch if bbox hasn't changed
    const bboxKey = opts?.bbox ?? opts?.cityId ?? 'all'
    if (bboxKey === lastBbox.value && zones.value.length > 0) return

    isLoading.value = true
    error.value = null
    try {
      zones.value = await fetchZones(opts)
      lastBbox.value = bboxKey
    } catch (e) {
      if (e instanceof ApiError) {
        error.value = e.status === 0
          ? 'Backend non raggiungibile. Verifica che il server sia avviato.'
          : `Errore caricamento zone: ${e.message}`
      } else {
        error.value = 'Errore caricamento zone'
      }
      zones.value = []
    } finally {
      isLoading.value = false
    }
  }

  function clearError() { error.value = null }

  function invalidateCache() {
    lastBbox.value = null
  }

  function updateZone(zone: Zone) {
    const idx = zones.value.findIndex(z => z.id === zone.id)
    if (idx !== -1) zones.value[idx] = zone
  }

  return { zones, isLoading, error, loadZones, clearError, invalidateCache, updateZone }
})
