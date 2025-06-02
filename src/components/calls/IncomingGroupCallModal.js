// components/call/IncomingGroupCallModal.js
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
import { getTheme } from "../../utils/theme"
import { ThemeContext } from "../../context/ThemeContext"

const { width, height } = Dimensions.get("window")

const IncomingGroupCallModal = ({ visible, callData, onAccept, onReject, onClose }) => {
  console.log("[IncomingGroupCallModal] Component rendering. Props visible:", visible, "callData:", !!callData)
  const { state: authState } = useContext(AuthContext)
  const { socket } = useContext(SocketContext)
  const { theme } = useContext(ThemeContext) || { theme: "light" }
  const currentTheme = getTheme(theme)

  const [isVisible, setIsVisible] = useState(false)
  const slideAnim = useRef(new Animated.Value(height)).current
  const pulseAnim = useRef(new Animated.Value(1)).current
  const vibrationPattern = useRef(null)

  useEffect(() => {
    console.log(
      "[IncomingGroupCallModal] useEffect for visibility. Props visible:",
      visible,
      "callData:",
      !!callData,
      "Current isVisible state:",
      isVisible,
    )
    if (visible && callData) {
      setIsVisible(true)
      startIncomingCallEffects()
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start()
      startPulseAnimation()
    } else {
      stopIncomingCallEffects()
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setIsVisible(false)
        if (!visible) {
          onClose?.()
        }
      })
    }
    return () => {
      stopIncomingCallEffects()
    }
  }, [visible, callData])

  const startIncomingCallEffects = async () => {
    try {
      console.log("[IncomingGroupCallModal] Starting ringtone and vibration for call:", callData?.callId)
      await AudioManager.startRingtone()
      const ONE_SECOND_IN_MS = 1000
      const PATTERN = [0.5 * ONE_SECOND_IN_MS, 1 * ONE_SECOND_IN_MS, 0.5 * ONE_SECOND_IN_MS, 1 * ONE_SECOND_IN_MS]
      Vibration.vibrate(PATTERN, true)
    } catch (error) {
      console.error("[IncomingGroupCallModal] Error starting effects:", error)
    }
  }

  const stopIncomingCallEffects = async () => {
    try {
      console.log("[IncomingGroupCallModal] Stopping ringtone and vibration for call:", callData?.callId)
      await AudioManager.stopRingtone()
      Vibration.cancel()
      if (vibrationPattern.current) {
        clearInterval(vibrationPattern.current)
        vibrationPattern.current = null
      }
      pulseAnim.setValue(1)
    } catch (error) {
      console.error("[IncomingGroupCallModal] Error stopping effects:", error)
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

  const handleAcceptPress = () => {
    console.log("[IncomingGroupCallModal] Accept pressed for call:", callData?.callId)
    stopIncomingCallEffects()
    onAccept(callData)
    setIsVisible(false)
  }

  const handleRejectPress = () => {
    console.log("[IncomingGroupCallModal] Reject pressed for call:", callData?.callId)
    stopIncomingCallEffects()
    onReject(callData)
    setIsVisible(false)
  }

  const handleModalCloseRequest = () => {
    console.log("[IncomingGroupCallModal] Modal close requested (hardware back) for call:", callData?.callId)
    handleRejectPress()
  }

  if (!isVisible || !callData) {
    return null
  }

  const { caller, callType, conversationName, groupImage } = callData
  const callerName = caller?.name || "Unknown Caller"
  const displayCallType = callType === "video" ? "Video" : "Audio"
  const displayImage = groupImage || caller?.profilePicture // Prefer group image, fallback to caller image

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="none"
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
          <Text style={styles.incomingCallText}>Incoming Group {displayCallType} Call</Text>
          <Animated.View style={[styles.callerImageContainer, { transform: [{ scale: pulseAnim }] }]}>
            {displayImage ? (
              <Image source={{ uri: `${API_BASE_URL_FOR_MEDIA}${displayImage}` }} style={styles.callerImage} />
            ) : (
              <View style={styles.defaultCallerImage}>
                <Ionicons name="people-outline" size={60} color="#FFFFFF" />
              </View>
            )}
          </Animated.View>
          <Text style={styles.callerName} numberOfLines={1}>
            {conversationName || "Group Call"}
          </Text>
          <Text style={styles.groupContextText} numberOfLines={1}>
            {callerName} is calling
          </Text>
        </View>

        <View style={styles.actionsContainer}>
          <View style={styles.mainActions}>
            <View style={styles.actionButtonWrapper}>
              <TouchableOpacity style={[styles.actionButton, styles.rejectButton]} onPress={handleRejectPress}>
                <Ionicons name="close" size={32} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.actionText}>Decline</Text>
            </View>
            <View style={styles.actionButtonWrapper}>
              <TouchableOpacity style={[styles.actionButton, styles.acceptButton]} onPress={handleAcceptPress}>
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

// Styles adapted from IncomingCallModal for consistency
const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    marginBottom: 30,
    textAlign: "center",
  },
  callerImageContainer: {
    marginBottom: 20,
  },
  callerImage: {
    width: 140,
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
  callerName: {
    // Used for Conversation Name here
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 5,
    textAlign: "center",
  },
  groupContextText: {
    // Used for "Caller is calling"
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
  },
  actionsContainer: {
    paddingBottom: Platform.OS === "ios" ? 60 : 40,
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
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 20,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  rejectButton: {
    backgroundColor: "#FF3B30",
  },
  acceptButton: {
    backgroundColor: "#34C759",
  },
  actionText: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 14,
    marginTop: 10,
  },
})

export default IncomingGroupCallModal
