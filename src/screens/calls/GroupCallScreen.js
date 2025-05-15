"use client"

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
  FlatList,
  ScrollView,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useNavigation, useRoute } from "@react-navigation/native"
import { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, mediaDevices, RTCView } from "react-native-webrtc"
import { AuthContext } from "../../context/AuthContext"
import { SocketContext } from "../../context/SocketContext"
import * as GroupCallsAPI from "../../api/group-calls"
import * as CallsAPI from "../../api/call"
import { API_BASE_URL } from "../../config/api"
import { formatCallDuration } from "../../utils/formatters"

const GroupCallScreen = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const { conversation, isVideoCall = false, incomingCall = null } = route.params || {}

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
  const [groupCallId, setGroupCallId] = useState(incomingCall?.groupCallId || null)
  const [participants, setParticipants] = useState([])
  const [activeParticipants, setActiveParticipants] = useState([])
  const [focusedParticipant, setFocusedParticipant] = useState(null)

  // WebRTC state
  const [localStream, setLocalStream] = useState(null)
  const peerConnections = useRef({})
  const remoteStreams = useRef({})
  const callTimerRef = useRef(null)

  // Initialize call
  useEffect(() => {
    const setupCall = async () => {
      try {
        // Get ICE servers from backend
        const iceServersResponse = await CallsAPI.getIceServers(authState.token)
        const iceServers = iceServersResponse.success
          ? iceServersResponse.iceServers
          : [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }]

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

        const stream = await mediaDevices.getUserMedia(constraints)
        setLocalStream(stream)

        // Set up socket event listeners
        setupSocketListeners()

        // If outgoing call, initiate it
        if (callState === "outgoing") {
          await initiateGroupCall(iceServers)
        } else if (callState === "incoming") {
          await joinGroupCall(iceServers)
        }

        setIsLoading(false)
      } catch (error) {
        console.error("Error setting up group call:", error)
        Alert.alert("Call Error", "Failed to set up group call. Please try again.")
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
    // Listen for new participant joined
    socket.on("participant-joined", handleParticipantJoined)

    // Listen for participant left
    socket.on("participant-left", handleParticipantLeft)

    // Listen for group call ended
    socket.on("group-call-ended", handleGroupCallEnded)

    // Listen for ICE candidates from remote peers
    socket.on("ice-candidate", handleRemoteICECandidate)

    // Listen for SDP offers
    socket.on("sdp-offer", handleSDPOffer)

    // Listen for SDP answers
    socket.on("sdp-answer", handleSDPAnswer)

    // Listen for screen sharing status
    socket.on("screen-sharing-status", handleScreenSharingStatus)
  }

  // Clean up socket listeners
  const cleanupSocketListeners = () => {
    socket.off("participant-joined")
    socket.off("participant-left")
    socket.off("group-call-ended")
    socket.off("ice-candidate")
    socket.off("sdp-offer")
    socket.off("sdp-answer")
    socket.off("screen-sharing-status")
  }

  // Initiate group call
  const initiateGroupCall = async (iceServers) => {
    try {
      // Create group call in backend
      const groupCallData = {
        conversationId: conversation._id,
        isVideoCall,
      }

      const response = await GroupCallsAPI.createGroupCall(groupCallData, authState.token)

      if (response.success) {
        setGroupCallId(response.groupCall._id)
        setParticipants(response.groupCall.participants)

        // Add self to active participants
        setActiveParticipants([
          {
            userId: authState.user.id,
            name: authState.user.name,
            profilePicture: authState.user.profilePicture,
            isHost: true,
            isSelf: true,
            stream: localStream,
          },
        ])

        // Start call timer
        startCallTimer()

        // Set call state to connected
        setCallState("connected")
      } else {
        Alert.alert("Call Error", response.message || "Failed to initiate group call")
        endCall()
      }
    } catch (error) {
      console.error("Error initiating group call:", error)
      Alert.alert("Call Error", "Failed to initiate group call. Please try again.")
      endCall()
    }
  }

  // Join group call
  const joinGroupCall = async (iceServers) => {
    try {
      // Join group call in backend
      const joinData = {
        accepted: true,
      }

      const response = await GroupCallsAPI.joinGroupCall(groupCallId, joinData, authState.token)

      if (response.success) {
        setParticipants(response.groupCall.participants)

        // Add self to active participants
        setActiveParticipants([
          {
            userId: authState.user.id,
            name: authState.user.name,
            profilePicture: authState.user.profilePicture,
            isHost: false,
            isSelf: true,
            stream: localStream,
          },
        ])

        // Create peer connections for each existing participant
        const existingParticipants = response.groupCall.participants.filter(
          (p) => p.userId !== authState.user.id && p.active,
        )

        for (const participant of existingParticipants) {
          createPeerConnection(participant.userId, iceServers)

          // Create and send offer to each participant
          const offer = await createOffer(participant.userId)

          socket.emit("sdp-offer", {
            groupCallId,
            offer,
            senderId: authState.user.id,
            recipientId: participant.userId,
          })
        }

        // Start call timer
        startCallTimer()

        // Set call state to connected
        setCallState("connected")
      } else {
        Alert.alert("Call Error", response.message || "Failed to join group call")
        endCall()
      }
    } catch (error) {
      console.error("Error joining group call:", error)
      Alert.alert("Call Error", "Failed to join group call. Please try again.")
      endCall()
    }
  }

  // Create peer connection for a participant
  const createPeerConnection = (participantId, iceServers) => {
    try {
      const pc = new RTCPeerConnection({
        iceServers,
        iceCandidatePoolSize: 10,
      })

      // Add local stream tracks to peer connection
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream)
        })
      }

      // Set up event handlers
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", {
            groupCallId,
            candidate: event.candidate.toJSON(),
            senderId: authState.user.id,
            recipientId: participantId,
          })
        }
      }

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          remoteStreams.current[participantId] = event.streams[0]

          // Update active participants
          setActiveParticipants((prev) => {
            const participant = participants.find((p) => p.userId === participantId)

            if (participant) {
              const exists = prev.some((p) => p.userId === participantId)

              if (exists) {
                return prev.map((p) => (p.userId === participantId ? { ...p, stream: event.streams[0] } : p))
              } else {
                return [
                  ...prev,
                  {
                    userId: participantId,
                    name: participant.name,
                    profilePicture: participant.profilePicture,
                    isHost: participant.isHost,
                    isSelf: false,
                    stream: event.streams[0],
                  },
                ]
              }
            }

            return prev
          })
        }
      }

      pc.oniceconnectionstatechange = () => {
        console.log(`ICE connection state with ${participantId}:`, pc.iceConnectionState)

        if (
          pc.iceConnectionState === "failed" ||
          pc.iceConnectionState === "disconnected" ||
          pc.iceConnectionState === "closed"
        ) {
          // Remove participant from active participants
          setActiveParticipants((prev) => prev.filter((p) => p.userId !== participantId))

          // Clean up peer connection
          if (peerConnections.current[participantId]) {
            peerConnections.current[participantId].close()
            delete peerConnections.current[participantId]
          }

          // Clean up remote stream
          if (remoteStreams.current[participantId]) {
            delete remoteStreams.current[participantId]
          }
        }
      }

      // Store peer connection
      peerConnections.current[participantId] = pc

      return pc
    } catch (error) {
      console.error(`Error creating peer connection for ${participantId}:`, error)
      return null
    }
  }

  // Create and send offer
  const createOffer = async (participantId) => {
    try {
      const pc = peerConnections.current[participantId]

      if (!pc) return null

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideoCall,
      })

      await pc.setLocalDescription(offer)

      return offer
    } catch (error) {
      console.error(`Error creating offer for ${participantId}:`, error)
      return null
    }
  }

  // Create and send answer
  const createAnswer = async (participantId, offer) => {
    try {
      let pc = peerConnections.current[participantId]

      if (!pc) {
        // Get ICE servers
        const iceServersResponse = await CallsAPI.getIceServers(authState.token)
        const iceServers = iceServersResponse.success
          ? iceServersResponse.iceServers
          : [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }]

        pc = createPeerConnection(participantId, iceServers)
      }

      if (!pc) return null

      await pc.setRemoteDescription(new RTCSessionDescription(offer))

      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      return answer
    } catch (error) {
      console.error(`Error creating answer for ${participantId}:`, error)
      return null
    }
  }

  // Handle SDP offer
  const handleSDPOffer = async (data) => {
    try {
      if (data.groupCallId === groupCallId && data.recipientId === authState.user.id) {
        const answer = await createAnswer(data.senderId, data.offer)

        if (answer) {
          socket.emit("sdp-answer", {
            groupCallId,
            answer,
            senderId: authState.user.id,
            recipientId: data.senderId,
          })
        }
      }
    } catch (error) {
      console.error("Error handling SDP offer:", error)
    }
  }

  // Handle SDP answer
  const handleSDPAnswer = async (data) => {
    try {
      if (data.groupCallId === groupCallId && data.recipientId === authState.user.id) {
        const pc = peerConnections.current[data.senderId]

        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer))
        }
      }
    } catch (error) {
      console.error("Error handling SDP answer:", error)
    }
  }

  // Handle remote ICE candidate
  const handleRemoteICECandidate = async (data) => {
    try {
      if (data.groupCallId === groupCallId && data.recipientId === authState.user.id) {
        const pc = peerConnections.current[data.senderId]

        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate))
        }
      }
    } catch (error) {
      console.error("Error handling remote ICE candidate:", error)
    }
  }

  // Handle participant joined
  const handleParticipantJoined = async (data) => {
    try {
      if (data.groupCallId === groupCallId) {
        // Update participants list
        setParticipants((prev) => [...prev, data.participant])

        // Create peer connection for new participant
        const iceServersResponse = await CallsAPI.getIceServers(authState.token)
        const iceServers = iceServersResponse.success
          ? iceServersResponse.iceServers
          : [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }]

        createPeerConnection(data.participant.userId, iceServers)
      }
    } catch (error) {
      console.error("Error handling participant joined:", error)
    }
  }

  // Handle participant left
  const handleParticipantLeft = (data) => {
    if (data.groupCallId === groupCallId) {
      // Update participants list
      setParticipants((prev) => prev.filter((p) => p.userId !== data.participantId))

      // Remove from active participants
      setActiveParticipants((prev) => prev.filter((p) => p.userId !== data.participantId))

      // Clean up peer connection
      if (peerConnections.current[data.participantId]) {
        peerConnections.current[data.participantId].close()
        delete peerConnections.current[data.participantId]
      }

      // Clean up remote stream
      if (remoteStreams.current[data.participantId]) {
        delete remoteStreams.current[data.participantId]
      }
    }
  }

  // Handle group call ended
  const handleGroupCallEnded = (data) => {
    if (data.groupCallId === groupCallId) {
      Alert.alert("Call Ended", "The host has ended the group call.")
      endCall(false)
    }
  }

  // Handle screen sharing status
  const handleScreenSharingStatus = (data) => {
    if (data.groupCallId === groupCallId) {
      // Update participant's screen sharing status
      setActiveParticipants((prev) =>
        prev.map((p) => (p.userId === data.participantId ? { ...p, isScreenSharing: data.isScreenSharing } : p)),
      )

      // If someone is screen sharing, focus on them
      if (data.isScreenSharing) {
        setFocusedParticipant(data.participantId)
      } else if (focusedParticipant === data.participantId) {
        setFocusedParticipant(null)
      }
    }
  }

  // Start call timer
  const startCallTimer = () => {
    callTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1)
    }, 1000)
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
            const newStream = await mediaDevices.getUserMedia({
              audio: true,
              video: {
                facingMode: "user",
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
            })

            // Replace audio track in all peer connections
            const audioTrack = newStream.getAudioTracks()[0]
            Object.values(peerConnections.current).forEach((pc) => {
              const sender = pc.getSenders().find((s) => s.track && s.track.kind === "audio")
              if (sender) {
                sender.replaceTrack(audioTrack)
              }
            })

            // Add video track to all peer connections
            const videoTrack = newStream.getVideoTracks()[0]
            Object.values(peerConnections.current).forEach((pc) => {
              pc.addTrack(videoTrack, newStream)
            })

            // Update local stream
            setLocalStream(newStream)

            // Update self in active participants
            setActiveParticipants((prev) => prev.map((p) => (p.isSelf ? { ...p, stream: newStream } : p)))
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

  // Toggle screen sharing
  const toggleScreenSharing = async () => {
    // This is a placeholder as screen sharing is more complex in React Native
    // and typically requires native modules or third-party libraries
    Alert.alert("Screen Sharing", "Screen sharing is not supported in this mobile version.")
  }

  // Focus on a participant
  const focusOnParticipant = (participantId) => {
    setFocusedParticipant(participantId === focusedParticipant ? null : participantId)
  }

  // End call
  const endCall = async (notifyRemote = true) => {
    try {
      // Stop call timer
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current)
      }

      // Update call state
      setCallState("ended")

      // Notify backend
      if (groupCallId) {
        if (notifyRemote) {
          // If host, end the call for everyone
          const isHost = participants.find((p) => p.userId === authState.user.id)?.isHost

          if (isHost) {
            await GroupCallsAPI.endGroupCall(groupCallId, authState.token)
          } else {
            // Otherwise, just leave the call
            await GroupCallsAPI.leaveGroupCall(groupCallId, { duration: callDuration }, authState.token)
          }
        }
      }

      // Clean up resources
      cleanupCall()

      // Navigate back
      navigation.goBack()
    } catch (error) {
      console.error("Error ending group call:", error)
      navigation.goBack()
    }
  }

  // Clean up call resources
  const cleanupCall = () => {
    // Stop call timer
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current)
    }

    // Clean up socket listeners
    cleanupSocketListeners()

    // Clean up WebRTC
    Object.values(peerConnections.current).forEach((pc) => {
      pc.close()
    })

    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.stop()
      })
      setLocalStream(null)
    }

    // Stop remote streams
    Object.values(remoteStreams.current).forEach((stream) => {
      stream.getTracks().forEach((track) => {
        track.stop()
      })
    })

    // Clear references
    peerConnections.current = {}
    remoteStreams.current = {}
  }

  // Render loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#128C7E" />
        <Text style={styles.loadingText}>Setting up group call...</Text>
      </View>
    )
  }

  // Determine grid layout based on number of participants
  const getGridLayout = () => {
    const count = activeParticipants.length

    if (count <= 1) return { columns: 1, height: "100%" }
    if (count <= 4) return { columns: 2, height: "50%" }
    return { columns: 3, height: "33.33%" }
  }

  const gridLayout = getGridLayout()

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Call info */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>{conversation.isGroup ? conversation.groupName : "Group Call"}</Text>
        <Text style={styles.durationText}>{formatCallDuration(callDuration)}</Text>
      </View>

      {/* Participants grid */}
      <View style={styles.gridContainer}>
        {focusedParticipant ? (
          // Focused view (one participant large, others small)
          <View style={styles.focusedContainer}>
            <View style={styles.focusedParticipant}>
              {renderParticipantVideo(activeParticipants.find((p) => p.userId === focusedParticipant))}
            </View>

            <ScrollView horizontal style={styles.thumbnailsContainer}>
              {activeParticipants
                .filter((p) => p.userId !== focusedParticipant)
                .map((participant) => (
                  <TouchableOpacity
                    key={participant.userId}
                    style={styles.thumbnailWrapper}
                    onPress={() => focusOnParticipant(participant.userId)}
                  >
                    {renderParticipantVideo(participant, true)}
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        ) : (
          // Grid view (all participants equal size)
          <FlatList
            data={activeParticipants}
            numColumns={gridLayout.columns}
            keyExtractor={(item) => item.userId}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.participantContainer,
                  { height: gridLayout.height, width: `${100 / gridLayout.columns}%` },
                ]}
                onPress={() => focusOnParticipant(item.userId)}
              >
                {renderParticipantVideo(item)}
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {/* Call actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={toggleMute}>
          <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color={isMuted ? "#FF3B30" : "#FFFFFF"} />
          <Text style={styles.actionText}>Mute</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={toggleVideo}>
          <Ionicons
            name={isVideoEnabled ? "videocam" : "videocam-off"}
            size={24}
            color={isVideoEnabled ? "#25D366" : "#FFFFFF"}
          />
          <Text style={styles.actionText}>Video</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={toggleSpeaker}>
          <Ionicons
            name={isSpeakerOn ? "volume-high" : "volume-medium"}
            size={24}
            color={isSpeakerOn ? "#25D366" : "#FFFFFF"}
          />
          <Text style={styles.actionText}>Speaker</Text>
        </TouchableOpacity>

        {isVideoEnabled && (
          <TouchableOpacity style={styles.actionButton} onPress={switchCamera}>
            <Ionicons name="camera-reverse" size={24} color="#FFFFFF" />
            <Text style={styles.actionText}>Flip</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.actionButton} onPress={toggleScreenSharing}>
          <Ionicons name="phone-landscape" size={24} color={isScreenSharing ? "#25D366" : "#FFFFFF"} />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, styles.endCallButton]} onPress={() => endCall()}>
          <Ionicons name="call" size={30} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )

  // Helper function to render participant video
  function renderParticipantVideo(participant, isThumbnail = false) {
    if (!participant) return null

    const { userId, name, profilePicture, stream, isSelf, isScreenSharing } = participant

    // If participant has video stream
    if (stream && stream.getVideoTracks().length > 0 && (stream.getVideoTracks()[0].enabled || isScreenSharing)) {
      return (
        <View style={isThumbnail ? styles.thumbnailVideo : styles.participantVideo}>
          <RTCView streamURL={stream.toURL()} style={styles.videoStream} objectFit="cover" zOrder={0} />
          <View style={styles.nameTag}>
            <Text style={styles.nameTagText}>{isSelf ? "You" : name}</Text>
          </View>
        </View>
      )
    }

    // If no video, show profile picture or placeholder
    return (
      <View style={isThumbnail ? styles.thumbnailVideo : styles.participantVideo}>
        <View style={styles.noVideoContainer}>
          {profilePicture ? (
            <Image source={{ uri: `${API_BASE_URL}${profilePicture}` }} style={styles.profileImage} />
          ) : (
            <View style={styles.defaultProfileImage}>
              <Text style={styles.profileImageText}>{name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.participantName}>{isSelf ? "You" : name}</Text>
        </View>
      </View>
    )
  }
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  headerText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  durationText: {
    color: "#CCCCCC",
    fontSize: 14,
  },
  gridContainer: {
    flex: 1,
  },
  participantContainer: {
    padding: 2,
  },
  participantVideo: {
    flex: 1,
    backgroundColor: "#2C2C2C",
    borderRadius: 8,
    overflow: "hidden",
  },
  videoStream: {
    flex: 1,
  },
  noVideoContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#2C2C2C",
    borderRadius: 8,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 10,
  },
  defaultProfileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#128C7E",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  profileImageText: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "bold",
  },
  participantName: {
    color: "#FFFFFF",
    fontSize: 14,
    textAlign: "center",
  },
  nameTag: {
    position: "absolute",
    bottom: 5,
    left: 5,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  nameTagText: {
    color: "#FFFFFF",
    fontSize: 12,
  },
  focusedContainer: {
    flex: 1,
  },
  focusedParticipant: {
    flex: 1,
    marginBottom: 5,
  },
  thumbnailsContainer: {
    height: 100,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  thumbnailWrapper: {
    width: 100,
    height: 100,
    padding: 5,
  },
  thumbnailVideo: {
    flex: 1,
    backgroundColor: "#2C2C2C",
    borderRadius: 8,
    overflow: "hidden",
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

export default GroupCallScreen
