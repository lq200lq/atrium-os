import { defineStore } from 'pinia'
import { useNotification } from './notification'

export const useShellUi = defineStore('shellUi', {
  state: () => ({
    notificationsOpen: false,
    spotlightOpen: false,
  }),
  actions: {
    toggleNotifications() {
      this.notificationsOpen = !this.notificationsOpen
      if (this.notificationsOpen) {
        this.spotlightOpen = false
        useNotification().markAllRead()
      }
    },
    openSpotlight() {
      this.spotlightOpen = true
      this.notificationsOpen = false
    },
    closeOverlays() {
      this.notificationsOpen = false
      this.spotlightOpen = false
    },
  },
})
