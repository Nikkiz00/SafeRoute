<script setup lang="ts">
import type { ZoneLevel } from '@/types'

interface Props {
  level: ZoneLevel
  label?: string
}

const props = withDefaults(defineProps<Props>(), {
  label: undefined,
})

const levelConfig: Record<ZoneLevel, { bg: string; text: string; dot: string; defaultLabel: string }> = {
  safe:     { bg: 'bg-safety-green/15',  text: 'text-green-700 dark:text-green-400',   dot: 'bg-safety-green',  defaultLabel: 'Sicuro' },
  caution:  { bg: 'bg-safety-yellow/15', text: 'text-yellow-700 dark:text-yellow-300', dot: 'bg-safety-yellow', defaultLabel: 'Attenzione' },
  danger:   { bg: 'bg-safety-red/15',    text: 'text-red-700 dark:text-red-400',       dot: 'bg-safety-red',    defaultLabel: 'Pericoloso' },
  critical: { bg: 'bg-safety-purple/15', text: 'text-purple-700 dark:text-purple-400', dot: 'bg-safety-purple', defaultLabel: 'Molto pericoloso' },
  unknown:  { bg: 'bg-safety-gray/20',   text: 'text-text-secondary',                  dot: 'bg-safety-gray',   defaultLabel: 'Sconosciuto' },
}

const config = levelConfig[props.level]
const displayLabel = props.label ?? config.defaultLabel
</script>

<template>
  <span
    :class="[config.bg, config.text, 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium']"
  >
    <span :class="[config.dot, 'w-2 h-2 rounded-full shrink-0']" aria-hidden="true"></span>
    {{ displayLabel }}
  </span>
</template>
