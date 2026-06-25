import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SOSActivationResult } from '@/types'

export type SOSFlowState = 'idle' | 'locating' | 'sending' | 'active' | 'followup_pending' | 'followup_done' | 'error'

export const useSOSStore = defineStore('sos', () => {
  const flowState = ref<SOSFlowState>('idle')
  const activationResult = ref<SOSActivationResult | null>(null)
  const sosId = ref<string | null>(null)
  const error = ref<string | null>(null)
  const showFlow = ref(false)

  function startFlow() {
    flowState.value = 'locating'
    showFlow.value = true
    error.value = null
    activationResult.value = null
  }

  function setSending() {
    flowState.value = 'sending'
  }

  function setActive(result: SOSActivationResult) {
    activationResult.value = result
    sosId.value = result.sosId
    flowState.value = 'active'
  }

  function setError(msg: string) {
    error.value = msg
    flowState.value = 'error'
  }

  function requestFollowup() {
    flowState.value = 'followup_pending'
  }

  function completeFollowup() {
    flowState.value = 'followup_done'
    setTimeout(() => {
      showFlow.value = false
      flowState.value = 'idle'
    }, 2000)
  }

  function dismiss() {
    showFlow.value = false
    flowState.value = 'idle'
  }

  return {
    flowState, activationResult, sosId, error, showFlow,
    startFlow, setSending, setActive, setError, requestFollowup, completeFollowup, dismiss,
  }
})
