/// <reference types="vite/client" />
import type { AirportApi } from '../../shared/ipc'

declare global {
  interface Window {
    airport: AirportApi
  }
}

export {}
