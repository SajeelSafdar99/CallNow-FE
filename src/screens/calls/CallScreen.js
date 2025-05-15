import React, { useState, useEffect, useRef, useContext } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  StatusBar,
  SafeAreaView,
  Dimensions,
} from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import Ionicons from "react-native-vector-icons/Ionicons"
import { AuthContext } from "../../context/AuthContext"
import { ThemeContext } from "../../context/ThemeContext"
import { getTheme } from "../../utils/theme"
import * as CallAPI from "../../api/call"
import * as CallLogAPI from "../../api/call-log"
import { API_BASE_URL_FOR_MEDIA } from "../../config/api"

const { width, height } = Dimensions.get("window")

const CallScreen = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const { receiverId, receiverName, receiverProfilePic, callType = "audio" } = route.params
  const { state: authState } = useContext(AuthContext)
  const { theme } = useContext(ThemeContext)
  const currentTheme = getTheme(theme)

  const [callState, setCallState] = useState("connecting") // connecting, ringing, ongoing, ended
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeakerOn, setIsSpeakerOn] = useState(callType === "video")
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === "video")
  const [isFrontCamera, setIsFrontCamera] = useState(true)

  const callTimerRef = useRef(null)
  const callIdRef = useRef(null)

  // Initialize call
  useEffect(() => {
    const initializeCall = async () => {
      try {
        // Initiate call in the backend
        const response = await CallAPI.initiateCall(
          authState.token,
          receiverId,
          callType
        )

        if (response.success) {
          callIdRef.current = response.call._id

          // Log call initiated event
          await CallLogAPI.logCallEvent(
            authState.token,
            response.call._id,
            "one-to-one",
            "call_initiated",
            { callType }
          )

          // Update call status to ringing
          await CallAPI.updateCallStatus(
            authState.token,
            response.call._id,
            "ringing"
          )

          setCallState("ringing")

          // In a real app, you would set up WebRTC here
          // For this demo, we'll simulate the call flow

          // Simulate call being answered after 2 seconds
          setTimeout(() => {
            handleCallAnswered()
          }, 2000)
        } else {
          console.error("Failed to initiate call:", response.message)
          handleEndCall()
        }
      } catch (error) {
        console.error("Error initializing call:", error)
        handleEndCall()
      }
    }

    initializeCall()

    // Clean up on unmount
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current)
      }
    }
  }, [])

  // Handle call answered
  const handleCallAnswered = async () => {
    try {
      if (callIdRef.current) {
        // Update call status to ongoing
        await CallAPI.updateCallStatus(
          authState.token,
          callIdRef.current,
          "ongoing"
        )

        // Log call answered event
        await CallLogAPI.logCallEvent(
          authState.token,
          callIdRef.current,
          "one-to-one",
          "call_answered",
          {}
        )

        setCallState("ongoing")

        // Start call timer
        callTimerRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1)
        }, 1000)
      }
    } catch (error) {
      console.error("Error handling call answer:", error)
    }
  }

  // Handle end call
  const handleEndCall = async () => {
    try {
      // Stop timer
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current)
      }

      if (callIdRef.current) {
        // Update call status based on current state
        const status = callState === "connecting" || callState === "ringing"
          ? "missed"
          : "completed"

        // Update call status in backend
        await CallAPI.updateCallStatus(
          authState.token,
          callIdRef.current,
          status,
          new Date().toISOString()
        )

        // Log call ended event
        await CallLogAPI.logCallEvent(
          authState.token,
          callIdRef.current,
          "one-to-one",
          "call_ended",
          { duration: callDuration }
        )
      }

      setCallState("ended")

      // Navigate back
      navigation.goBack()
    } catch (error) {
      console.error("Error ending call:", error)
      navigation.goBack()
    }
  }

  // Toggle mute
  const toggleMute = async () => {
    try {
      setIsMuted(prev => !prev)

      if (callIdRef.current) {
        // Log mute toggle event
        await CallLogAPI.logCallEvent(
          authState.token,
          callIdRef.current,
          "one-to-one",
          isMuted ? "unmuted" : "muted",
          {}
        )
      }
    } catch (error) {
      console.error("Error toggling mute:", error)
    }
  }

  // Toggle speaker
  const toggleSpeaker = async () => {
    try {
      setIsSpeakerOn(prev => !prev)

      if (callIdRef.current) {
        // Log speaker toggle event
        await CallLogAPI.logCallEvent(
          authState.token,
          callIdRef.current,
          "one-to-one",
          isSpeakerOn ? "speaker_off" : "speaker_on",
          {}
        )
      }
    } catch (error) {
      console.error("Error toggling speaker:", error)
    }
  }

  // Toggle video
  const toggleVideo = async () => {
    try {
      setIsVideoEnabled(prev => !prev)

      if (callIdRef.current) {
        // Log video toggle event
        await CallLogAPI.logCallEvent(
          authState.token,
          callIdRef.current,
          "one-to-one",
          isVideoEnabled ? "video_disabled" : "video_enabled",
          {}
        )
      }
    } catch (error) {
      console.error("Error toggling video:", error)
    }
  }

  // Toggle camera
  const toggleCamera = async () => {
    try {
      setIsFrontCamera(prev => !prev)

      if (callIdRef.current) {
        // Log camera toggle event
        await CallLogAPI.logCallEvent(
          authState.token,
          callIdRef.current,
          "one-to-one",
          isFrontCamera ? "camera_switched_to_back" : "camera_switched_to_front",
          {}
        )
      }
    } catch (error) {
      console.error("Error toggling camera:", error)
    }
  }

  // Format call duration
  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }

    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  // Get call status text
  const getCallStatusText = () => {
    switch (callState) {
      case "connecting": return "Connecting..."
      case "ringing": return "Ringing..."
      case "ongoing": return formatDuration(callDuration)
      case "ended": return "Call ended"
      default: return ""
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: "#000000" }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Call Header */}
      <View style={styles.callHeader}>
        <TouchableOpacity
          style={styles.minimizeButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        {callType === "video" && isVideoEnabled && (
          <TouchableOpacity
            style={styles.cameraToggleButton}
            onPress={toggleCamera}
          >
            <Ionicons name="camera-reverse" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Call Content */}
      <View style={styles.callContent}>
        {callType === "video" && isVideoEnabled ? (
          // Video call view (simulated)
          <View style={styles.videoContainer}>
            {/* Main video (remote user) */}
            <View style={styles.remoteVideoContainer}>
              <View style={styles.videoPlaceholder}>
                <Ionicons name="videocam-off" size={40} color="#FFFFFF" />
                <Text style={styles.videoPlaceholderText}>
                  Video preview not available in demo
                </Text>
              </View>
            </View>

            {/* Self video (picture-in-picture) */}
            <View style={styles.selfVideoContainer}>
              <View style={styles.selfVideoPlaceholder}>
                <Ionicons name="person" size={24} color="#FFFFFF" />
              </View>
            </View>
          </View>
        ) : (
          // Audio call view
          <View style={styles.audioCallContainer}>
            {receiverProfilePic ? (
              <Image
                source={{ uri: `${API_BASE_URL_FOR_MEDIA}${receiverProfilePic}` }}
                style={styles.callerImage}
              />
            ) : (
              <View style={styles.defaultCallerImage}>
                <Text style={styles.defaultCallerImageText}>
                  {receiverName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            <Text style={styles.callerName}>{receiverName}</Text>
            <Text style={styles.callStatus}>{getCallStatusText()}</Text>
          </View>
        )}
      </View>

      {/* Call Controls */}
      <View style={styles.callControls}>
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.activeControlButton]}
          onPress={toggleMute}
        >
          <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color="#FFFFFF" />
          <Text style={styles.controlText}>Mute</Text>
        </TouchableOpacity>

        {callType === "video" && (
          <TouchableOpacity
            style={[styles.controlButton, !isVideoEnabled && styles.activeControlButton]}
            onPress={toggleVideo}
          >
            <Ionicons name={isVideoEnabled ? "videocam" : "videocam-off"} size={24} color="#FFFFFF" />
            <Text style={styles.controlText}>Video</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.controlButton, isSpeakerOn && styles.activeControlButton]}
          onPress={toggleSpeaker}
        >
          <Ionicons name={isSpeakerOn ? "volume-high" : "volume-medium"} size={24} color="#FFFFFF" />
          <Text style={styles.controlText}>Speaker</Text>
        </TouchableOpacity>
      </View>

      {/* End Call Button */}
      <View style={styles.endCallContainer}>
        <TouchableOpacity
          style={styles.endCallButton}
          onPress={handleEndCall}
        >
          <Ionicons name="call" size={30} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  callHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 15,
  },
  minimizeButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraToggleButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  callContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  audioCallContainer: {
    alignItems: "center",
  },
  callerImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 20,
  },
  defaultCallerImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#128C7E",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  defaultCallerImageText: {
    color: "#FFFFFF",
    fontSize: 50,
    fontWeight: "bold",
  },
  callerName: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  callStatus: {
    color: "#CCCCCC",
    fontSize: 16,
  },
  videoContainer: {
    width: width,
    height: height - 200, // Adjust based on your UI
    position: "relative",
  },
  remoteVideoContainer: {
    width: "100%",
    height: "100%",
    backgroundColor: "#333333",
    justifyContent: "center",
    alignItems: "center",
  },
  videoPlaceholder: {
    alignItems: "center",
  },
  videoPlaceholderText: {
    color: "#FFFFFF",
    marginTop: 10,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  selfVideoContainer: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 100,
    height: 150,
    backgroundColor: "#555555",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  selfVideoPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#128C7E",
    justifyContent: "center",
    alignItems: "center",
  },
  callControls: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 20,
  },
  controlButton: {
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
  },
  activeControlButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  controlText: {
    color: "#FFFFFF",
    marginTop: 5,
    fontSize: 12,
  },
  endCallContainer: {
    alignItems: "center",
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
  },
  endCallButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
    transform: [{ rotate: "135deg" }],
  },
})

export default CallScreen
