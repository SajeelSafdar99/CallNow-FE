"use client"

// I'll update the CallScreen to use our enhanced WebRTC helpers and call quality monitoring

import { useState, useEffect, useRef, useContext } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  SafeAreaView,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useNavigation, useRoute } from "@react-navigation/native"
import { RTCSessionDescription, RTCView } from "react-native-webrtc"
import { AuthContext } from "../../context/AuthContext"
import { SocketContext } from "../../context/SocketContext"
import * as CallsAPI from "../../api/calls"
import { API_BASE_URL } from "../../config/api"
import { formatCallDuration } from "../../utils/formatters"
import * as WebRTCHelper from "../../utils/webrtc-helper"

const CallScreen = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const { contact, isVideoCall = false, incomingCall = null } = route.params || {}

  const { state: authState } = useContext(AuthContext)
  const { socket } = useContext(SocketContext)

  // Call state
  const [callState, setCallState] = useState(incomingCall ? "incoming" : "outgoing") // outgoing, incoming, connected, ended
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeakerOn, setIsSpeakerOn] = useState(false)
  const [isVideoEnabled, setIsVideoEnabled] = useState(isVideoCall)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [callId, setCallId] = useState(incomingCall?.callId || null)

  // WebRTC state
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const peerConnection = useRef(null)
  const callTimerRef = useRef(null)
  const qualityMonitoringRef = useRef(null)

  // Initialize call
  useEffect(() => {
    const setupCall = async () => {
      try {
        // Get optimal ICE servers based on region
        const iceServers = await WebRTCHelper.getOptimalIceServers(authState.token)

        // Create peer connection
        const pc = WebRTCHelper.createPeerConnection(iceServers)
        peerConnection.current = pc

        // Set up event handlers
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("ice-candidate", {
              callId,
              candidate: event.candidate.toJSON(),
              senderId: authState.user.id,
              recipientId: incomingCall ? incomingCall.callerId : contact._id,
            })
          }
        }

        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            setRemoteStream(event.streams[0])
          }
        }

        pc.oniceconnectionstatechange = () => {
          console.log("ICE connection state:", pc.iceConnectionState)

          // Handle connection failures
          if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
            Alert.alert("Connection Issue", "Call connection is unstable. Would you like to try reconnecting?", [
              {
                text: "End Call",
                onPress: () => endCall(),
                style: "cancel",
              },
              {
                text: "Reconnect",
                onPress: () => restartIce(),
              },
            ])
          }
        }

        // Get user media
        const constraints = {
          audio: true,
          video: isVideoCall
            ? {
              facingMode: "user",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
            : false,
        }

        const stream = await WebRTCHelper.getUserMedia(constraints)
        setLocalStream(stream)

        // Add tracks to peer connection
        WebRTCHelper.addTracksToConnection(pc, stream)

        // Set up socket event listeners
        setupSocketListeners()

        // If outgoing call, initiate it
        if (callState === "outgoing") {
          await initiateCall()
        } else if (callState === "incoming") {
          await answerCall()
        }

        setIsLoading(false)
      } catch (error) {
        console.error("Error setting up call:", error)
        Alert.alert("Call Error", "Failed to set up call. Please try again.")
        endCall()
      }
    }

    setupCall()

    // Clean up on unmount
    return () => {
      cleanupCall()
    }
  }, [])

  // Set up socket listeners
  const setupSocketListeners = () => {
    // Listen for ICE candidates
    socket.on("ice-candidate", handleRemoteICECandidate)

    // Listen for call accepted
    socket.on("call-accepted", handleCallAccepted)

    // Listen for call rejected
    socket.on("call-rejected", handleCallRejected)

    // Listen for call ended
    socket.on("call-ended", handleCallEnded)

    // Listen for SDP answer
    socket.on("sdp-answer", handleSDPAnswer)

    // Listen for screen sharing status
    socket.on("screen-sharing-status", handleScreenSharingStatus)
  }

  // Clean up socket listeners
  const cleanupSocketListeners = () => {
    socket.off("ice-candidate")
    socket.off("call-accepted")
    socket.off("call-rejected")
    socket.off("call-ended")
    socket.off("sdp-answer")
    socket.off("screen-sharing-status")
  }

  // Initiate call
  const initiateCall = async () => {
    try {
      // Create offer
      const offer = await WebRTCHelper.createOffer(peerConnection.current)

      // Send call request to server
      const callData = {
        receiverId: contact._id,
        isVideoCall,
        offer,
      }

      const response = await CallsAPI.initiateCall(callData, authState.token)

      if (response.success) {
        setCallId(response.call._id)
      } else {
        Alert.alert("Call Error", response.message || "Failed to initiate call")
        endCall()
      }
    } catch (error) {
      console.error("Error initiating call:", error)
      Alert.alert("Call Error", "Failed to initiate call. Please try again.")
      endCall()
    }
  }

  // Answer call
  const answerCall = async () => {
    try {
      // Create answer
      const answer = await WebRTCHelper.createAnswer(peerConnection.current, incomingCall.offer)

      // Send answer to server
      const answerData = {
        accepted: true,
        answer,
      }

      const response = await CallsAPI.answerCall(incomingCall.callId, answerData, authState.token)

      if (response.success) {
        // Start call timer
        startCallTimer()

        // Start call quality monitoring
        startCallQualityMonitoring()

        // Set call state to connected
        setCallState("connected")
      } else {
        Alert.alert("Call Error", response.message || "Failed to answer call")
        endCall()
      }
    } catch (error) {
      console.error("Error answering call:", error)
      Alert.alert("Call Error", "Failed to answer call. Please try again.")
      endCall()
    }
  }

  // Handle remote ICE candidate
  const handleRemoteICECandidate = async (data) => {
    try {
      if (data.callId === callId) {
        await WebRTCHelper.addIceCandidate(peerConnection.current, data.candidate)
      }
    } catch (error) {
      console.error("Error handling remote ICE candidate:", error)
    }
  }

  // Handle call accepted
  const handleCallAccepted = async (data) => {
    try {
      if (data.callId === callId) {
        // Set remote description
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer))

        // Start call timer
        startCallTimer()

        // Start call quality monitoring
        startCallQualityMonitoring()

        // Set call state to connected
        setCallState("connected")
      }
    } catch (error) {
      console.error("Error handling call accepted:", error)
      Alert.alert("Call Error", "Failed to establish call connection. Please try again.")
      endCall()
    }
  }

  // Handle call rejected
  const handleCallRejected = (data) => {
    if (data.callId === callId) {
      Alert.alert("Call Rejected", "The recipient rejected your call.")
      endCall(false)
    }
  }

  // Handle call ended
  const handleCallEnded = (data) => {
    if (data.callId === callId) {
      Alert.alert("Call Ended", "The other person ended the call.")
      endCall(false)
    }
  }

  // Handle SDP answer
  const handleSDPAnswer = async (data) => {
    try {
      if (data.callId === callId) {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer))
      }
    } catch (error) {
      console.error("Error handling SDP answer:", error)
    }
  }

  // Handle screen sharing status
  const handleScreenSharingStatus = (data) => {
    if (data.callId === callId) {
      // Update UI to show that the other person is screen sharing
      setIsScreenSharing(data.isScreenSharing)
    }
  }

  // Start call timer
  const startCallTimer = () => {
    callTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1)
    }, 1000)
  }

  // Start call quality monitoring
  const startCallQualityMonitoring = () => {
    qualityMonitoringRef.current = WebRTCHelper.startCallQualityMonitoring(
      peerConnection.current,
      callId,
      "one-to-one",
      authState.token,
    )
  }

  // Restart ICE connection (for handling connection issues)
  const restartIce = async () => {
    try {
      if (peerConnection.current) {
        // Create new offer with ICE restart
        const offer = await peerConnection.current.createOffer({ iceRestart: true })
        await peerConnection.current.setLocalDescription(offer)

        // Send the offer to the other peer via signaling server
        socket.emit("sdp-offer", {
          callId,
          offer,
          senderId: authState.user.id,
          recipientId: incomingCall ? incomingCall.callerId : contact._id,
        })
      }
    } catch (error) {
      console.error("Error restarting ICE:", error)
    }
  }

  // Toggle mute
  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted
      })
      setIsMuted(!isMuted)
    }
  }

  // Toggle speaker
  const toggleSpeaker = () => {
    // This would typically use native modules to switch audio output
    // For simplicity, we're just toggling the state
    setIsSpeakerOn(!isSpeakerOn)
  }

  // Toggle video
  const toggleVideo = async () => {
    if (localStream) {
      if (isVideoEnabled) {
        // Disable video
        localStream.getVideoTracks().forEach((track) => {
          track.enabled = false
        })
      } else {
        // Enable video
        if (localStream.getVideoTracks().length > 0) {
          localStream.getVideoTracks().forEach((track) => {
            track.enabled = true
          })
        } else {
          // If no video tracks exist, get new stream with video
          try {
            const newStream = await WebRTCHelper.getUserMedia({
              audio: true,
              video: {
                facingMode: "user",
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
            })

            // Replace audio track in all peer connections
            const audioTrack = newStream.getAudioTracks()[0]
            const sender = peerConnection.current.getSenders().find((s) => s.track && s.track.kind === "audio")
            if (sender) {
              sender.replaceTrack(audioTrack)
            }

            // Add video track to peer connection
            const videoTrack = newStream.getVideoTracks()[0]
            peerConnection.current.addTrack(videoTrack, newStream)

            // Update local stream
            setLocalStream(newStream)
          } catch (error) {
            console.error("Error enabling video:", error)
            Alert.alert("Video Error", "Failed to enable video. Please try again.")
            return
          }
        }
      }

      setIsVideoEnabled(!isVideoEnabled)
    }
  }

  // Switch camera (front/back)
  const switchCamera = () => {
    if (localStream && localStream.getVideoTracks().length > 0) {
      const videoTrack = localStream.getVideoTracks()[0]
      videoTrack._switchCamera()
    }
  }

  // Toggle screen sharing (for web/desktop clients)
  const toggleScreenSharing = async () => {
    // Screen sharing is primarily for web/desktop clients
    if (Platform.OS !== "web") {
      Alert.alert("Screen Sharing", "Screen sharing is not supported in this mobile version.")
      return
    }

    try {
      if (isScreenSharing) {
        // Switch back to camera
        const newStream = await WebRTCHelper.getUserMedia({
          audio: true,
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })

        // Replace video track
        const videoTrack = newStream.getVideoTracks()[0]
        const sender = peerConnection.current.getSenders().find((s) => s.track && s.track.kind === "video")
        if (sender) {
          sender.replaceTrack(videoTrack)
        }

        // Update local stream
        setLocalStream(newStream)

        // Notify other peer
        socket.emit("screen-sharing-status", {
          callId,
          isScreenSharing: false,
          senderId: authState.user.id,
          recipientId: incomingCall ? incomingCall.callerId : contact._id,
        })
      } else {
        // Get screen sharing stream
        const screenStream = await WebRTCHelper.getDisplayMedia()

        // Replace video track
        const screenTrack = screenStream.getVideoTracks()[0]
        const sender = peerConnection.current.getSenders().find((s) => s.track && s.track.kind === "video")
        if (sender) {
          sender.replaceTrack(screenTrack)
        }

        // Handle screen sharing ended by user
        screenTrack.onended = () => {
          toggleScreenSharing()
        }

        // Update local stream (keep audio from original stream)
        const combinedStream = new MediaStream()
        localStream.getAudioTracks().forEach((track) => combinedStream.addTrack(track))
        combinedStream.addTrack(screenTrack)
        setLocalStream(combinedStream)

        // Notify other peer
        socket.emit("screen-sharing-status", {
          callId,
          isScreenSharing: true,
          senderId: authState.user.id,
          recipientId: incomingCall ? incomingCall.callerId : contact._id,
        })
      }

      setIsScreenSharing(!isScreenSharing)
    } catch (error) {
      console.error("Error toggling screen sharing:", error)
      Alert.alert("Screen Sharing Error", "Failed to share screen. Please try again.")
    }
  }

  // End call
  const endCall = async (notifyRemote = true) => {
    try {
      // Stop call timer
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current)
      }

      // Stop quality monitoring
      if (qualityMonitoringRef.current) {
        WebRTCHelper.stopCallQualityMonitoring(qualityMonitoringRef.current)
      }

      // Update call state
      setCallState("ended")

      // Notify backend
      if (callId && notifyRemote) {
        await CallsAPI.endCall(callId, { duration: callDuration }, authState.token)
      }

      // Clean up resources
      cleanupCall()

      // Navigate back
      navigation.goBack()
    } catch (error) {
      console.error("Error ending call:", error)
      navigation.goBack()
    }
  }

  // Clean up call resources
  const cleanupCall = () => {
    // Stop call timer
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current)
    }

    // Stop quality monitoring
    if (qualityMonitoringRef.current) {
      WebRTCHelper.stopCallQualityMonitoring(qualityMonitoringRef.current)
    }

    // Clean up socket listeners
    cleanupSocketListeners()

    // Clean up WebRTC
    WebRTCHelper.cleanupWebRTC(peerConnection.current, localStream, remoteStream)
    peerConnection.current = null
    setLocalStream(null)
    setRemoteStream(null)
  }

  // Render loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#128C7E" />
        <Text style={styles.loadingText}>Setting up call...</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Remote video (full screen) */}
      {isVideoCall && remoteStream && (
        <RTCView streamURL={remoteStream.toURL()} style={styles.remoteVideo} objectFit="cover" zOrder={0} />
      )}

      {/* Call info */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>{contact.name}</Text>
        <Text style={styles.callStateText}>
          {callState === "outgoing"
            ? "Calling..."
            : callState === "incoming"
              ? "Incoming call..."
              : formatCallDuration(callDuration)}
        </Text>
      </View>

      {/* Local video (picture-in-picture) */}
      {isVideoCall && localStream && (
        <View style={styles.localVideoContainer}>
          <RTCView streamURL={localStream.toURL()} style={styles.localVideo} objectFit="cover" zOrder={1} />
        </View>
      )}

      {/* Contact image (shown when video is off) */}
      {(!isVideoCall || !remoteStream) && (
        <View style={styles.contactImageContainer}>
          {contact.profilePicture ? (
            <Image source={{ uri: `${API_BASE_URL}${contact.profilePicture}` }} style={styles.contactImage} />
          ) : (
            <View style={styles.defaultContactImage}>
              <Text style={styles.contactInitial}>{contact.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>
      )}

      {/* Call actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={toggleMute}>
          <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color={isMuted ? "#FF3B30" : "#FFFFFF"} />
          <Text style={styles.actionText}>Mute</Text>
        </TouchableOpacity>

        {isVideoCall && (
          <TouchableOpacity style={styles.actionButton} onPress={toggleVideo}>
            <Ionicons
              name={isVideoEnabled ? "videocam" : "videocam-off"}
              size={24}
              color={isVideoEnabled ? "#25D366" : "#FFFFFF"}
            />
            <Text style={styles.actionText}>Video</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.actionButton} onPress={toggleSpeaker}>
          <Ionicons
            name={isSpeakerOn ? "volume-high" : "volume-medium"}
            size={24}
            color={isSpeakerOn ? "#25D366" : "#FFFFFF"}
          />
          <Text style={styles.actionText}>Speaker</Text>
        </TouchableOpacity>

        {isVideoCall && isVideoEnabled && (
          <TouchableOpacity style={styles.actionButton} onPress={switchCamera}>
            <Ionicons name="camera-reverse" size={24} color="#FFFFFF" />
            <Text style={styles.actionText}>Flip</Text>
          </TouchableOpacity>
        )}

        {Platform.OS === "web" && isVideoCall && (
          <TouchableOpacity style={styles.actionButton} onPress={toggleScreenSharing}>
            <Ionicons name="phone-landscape" size={24} color={isScreenSharing ? "#25D366" : "#FFFFFF"} />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.actionButton, styles.endCallButton]} onPress={() => endCall()}>
          <Ionicons name="call" size={30} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A1A1A",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
  },
  loadingText: {
    color: "#FFFFFF",
    marginTop: 10,
    fontSize: 16,
  },
  headerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    padding: 15,
    zIndex: 10,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
  },
  headerText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
  },
  callStateText: {
    color: "#CCCCCC",
    fontSize: 16,
    marginTop: 5,
  },
  remoteVideo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  localVideoContainer: {
    position: "absolute",
    top: 100,
    right: 20,
    width: 100,
    height: 150,
    borderRadius: 10,
    overflow: "hidden",
    zIndex: 2,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  localVideo: {
    flex: 1,
  },
  contactImageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  contactImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  defaultContactImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#128C7E",
    justifyContent: "center",
    alignItems: "center",
  },
  contactInitial: {
    color: "#FFFFFF",
    fontSize: 64,
    fontWeight: "bold",
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    padding: 15,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingBottom: Platform.OS === "ios" ? 30 : 15,
  },
  actionButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    color: "#FFFFFF",
    marginTop: 5,
    fontSize: 12,
  },
  endCallButton: {
    backgroundColor: "#FF3B30",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
})

export default CallScreen
