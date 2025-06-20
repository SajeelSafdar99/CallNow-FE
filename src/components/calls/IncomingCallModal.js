// components/call/IncomingCallModal.js
"use client"

import { useEffect, useRef, useContext, useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Animated,
  Vibration,
  Platform,
  Dimensions,
  StatusBar,
} from "react-native"
import Ionicons from "react-native-vector-icons/Ionicons"
import { API_BASE_URL_FOR_MEDIA } from "../../config/api" // Ensure this path is correct
import { AuthContext } from "../../context/AuthContext"
import { SocketContext } from "../../context/SocketContext"
import AudioManager from "../../utils/audio-manager"
import { getTheme } from "../../utils/theme" // Assuming you might use theme context
import { ThemeContext } from "../../context/ThemeContext" // Assuming you might use theme context

const { width, height } = Dimensions.get("window")

const IncomingCallModal = ({ visible, callData, onAccept, onReject, onClose }) => {
  console.log("[IncomingCallModal] Component rendering/re-rendering. Props visible:", visible, "callData:", !!callData)
  const { state: authState } = useContext(AuthContext)
  const { socket } = useContext(SocketContext)
  const { theme } = useContext(ThemeContext) || { theme: "light" } // Default theme
  const currentTheme = getTheme(theme)

  const [isVisible, setIsVisible] = useState(false)
  const slideAnim = useRef(new Animated.Value(height)).current // For potential future animation
  const pulseAnim = useRef(new Animated.Value(1)).current // For potential future animation
  const vibrationPattern = useRef(null)

  useEffect(() => {
    console.log(
      "[IncomingCallModal] useEffect for visibility. Props visible:",
      visible,
      "callData:",
      !!callData,
      "Current isVisible state:",
      isVisible,
    )
    if (visible && callData) {
      setIsVisible(true)
      startIncomingCallEffects()
      // Example: Animate modal in (optional, can be simple fade or slide)
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start()
      startPulseAnimation()
    } else {
      stopIncomingCallEffects()
      // Example: Animate modal out
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setIsVisible(false) // Set internal visibility to false after animation
        if (!visible) {
          onClose?.() // Call onClose if the main prop became false
        }
      })
    }

    return () => {
      stopIncomingCallEffects()
    }
  }, [visible, callData])

  const startIncomingCallEffects = async () => {
    try {
      console.log("[IncomingCallModal] Starting ringtone and vibration.")
      await AudioManager.startRingtone()
      const ONE_SECOND_IN_MS = 1000
      const PATTERN = [0.5 * ONE_SECOND_IN_MS, 1 * ONE_SECOND_IN_MS, 0.5 * ONE_SECOND_IN_MS, 1 * ONE_SECOND_IN_MS]
      Vibration.vibrate(PATTERN, true)
    } catch (error) {
      console.error("[IncomingCallModal] Error starting incoming call effects:", error)
    }
  }

  const stopIncomingCallEffects = async () => {
    try {
      console.log("[IncomingCallModal] Stopping ringtone and vibration.")
      await AudioManager.stopRingtone()
      Vibration.cancel()
      if (vibrationPattern.current) {
        clearInterval(vibrationPattern.current) // Though Vibration.cancel should be enough
        vibrationPattern.current = null
      }
      pulseAnim.setValue(1) // Reset pulse animation
    } catch (error) {
      console.error("[IncomingCallModal] Error stopping incoming call effects:", error)
    }
  }

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    ).start()
  }

  const handleAccept = async () => {
    console.log("[IncomingCallModal] Accept pressed.")
    stopIncomingCallEffects()
    onAccept?.(callData)
    setIsVisible(false)
  }

  const handleReject = async () => {
    console.log("[IncomingCallModal] Reject pressed.")
    stopIncomingCallEffects()
    onReject?.(callData)
    setIsVisible(false)
  }

  const handleModalCloseRequest = () => {
    console.log("[IncomingCallModal] Modal close requested (e.g., Android back button).")
    handleReject()
  }

  if (!isVisible || !callData) {
    return null
  }

  const { caller, callType } = callData
  const callerName = caller?.name || "Unknown Caller"
  const callerProfilePic = caller?.profilePicture
  const callTypeDisplay = callType === "video" ? "Video Call" : "Audio Call"

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="none" // Using "none" because we handle animation with Animated API
      onRequestClose={handleModalCloseRequest}
      statusBarTranslucent
    >
      <Animated.View
        style={[
          styles.container,
          { backgroundColor: currentTheme.incomingCallBackground || "rgba(0, 0, 0, 0.9)" },
          // { transform: [{ translateY: slideAnim }] } // Optional slide animation
        ]}
      >
        <StatusBar barStyle="light-content" />
        <View style={styles.callInfoSection}>
          <Text style={styles.incomingCallText}>Incoming {callTypeDisplay}</Text>
          <Animated.View style={[styles.callerImageContainer, { transform: [{ scale: pulseAnim }] }]}>
            {callerProfilePic ? (
              <Image source={{ uri: `${API_BASE_URL_FOR_MEDIA}${callerProfilePic}` }} style={styles.callerImage} />
            ) : (
              <View style={styles.defaultCallerImage}>
                <Text style={styles.callerInitial}>{callerName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </Animated.View>
          <Text style={styles.callerName}>{callerName}</Text>
          {/* <View style={styles.callTypeContainer}>
          <Ionicons
            name={callType === "video" ? "videocam-outline" : "call-outline"}
            size={18}
            color="#FFFFFF"
          />
          <Text style={styles.callTypeText}>{callTypeDisplay}</Text>
        </View> */}
        </View>

        <View style={styles.actionsContainer}>
          <View style={styles.mainActions}>
            <View style={styles.actionButtonWrapper}>
              <TouchableOpacity style={[styles.actionButton, styles.rejectButton]} onPress={handleReject}>
                <Ionicons name="close" size={32} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.actionText}>Decline</Text>
            </View>
            <View style={styles.actionButtonWrapper}>
              <TouchableOpacity style={[styles.actionButton, styles.acceptButton]} onPress={handleAccept}>
                <Ionicons name="call" size={30} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.actionText}>Accept</Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: "rgba(0, 0, 0, 0.95)", // Set by theme
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  callInfoSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  incomingCallText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 18,
    marginBottom: 40, // Increased spacing
  },
  callerImageContainer: {
    marginBottom: 25, // Increased spacing
  },
  callerImage: {
    width: 140, // Larger image
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  defaultCallerImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#1A73E8", // Example color, can be themed
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  callerInitial: {
    color: "#FFFFFF",
    fontSize: 64, // Larger initial
    fontWeight: "bold",
  },
  callerName: {
    color: "#FFFFFF",
    fontSize: 26, // Larger name
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  callTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 10,
  },
  callTypeText: {
    color: "#FFFFFF",
    fontSize: 15,
    marginLeft: 8,
  },
  actionsContainer: {
    paddingBottom: Platform.OS === "ios" ? 60 : 40, // More padding at bottom
    paddingHorizontal: 20,
  },
  mainActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  actionButtonWrapper: {
    alignItems: "center",
  },
  actionButton: {
    width: 70, // Standard button size
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 20, // Spacing between buttons
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  rejectButton: {
    backgroundColor: "#FF3B30", // Standard red for reject
  },
  acceptButton: {
    backgroundColor: "#34C759", // Standard green for accept
  },
  actionText: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 14,
    marginTop: 10,
  },
})

export default IncomingCallModal
