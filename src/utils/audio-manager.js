import InCallManager from "react-native-incall-manager"
import { Platform } from "react-native"
import SystemSoundManager from "./system-sound" // Ensure this path is correct

const AM_LOG_PREFIX = "[AudioManager]"

class AudioManager {
  constructor() {
    this.isInitialized = false
    this.currentAudioRoute = "earpiece"
    this.isRingtonePlaying = false // Track system ringtone state
    this.isRingbackPlaying = false // Track custom ringback state
    console.log(`${AM_LOG_PREFIX} Instance created. Initialized: ${this.isInitialized}`)
  }

  async initializeAudioSession(isVideoCall = false, isIncomingCall = false, isPreAcceptedCall = false) {
    try {
      if (this.isInitialized) {
        console.log(`${AM_LOG_PREFIX} Session already initialized. Reconfiguring for new call type if needed.`)
        // Potentially stop existing sounds if re-initializing for a new call
        // await this.stopAllSounds(); // Consider if this is needed or handled elsewhere
      }

      console.log(
        `${AM_LOG_PREFIX} Initializing audio session. Video: ${isVideoCall}, Incoming: ${isIncomingCall}, PreAccepted: ${isPreAcceptedCall}`,
      )
      await InCallManager.start({
        media: isVideoCall ? "video" : "audio",
        auto: true,
        // If it's an incoming call that's NOT pre-accepted, InCallManager might play a ringtone.
        // Otherwise, don't specify ringback here to prevent InCallManager from starting one
        // when the app intends to manage it or when it's a pre-accepted/outgoing call.
        ringback: isIncomingCall && !isPreAcceptedCall && Platform.OS === "android" ? "_DEFAULT_" : "",
      })
      console.log(`${AM_LOG_PREFIX} InCallManager started.`)

      if (isIncomingCall && !isPreAcceptedCall) {
        console.log(
          `${AM_LOG_PREFIX} initializeAudioSession - Condition MET for starting OS ringtone (via SystemSoundManager). isIncomingCall: ${isIncomingCall}, isPreAcceptedCall: ${isPreAcceptedCall}`,
        )
        await this.startRingtone() // App-controlled ringtone via SystemSoundManager
      } else {
        console.log(
          `${AM_LOG_PREFIX} initializeAudioSession - Condition NOT MET for starting OS ringtone directly. isIncomingCall: ${isIncomingCall}, isPreAcceptedCall: ${isPreAcceptedCall}`,
        )
      }

      if (!isPreAcceptedCall) {
        if (isVideoCall) {
          console.log(`${AM_LOG_PREFIX} Video call (not pre-accepted), setting speaker ON initially.`)
          await this.setSpeakerOn(true)
        } else {
          console.log(
            `${AM_LOG_PREFIX} Audio call (not pre-accepted or outgoing), setting speaker OFF (earpiece) initially.`,
          )
          await this.setSpeakerOn(false)
        }
      } else {
        console.log(
          `${AM_LOG_PREFIX} Pre-accepted call, initial speaker state will be managed by CallScreen's defaults or restored state. Current route: ${this.currentAudioRoute}`,
        )
      }

      this.isInitialized = true
      console.log(`${AM_LOG_PREFIX} Audio session initialized successfully.`)
    } catch (error) {
      console.error(`${AM_LOG_PREFIX} Error initializing audio session:`, error)
      this.isInitialized = false
    }
  }

  async setSpeakerOn(enabled) {
    try {
      await InCallManager.setForceSpeakerphoneOn(enabled)
      this.currentAudioRoute = enabled ? "speaker" : "earpiece"
      console.log(`${AM_LOG_PREFIX} Speaker ${enabled ? "ON" : "OFF"}. Audio route: ${this.currentAudioRoute}`)
      return true
    } catch (error) {
      console.error(`${AM_LOG_PREFIX} Error setting speaker:`, error)
      return false
    }
  }

  async toggleSpeaker() {
    try {
      const currentSpeakerState = this.currentAudioRoute === "speaker"
      const newSpeakerState = !currentSpeakerState
      console.log(`${AM_LOG_PREFIX} Toggling speaker. Current: ${currentSpeakerState}, New: ${newSpeakerState}`)
      const success = await this.setSpeakerOn(newSpeakerState)
      return { success, isSpeakerOn: newSpeakerState }
    } catch (error) {
      console.error(`${AM_LOG_PREFIX} Error toggling speaker:`, error)
      return { success: false, isSpeakerOn: this.currentAudioRoute === "speaker" }
    }
  }

  async setMicrophoneMute(muted) {
    try {
      await InCallManager.setMicrophoneMute(muted)
      console.log(`${AM_LOG_PREFIX} Microphone ${muted ? "muted" : "unmuted"}`)
      return true
    } catch (error) {
      console.error(`${AM_LOG_PREFIX} Error setting microphone mute:`, error)
      return false
    }
  }

  async getAvailableAudioRoutes() {
    console.log(`${AM_LOG_PREFIX} Getting available audio routes (simplified).`)
    const routes = ["earpiece", "speaker"]
    return routes
  }

  async setAudioRoute(route) {
    try {
      console.log(`${AM_LOG_PREFIX} Attempting to set audio route to: ${route}`)
      switch (route) {
        case "speaker":
          await this.setSpeakerOn(true)
          break
        case "earpiece":
        case "bluetooth":
        case "wired":
          await this.setSpeakerOn(false)
          if (route === "bluetooth" || route === "wired") {
            console.warn(
              `${AM_LOG_PREFIX} Set speaker OFF for ${route}. Actual device selection depends on OS and connected peripherals.`,
            )
          }
          break
        default:
          console.warn(`${AM_LOG_PREFIX} Unknown audio route: ${route}. Defaulting to earpiece.`)
          await this.setSpeakerOn(false)
      }
      console.log(
        `${AM_LOG_PREFIX} Audio route set command issued for: ${route}. Current internal route: ${this.currentAudioRoute}`,
      )
      return true
    } catch (error) {
      console.error(`${AM_LOG_PREFIX} Error setting audio route to ${route}:`, error)
      return false
    }
  }

  enableProximitySensor(enabled) {
    try {
      if (Platform.OS === "android") {
        InCallManager.setProximitySensorOn(enabled)
        console.log(`${AM_LOG_PREFIX} Proximity sensor explicit control set to: ${enabled} (Android).`)
      } else {
        console.log(
          `${AM_LOG_PREFIX} Proximity sensor control is typically automatic on iOS or managed by InCallManager's 'auto' mode.`,
        )
      }
    } catch (error) {
      console.error(`${AM_LOG_PREFIX} Error with proximity sensor action:`, error)
    }
  }

  async startRingback(ringbackFileName = "my_custom_ringback.mav") {
    if (this.isRingbackPlaying) {
      console.log(`${AM_LOG_PREFIX} startRingback called but already playing. Skipping.`)
      return
    }
    console.log(`${AM_LOG_PREFIX} startRingback INVOKED (for caller's device). File: ${ringbackFileName}`)
    try {
      // Ensure InCallManager is not set to play its own ringback if we use a custom one
      // This might require InCallManager.start({ ringback: '' }) before this.
      await InCallManager.startRingback(ringbackFileName)
      this.isRingbackPlaying = true
      console.log(`${AM_LOG_PREFIX} Custom ringback started. isRingbackPlaying: ${this.isRingbackPlaying}`)
    } catch (error) {
      console.error(`${AM_LOG_PREFIX} Error starting custom ringback:`, error)
      this.isRingbackPlaying = false
    }
  }

  async stopRingback() {
    if (!this.isRingbackPlaying) {
      console.log(`${AM_LOG_PREFIX} stopRingback called but not playing. Skipping.`)
      return
    }
    console.log(`${AM_LOG_PREFIX} stopRingback INVOKED.`)
    try {
      await InCallManager.stopRingback()
      this.isRingbackPlaying = false
      console.log(`${AM_LOG_PREFIX} Custom ringback stopped. isRingbackPlaying: ${this.isRingbackPlaying}`)
    } catch (error) {
      console.error(`${AM_LOG_PREFIX} Error stopping custom ringback:`, error)
      this.isRingbackPlaying = false
    }
  }

  async startRingtone(type = "_DEFAULT_") {
    if (this.isRingtonePlaying) {
      console.log(`${AM_LOG_PREFIX} startRingtone called but already playing. Skipping.`)
      return
    }
    console.log(`${AM_LOG_PREFIX} startRingtone INVOKED (via SystemSoundManager). Type: ${type}`)
    try {
      await SystemSoundManager.playDefaultRingtone()
      this.isRingtonePlaying = true
      console.log(
        `${AM_LOG_PREFIX} System ringtone started via SystemSoundManager. isRingtonePlaying: ${this.isRingtonePlaying}`,
      )
    } catch (error) {
      console.error(`${AM_LOG_PREFIX} Error starting system ringtone:`, error)
      this.isRingtonePlaying = false
    }
  }

  async stopRingtone(type = "") {
    const wasRingtonePlayingBeforeAttempt = this.isRingtonePlaying
    if (!wasRingtonePlayingBeforeAttempt && type !== "force_stop") {
      console.log(`${AM_LOG_PREFIX} stopRingtone called but not playing (or not forced). Skipping.`)
      if (type !== "force_stop") return
    }
    console.log(
      `${AM_LOG_PREFIX} stopRingtone INVOKED. isRingtonePlaying (before stop): ${wasRingtonePlayingBeforeAttempt}, Type: ${type}`,
    )
    try {
      // Stop ringtone started by SystemSoundManager
      await SystemSoundManager.stopRingtone()
      this.isRingtonePlaying = false // Assume SystemSoundManager part is now handled
      console.log(
        `${AM_LOG_PREFIX} System ringtone (via SystemSoundManager) commanded to stop. isRingtonePlaying set to: ${this.isRingtonePlaying}`,
      )

      // Also stop any ringback/ringtone potentially started by InCallManager
      // This is important if InCallManager.start was called with ringback: '_DEFAULT_'
      console.log(`${AM_LOG_PREFIX} Attempting to stop InCallManager's ringback/default ringtone as a precaution.`)
      await InCallManager.stopRingback() // This stops sounds started by InCallManager's ringback option
      this.isRingbackPlaying = false // Update this state too, as InCallManager's ringback might have been active
      console.log(
        `${AM_LOG_PREFIX} InCallManager.stopRingback() called. isRingbackPlaying set to: ${this.isRingbackPlaying}`,
      )
    } catch (error) {
      console.error(`${AM_LOG_PREFIX} Error stopping system ringtone and/or InCallManager ringback:`, error)
      // Ensure states are reset on error to prevent them from being stuck as true
      this.isRingtonePlaying = false
      this.isRingbackPlaying = false
    }
  }

  async stopAllSounds() {
    console.log(
      `${AM_LOG_PREFIX} Stopping all sounds. Ringback playing: ${this.isRingbackPlaying}, Ringtone playing: ${this.isRingtonePlaying}`,
    )
    try {
      // Call the refined stopRingtone which now handles both SystemSoundManager and InCallManager ringback
      await this.stopRingtone("force_stop")

      // Explicitly stop custom ringback if it was managed separately and state might be out of sync
      if (this.isRingbackPlaying) {
        // This might be redundant if stopRingtone already called InCallManager.stopRingback()
        // but can be a safeguard.
        console.log(`${AM_LOG_PREFIX} stopAllSounds: Explicitly calling InCallManager.stopRingback() again if needed.`)
        await InCallManager.stopRingback()
        this.isRingbackPlaying = false
      }

      // Fallback in case state tracking was off or for other sounds InCallManager might handle
      // This is a bit broad but can help in complex scenarios.
      // await InCallManager.stop(); // This is too aggressive here, use in cleanup()
      // await InCallManager.start({ media: 'audio', auto: true, ringback: '' }); // Reset InCallManager state without sound

      console.log(`${AM_LOG_PREFIX} All sounds commanded to stop.`)
    } catch (error) {
      console.error(`${AM_LOG_PREFIX} Error in stopAllSounds:`, error)
      this.isRingtonePlaying = false
      this.isRingbackPlaying = false
    }
  }

  async cleanup() {
    try {
      if (!this.isInitialized) {
        console.log(`${AM_LOG_PREFIX} Cleanup called but not initialized. Skipping.`)
        return
      }
      console.log(`${AM_LOG_PREFIX} Cleaning up audio session.`)

      await this.stopAllSounds()

      await InCallManager.setForceSpeakerphoneOn(false)
      await InCallManager.setMicrophoneMute(false)
      console.log(`${AM_LOG_PREFIX} Speaker forced OFF and Mic UNMUTED before stopping InCallManager.`)

      await InCallManager.stop()
      console.log(`${AM_LOG_PREFIX} InCallManager stopped.`)

      this.isInitialized = false
      this.currentAudioRoute = "earpiece"
      this.isRingtonePlaying = false
      this.isRingbackPlaying = false
      console.log(`${AM_LOG_PREFIX} Audio session cleaned up successfully. States reset.`)
    } catch (error) {
      console.error(`${AM_LOG_PREFIX} Error cleaning up audio session:`, error)
      this.isInitialized = false
      this.currentAudioRoute = "earpiece"
      this.isRingtonePlaying = false
      this.isRingbackPlaying = false
    }
  }

  getCurrentAudioRoute() {
    return this.currentAudioRoute
  }

  isSpeakerphoneOn() {
    const isSpeaker = this.currentAudioRoute === "speaker"
    return isSpeaker
  }
}

export default new AudioManager()
