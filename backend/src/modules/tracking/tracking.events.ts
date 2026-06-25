import { EventEmitter } from 'node:events'

class TrackingEventEmitter extends EventEmitter {}

export const trackingEmitter = new TrackingEventEmitter()
trackingEmitter.setMaxListeners(500) // allow many concurrent SSE clients
