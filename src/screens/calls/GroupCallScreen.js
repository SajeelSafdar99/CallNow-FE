"use client"

import { useState, useEffect, useRef, useContext } from "react"
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
  FlatList,
  Alert,
  PermissionsAndroid,
  AppState,
  ActivityIndicator,
} from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import Ionicons from "react-native-vector-icons/Ionicons"
import { AuthContext } from "../../context/AuthContext"
import { SocketContext } from "../../context/SocketContext"
import { ThemeContext } from "../../context/ThemeContext"
import { getTheme } from "../../utils/theme"
import * as GroupCallAPI from "../../api/group-calls"
import * as IceServerAPI from "../../api/ice-server"
import * as CallLogAPI from "../../api/call-log"
import { API_BASE_URL_FOR_MEDIA } from "../../config/api"
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  mediaDevices,
} from "react-native-webrtc"
import { check, request, PERMISSIONS, RESULTS } from "react-native-permissions"
import NetInfo from "@react-native-community/netinfo"

const { width, height } = Dimensions.get("window")

const GroupCallScreen = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const { conversation, isVideo = false, groupCallId = null } = route.params
  const { state: authState } = useContext(AuthContext)
  const { socket, isConnected } = useContext(SocketContext)
  const { theme } = useContext(ThemeContext)
  const currentTheme = getTheme(theme)

  // Call state
  const [callState, setCallState] = useState("initializing") // initializing, connecting, ongoing, ended
  const [callDuration, setCallDuration] = useState(0)
  const [activeGroupCallId, setActiveGroupCallId] = useState(groupCallId)
  const [participants, setParticipants] = useState([])
  const [isJoining, setIsJoining] = useState(false)
  const [isCreator, setIsCreator] = useState(false)
  const [callEndReason, setCallEndReason] = useState(null)

  // Media state
  const [localStream, setLocalStream] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeakerOn, setIsSpeakerOn] = useState(isVideo)
  const [isVideoEnabled, setIsVideoEnabled] = useState(isVideo)
  const [isFrontCamera, setIsFrontCamera] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)

  // Network state
  const [networkType, setNetworkType] = useState(null)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [callQuality, setCallQuality] = useState("good") // good, fair, poor

  // Refs
  const peerConnectionsRef = useRef({}) // Map of userId -> RTCPeerConnection
  const remoteStreamsRef = useRef({}) // Map of userId -> MediaStream
  const callTimerRef = useRef(null)
  const qualityMonitorRef = useRef(null)
  const iceServersRef = useRef([])
  const appStateRef = useRef(AppState.currentState)
  const isCallEndingRef = useRef(false)
  const connectionIdsRef = useRef([])

  // Initialize call
  useEffect(() => {
    const setupCall = async () => {
      try {
        // Request permissions
        const hasPermissions = await requestPermissions()
        if (!hasPermissions) {
          Alert.alert("Permission Required", "Camera and microphone permissions are required for group calls.", [
            { text: "OK", onPress: () => navigation.goBack() },
          ])
          return
        }

        // Get ICE servers
        const iceServersResponse = await IceServerAPI.getIceServers(authState.token)
        if (iceServersResponse.success) {
          iceServersRef.current = iceServersResponse.iceServers
        } else {
          // Fallback to default STUN servers
          iceServersRef.current = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }]
        }

        // Initialize media stream
        await setupMediaStream()

        // Check if joining existing call or creating new one
        if (activeGroupCallId) {
          // Join existing call
          await joinExistingCall()
        } else {
          // Create new call
          await createNewCall()
        }

        // Set up network monitoring
        setupNetworkMonitoring()

        // Set up app state monitoring
        setupAppStateMonitoring()
      } catch (error) {
        console.error("Error setting up group call:", error)
        handleLeaveCall("setup_failed")
      }
    }

    setupCall()

    // Clean up on unmount
    return () => {
      cleanupCall()
    }
  }, [])

  // Set up socket event listeners
  useEffect(() => {
    if (socket && isConnected && activeGroupCallId) {
      // Join group call room
      socket.emit("join-group-call", activeGroupCallId)

      // Listen for new participants
      socket.on("group-call-user-joined", handleUserJoined)

      // Listen for participants leaving
      socket.on("group-call-user-left", handleUserLeft)

      // Listen for offers
      socket.on("group-call-offer", handleRemoteOffer)

      // Listen for answers
      socket.on("group-call-answer", handleRemoteAnswer)

      // Listen for ICE candidates
      socket.on("group-call-ice-candidate", handleRemoteIceCandidate)

      // Listen for screen sharing updates
      socket.on("group-call-screen-sharing", handleScreenSharingUpdate)

      return () => {
        // Leave group call room
        socket.emit("leave-group-call", activeGroupCallId)

        // Remove listeners
        socket.off("group-call-user-joined", handleUserJoined)
        socket.off("group-call-user-left", handleUserLeft)
        socket.off("group-call-offer", handleRemoteOffer)
        socket.off("group-call-answer", handleRemoteAnswer)
        socket.off("group-call-ice-candidate", handleRemoteIceCandidate)
        socket.off("group-call-screen-sharing", handleScreenSharingUpdate)
      }
    }
  }, [socket, isConnected, activeGroupCallId])

  // Request permissions
  const requestPermissions = async () => {
    if (Platform.OS === "android") {
      try {
        const micPermission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
          title: "Microphone Permission",
          message: "CallNow needs access to your microphone for calls.",
          buttonNeutral: "Ask Me Later",
          buttonNegative: "Cancel",
          buttonPositive: "OK",
        })

        let cameraPermission = RESULTS.GRANTED
        if (isVideo) {
          cameraPermission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
            title: "Camera Permission",
            message: "CallNow needs access to your camera for video calls.",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK",
          })
        }

        return (
          micPermission === PermissionsAndroid.RESULTS.GRANTED &&
          (!isVideo || cameraPermission === PermissionsAndroid.RESULTS.GRANTED)
        )
      } catch (err) {
        console.error("Error requesting permissions:", err)
        return false
      }
    } else {
      // iOS
      try {
        const micStatus = await check(PERMISSIONS.IOS.MICROPHONE)
        if (micStatus !== RESULTS.GRANTED) {
          const micResult = await request(PERMISSIONS.IOS.MICROPHONE)
          if (micResult !== RESULTS.GRANTED) return false
        }

        if (isVideo) {
          const cameraStatus = await check(PERMISSIONS.IOS.CAMERA)
          if (cameraStatus !== RESULTS.GRANTED) {
            const cameraResult = await request(PERMISSIONS.IOS.CAMERA)
            if (cameraResult !== RESULTS.GRANTED) return false
          }
        }

        return true
      } catch (err) {
        console.error("Error checking permissions:", err)
        return false
      }
    }
  }

  // Set up media stream
  const setupMediaStream = async () => {
    try {
      const constraints = {
        audio: true,
        video: isVideo
          ? {
            facingMode: isFrontCamera ? "user" : "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          }
          : false,
      }

      const stream = await mediaDevices.getUserMedia(constraints)
      setLocalStream(stream)

      return stream
    } catch (error) {
      console.error("Error getting user media:", error)
      throw new Error("Failed to access camera or microphone")
    }
  }

  // Set up network monitoring
  const setupNetworkMonitoring = () => {
    // Subscribe to network info updates
    const unsubscribe = NetInfo.addEventListener((state) => {
      setNetworkType(state.type)

      // Handle network changes
      if (!state.isConnected && callState === "ongoing") {
        setIsReconnecting(true)
        // Try to reconnect peer connections
        Object.values(peerConnectionsRef.current).forEach((pc) => {
          if (pc && (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed")) {
            restartIce(pc)
          }
        })
      } else if (state.isConnected && isReconnecting) {
        setIsReconnecting(false)
      }
    })

    return unsubscribe
  }

  // Set up app state monitoring
  const setupAppStateMonitoring = () => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === "active" && callState === "ongoing") {
        // App has come to the foreground during a call
        // Check connections and restart if needed
        Object.values(peerConnectionsRef.current).forEach((pc) => {
          if (pc && (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed")) {
            restartIce(pc)
          }
        })
      }
      appStateRef.current = nextAppState
    })

    return () => {
      subscription.remove()
    }
  }

  // Create new group call
  const createNewCall = async () => {
    try {
      setCallState("connecting")

      // Create group call in backend
      const response = await GroupCallAPI.createGroupCall(
        {
          conversationId: conversation._id,
          type: isVideo ? "video" : "audio",
          name: conversation.groupName || "Group Call",
        },
        authState.token,
      )

      if (response.success) {
        const newGroupCallId = response.groupCall._id
        setActiveGroupCallId(newGroupCallId)
        setIsCreator(true)

        // Update participants
        setParticipants(
          response.groupCall.participants.map((p) => ({
            ...p.user,
            isActive: p.isActive,
            isSharingScreen: p.sharingScreen,
            joinedAt: p.joinedAt,
          })),
        )

        // Start call timer
        callTimerRef.current = setInterval(() => {
          setCallDuration((prev) => prev + 1)
        }, 1000)

        // Start quality monitoring
        startQualityMonitoring()

        // Update call state
        setCallState("ongoing")

        // Log call created event
        await CallLogAPI.logCallEvent(authState.token, newGroupCallId, "group", "call_created", {
          callType: isVideo ? "video" : "audio",
        })

        // Notify others via socket that you've joined
        if (socket && isConnected) {
          socket.emit("group-call-user-joined", {
            groupCallId: newGroupCallId,
            user: {
              _id: authState.user.id,
              name: authState.user.name,
              profilePicture: authState.user.profilePicture,
            },
          })
        }
      } else {
        console.error("Failed to create group call:", response.message)
        handleLeaveCall("create_failed")
      }
    } catch (error) {
      console.error("Error creating group call:", error)
      handleLeaveCall("create_failed")
    }
  }

  // Join existing group call
  const joinExistingCall = async () => {
    try {
      setIsJoining(true)
      setCallState("connecting")

      // Get call details
      const response = await GroupCallAPI.getGroupCallDetails(activeGroupCallId, authState.token)

      if (response.success) {
        // Update participants
        setParticipants(
          response.groupCall.participants.map((p) => ({
            ...p.user,
            isActive: p.isActive,
            isSharingScreen: p.sharingScreen,
            joinedAt: p.joinedAt,
          })),
        )

        // Check if user is creator
        setIsCreator(response.groupCall.initiator._id === authState.user.id)

        // Join call in backend
        const joinResponse = await GroupCallAPI.joinGroupCall(activeGroupCallId, { connectionIds: [] }, authState.token)

        if (joinResponse.success) {
          // Create peer connections with all active participants
          const activeParticipants = joinResponse.groupCall.participants.filter(
            (p) => p.isActive && p.user._id !== authState.user.id,
          )

          // Create connection IDs for each participant
          const newConnectionIds = []

          for (const participant of activeParticipants) {
            const connectionId = `${authState.user.id}-${participant.user._id}-${Date.now()}`
            newConnectionIds.push(connectionId)

            // Create peer connection
            const pc = await createPeerConnection(participant.user._id, connectionId)

            // Create and send offer
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)

            // Send offer via socket
            if (socket && isConnected) {
              socket.emit("group-call-offer", {
                groupCallId: activeGroupCallId,
                receiverId: participant.user._id,
                offer,
                connectionId,
              })
            }
          }

          // Update connection IDs in backend
          if (newConnectionIds.length > 0) {
            connectionIdsRef.current = newConnectionIds
            await GroupCallAPI.updateConnectionIds(
              activeGroupCallId,
              { connectionIds: newConnectionIds },
              authState.token,
            )
          }

          // Start call timer
          callTimerRef.current = setInterval(() => {
            setCallDuration((prev) => prev + 1)
          }, 1000)

          // Start quality monitoring
          startQualityMonitoring()

          // Update call state
          setCallState("ongoing")

          // Log call joined event
          await CallLogAPI.logCallEvent(authState.token, activeGroupCallId, "group", "call_joined", {})

          // Notify others via socket that you've joined
          if (socket && isConnected) {
            socket.emit("group-call-user-joined", {
              groupCallId: activeGroupCallId,
              user: {
                _id: authState.user.id,
                name: authState.user.name,
                profilePicture: authState.user.profilePicture,
              },
            })
          }
        } else {
          console.error("Failed to join group call:", joinResponse.message)
          handleLeaveCall("join_failed")
        }
      } else {
        console.error("Failed to get group call details:", response.message)
        handleLeaveCall("join_failed")
      }
    } catch (error) {
      console.error("Error joining group call:", error)
      handleLeaveCall("join_failed")
    } finally {
      setIsJoining(false)
    }
  }

  // Create WebRTC peer connection for a participant
  const createPeerConnection = async (participantId, connectionId) => {
    try {
      const configuration = {
        iceServers: iceServersRef.current,
        iceCandidatePoolSize: 10,
      }

      const pc = new RTCPeerConnection(configuration)

      // Add local stream tracks to peer connection
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream)
        })
      }

      // Handle ICE candidates
      pc.onicecandidate = ({ candidate }) => {
        if (candidate && socket && isConnected && activeGroupCallId) {
          socket.emit("group-call-ice-candidate", {
            groupCallId: activeGroupCallId,
            receiverId: participantId,
            candidate,
            connectionId,
          })
        }
      }

      // Handle ICE connection state changes
      pc.oniceconnectionstatechange = () => {
        console.log(`ICE connection state for ${participantId}:`, pc.iceConnectionState)

        if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
          // Try to restart ICE if connection fails
          if (callState === "ongoing") {
            restartIce(pc, participantId, connectionId)
          }
        }
      }

      // Handle remote stream
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          // Store remote stream
          remoteStreamsRef.current[participantId] = event.streams[0]

          // Force update to render new stream
          setParticipants((prev) => {
            const updated = [...prev]
            const index = updated.findIndex((p) => p._id === participantId)
            if (index !== -1) {
              updated[index] = { ...updated[index], hasStream: true }
            }
            return updated
          })
        }
      }

      // Store peer connection
      peerConnectionsRef.current[participantId] = pc
      return pc
    } catch (error) {
      console.error(`Error creating peer connection for ${participantId}:`, error)
      throw new Error("Failed to create peer connection")
    }
  }

  // Handle new user joined
  const handleUserJoined = async ({ groupCallId, user }) => {
    if (groupCallId === activeGroupCallId && user._id !== authState.user.id) {
      // Add user to participants if not already there
      setParticipants((prev) => {
        const exists = prev.some((p) => p._id === user._id)
        if (exists) {
          return prev.map((p) => (p._id === user._id ? { ...p, isActive: true } : p))
        } else {
          return [...prev, { ...user, isActive: true }]
        }
      })

      // Wait for the other user to send an offer
      console.log(`User ${user.name} joined the call`)
    }
  }

  // Handle user left
  const handleUserLeft = ({ groupCallId, userId }) => {
    if (groupCallId === activeGroupCallId) {
      // Update participant status
      setParticipants((prev) => prev.map((p) => (p._id === userId ? { ...p, isActive: false } : p)))

      // Clean up peer connection
      if (peerConnectionsRef.current[userId]) {
        peerConnectionsRef.current[userId].close()
        delete peerConnectionsRef.current[userId]
      }

      // Clean up remote stream
      if (remoteStreamsRef.current[userId]) {
        delete remoteStreamsRef.current[userId]
      }

      console.log(`User ${userId} left the call`)
    }
  }

  // Handle remote offer
  const handleRemoteOffer = async ({ groupCallId, senderId, offer, connectionId }) => {
    try {
      if (groupCallId === activeGroupCallId && callState === "ongoing") {
        // Create peer connection if it doesn't exist
        let pc = peerConnectionsRef.current[senderId]
        if (!pc) {
          pc = await createPeerConnection(senderId, connectionId)
        }

        // Set remote description
        await pc.setRemoteDescription(new RTCSessionDescription(offer))

        // Create answer
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        // Send answer via socket
        if (socket && isConnected) {
          socket.emit("group-call-answer", {
            groupCallId,
            receiverId: senderId,
            answer,
            connectionId,
          })
        }
      }
    } catch (error) {
      console.error("Error handling remote offer:", error)
    }
  }

  // Handle remote answer
  const handleRemoteAnswer = async ({ groupCallId, senderId, answer, connectionId }) => {
    try {
      if (groupCallId === activeGroupCallId && callState === "ongoing") {
        const pc = peerConnectionsRef.current[senderId]
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer))
        }
      }
    } catch (error) {
      console.error("Error handling remote answer:", error)
    }
  }

  // Handle remote ICE candidate
  const handleRemoteIceCandidate = async ({ groupCallId, senderId, candidate, connectionId }) => {
    try {
      if (groupCallId === activeGroupCallId && callState === "ongoing") {
        const pc = peerConnectionsRef.current[senderId]
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate))
        }
      }
    } catch (error) {
      console.error("Error adding remote ICE candidate:", error)
    }
  }

  // Handle screen sharing update
  const handleScreenSharingUpdate = ({ groupCallId, userId, isSharing }) => {
    if (groupCallId === activeGroupCallId) {
      // Update participant status
      setParticipants((prev) => prev.map((p) => (p._id === userId ? { ...p, isSharingScreen: isSharing } : p)))
    }
  }

  // Restart ICE connection
  const restartIce = async (pc, participantId, connectionId) => {
    try {
      if (pc && callState === "ongoing") {
        // Create new offer with ICE restart
        const offer = await pc.createOffer({ iceRestart: true })
        await pc.setLocalDescription(offer)

        // Send the offer via signaling
        if (socket && isConnected && participantId) {
          socket.emit("group-call-offer", {
            groupCallId: activeGroupCallId,
            receiverId: participantId,
            offer,
            connectionId,
          })
        }

        // Log ICE restart event
        await CallLogAPI.logCallEvent(authState.token, activeGroupCallId, "group", "ice_restart", { participantId })
      }
    } catch (error) {
      console.error("Error restarting ICE:", error)
    }
  }

  // Start call quality monitoring
  const startQualityMonitoring = () => {
    qualityMonitorRef.current = setInterval(async () => {
      try {
        if (callState === "ongoing") {
          // Get stats from all peer connections
          const allStats = {}

          for (const [participantId, pc] of Object.entries(peerConnectionsRef.current)) {
            if (pc) {
              const stats = await pc.getStats()
              const metricsData = processRTCStats(stats)
              allStats[participantId] = metricsData
            }
          }

          // Calculate average metrics
          const avgMetrics = calculateAverageMetrics(allStats)

          // Update local UI based on metrics
          updateCallQualityUI(avgMetrics)

          // Send metrics to backend
          await CallLogAPI.logCallEvent(authState.token, activeGroupCallId, "group", "quality_metrics", {
            metrics: avgMetrics,
          })

          // If quality is poor, consider fallback options
          if (
            avgMetrics.qualityScore &&
            (avgMetrics.qualityScore.audio < 2 || (isVideo && avgMetrics.qualityScore.video < 2))
          ) {
            // If video call with poor quality, suggest falling back to audio
            if (isVideo && isVideoEnabled) {
              Alert.alert(
                "Poor Connection",
                "Your connection quality is poor. Would you like to turn off video to improve call quality?",
                [
                  { text: "No", style: "cancel" },
                  {
                    text: "Yes",
                    onPress: () => {
                      toggleVideo()
                    },
                  },
                ],
              )
            }
          }
        }
      } catch (error) {
        console.error("Error monitoring call quality:", error)
      }
    }, 10000) // Check every 10 seconds
  }

  // Process WebRTC stats
  const processRTCStats = (stats) => {
    let rtt = 0
    let jitter = 0
    let packetLoss = 0
    let audioLevel = 0
    const videoBitrate = 0
    const audioBitrate = 0
    let frameRate = 0
    let frameWidth = 0
    let frameHeight = 0
    const iceConnectionState = "unknown"

    stats.forEach((stat) => {
      if (stat.type === "inbound-rtp" && stat.kind === "video") {
        jitter = stat.jitter || 0
        packetLoss = stat.packetsLost || 0
        frameRate = stat.framesPerSecond || 0
        frameWidth = stat.frameWidth || 0
        frameHeight = stat.frameHeight || 0
      } else if (stat.type === "inbound-rtp" && stat.kind === "audio") {
        audioLevel = stat.audioLevel || 0
      } else if (stat.type === "candidate-pair" && stat.state === "succeeded") {
        rtt = stat.currentRoundTripTime * 1000 || 0 // Convert to ms
      }
    })

    // Calculate quality scores (0-5 scale)
    const audioQualityScore = calculateAudioQualityScore(rtt, jitter, packetLoss)
    const videoQualityScore = isVideo ? calculateVideoQualityScore(rtt, jitter, packetLoss, frameRate, videoBitrate) : 0

    return {
      timestamp: new Date().toISOString(),
      rtt,
      jitter,
      packetLoss,
      bitrate: {
        audio: audioBitrate,
        video: videoBitrate,
      },
      audioLevel,
      frameRate,
      resolution: {
        width: frameWidth,
        height: frameHeight,
      },
      iceConnectionState,
      connectionType: networkType,
      qualityScore: {
        audio: audioQualityScore,
        video: videoQualityScore,
      },
    }
  }

  // Calculate average metrics from all connections
  const calculateAverageMetrics = (allStats) => {
    if (Object.keys(allStats).length === 0) {
      return {
        qualityScore: { audio: 5, video: 5 },
        rtt: 0,
        jitter: 0,
        packetLoss: 0,
      }
    }

    let totalAudioScore = 0
    let totalVideoScore = 0
    let totalRtt = 0
    let totalJitter = 0
    let totalPacketLoss = 0
    let count = 0

    for (const stats of Object.values(allStats)) {
      if (stats.qualityScore) {
        totalAudioScore += stats.qualityScore.audio || 0
        totalVideoScore += stats.qualityScore.video || 0
      }
      totalRtt += stats.rtt || 0
      totalJitter += stats.jitter || 0
      totalPacketLoss += stats.packetLoss || 0
      count++
    }

    return {
      qualityScore: {
        audio: totalAudioScore / count,
        video: totalVideoScore / count,
      },
      rtt: totalRtt / count,
      jitter: totalJitter / count,
      packetLoss: totalPacketLoss / count,
      connectionType: networkType,
    }
  }

  // Calculate audio quality score (0-5 scale)
  const calculateAudioQualityScore = (rtt, jitter, packetLoss) => {
    // Simple scoring algorithm
    let score = 5

    if (rtt > 300) score -= 1
    if (rtt > 500) score -= 1

    if (jitter > 30) score -= 1
    if (jitter > 50) score -= 1

    if (packetLoss > 3) score -= 1
    if (packetLoss > 8) score -= 1

    return Math.max(0, score)
  }

  // Calculate video quality score (0-5 scale)
  const calculateVideoQualityScore = (rtt, jitter, packetLoss, frameRate, bitrate) => {
    // Simple scoring algorithm
    let score = 5

    if (rtt > 200) score -= 1
    if (rtt > 400) score -= 1

    if (jitter > 20) score -= 1
    if (jitter > 40) score -= 1

    if (packetLoss > 2) score -= 1
    if (packetLoss > 5) score -= 1

    if (frameRate < 20) score -= 1
    if (frameRate < 10) score -= 1

    return Math.max(0, score)
  }

  // Update call quality UI based on metrics
  const updateCallQualityUI = (metrics) => {
    if (!metrics.qualityScore) return

    const overallScore = Math.min(metrics.qualityScore.audio, isVideo ? metrics.qualityScore.video : 5)

    if (overallScore >= 4) {
      setCallQuality("good")
    } else if (overallScore >= 2) {
      setCallQuality("fair")
    } else {
      setCallQuality("poor")
    }
  }

  // Leave call
  const handleLeaveCall = async (reason = "user_left") => {
    try {
      // Prevent multiple call end attempts
      if (isCallEndingRef.current) return
      isCallEndingRef.current = true

      // Stop timers
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current)
        callTimerRef.current = null
      }

      if (qualityMonitorRef.current) {
        clearInterval(qualityMonitorRef.current)
        qualityMonitorRef.current = null
      }

      if (activeGroupCallId) {
        // Notify other participants via socket
        if (socket && isConnected) {
          socket.emit("group-call-user-left", {
            groupCallId: activeGroupCallId,
            userId: authState.user.id,
          })
        }

        // Leave call in backend
        await GroupCallAPI.leaveGroupCall(activeGroupCallId, {}, authState.token)

        // If creator is ending the call, end it for everyone
        if (isCreator && reason === "user_left") {
          await GroupCallAPI.endGroupCall(activeGroupCallId, authState.token)
        }

        // Log call left event
        await CallLogAPI.logCallEvent(authState.token, activeGroupCallId, "group", "call_left", {
          duration: callDuration,
          reason: reason,
        })
      }

      // Clean up WebRTC
      cleanupWebRTC()

      // Update UI state
      setCallState("ended")
      setCallEndReason(reason)

      // Navigate back after a short delay to show the ended state
      setTimeout(() => {
        navigation.goBack()
      }, 1000)
    } catch (error) {
      console.error("Error leaving call:", error)
      navigation.goBack()
    }
  }

  // Clean up WebRTC resources
  const cleanupWebRTC = () => {
    // Stop all tracks in local stream
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.stop()
      })
    }

    // Close all peer connections
    Object.values(peerConnectionsRef.current).forEach((pc) => {
      if (pc) {
        pc.close()
      }
    })
    peerConnectionsRef.current = {}
    remoteStreamsRef.current = {}
  }

  // Clean up call resources
  const cleanupCall = () => {
    // Stop timers
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current)
    }

    if (qualityMonitorRef.current) {
      clearInterval(qualityMonitorRef.current)
    }

    // Clean up WebRTC
    cleanupWebRTC()
  }

  // Toggle mute
  const toggleMute = async () => {
    try {
      if (localStream) {
        localStream.getAudioTracks().forEach((track) => {
          track.enabled = isMuted
        })

        setIsMuted(!isMuted)

        // Log mute toggle event
        if (activeGroupCallId) {
          await CallLogAPI.logCallEvent(authState.token, activeGroupCallId, "group", isMuted ? "unmuted" : "muted", {})
        }
      }
    } catch (error) {
      console.error("Error toggling mute:", error)
    }
  }

  // Toggle speaker
  const toggleSpeaker = async () => {
    try {
      // In a real implementation, you would use a native module to switch audio output
      // For this example, we'll just update the state
      setIsSpeakerOn(!isSpeakerOn)

      // Log speaker toggle event
      if (activeGroupCallId) {
        await CallLogAPI.logCallEvent(
          authState.token,
          activeGroupCallId,
          "group",
          isSpeakerOn ? "speaker_off" : "speaker_on",
          {},
        )
      }
    } catch (error) {
      console.error("Error toggling speaker:", error)
    }
  }

  // Toggle video
  const toggleVideo = async () => {
    try {
      if (localStream) {
        // If turning video on
        if (!isVideoEnabled) {
          // Get new stream with video
          const newStream = await mediaDevices.getUserMedia({
            audio: true,
            video: {
              facingMode: isFrontCamera ? "environment" : "user",
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
            },
          })

          // Replace tracks in all peer connections
          Object.values(peerConnectionsRef.current).forEach((pc) => {
            if (pc) {
              const senders = pc.getSenders()
              const videoTrack = newStream.getVideoTracks()[0]

              // Find video sender and replace track
              const videoSender = senders.find((sender) => sender.track && sender.track.kind === "video")

              if (videoSender) {
                videoSender.replaceTrack(videoTrack)
              } else {
                // Add video track if not already present
                pc.addTrack(videoTrack, newStream)
              }
            }
          })

          // Keep audio tracks from current stream
          const audioTracks = localStream.getAudioTracks()
          audioTracks.forEach((track) => {
            newStream.addTrack(track)
          })

          // Update local stream
          setLocalStream(newStream)
        } else {
          // Turn off video tracks
          localStream.getVideoTracks().forEach((track) => {
            track.enabled = false
          })
        }

        setIsVideoEnabled(!isVideoEnabled)

        // Log video toggle event
        if (activeGroupCallId) {
          await CallLogAPI.logCallEvent(
            authState.token,
            activeGroupCallId,
            "group",
            isVideoEnabled ? "video_disabled" : "video_enabled",
            {},
          )
        }
      }
    } catch (error) {
      console.error("Error toggling video:", error)
      Alert.alert("Error", "Failed to toggle video. Please try again.")
    }
  }

  // Toggle camera (front/back)
  const toggleCamera = async () => {
    try {
      if (localStream && isVideoEnabled) {
        // Stop current video track
        localStream.getVideoTracks().forEach((track) => {
          track.stop()
        })

        // Get new video track with different camera
        const newStream = await mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: isFrontCamera ? "environment" : "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
        })

        // Replace video track in all peer connections
        Object.values(peerConnectionsRef.current).forEach((pc) => {
          if (pc) {
            const senders = pc.getSenders()
            const videoTrack = newStream.getVideoTracks()[0]

            const videoSender = senders.find((sender) => sender.track && sender.track.kind === "video")

            if (videoSender) {
              videoSender.replaceTrack(videoTrack)
            }
          }
        })

        // Update local stream by replacing video track
        const newVideoTrack = newStream.getVideoTracks()[0]
        const audioTracks = localStream.getAudioTracks()

        // Create a new stream with existing audio and new video
        const combinedStream = new MediaStream()
        audioTracks.forEach((track) => combinedStream.addTrack(track))
        combinedStream.addTrack(newVideoTrack)

        setLocalStream(combinedStream)
        setIsFrontCamera(!isFrontCamera)

        // Log camera toggle event
        if (activeGroupCallId) {
          await CallLogAPI.logCallEvent(
            authState.token,
            activeGroupCallId,
            "group",
            isFrontCamera ? "camera_switched_to_back" : "camera_switched_to_front",
            {},
          )
        }
      }
    } catch (error) {
      console.error("Error toggling camera:", error)
      Alert.alert("Error", "Failed to switch camera. Please try again.")
    }
  }

  // Toggle screen sharing
  const toggleScreenSharing = async () => {
    try {
      // In a real implementation, you would use a native module to capture screen
      // For this example, we'll just update the state
      const newSharingState = !isScreenSharing
      setIsScreenSharing(newSharingState)

      // Update backend
      await GroupCallAPI.toggleScreenSharing(activeGroupCallId, { isSharing: newSharingState }, authState.token)

      // Log screen sharing event
      await CallLogAPI.logCallEvent(
        authState.token,
        activeGroupCallId,
        "group",
        newSharingState ? "screen_sharing_started" : "screen_sharing_stopped",
        {},
      )
    } catch (error) {
      console.error("Error toggling screen sharing:", error)
      Alert.alert("Error", "Failed to toggle screen sharing. Please try again.")
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
      case "initializing":
        return "Initializing..."
      case "connecting":
        return "Connecting..."
      case "ongoing":
        if (isReconnecting) return "Reconnecting..."
        return formatDuration(callDuration)
      case "ended":
        if (callEndReason === "create_failed") return "Failed to create call"
        if (callEndReason === "join_failed") return "Failed to join call"
        return "Call ended"
      default:
        return ""
    }
  }

  // Get quality indicator color
  const getQualityColor = () => {
    switch (callQuality) {
      case "good":
        return "#4CAF50"
      case "fair":
        return "#FFC107"
      case "poor":
        return "#F44336"
      default:
        return "#4CAF50"
    }
  }

  // Render participant item
  const renderParticipantItem = ({ item }) => {
    const isCurrentUser = item._id === authState.user.id
    const hasStream = remoteStreamsRef.current[item._id] !== undefined

    return (
      <View style={styles.participantItem}>
        {isVideo && hasStream && !isCurrentUser ? (
          <RTCView
            streamURL={remoteStreamsRef.current[item._id].toURL()}
            style={styles.participantVideo}
            objectFit="cover"
          />
        ) : (
          <View style={styles.participantPlaceholder}>
            {item.profilePicture ? (
              <Image
                source={{ uri: `${API_BASE_URL_FOR_MEDIA}${item.profilePicture}` }}
                style={styles.participantImage}
              />
            ) : (
              <View style={styles.defaultParticipantImage}>
                <Text style={styles.defaultImageText}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>
        )}

        <Text style={styles.participantName}>
          {item.name} {isCurrentUser ? "(You)" : ""}
        </Text>

        {item.isSharingScreen && (
          <View style={styles.sharingIndicator}>
            <Ionicons name="desktop-outline" size={12} color="#FFFFFF" />
          </View>
        )}

        {!item.isActive && (
          <View style={styles.inactiveOverlay}>
            <Text style={styles.inactiveText}>Left</Text>
          </View>
        )}
      </View>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: "#000000" }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Call Header */}
      <View style={styles.callHeader}>
        <TouchableOpacity
          style={styles.minimizeButton}
          onPress={() => {
            if (callState === "ongoing") {
              // Show confirmation dialog before leaving ongoing call
              Alert.alert("Leave Call", "Are you sure you want to leave this call?", [
                { text: "Cancel", style: "cancel" },
                { text: "Leave", style: "destructive", onPress: () => handleLeaveCall("user_left") },
              ])
            } else {
              handleLeaveCall("user_left")
            }
          }}
        >
          <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.callTitle}>{conversation.groupName || "Group Call"}</Text>

        {callState === "ongoing" && (
          <View style={styles.callQualityContainer}>
            <View style={[styles.qualityIndicator, { backgroundColor: getQualityColor() }]} />
            {isReconnecting && <Text style={styles.reconnectingText}>Reconnecting...</Text>}
          </View>
        )}
      </View>

      {/* Call Content */}
      <View style={styles.callContent}>
        {callState === "connecting" ? (
          <View style={styles.connectingContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.connectingText}>{isJoining ? "Joining call..." : "Starting call..."}</Text>
          </View>
        ) : callState === "ongoing" ? (
          <View style={styles.participantsContainer}>
            <Text style={styles.callStatus}>{getCallStatusText()}</Text>

            <FlatList
              data={participants.filter((p) => p.isActive)}
              renderItem={renderParticipantItem}
              keyExtractor={(item) => item._id}
              numColumns={2}
              contentContainerStyle={styles.participantsList}
            />

            {/* Local video preview */}
            {isVideo && isVideoEnabled && localStream && (
              <View style={styles.localVideoContainer}>
                <RTCView streamURL={localStream.toURL()} style={styles.localVideo} objectFit="cover" zOrder={1} />
              </View>
            )}
          </View>
        ) : (
          <View style={styles.endedContainer}>
            <Ionicons name="call" size={50} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
            <Text style={styles.endedText}>{getCallStatusText()}</Text>
          </View>
        )}
      </View>

      {/* Call Controls */}
      {callState === "ongoing" && (
        <View style={styles.callControls}>
          <TouchableOpacity style={[styles.controlButton, isMuted && styles.activeControlButton]} onPress={toggleMute}>
            <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color="#FFFFFF" />
            <Text style={styles.controlText}>Mute</Text>
          </TouchableOpacity>

          {isVideo && (
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

          {isVideo && isVideoEnabled && (
            <TouchableOpacity style={styles.controlButton} onPress={toggleCamera}>
              <Ionicons name="camera-reverse" size={24} color="#FFFFFF" />
              <Text style={styles.controlText}>Flip</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.controlButton, isScreenSharing && styles.activeControlButton]}
            onPress={toggleScreenSharing}
          >
            <Ionicons name="desktop-outline" size={24} color="#FFFFFF" />
            <Text style={styles.controlText}>Share</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* End Call Button */}
      {callState === "ongoing" && (
        <View style={styles.endCallContainer}>
          <TouchableOpacity style={styles.endCallButton} onPress={() => handleLeaveCall("user_left")}>
            <Ionicons name="call" size={30} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
          </TouchableOpacity>
        </View>
      )}
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
    alignItems: "center",
    padding: 15,
  },
  minimizeButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  callTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  callQualityContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  qualityIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 5,
  },
  reconnectingText: {
    color: "#FFC107",
    fontSize: 12,
  },
  callContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  connectingContainer: {
    alignItems: "center",
  },
  connectingText: {
    color: "#FFFFFF",
    fontSize: 18,
    marginTop: 20,
  },
  participantsContainer: {
    flex: 1,
    width: "100%",
    alignItems: "center",
  },
  callStatus: {
    color: "#FFFFFF",
    fontSize: 16,
    marginVertical: 10,
  },
  participantsList: {
    paddingHorizontal: 10,
  },
  participantItem: {
    width: width / 2 - 20,
    height: 200,
    margin: 5,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#333333",
    position: "relative",
  },
  participantVideo: {
    width: "100%",
    height: "100%",
  },
  participantPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  participantImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  defaultParticipantImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#128C7E",
    justifyContent: "center",
    alignItems: "center",
  },
  defaultImageText: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "bold",
  },
  participantName: {
    position: "absolute",
    bottom: 10,
    left: 10,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  sharingIndicator: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#128C7E",
    borderRadius: 12,
    padding: 5,
  },
  inactiveOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  inactiveText: {
    color: "#FFFFFF",
    fontSize: 16,
  },
  localVideoContainer: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 100,
    height: 150,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  localVideo: {
    width: "100%",
    height: "100%",
  },
  endedContainer: {
    alignItems: "center",
  },
  endedText: {
    color: "#FFFFFF",
    fontSize: 18,
    marginTop: 20,
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
  },
})

export default GroupCallScreen
