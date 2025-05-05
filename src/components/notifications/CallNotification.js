"use client"

import { useContext, useEffect, useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Image, Vibration, Animated } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { NotificationContext } from "../../context/NotificationContext"
import { API_BASE_URL } from "../../config/api"

const CallNotification = () => {
  const { incomingCall, incomingGroupCall, acceptCall, rejectCall, acceptGroupCall, rejectGroupCall } =
    useContext(NotificationContext)

  const [visible, setVisible] = useState(false)
  const [callSound, setCallSound] = useState(null)
  const slideAnim = new Animated.Value(-200)

  // Show notification when incoming call or group call is received
  useEffect(() => {
    if (incomingCall || incomingGroupCall) {
      setVisible(true)
      startRinging()

      // Slide in animation
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start()
    } else {
      // Slide out animation
      Animated.timing(slideAnim, {
        toValue: -200,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setVisible(false)
        stopRinging()
      })
    }

    return () => {
      stopRinging()
    }
  }, [incomingCall, incomingGroupCall])

  // Start ringing sound and vibration
  const startRinging = async () => {
    // Start vibration pattern
    Vibration.vibrate([500, 1000, 500, 1000], true)

    // Play sound (using Expo Audio would be implemented here)
    // For brevity, we're not implementing the actual sound playback
    // but in a real app, you would use Expo Audio or react-native-sound
  }

  // Stop ringing sound and vibration
  const stopRinging = () => {
    Vibration.cancel()

    // Stop sound
    if (callSound) {
      // callSound.stopAsync()
      setCallSound(null)
    }
  }

  // Handle accept call
  const handleAccept = () => {
    if (incomingCall) {
      acceptCall()
    } else if (incomingGroupCall) {
      acceptGroupCall()
    }
    stopRinging()
  }

  // Handle reject call
  const handleReject = () => {
    if (incomingCall) {
      rejectCall()
    } else if (incomingGroupCall) {
      rejectGroupCall()
    }
    stopRinging()
  }

  if (!visible) return null

  const call = incomingCall || incomingGroupCall
  const isGroupCall = !!incomingGroupCall
  const caller = call?.caller
  const isVideoCall = call?.isVideoCall

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.content}>
        <View style={styles.callerInfo}>
          {caller?.profilePicture ? (
            <Image source={{ uri: `${API_BASE_URL}${caller.profilePicture}` }} style={styles.callerImage} />
          ) : (
            <View style={styles.defaultCallerImage}>
              <Text style={styles.callerInitial}>{caller?.name?.charAt(0).toUpperCase() || "?"}</Text>
            </View>
          )}

          <View style={styles.textContainer}>
            <Text style={styles.callerName}>{caller?.name || "Unknown"}</Text>
            <Text style={styles.callType}>
              {isGroupCall ? "Group " : ""}
              {isVideoCall ? "Video" : "Voice"} Call
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionButton, styles.rejectButton]} onPress={handleReject}>
            <Ionicons name="call" size={24} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, styles.acceptButton]} onPress={handleAccept}>
            <Ionicons name="call" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#075E54",
    zIndex: 1000,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  content: {
    padding: 15,
    paddingTop: 40, // Account for status bar
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  callerInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  callerImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 10,
  },
  defaultCallerImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#128C7E",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  callerInitial: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
  },
  textContainer: {
    flexDirection: "column",
  },
  callerName: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  callType: {
    color: "#FFFFFF",
    fontSize: 14,
    opacity: 0.8,
  },
  actions: {
    flexDirection: "row",
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  acceptButton: {
    backgroundColor: "#25D366",
  },
  rejectButton: {
    backgroundColor: "#FF3B30",
  },
})

export default CallNotification
