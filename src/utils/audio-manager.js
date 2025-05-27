import InCallManager from "react-native-incall-manager"
import { Platform } from "react-native"
import SystemSoundManager from './system-sound'

class AudioManager {
  constructor() {
    this.isInitialized = false
    this.currentAudioRoute = "earpiece" // earpiece, speaker, bluetooth, wired
  }

  // Initialize audio session for call
  async initializeAudioSession(isVideoCall = false) {
    try {
      if (this.isInitialized) return

      // Start InCallManager
      await InCallManager.start({
        media: isVideoCall ? "video" : "audio",
        auto: true, // Automatically handle proximity sensor
        ringback: false, // We handle ringback tones separately
      })

      // Set initial audio route
      if (isVideoCall) {
        // Video calls default to speaker
        await this.setSpeakerOn(true)
      } else {
        // Audio calls default to earpiece
        await this.setSpeakerOn(false)
      }

      this.isInitialized = true
      console.log("Audio session initialized")
    } catch (error) {
      console.error("Error initializing audio session:", error)
      throw error
    }
  }

  // Set speaker on/off
  async setSpeakerOn(enabled) {
    try {
      if (enabled) {
        await InCallManager.setForceSpeakerphoneOn(true)
        this.currentAudioRoute = "speaker"
      } else {
        await InCallManager.setForceSpeakerphoneOn(false)
        this.currentAudioRoute = "earpiece"
      }

      console.log(`Audio route changed to: ${this.currentAudioRoute}`)
      return true
    } catch (error) {
      console.error("Error setting speaker:", error)
      return false
    }
  }

  // Toggle speaker
  async toggleSpeaker() {
    try {
      const newState = this.currentAudioRoute !== "speaker"
      const success = await this.setSpeakerOn(newState)
      return { success, isSpeakerOn: newState }
    } catch (error) {
      console.error("Error toggling speaker:", error)
      return { success: false, isSpeakerOn: this.currentAudioRoute === "speaker" }
    }
  }

  // Mute/unmute microphone
  async setMicrophoneMute(muted) {
    try {
      await InCallManager.setMicrophoneMute(muted)
      console.log(`Microphone ${muted ? "muted" : "unmuted"}`)
      return true
    } catch (error) {
      console.error("Error setting microphone mute:", error)
      return false
    }
  }

  // Get available audio routes
  async getAvailableAudioRoutes() {
    try {
      // This would typically come from a native module
      // For now, we'll return common routes
      const routes = ["earpiece", "speaker"]

      // Check if bluetooth is available
      if (Platform.OS === "ios") {
        // iOS specific bluetooth detection would go here
        routes.push("bluetooth")
      } else {
        // Android specific bluetooth detection would go here
        routes.push("bluetooth")
      }

      // Check if wired headset is connected
      routes.push("wired")

      return routes
    } catch (error) {
      console.error("Error getting audio routes:", error)
      return ["earpiece", "speaker"]
    }
  }

  // Set specific audio route
  async setAudioRoute(route) {
    try {
      switch (route) {
        case "speaker":
          await this.setSpeakerOn(true)
          break
        case "earpiece":
          await this.setSpeakerOn(false)
          break
        case "bluetooth":
          // Handle bluetooth routing
          await InCallManager.setForceSpeakerphoneOn(false)
          // Additional bluetooth specific code would go here
          this.currentAudioRoute = "bluetooth"
          break
        case "wired":
          // Handle wired headset routing
          await InCallManager.setForceSpeakerphoneOn(false)
          this.currentAudioRoute = "wired"
          break
        default:
          await this.setSpeakerOn(false)
      }

      console.log(`Audio route set to: ${route}`)
      return true
    } catch (error) {
      console.error("Error setting audio route:", error)
      return false
    }
  }

  // Handle proximity sensor (for audio calls)
  enableProximitySensor(enabled) {
    try {
      if (Platform.OS === "android") {
        InCallManager.turnScreenOff()
      }
      // iOS handles this automatically with InCallManager
      console.log(`Proximity sensor ${enabled ? "enabled" : "disabled"}`)
    } catch (error) {
      console.error("Error handling proximity sensor:", error)
    }
  }

  // Start ringback tone (for outgoing calls)
  async startRingback() {
    try {
      // await InCallManager.startRingback("_BUNDLE_")
      console.log("Ringback tone started")
    } catch (error) {
      console.error("Error starting ringback:", error)
    }
  }

  // Stop ringback tone
  async stopRingback() {
    try {
      // await InCallManager.stopRingback()
      console.log("Ringback tone stopped")
    } catch (error) {
      console.error("Error stopping ringback:", error)
    }
  }

  // Start ringtone (for incoming calls)
  async startRingtone() {
    try {
      // Use system ringtone instead of InCallManager
      await SystemSoundManager.playDefaultRingtone();
      console.log("System ringtone started");
    } catch (error) {
      console.error("Error starting ringtone:", error);
    }
  }

  // Stop ringtone
  async stopRingtone() {
    try {
      await SystemSoundManager.stopRingtone();
      console.log("System ringtone stopped");
    } catch (error) {
      console.error("Error stopping ringtone:", error);
    }
  }


  // Clean up audio session
  async cleanup() {
    try {
      if (!this.isInitialized) return

      // Stop any playing tones
      await this.stopRingback()
      await this.stopRingtone()

      // Stop InCallManager
      await InCallManager.stop()

      this.isInitialized = false
      this.currentAudioRoute = "earpiece"

      console.log("Audio session cleaned up")
    } catch (error) {
      console.error("Error cleaning up audio session:", error)
    }
  }

  // Get current audio route
  getCurrentAudioRoute() {
    return this.currentAudioRoute
  }

  // Check if speaker is on
  isSpeakerOn() {
    return this.currentAudioRoute === "speaker"
  }
}

// Export singleton instance
export default new AudioManager()
