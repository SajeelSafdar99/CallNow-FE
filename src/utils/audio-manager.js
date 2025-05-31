import InCallManager from "react-native-incall-manager"
import { Platform } from "react-native"
// Assuming SystemSoundManager is a custom module you have.
// If not, you'll need to implement or replace its functionality.
// For now, we'll assume it exists and works as intended.
import SystemSoundManager from "./system-sound" // Ensure this path is correct

class AudioManager {
  constructor() {
    this.isInitialized = false
    this.currentAudioRoute = "earpiece" // earpiece, speaker, bluetooth, wired
    console.log("AudioManager: Instance created.")
  }

  async initializeAudioSession(isVideoCall = false, isIncomingCall = false) {
    try {
      if (this.isInitialized) {
        console.log("AudioManager: Session already initialized. Reconfiguring for new call type if needed.")
        // Even if initialized, we might need to adjust settings for the new call
      }

      console.log(`AudioManager: Initializing audio session. Video: ${isVideoCall}, Incoming: ${isIncomingCall}`)
      await InCallManager.start({
        media: isVideoCall ? "video" : "audio",
        auto: true,
        ringback: "_DEFAULT_", // Let InCallManager handle ringback if desired, or use custom below
      })
      console.log("AudioManager: InCallManager started.")

      if (isIncomingCall) {
        console.log("AudioManager: Incoming call, starting ringtone.")
        await this.startRingtone()
      } else {
        // For outgoing calls, InCallManager's ringback might be used if `ringback: '_DEFAULT_'`
        // Or you can explicitly start your custom ringback here if needed.
        // await this.startRingback(); // If you want custom ringback for outgoing
      }

      if (isVideoCall) {
        console.log("AudioManager: Video call, setting speaker ON.")
        await this.setSpeakerOn(true)
      } else {
        console.log("AudioManager: Audio call, setting speaker OFF (earpiece).")
        await this.setSpeakerOn(false)
      }

      this.isInitialized = true
      console.log("AudioManager: Audio session initialized successfully.")
    } catch (error) {
      console.error("AudioManager: Error initializing audio session:", error)
      // Don't re-throw, allow app to continue if possible, but log error
    }
  }

  async setSpeakerOn(enabled) {
    try {
      await InCallManager.setForceSpeakerphoneOn(enabled)
      this.currentAudioRoute = enabled ? "speaker" : "earpiece" // Simplified assumption
      console.log(`AudioManager: Speaker ${enabled ? "ON" : "OFF"}. Audio route: ${this.currentAudioRoute}`)
      return true
    } catch (error) {
      console.error("AudioManager: Error setting speaker:", error)
      return false
    }
  }

  async toggleSpeaker() {
    try {
      const currentSpeakerState = this.currentAudioRoute === "speaker"
      const newSpeakerState = !currentSpeakerState
      console.log(`AudioManager: Toggling speaker. Current: ${currentSpeakerState}, New: ${newSpeakerState}`)
      const success = await this.setSpeakerOn(newSpeakerState)
      return { success, isSpeakerOn: newSpeakerState }
    } catch (error) {
      console.error("AudioManager: Error toggling speaker:", error)
      return { success: false, isSpeakerOn: this.currentAudioRoute === "speaker" }
    }
  }

  async setMicrophoneMute(muted) {
    try {
      await InCallManager.setMicrophoneMute(muted)
      console.log(`AudioManager: Microphone ${muted ? "muted" : "unmuted"}`)
      return true
    } catch (error) {
      console.error("AudioManager: Error setting microphone mute:", error)
      return false
    }
  }

  async getAvailableAudioRoutes() {
    // This is a simplified version. Real implementation might involve native event listeners.
    console.log("AudioManager: Getting available audio routes (simplified).")
    const routes = ["earpiece", "speaker"]
    // InCallManager might provide info on bluetooth/wired connections via events or methods.
    // For now, this is a placeholder.
    // if (InCallManager.getIsWiredHeadsetPluggedIn()) routes.push("wired");
    // if (InCallManager.getIsBluetoothHeadsetPluggedIn()) routes.push("bluetooth");
    return routes
  }

  async setAudioRoute(route) {
    try {
      console.log(`AudioManager: Attempting to set audio route to: ${route}`)
      switch (route) {
        case "speaker":
          await this.setSpeakerOn(true)
          break
        case "earpiece":
          await this.setSpeakerOn(false) // This typically means turn speaker off
          // InCallManager usually defaults to earpiece if speaker is off and no other device.
          this.currentAudioRoute = "earpiece"
          break
        case "bluetooth":
          // InCallManager might handle some of this automatically when a BT device connects.
          // Explicit control might be needed via native modules for specific BT device selection.
          await InCallManager.setForceSpeakerphoneOn(false) // Ensure speaker is off
          // Potentially: InCallManager.chooseBluetoothDevice(deviceId);
          this.currentAudioRoute = "bluetooth"
          console.warn("AudioManager: Bluetooth routing is complex and may require native implementation.")
          break
        case "wired":
          // InCallManager usually handles this automatically when wired headset is plugged in.
          await InCallManager.setForceSpeakerphoneOn(false) // Ensure speaker is off
          this.currentAudioRoute = "wired"
          break
        default:
          console.warn(`AudioManager: Unknown audio route: ${route}. Defaulting to earpiece.`)
          await this.setSpeakerOn(false)
          this.currentAudioRoute = "earpiece"
      }
      console.log(`AudioManager: Audio route changed to: ${this.currentAudioRoute}`)
      return true
    } catch (error) {
      console.error(`AudioManager: Error setting audio route to ${route}:`, error)
      return false
    }
  }

  enableProximitySensor(enabled) {
    // InCallManager's `auto: true` in start() should handle this.
    // Explicit control might be needed if `auto` is false or for specific behaviors.
    try {
      if (Platform.OS === "android") {
        if (enabled) {
          // InCallManager.turnScreenOff(); // This is an action, not enabling the sensor
          console.log(
            "AudioManager: Proximity sensor effect (screen off) would be active on Android if call is ongoing.",
          )
        } else {
          // InCallManager.turnScreenOn();
          console.log("AudioManager: Proximity sensor effect (screen on) would be active on Android.")
        }
      }
      // iOS handles proximity automatically with an active audio session.
      console.log(`AudioManager: Proximity sensor management typically handled by InCallManager 'auto' mode.`)
    } catch (error) {
      console.error("AudioManager: Error with proximity sensor related action:", error)
    }
  }

  async startRingback(type = "_DEFAULT_") {
    // type can be '_DEFAULT_', '_BUNDLE_', or a filename
    try {
      console.log(`AudioManager: Starting ringback tone (type: ${type}).`)
      await InCallManager.startRingback(type) // Use InCallManager's ringback
    } catch (error) {
      console.error("AudioManager: Error starting ringback:", error)
    }
  }

  async stopRingback() {
    try {
      console.log("AudioManager: Stopping ringback tone.")
      await InCallManager.stopRingback()
    } catch (error) {
      console.error("AudioManager: Error stopping ringback:", error)
    }
  }

  async startRingtone(type = "_DEFAULT_") {
    // type can be '_DEFAULT_', '_BUNDLE_', or a filename
    try {
      console.log(`AudioManager: Starting ringtone (type: ${type}).`)
      // For incoming calls, InCallManager can also play a ringtone.
      // If you use `SystemSoundManager`, ensure it doesn't conflict.
      // await InCallManager.startRingtone(type);
      // OR using your SystemSoundManager:
      await SystemSoundManager.playDefaultRingtone() // Ensure this method exists and works
      console.log("AudioManager: System ringtone started via SystemSoundManager.")
    } catch (error) {
      console.error("AudioManager: Error starting ringtone:", error)
    }
  }

  async stopRingtone() {
    try {
      console.log("AudioManager: Stopping ringtone.")
      // await InCallManager.stopRingtone();
      // OR using your SystemSoundManager:
      await SystemSoundManager.stopRingtone() // Ensure this method exists and works
      console.log("AudioManager: System ringtone stopped via SystemSoundManager.")
    } catch (error) {
      console.error("AudioManager: Error stopping ringtone:", error)
    }
  }

  async stopAllSounds() {
    console.log("AudioManager: Stopping all sounds (ringback and ringtone).")
    try {
      await this.stopRingback()
      await this.stopRingtone()
      console.log("AudioManager: All sounds stopped.")
    } catch (error) {
      console.error("AudioManager: Error in stopAllSounds:", error)
    }
  }

  async cleanup() {
    try {
      if (!this.isInitialized) {
        console.log("AudioManager: Cleanup called but not initialized. Skipping.")
        return
      }
      console.log("AudioManager: Cleaning up audio session.")

      await this.stopAllSounds() // Use the new method

      await InCallManager.stop()
      console.log("AudioManager: InCallManager stopped.")

      this.isInitialized = false
      this.currentAudioRoute = "earpiece" // Reset to default
      console.log("AudioManager: Audio session cleaned up successfully.")
    } catch (error) {
      console.error("AudioManager: Error cleaning up audio session:", error)
    }
  }

  getCurrentAudioRoute() {
    return this.currentAudioRoute
  }

  isSpeakerphoneOn() {
    // Renamed for clarity to match InCallManager
    return this.currentAudioRoute === "speaker"
  }
}

export default new AudioManager()
