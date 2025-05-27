"use client"

import { useState, useEffect, useRef, useContext } from "react"
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
import { AuthContext } from "../../context/AuthContext"
import { SocketContext } from "../../context/SocketContext"
import { API_BASE_URL_FOR_MEDIA } from "../../config/api"
import AudioManager from "../../utils/audio-manager"

const { width, height } = Dimensions.get("window")

const IncomingCallModal = ({ visible, callData, onAccept, onReject, onClose }) => {
  const { state: authState } = useContext(AuthContext)
  const { socket } = useContext(SocketContext)

  const [isVisible, setIsVisible] = useState(false)
  const slideAnim = useRef(new Animated.Value(height)).current
  const pulseAnim = useRef(new Animated.Value(1)).current
  const vibrationPattern = useRef(null)

  useEffect(() => {
    if (visible && callData) {
      setIsVisible(true)
      startIncomingCallEffects()

      // Slide in animation
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start()

      // Start pulse animation for accept button
      startPulseAnimation()
    } else {
      stopIncomingCallEffects()

      // Slide out animation
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setIsVisible(false)
        onClose?.()
      })
    }

    return () => {
      stopIncomingCallEffects()
    }
  }, [visible, callData])

  const startIncomingCallEffects = async () => {
    try {
      // Start ringtone
      await AudioManager.startRingtone()
      const ONE_SECOND_IN_MS = 1000;

      const PATTERN = [
        1 * ONE_SECOND_IN_MS,
        2 * ONE_SECOND_IN_MS,
        3 * ONE_SECOND_IN_MS,
      ];      // Start vibration pattern
      try {
        Vibration.vibrate(PATTERN, true);
      } catch (error) {
        console.error("Vibration error:", error);
        // Fallback to simpler vibration
        try {
          Vibration.vibrate(1000);
        } catch (fallbackError) {
          console.error("Fallback vibration failed:", fallbackError);
        }
      }
    } catch (error) {
      console.error("Error starting incoming call effects:", error)
    }
  }
  useEffect(() => {
    return () => {
      // This ensures cleanup runs when component unmounts
      stopIncomingCallEffects();
    };
  }, []);
  const stopIncomingCallEffects = async () => {
    try {
      // Stop ringtone
      await AudioManager.stopRingtone()

      // Stop vibration
      Vibration.cancel()
      if (vibrationPattern.current) {
        clearInterval(vibrationPattern.current)
        vibrationPattern.current = null
      }
    } catch (error) {
      console.error("Error stopping incoming call effects:", error)
    }
  }

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start()
  }

  const handleAccept = async () => {
    stopIncomingCallEffects()
    onAccept?.(callData)
  }

  const handleReject = async () => {
    stopIncomingCallEffects()
    onReject?.(callData)
  }

  if (!isVisible || !callData) {
    return null
  }

  const { caller, callType, callId } = callData

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
      onRequestClose={handleReject}
    >
      <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.9)" translucent />

      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Background overlay */}
        <View style={styles.overlay} />

        {/* Call info section */}
        <View style={styles.callInfoSection}>
          <Text style={styles.incomingCallText}>Incoming {callType === "video" ? "video" : "voice"} call</Text>

          {/* Caller image */}
          <View style={styles.callerImageContainer}>
            {caller?.profilePicture ? (
              <Image source={{ uri: `${API_BASE_URL_FOR_MEDIA}${caller.profilePicture}` }} style={styles.callerImage} />
            ) : (
              <View style={styles.defaultCallerImage}>
                <Text style={styles.callerInitial}>{caller?.name?.charAt(0).toUpperCase() || "?"}</Text>
              </View>
            )}
          </View>

          {/* Caller name */}
          <Text style={styles.callerName}>{caller?.name || "Unknown"}</Text>

          {/* Call type indicator */}
          <View style={styles.callTypeContainer}>
            <Ionicons name={callType === "video" ? "videocam" : "call"} size={16} color="#FFFFFF" />
            <Text style={styles.callTypeText}>{callType === "video" ? "Video call" : "Voice call"}</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionsContainer}>
          {/* Additional actions */}
          <View style={styles.additionalActions}>
            <TouchableOpacity style={styles.additionalActionButton}>
              <Ionicons name="chatbubble" size={24} color="#FFFFFF" />
              <Text style={styles.additionalActionText}>Message</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.additionalActionButton}>
              <Ionicons name="person-add" size={24} color="#FFFFFF" />
              <Text style={styles.additionalActionText}>Remind</Text>
            </TouchableOpacity>
          </View>

          {/* Main action buttons */}
          <View style={styles.mainActions}>
            {/* Reject button */}
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={handleReject}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={28} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
            </TouchableOpacity>

            {/* Accept button with pulse animation */}
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButton]}
                onPress={handleAccept}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>

        {/* Swipe indicators */}
        <View style={styles.swipeIndicators}>
          <View style={styles.swipeIndicator}>
            <Ionicons name="chevron-up" size={20} color="rgba(255,255,255,0.5)" />
            <Text style={styles.swipeText}>Swipe up for more options</Text>
          </View>
        </View>
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  callInfoSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
  },
  incomingCallText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 16,
    marginBottom: 30,
  },
  callerImageContainer: {
    marginBottom: 20,
  },
  callerImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  defaultCallerImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#128C7E",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  callerInitial: {
    color: "#FFFFFF",
    fontSize: 60,
    fontWeight: "bold",
  },
  callerName: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  callTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  callTypeText: {
    color: "#FFFFFF",
    fontSize: 14,
    marginLeft: 5,
  },
  actionsContainer: {
    paddingBottom: Platform.OS === "ios" ? 50 : 30,
  },
  additionalActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 40,
    paddingHorizontal: 60,
  },
  additionalActionButton: {
    alignItems: "center",
  },
  additionalActionText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12,
    marginTop: 5,
  },
  mainActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 80,
  },
  actionButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
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
    backgroundColor: "#4CD964",
  },
  swipeIndicators: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  swipeIndicator: {
    alignItems: "center",
  },
  swipeText: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 12,
    marginTop: 5,
  },
})

export default IncomingCallModal
