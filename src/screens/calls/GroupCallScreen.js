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
  Alert,
  PermissionsAndroid,
  AppState,
  ScrollView,
  FlatList,
  Modal,
} from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import Ionicons from "react-native-vector-icons/Ionicons"
import { AuthContext } from "../../context/AuthContext"
import { SocketContext } from "../../context/SocketContext"
import { ThemeContext } from "../../context/ThemeContext"
import { getTheme } from "../../utils/theme"
// import * as CallAPI from '../../api/call';
import * as GroupCallAPI from "../../api/group-calls"
import * as CallLogAPI from "../../api/call-log"
import * as IceServerAPI from "../../api/ice-server"
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
import AudioManager from "../../utils/audio-manager"
import AudioRouteSelector from "../../components/calls/AudioRouteSelector"
import { recordCallQualityMetrics } from "../../api/call-quality"

const { width, height } = Dimensions.get("window")

const GroupCallScreen = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const {
    conversationId,
    conversationName,
    participants: initialParticipants,
    callType,
    isIncoming = false,
    callId: incomingCallId = null,
  } = route.params

  const { state: authState } = useContext(AuthContext)
  const { socket, isConnected } = useContext(SocketContext)
  const { theme } = useContext(ThemeContext)
  const currentTheme = getTheme(theme)

  // Call state
  const [callState, setCallState] = useState("initializing") // initializing, connecting, ringing, ongoing, ended
  const [callDuration, setCallDuration] = useState(0)
  const [callStartTime, setCallStartTime] = useState(null)
  const [callId, setCallId] = useState(incomingCallId)
  const [callEndReason, setCallEndReason] = useState(null)

  // Participants state
  const [participants, setParticipants] = useState(initialParticipants || [])
  const [activeParticipants, setActiveParticipants] = useState(new Map()) // participantId -> participant data
  const [participantConnections, setParticipantConnections] = useState(new Map()) // participantId -> RTCPeerConnection
  const [participantStreams, setParticipantStreams] = useState(new Map()) // participantId -> MediaStream
  const [participantDevices, setParticipantDevices] = useState(new Map()) // participantId -> activeDevice
  const [participantStatus, setParticipantStatus] = useState(new Map()) // participantId -> {status, quality, muted, videoEnabled}

  // Media state
  const [localStream, setLocalStream] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeakerOn, setIsSpeakerOn] = useState(callType === "video")
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === "video")
  const [isFrontCamera, setIsFrontCamera] = useState(true)

  // UI state
  const [selectedParticipant, setSelectedParticipant] = useState(null) // For full-screen view
  const [showParticipantsList, setShowParticipantsList] = useState(false)
  const [showAddParticipants, setShowAddParticipants] = useState(false)
  const [gridLayout, setGridLayout] = useState("auto") // auto, 1x1, 2x2, 3x3, etc.

  // Network state
  const [networkType, setNetworkType] = useState(null)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [callQuality, setCallQuality] = useState("good")

  // Refs
  const callTimerRef = useRef(null)
  const qualityMonitorRef = useRef(null)
  const iceServersRef = useRef([])
  const appStateRef = useRef(AppState.currentState)
  const isCallEndingRef = useRef(false)
  const localStreamRef = useRef(null)

  // Audio route selector
  const [showAudioRouteSelector, setShowAudioRouteSelector] = useState(false)

  // Initialize group call
  useEffect(() => {
    const setupGroupCall = async () => {
      try {
        // Request permissions
        const hasPermissions = await requestPermissions()
        if (!hasPermissions) {
          Alert.alert("Permission Required", "Camera and microphone permissions are required for calls.", [
            { text: "OK", onPress: () => navigation.goBack() },
          ])
          return
        }

        // Get ICE servers
        const iceServersResponse = await IceServerAPI.getIceServers(authState.token)
        if (iceServersResponse.success) {
          iceServersRef.current = iceServersResponse.iceServers
        } else {
          iceServersRef.current = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }]
        }

        // Initialize media stream
        await setupMediaStream()

        // Initialize audio session
        await AudioManager.initializeAudioSession(callType === "video")

        if (!isIncoming) {
          // Initiate outgoing group call
          await initiateGroupCall()
        } else {
          // Handle incoming group call
          setCallState("ringing")
          await AudioManager.startRingtone()
        }

        // Set up network monitoring
        setupNetworkMonitoring()
        setupAppStateMonitoring()
      } catch (error) {
        console.error("Error setting up group call:", error)
        handleEndCall("setup_failed")
      }
    }

    setupGroupCall()

    return () => {
      cleanupCall()
    }
  }, [])

  // Socket event listeners for group calls
  useEffect(() => {
    if (socket && isConnected) {
      // Group call events
      socket.on("group-call-answered", handleGroupCallAnswered)
      socket.on("group-call-rejected", handleGroupCallRejected)
      socket.on("group-call-ended", handleGroupCallEnded)
      socket.on("participant-joined", handleParticipantJoined)
      socket.on("participant-left", handleParticipantLeft)
      socket.on("participant-muted", handleParticipantMuted)
      socket.on("participant-video-toggled", handleParticipantVideoToggled)

      // WebRTC signaling for group calls
      socket.on("group-ice-candidate", handleGroupIceCandidate)
      socket.on("group-offer", handleGroupOffer)
      socket.on("group-answer", handleGroupAnswer)

      // Call quality and network events
      socket.on("group-call-quality-issue", handleGroupCallQualityIssue)
      socket.on("group-network-fallback", handleGroupNetworkFallback)
      socket.on("group-ice-restart-needed", handleGroupIceRestartNeeded)

      // Participant device status
      socket.on("participant-device-change", handleParticipantDeviceChange)
      socket.on("participant-status-update", handleParticipantStatusUpdate)

      return () => {
        socket.off("group-call-answered", handleGroupCallAnswered)
        socket.off("group-call-rejected", handleGroupCallRejected)
        socket.off("group-call-ended", handleGroupCallEnded)
        socket.off("participant-joined", handleParticipantJoined)
        socket.off("participant-left", handleParticipantLeft)
        socket.off("participant-muted", handleParticipantMuted)
        socket.off("participant-video-toggled", handleParticipantVideoToggled)
        socket.off("group-ice-candidate", handleGroupIceCandidate)
        socket.off("group-offer", handleGroupOffer)
        socket.off("group-answer", handleGroupAnswer)
        socket.off("group-call-quality-issue", handleGroupCallQualityIssue)
        socket.off("group-network-fallback", handleGroupNetworkFallback)
        socket.off("group-ice-restart-needed", handleGroupIceRestartNeeded)
        socket.off("participant-device-change", handleParticipantDeviceChange)
        socket.off("participant-status-update", handleParticipantStatusUpdate)
      }
    }
  }, [socket, isConnected, callId])

  // Request permissions (same as CallScreen)
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
        if (callType === "video") {
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
          (callType !== "video" || cameraPermission === PermissionsAndroid.RESULTS.GRANTED)
        )
      } catch (err) {
        console.error("Error requesting permissions:", err)
        return false
      }
    } else {
      // iOS permissions handling
      try {
        const micStatus = await check(PERMISSIONS.IOS.MICROPHONE)
        if (micStatus !== RESULTS.GRANTED) {
          const micResult = await request(PERMISSIONS.IOS.MICROPHONE)
          if (micResult !== RESULTS.GRANTED) return false
        }

        if (callType === "video") {
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

  // Set up media stream (same as CallScreen)
  const setupMediaStream = async () => {
    try {
      const constraints = {
        audio: true,
        video:
          callType === "video"
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
      localStreamRef.current = stream
      return stream
    } catch (error) {
      console.error("Error getting user media:", error)
      throw new Error("Failed to access camera or microphone")
    }
  }

  // Set up network monitoring (same as CallScreen)
  const setupNetworkMonitoring = () => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setNetworkType(state.type)
      if (!state.isConnected && callState === "ongoing") {
        setIsReconnecting(true)
        // Restart ICE for all connections
        participantConnections.forEach((pc, participantId) => {
          if (pc) restartIceForParticipant(participantId)
        })
      } else if (state.isConnected && isReconnecting) {
        setIsReconnecting(false)
      }
    })
    return unsubscribe
  }

  // Set up app state monitoring (same as CallScreen)
  const setupAppStateMonitoring = () => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === "active" && callState === "ongoing") {
        // Check all connections and restart if needed
        participantConnections.forEach((pc, participantId) => {
          if (pc?.iceConnectionState === "disconnected" || pc?.iceConnectionState === "failed") {
            restartIceForParticipant(participantId)
          }
        })
      }
      appStateRef.current = nextAppState
    })

    return () => subscription.remove()
  }

  // Initiate outgoing group call with device targeting
  const initiateGroupCall = async () => {
    try {
      setCallState("connecting")

      // Check online status for all participants
      const participantStatuses = new Map()
      const participantDevicesMap = new Map()

      for (const participant of participants) {
        if (participant._id !== authState.user.id) {
          // Check each participant's status and active device
          if (socket) {
            socket.emit("check-user-status", { userId: participant._id })

            // Wait for status response
            const statusPromise = new Promise((resolve) => {
              const handleStatusResponse = ({ userId, status, activeDevice }) => {
                if (userId === participant._id) {
                  socket.off("user-status-response", handleStatusResponse)
                  resolve({ status, activeDevice })
                }
              }
              socket.on("user-status-response", handleStatusResponse)

              setTimeout(() => {
                socket.off("user-status-response", handleStatusResponse)
                resolve({ status: "offline", activeDevice: null })
              }, 3000)
            })

            const { status, activeDevice } = await statusPromise
            participantStatuses.set(participant._id, status)
            participantDevicesMap.set(participant._id, activeDevice)
          }
        }
      }

      setParticipantDevices(participantDevicesMap)

      // Initiate group call in backend
      const groupCallData = {
        conversationId,
        type: callType,
        name: conversationName,
        initialParticipants: participants.map((p) => ({
          userId: p._id,
          targetDeviceId: participantDevicesMap.get(p._id), // Ensure participantDevicesMap is correctly populated
        })),
      }
      // Ensure groupCallData.initialParticipants matches the new API's expected format:
      // Array<{userId: string, targetDeviceId?: string}>
      const apiPayload = {
        conversationId: groupCallData.conversationId,
        type: groupCallData.type,
        name: groupCallData.name,
        initialParticipants: groupCallData.initialParticipants, // This should already be in the correct format
      }
      const response = await GroupCallAPI.createGroupCall(
        apiPayload.conversationId,
        apiPayload.type,
        apiPayload.name,
        apiPayload.initialParticipants,
      )

      if (response.success && response.groupCall) {
        const newCallId = response.groupCall._id

        setCallId(newCallId)

        // Send group call offers to all participants
        const onlineParticipants = participants.filter(
          (p) => p._id !== authState.user.id && participantStatuses.get(p._id) === "online",
        )

        if (onlineParticipants.length > 0) {
          setCallState("ringing")
          await AudioManager.startRingback()
        } else {
          setCallState("calling")
        }

        // Create peer connections for all participants
        for (const participant of participants) {
          if (participant._id !== authState.user.id) {
            await createPeerConnectionForParticipant(participant._id)
          }
        }

        // Send offers via socket
        // if (socket && isConnected) {
        //   socket.emit('group-call-offer', { // This might be handled by the backend now
        //     callId: newCallId,
        //     conversationId,
        //     participants: participants.map(p => ({
        //       userId: p._id,
        //       targetDeviceId: participantDevicesMap.get(p._id),
        //     })),
        //     callType,
        //     callerInfo: {
        //       id: authState.user.id,
        //       name: authState.user.name,
        //       profilePicture: authState.user.profilePicture,
        //     },
        //   });
        // }

        // Log group call initiated
        await CallLogAPI.logCallEvent(authState.token, newCallId, "group", "call_initiated", {
          callType,
          participantCount: participants.length,
          onlineParticipants: onlineParticipants.length,
        })

        // Set timeout for call not answered
        setTimeout(() => {
          if (callState === "ringing" || callState === "calling") {
            handleEndCall("no_answer")
          }
        }, 60000)
      } else {
        console.error("Failed to initiate group call:", response.message)
        await handleEndCall("initiate_failed")
      }
    } catch (error) {
      console.error("Error initiating group call:", error)
      await handleEndCall("initiate_failed")
    }
  }

  // Create peer connection for a specific participant
  const createPeerConnectionForParticipant = async (participantId) => {
    try {
      const configuration = {
        iceServers: iceServersRef.current,
        iceCandidatePoolSize: 10,
      }

      const pc = new RTCPeerConnection(configuration)

      // Add local stream tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current)
        })
      }

      // Handle ICE candidates
      pc.onicecandidate = ({ candidate }) => {
        if (candidate && socket && isConnected && callId) {
          socket.emit("group-ice-candidate", {
            callId,
            candidate,
            fromParticipant: authState.user.id,
            toParticipant: participantId,
          })
        }
      }

      // Handle ICE connection state changes
      pc.oniceconnectionstatechange = () => {
        console.log(`ICE connection state for ${participantId}:`, pc.iceConnectionState)

        if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
          if (callState === "ongoing") {
            setIsReconnecting(true)
            restartIceForParticipant(participantId)
          }
        } else if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          setIsReconnecting(false)
        }
      }

      // Handle remote stream
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setParticipantStreams((prev) => new Map(prev.set(participantId, event.streams[0])))

          // Check if remote stream has video tracks
          const hasVideoTracks = event.streams[0].getVideoTracks().length > 0
          setParticipantStatus(
            (prev) =>
              new Map(
                prev.set(participantId, {
                  ...prev.get(participantId),
                  videoEnabled: hasVideoTracks,
                }),
              ),
          )
        }
      }

      // Store the peer connection
      setParticipantConnections((prev) => new Map(prev.set(participantId, pc)))

      return pc
    } catch (error) {
      console.error(`Error creating peer connection for ${participantId}:`, error)
      throw error
    }
  }

  // Handle group call answered
  const handleGroupCallAnswered = async ({ callId: answeredCallId, participantId, answer }) => {
    try {
      if (callId === answeredCallId) {
        const pc = participantConnections.get(participantId)
        if (pc) {
          const rtcSessionDescription = new RTCSessionDescription(answer)
          await pc.setRemoteDescription(rtcSessionDescription)

          // Add participant to active participants
          const participant = participants.find((p) => p._id === participantId)
          if (participant) {
            setActiveParticipants((prev) => new Map(prev.set(participantId, participant)))
          }

          // If this is the first participant to answer, start the call
          if (callState === "ringing" || callState === "calling") {
            setCallState("ongoing")
            setCallStartTime(new Date())
            await AudioManager.stopRingback()

            // Start call timer
            callTimerRef.current = setInterval(() => {
              setCallDuration((prev) => prev + 1)
            }, 1000)

            // Start quality monitoring
            startQualityMonitoring()
          }
        }
      }
    } catch (error) {
      console.error("Error handling group call answer:", error)
    }
  }

  // Handle participant joined during ongoing call
  const handleParticipantJoined = async ({ callId: joinedCallId, participant, offer }) => {
    try {
      if (callId === joinedCallId && callState === "ongoing") {
        // Create peer connection for new participant
        const pc = await createPeerConnectionForParticipant(participant._id)

        if (offer) {
          // Set remote description and create answer
          const rtcSessionDescription = new RTCSessionDescription(offer)
          await pc.setRemoteDescription(rtcSessionDescription)

          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)

          // Send answer back
          if (socket && isConnected) {
            socket.emit("group-answer", {
              callId,
              fromParticipant: authState.user.id,
              toParticipant: participant._id,
              answer,
            })
          }
        }

        // Add to active participants
        setActiveParticipants((prev) => new Map(prev.set(participant._id, participant)))

        // Log participant joined
        await CallLogAPI.logCallEvent(authState.token, callId, "group", "participant_joined", {
          participantId: participant._id,
          participantName: participant.name,
        })
      }
    } catch (error) {
      console.error("Error handling participant joined:", error)
    }
  }

  // Handle participant left
  const handleParticipantLeft = ({ callId: leftCallId, participantId }) => {
    if (callId === leftCallId) {
      // Remove participant from active participants
      setActiveParticipants((prev) => {
        const newMap = new Map(prev)
        newMap.delete(participantId)
        return newMap
      })

      // Close and remove peer connection
      const pc = participantConnections.get(participantId)
      if (pc) {
        pc.close()
        setParticipantConnections((prev) => {
          const newMap = new Map(prev)
          newMap.delete(participantId)
          return newMap
        })
      }

      // Remove participant stream
      setParticipantStreams((prev) => {
        const newMap = new Map(prev)
        newMap.delete(participantId)
        return newMap
      })

      // Remove participant status
      setParticipantStatus((prev) => {
        const newMap = new Map(prev)
        newMap.delete(participantId)
        return newMap
      })

      // If no participants left, end call
      if (activeParticipants.size <= 1) {
        handleEndCall("all_participants_left")
      }
    }
  }

  // Handle participant muted/unmuted
  const handleParticipantMuted = ({ callId: mutedCallId, participantId, isMuted }) => {
    if (callId === mutedCallId) {
      setParticipantStatus(
        (prev) =>
          new Map(
            prev.set(participantId, {
              ...prev.get(participantId),
              muted: isMuted,
            }),
          ),
      )
    }
  }

  // Handle participant video toggled
  const handleParticipantVideoToggled = ({ callId: videoCallId, participantId, isVideoEnabled }) => {
    if (callId === videoCallId) {
      setParticipantStatus(
        (prev) =>
          new Map(
            prev.set(participantId, {
              ...prev.get(participantId),
              videoEnabled: isVideoEnabled,
            }),
          ),
      )
    }
  }

  // Handle group ICE candidate
  const handleGroupIceCandidate = async ({ callId: iceCallId, candidate, fromParticipant }) => {
    try {
      if (callId === iceCallId) {
        const pc = participantConnections.get(fromParticipant)
        if (pc) {
          const iceCandidate = new RTCIceCandidate(candidate)
          await pc.addIceCandidate(iceCandidate)
        }
      }
    } catch (error) {
      console.error("Error adding group ICE candidate:", error)
    }
  }

  // Handle group offer (for incoming calls or new participants)
  const handleGroupOffer = async ({ callId: offerCallId, fromParticipant, offer }) => {
    try {
      if (callId === offerCallId) {
        let pc = participantConnections.get(fromParticipant)

        if (!pc) {
          pc = await createPeerConnectionForParticipant(fromParticipant)
        }

        const rtcSessionDescription = new RTCSessionDescription(offer)
        await pc.setRemoteDescription(rtcSessionDescription)

        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        // Send answer back
        if (socket && isConnected) {
          socket.emit("group-answer", {
            callId,
            fromParticipant: authState.user.id,
            toParticipant: fromParticipant,
            answer,
          })
        }
      }
    } catch (error) {
      console.error("Error handling group offer:", error)
    }
  }

  // Handle group answer
  const handleGroupAnswer = async ({ callId: answerCallId, fromParticipant, answer }) => {
    try {
      if (callId === answerCallId) {
        const pc = participantConnections.get(fromParticipant)
        if (pc) {
          const rtcSessionDescription = new RTCSessionDescription(answer)
          await pc.setRemoteDescription(rtcSessionDescription)
        }
      }
    } catch (error) {
      console.error("Error handling group answer:", error)
    }
  }

  // Restart ICE for specific participant
  const restartIceForParticipant = async (participantId) => {
    try {
      const pc = participantConnections.get(participantId)
      if (pc && callState === "ongoing") {
        // Notify the participant
        if (socket && isConnected) {
          socket.emit("group-ice-restart-request", {
            callId,
            fromParticipant: authState.user.id,
            toParticipant: participantId,
          })
        }

        // Create new offer with ICE restart
        const offer = await pc.createOffer({ iceRestart: true })
        await pc.setLocalDescription(offer)

        // Send the offer
        if (socket && isConnected) {
          socket.emit("group-offer", {
            callId,
            fromParticipant: authState.user.id,
            toParticipant: participantId,
            offer,
          })
        }
      }
    } catch (error) {
      console.error(`Error restarting ICE for ${participantId}:`, error)
    }
  }

  // Start quality monitoring for all connections
  const startQualityMonitoring = () => {
    qualityMonitorRef.current = setInterval(async () => {
      try {
        if (callState === "ongoing") {
          const allMetrics = []

          for (const [participantId, pc] of participantConnections) {
            if (pc) {
              const stats = await pc.getStats()
              const metricsData = processRTCStats(stats, participantId)
              allMetrics.push(metricsData)

              // Update participant quality status
              updateParticipantQualityUI(participantId, metricsData)
            }
          }

          // Record metrics for the group call
          await recordCallQualityMetrics(authState.token, callId, "group", {
            participantMetrics: allMetrics,
            overallQuality: calculateOverallQuality(allMetrics),
          })
        }
      } catch (error) {
        console.error("Error monitoring group call quality:", error)
      }
    }, 10000)
  }

  // Process WebRTC stats (similar to CallScreen but with participant ID)
  const processRTCStats = (stats, participantId) => {
    // Same logic as CallScreen but include participantId
    let rtt = 0
    let jitter = 0
    let packetLoss = 0
    let audioLevel = 0
    const videoBitrate = 0
    const audioBitrate = 0
    let frameRate = 0
    let frameWidth = 0
    let frameHeight = 0

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
        rtt = stat.currentRoundTripTime * 1000 || 0
      }
    })

    const audioQualityScore = calculateAudioQualityScore(rtt, jitter, packetLoss)
    const videoQualityScore =
      callType === "video" ? calculateVideoQualityScore(rtt, jitter, packetLoss, frameRate, videoBitrate) : 0

    return {
      participantId,
      timestamp: new Date().toISOString(),
      rtt,
      jitter,
      packetLoss,
      bitrate: { audio: audioBitrate, video: videoBitrate },
      audioLevel,
      frameRate,
      resolution: { width: frameWidth, height: frameHeight },
      connectionType: networkType,
      qualityScore: { audio: audioQualityScore, video: videoQualityScore },
    }
  }

  // Calculate overall call quality from all participants
  const calculateOverallQuality = (allMetrics) => {
    if (allMetrics.length === 0) return "good"

    const avgAudioScore = allMetrics.reduce((sum, m) => sum + m.qualityScore.audio, 0) / allMetrics.length
    const avgVideoScore =
      callType === "video" ? allMetrics.reduce((sum, m) => sum + m.qualityScore.video, 0) / allMetrics.length : 5

    const overallScore = Math.min(avgAudioScore, avgVideoScore)

    if (overallScore >= 4) return "good"
    if (overallScore >= 2) return "fair"
    return "poor"
  }

  // Update participant quality UI
  const updateParticipantQualityUI = (participantId, metrics) => {
    const overallScore = Math.min(metrics.qualityScore.audio, callType === "video" ? metrics.qualityScore.video : 5)

    let quality = "good"
    if (overallScore >= 4) quality = "good"
    else if (overallScore >= 2) quality = "fair"
    else quality = "poor"

    setParticipantStatus(
      (prev) =>
        new Map(
          prev.set(participantId, {
            ...prev.get(participantId),
            quality,
          }),
        ),
    )
  }

  // Audio quality score calculation (same as CallScreen)
  const calculateAudioQualityScore = (rtt, jitter, packetLoss) => {
    let score = 5
    if (rtt > 300) score -= 1
    if (rtt > 500) score -= 1
    if (jitter > 30) score -= 1
    if (jitter > 50) score -= 1
    if (packetLoss > 3) score -= 1
    if (packetLoss > 8) score -= 1
    return Math.max(0, score)
  }

  // Video quality score calculation (same as CallScreen)
  const calculateVideoQualityScore = (rtt, jitter, packetLoss, frameRate, bitrate) => {
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

  // Handle group call quality issues
  const handleGroupCallQualityIssue = ({ callId: qualityCallId, participantId, issueType, metrics }) => {
    if (callId === qualityCallId && callState === "ongoing") {
      setParticipantStatus(
        (prev) =>
          new Map(
            prev.set(participantId, {
              ...prev.get(participantId),
              quality: "poor",
            }),
          ),
      )
      console.log(`Call quality issue with ${participantId}:`, issueType, metrics)
    }
  }

  // Handle group network fallback
  const handleGroupNetworkFallback = ({ callId: fallbackCallId, fallbackType }) => {
    if (callId === fallbackCallId && callState === "ongoing") {
      if (fallbackType === "audio_only" && callType === "video") {
        Alert.alert("Network Issue", "Switching to audio only due to poor connection", [{ text: "OK" }])
        setIsVideoEnabled(false)
      }
    }
  }

  // Handle group ICE restart needed
  const handleGroupIceRestartNeeded = async ({ callId: restartCallId, fromParticipant }) => {
    if (callId === restartCallId && callState === "ongoing") {
      await restartIceForParticipant(fromParticipant)
    }
  }

  // Handle participant device change
  const handleParticipantDeviceChange = ({ participantId, newActiveDevice }) => {
    setParticipantDevices((prev) => new Map(prev.set(participantId, newActiveDevice)))
  }

  // Handle participant status update
  const handleParticipantStatusUpdate = ({ participantId, status }) => {
    setParticipantStatus(
      (prev) =>
        new Map(
          prev.set(participantId, {
            ...prev.get(participantId),
            status,
          }),
        ),
    )
  }

  // Handle group call rejected
  const handleGroupCallRejected = ({ callId: rejectedCallId, participantId }) => {
    if (callId === rejectedCallId) {
      // Remove participant from expected participants
      setParticipants((prev) => prev.filter((p) => p._id !== participantId))

      // If no participants left to answer, end call
      const remainingParticipants = participants.filter((p) => p._id !== authState.user.id && p._id !== participantId)

      if (remainingParticipants.length === 0) {
        handleEndCall("all_rejected")
      }
    }
  }

  // Handle group call ended
  const handleGroupCallEnded = ({ callId: endedCallId }) => {
    if (callId === endedCallId) {
      setCallEndReason("remote_ended")
      handleEndCall("remote_ended")
    }
  }

  // Toggle mute
  const toggleMute = async () => {
    try {
      const newMuteState = !isMuted
      const success = await AudioManager.setMicrophoneMute(newMuteState)

      if (success) {
        setIsMuted(newMuteState)

        // Notify other participants
        if (socket && isConnected && callId) {
          socket.emit("participant-muted", {
            callId,
            participantId: authState.user.id,
            isMuted: newMuteState,
          })
        }

        // Log mute toggle
        if (callId) {
          await CallLogAPI.logCallEvent(authState.token, callId, "group", newMuteState ? "muted" : "unmuted", {})
        }
      }
    } catch (error) {
      console.error("Error toggling mute:", error)
      Alert.alert("Audio Error", "Failed to toggle microphone. Please try again.")
    }
  }

  // Toggle speaker
  const toggleSpeaker = async () => {
    try {
      const result = await AudioManager.toggleSpeaker()
      if (result.success) {
        setIsSpeakerOn(result.isSpeakerOn)
      }
    } catch (error) {
      console.error("Error toggling speaker:", error)
      Alert.alert("Audio Error", "Failed to toggle speaker. Please try again.")
    }
  }

  // Toggle video
  const toggleVideo = async () => {
    try {
      if (localStreamRef.current) {
        if (!isVideoEnabled) {
          // Turn on video
          const newStream = await mediaDevices.getUserMedia({
            audio: true,
            video: {
              facingMode: isFrontCamera ? "user" : "environment",
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
            },
          })

          // Replace video tracks in all peer connections
          participantConnections.forEach((pc, participantId) => {
            if (pc) {
              const senders = pc.getSenders()
              const videoTrack = newStream.getVideoTracks()[0]
              const videoSender = senders.find((sender) => sender.track && sender.track.kind === "video")

              if (videoSender) {
                videoSender.replaceTrack(videoTrack)
              } else {
                pc.addTrack(videoTrack, newStream)
              }
            }
          })

          setLocalStream(newStream)
          localStreamRef.current = newStream
        } else {
          // Turn off video
          localStreamRef.current.getVideoTracks().forEach((track) => {
            track.enabled = false
          })
        }

        setIsVideoEnabled(!isVideoEnabled)

        // Notify other participants
        if (socket && isConnected && callId) {
          socket.emit("participant-video-toggled", {
            callId,
            participantId: authState.user.id,
            isVideoEnabled: !isVideoEnabled,
          })
        }

        // Log video toggle
        if (callId) {
          await CallLogAPI.logCallEvent(
            authState.token,
            callId,
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
      if (localStreamRef.current && isVideoEnabled) {
        // Stop current video track
        localStreamRef.current.getVideoTracks().forEach((track) => track.stop())

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
        participantConnections.forEach((pc, participantId) => {
          if (pc) {
            const senders = pc.getSenders()
            const videoTrack = newStream.getVideoTracks()[0]
            const videoSender = senders.find((sender) => sender.track && sender.track.kind === "video")
            if (videoSender) {
              videoSender.replaceTrack(videoTrack)
            }
          }
        })

        // Update local stream
        const newVideoTrack = newStream.getVideoTracks()[0]
        const audioTracks = localStreamRef.current.getAudioTracks()
        const combinedStream = new MediaStream()
        audioTracks.forEach((track) => combinedStream.addTrack(track))
        combinedStream.addTrack(newVideoTrack)

        setLocalStream(combinedStream)
        localStreamRef.current = combinedStream
        setIsFrontCamera(!isFrontCamera)
      }
    } catch (error) {
      console.error("Error toggling camera:", error)
      Alert.alert("Error", "Failed to switch camera. Please try again.")
    }
  }

  // Answer incoming group call
  const answerGroupCall = async () => {
    try {
      setCallState("connecting")

      // Create peer connections for all participants
      for (const participant of participants) {
        if (participant._id !== authState.user.id) {
          await createPeerConnectionForParticipant(participant._id)
        }
      }

      // Send answer via socket
      // if (socket && isConnected) {
      //   socket.emit('group-call-answer', {
      //     callId,
      //     participantId: authState.user.id,
      //     conversationId,
      //   });
      // }

      await GroupCallAPI.updateCallStatus(callId, { status: "active", targetUserId: authState.user.id })
      // Note: The new API uses 'active' for ongoing. 'targetUserId' might be relevant if updating a specific participant's status upon answering.

      setCallState("ongoing")
      setCallStartTime(new Date())
      await AudioManager.stopRingtone()

      // Start call timer
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)

      // Start quality monitoring
      startQualityMonitoring()

      // Update call status
      // await CallAPI.updateCallStatus(authState.token, callId, 'ongoing');

      // Log call answered
      await CallLogAPI.logCallEvent(authState.token, callId, "group", "call_answered", {})
    } catch (error) {
      console.error("Error answering group call:", error)
      handleEndCall("answer_failed")
    }
  }

  // Reject incoming group call
  const rejectGroupCall = async () => {
    try {
      // Send rejection via socket
      if (socket && isConnected) {
        socket.emit("group-call-reject", {
          callId,
          participantId: authState.user.id,
          conversationId,
        })
      }

      await AudioManager.stopRingtone()
      await GroupCallAPI.updateCallStatus(callId, { status: "rejected", targetUserId: authState.user.id })
      // await CallAPI.updateCallStatus(authState.token, callId, 'rejected');

      // Log call rejected
      await CallLogAPI.logCallEvent(authState.token, callId, "group", "call_rejected", {})

      navigation.goBack()
    } catch (error) {
      console.error("Error rejecting group call:", error)
      navigation.goBack()
    }
  }

  // Add participant to ongoing call
  const addParticipant = async (newParticipant) => {
    try {
      if (callState === "ongoing" && socket && isConnected) {
        // Check new participant's status
        socket.emit("check-user-status", { userId: newParticipant._id })

        // Add to participants list
        setParticipants((prev) => [...prev, newParticipant])

        // Send invitation
        socket.emit("group-call-invite", {
          callId,
          conversationId,
          invitedParticipant: newParticipant,
          inviterInfo: {
            id: authState.user.id,
            name: authState.user.name,
          },
        })

        // Log participant added
        await CallLogAPI.logCallEvent(authState.token, callId, "group", "participant_added", {
          addedParticipant: newParticipant._id,
          addedBy: authState.user.id,
        })
      }
    } catch (error) {
      console.error("Error adding participant:", error)
      Alert.alert("Error", "Failed to add participant to the call.")
    }
  }

  // Remove participant from call (admin only)
  const removeParticipant = async (participantId) => {
    try {
      if (callState === "ongoing" && socket && isConnected) {
        // Send removal notification
        socket.emit("group-call-remove-participant", {
          callId,
          conversationId,
          removedParticipantId: participantId,
          removedBy: authState.user.id,
        })

        // Remove from local state
        handleParticipantLeft({ callId, participantId })

        // Log participant removed
        await CallLogAPI.logCallEvent(authState.token, callId, "group", "participant_removed", {
          removedParticipant: participantId,
          removedBy: authState.user.id,
        })
      }
    } catch (error) {
      console.error("Error removing participant:", error)
      Alert.alert("Error", "Failed to remove participant from the call.")
    }
  }

  // Handle end call
  const handleEndCall = async (reason = "user_ended") => {
    try {
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

      // Determine call status
      let callStatus = "completed"
      if (callState === "connecting" || callState === "ringing" || callState === "calling") {
        callStatus = isIncoming ? "rejected" : "missed"
      } else if (reason === "error" || reason === "setup_failed" || reason === "initiate_failed") {
        callStatus = "failed"
      }

      // Update call status and notify participants
      if (callId) {
        // if (socket && isConnected && callState !== 'ended') {
        //   socket.emit('end-group-call', { // This might be redundant if API call handles it
        //     callId,
        //     conversationId,
        //     endedBy: authState.user.id,
        //   });
        // }

        // await CallAPI.updateCallStatus(authState.token, callId, callStatus, new Date().toISOString());
        if (reason === "user_ended") {
          // This is a simplification. You might need to know if the current user is the initiator
          // to decide between endGroupCall (for initiator) and leaveGroupCall (for participant).
          // Let's assume for now 'user_ended' means the current user is leaving.
          // If they are the last one, the backend might auto-end it.
          // Or, if you have a specific "End Call for All" button for initiators, that would call endGroupCall.
          const endResponse = await GroupCallAPI.leaveGroupCall(callId)
          if (!endResponse.success) {
            console.warn("Failed to leave group call via API:", endResponse.message)
          }
        } else if (callStatus === "missed" || callStatus === "rejected" || callStatus === "failed") {
          // Update status for specific failure reasons if not a direct leave/end action
          await GroupCallAPI.updateCallStatus(callId, {
            status: callStatus, // 'missed', 'rejected', 'failed'
            reason: reason,
            endTime: new Date().toISOString(),
            targetUserId: authState.user.id, // Status update for this user
          })
        }
        // If 'remote_ended' or 'all_participants_left', the call is already ended by others,
        // so a client-side API call to end/leave might be redundant or could even error if the call record is gone.
        // The backend should handle the primary status update in those cases.

        // Log call ended
        await CallLogAPI.logCallEvent(authState.token, callId, "group", "call_ended", {
          duration: callDuration,
          reason,
          participantCount: activeParticipants.size + 1,
        })
      }

      // Clean up WebRTC
      cleanupWebRTC()

      setCallState("ended")
      setCallEndReason(reason)

      setTimeout(() => {
        navigation.goBack()
      }, 1000)
    } catch (error) {
      console.error("Error ending group call:", error)
      navigation.goBack()
    }
  }

  // Clean up WebRTC resources
  const cleanupWebRTC = () => {
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
    }

    // Close all peer connections
    participantConnections.forEach((pc, participantId) => {
      if (pc) {
        pc.close()
      }
    })

    setParticipantConnections(new Map())
    setParticipantStreams(new Map())
  }

  // Clean up call resources
  const cleanupCall = () => {
    if (callTimerRef.current) clearInterval(callTimerRef.current)
    if (qualityMonitorRef.current) clearInterval(qualityMonitorRef.current)
    AudioManager.cleanup()
    cleanupWebRTC()
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
      case "calling":
        return "Calling..."
      case "ringing":
        return isIncoming ? "Incoming group call..." : "Ringing..."
      case "ongoing":
        if (isReconnecting) return "Reconnecting..."
        return formatDuration(callDuration)
      case "ended":
        if (callEndReason === "rejected") return "Call rejected"
        if (callEndReason === "remote_ended") return "Call ended"
        if (callEndReason === "no_answer") return "No answer"
        if (callEndReason === "all_participants_left") return "All participants left"
        return "Call ended"
      default:
        return ""
    }
  }

  // Calculate grid layout
  const calculateGridLayout = () => {
    const totalParticipants = activeParticipants.size + 1 // +1 for local user

    if (totalParticipants <= 1) return { rows: 1, cols: 1 }
    if (totalParticipants <= 2) return { rows: 1, cols: 2 }
    if (totalParticipants <= 4) return { rows: 2, cols: 2 }
    if (totalParticipants <= 6) return { rows: 2, cols: 3 }
    if (totalParticipants <= 9) return { rows: 3, cols: 3 }
    return { rows: 4, cols: 3 } // Max 12 participants visible
  }

  // Render participant video
  const renderParticipantVideo = (participantId, participant, index) => {
    const stream = participantStreams.get(participantId)
    const status = participantStatus.get(participantId) || {}
    const { rows, cols } = calculateGridLayout()

    const videoWidth = width / cols
    const videoHeight = (height - 200) / rows // Adjust for controls

    return (
      <TouchableOpacity
        key={participantId}
        style={[
          styles.participantVideo,
          {
            width: videoWidth,
            height: videoHeight,
            backgroundColor: "#333333",
          },
        ]}
        onPress={() => setSelectedParticipant(selectedParticipant === participantId ? null : participantId)}
      >
        {stream && status.videoEnabled ? (
          <RTCView streamURL={stream.toURL()} style={styles.videoStream} objectFit="cover" />
        ) : (
          <View style={styles.participantPlaceholder}>
            {participant.profilePicture ? (
              <Image
                source={{ uri: `${API_BASE_URL_FOR_MEDIA}${participant.profilePicture}` }}
                style={styles.participantAvatar}
              />
            ) : (
              <View style={styles.defaultParticipantAvatar}>
                <Text style={styles.defaultAvatarText}>{participant.name?.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>
        )}

        {/* Participant info overlay */}
        <View style={styles.participantOverlay}>
          <Text style={styles.participantName} numberOfLines={1}>
            {participant.name}
          </Text>

          {/* Status indicators */}
          <View style={styles.participantIndicators}>
            {status.muted && (
              <View style={styles.mutedIndicator}>
                <Ionicons name="mic-off" size={12} color="#FFFFFF" />
              </View>
            )}

            {status.quality && (
              <View
                style={[
                  styles.qualityIndicator,
                  {
                    backgroundColor:
                      status.quality === "good" ? "#4CAF50" : status.quality === "fair" ? "#FFC107" : "#F44336",
                  },
                ]}
              />
            )}
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  // Render local video
  const renderLocalVideo = () => {
    const { rows, cols } = calculateGridLayout()
    const videoWidth = width / cols
    const videoHeight = (height - 200) / rows

    return (
      <TouchableOpacity
        style={[
          styles.participantVideo,
          {
            width: videoWidth,
            height: videoHeight,
            backgroundColor: "#333333",
          },
        ]}
        onPress={() => setSelectedParticipant(selectedParticipant === "local" ? null : "local")}
      >
        {localStream && isVideoEnabled ? (
          <RTCView streamURL={localStream.toURL()} style={styles.videoStream} objectFit="cover" zOrder={1} />
        ) : (
          <View style={styles.participantPlaceholder}>
            {authState.user.profilePicture ? (
              <Image
                source={{ uri: `${API_BASE_URL_FOR_MEDIA}${authState.user.profilePicture}` }}
                style={styles.participantAvatar}
              />
            ) : (
              <View style={styles.defaultParticipantAvatar}>
                <Text style={styles.defaultAvatarText}>{authState.user.name?.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>
        )}

        {/* Local user overlay */}
        <View style={styles.participantOverlay}>
          <Text style={styles.participantName} numberOfLines={1}>
            You
          </Text>

          <View style={styles.participantIndicators}>
            {isMuted && (
              <View style={styles.mutedIndicator}>
                <Ionicons name="mic-off" size={12} color="#FFFFFF" />
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  // Render participants list modal
  const renderParticipantsList = () => (
    <Modal
      visible={showParticipantsList}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowParticipantsList(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: currentTheme.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: currentTheme.text }]}>
              Participants ({activeParticipants.size + 1})
            </Text>
            <TouchableOpacity onPress={() => setShowParticipantsList(false)}>
              <Ionicons name="close" size={24} color={currentTheme.text} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={[{ _id: authState.user.id, name: "You", isLocal: true }, ...Array.from(activeParticipants.values())]}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <View style={styles.participantListItem}>
                <Image
                  source={
                    item.profilePicture
                      ? { uri: `${API_BASE_URL_FOR_MEDIA}${item.profilePicture}` }
                      : require("../../assets/images/default-avatar.png")
                  }
                  style={styles.participantListAvatar}
                />
                <View style={styles.participantListInfo}>
                  <Text style={[styles.participantListName, { color: currentTheme.text }]}>{item.name}</Text>
                  <Text style={[styles.participantListStatus, { color: currentTheme.placeholder }]}>
                    {item.isLocal ? "You" : "Connected"}
                  </Text>
                </View>

                {!item.isLocal && (
                  <TouchableOpacity
                    style={styles.removeParticipantButton}
                    onPress={() => {
                      Alert.alert("Remove Participant", `Remove ${item.name} from the call?`, [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Remove",
                          style: "destructive",
                          onPress: () => removeParticipant(item._id),
                        },
                      ])
                    }}
                  >
                    <Ionicons name="remove-circle" size={20} color="#F44336" />
                  </TouchableOpacity>
                )}
              </View>
            )}
          />

          <TouchableOpacity
            style={[styles.addParticipantButton, { backgroundColor: currentTheme.primary }]}
            onPress={() => {
              setShowParticipantsList(false)
              setShowAddParticipants(true)
            }}
          >
            <Ionicons name="person-add" size={20} color="#FFFFFF" />
            <Text style={styles.addParticipantText}>Add Participant</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: "#000000" }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Call Header */}
      <View style={styles.callHeader}>
        <TouchableOpacity
          style={styles.minimizeButton}
          onPress={() => {
            if (callState === "ongoing") {
              Alert.alert("End Call", "Are you sure you want to end this group call?", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "End Call",
                  style: "destructive",
                  onPress: () => handleEndCall("user_ended"),
                },
              ])
            } else {
              handleEndCall("user_ended")
            }
          }}
        >
          <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.callInfo}>
          <Text style={styles.conversationName}>{conversationName}</Text>
          <Text style={styles.callStatusText}>{getCallStatusText()}</Text>
        </View>

        <TouchableOpacity style={styles.participantsButton} onPress={() => setShowParticipantsList(true)}>
          <Ionicons name="people" size={24} color="#FFFFFF" />
          <Text style={styles.participantCount}>{activeParticipants.size + 1}</Text>
        </TouchableOpacity>
      </View>

      {/* Video Grid or Audio Call View */}
      {callType === "video" && callState === "ongoing" ? (
        <View style={styles.videoGrid}>
          {selectedParticipant ? (
            // Full-screen view of selected participant
            <View style={styles.fullScreenVideo}>
              {selectedParticipant === "local" ? (
                localStream && isVideoEnabled ? (
                  <RTCView streamURL={localStream.toURL()} style={styles.fullScreenVideoStream} objectFit="cover" />
                ) : (
                  <View style={styles.fullScreenPlaceholder}>
                    <Text style={styles.fullScreenName}>You</Text>
                  </View>
                )
              ) : (
                (() => {
                  const stream = participantStreams.get(selectedParticipant)
                  const participant = activeParticipants.get(selectedParticipant)
                  const status = participantStatus.get(selectedParticipant) || {}

                  return stream && status.videoEnabled ? (
                    <RTCView streamURL={stream.toURL()} style={styles.fullScreenVideoStream} objectFit="cover" />
                  ) : (
                    <View style={styles.fullScreenPlaceholder}>
                      <Text style={styles.fullScreenName}>{participant?.name}</Text>
                    </View>
                  )
                })()
              )}

              {/* Thumbnail grid at bottom */}
              <View style={styles.thumbnailGrid}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {renderLocalVideo()}
                  {Array.from(activeParticipants.entries()).map(([participantId, participant], index) =>
                    participantId !== selectedParticipant
                      ? renderParticipantVideo(participantId, participant, index)
                      : null,
                  )}
                </ScrollView>
              </View>
            </View>
          ) : (
            // Grid view of all participants
            <ScrollView contentContainerStyle={styles.gridContainer}>
              {renderLocalVideo()}
              {Array.from(activeParticipants.entries()).map(([participantId, participant], index) =>
                renderParticipantVideo(participantId, participant, index),
              )}
            </ScrollView>
          )}
        </View>
      ) : (
        // Audio call view
        <View style={styles.audioCallContainer}>
          <Text style={styles.conversationNameLarge}>{conversationName}</Text>
          <Text style={styles.callStatusLarge}>{getCallStatusText()}</Text>

          {/* Participants avatars in audio call */}
          <View style={styles.audioParticipantsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {/* Local user */}
              <View style={styles.audioParticipant}>
                {authState.user.profilePicture ? (
                  <Image
                    source={{ uri: `${API_BASE_URL_FOR_MEDIA}${authState.user.profilePicture}` }}
                    style={styles.audioParticipantAvatar}
                  />
                ) : (
                  <View style={styles.defaultAudioAvatar}>
                    <Text style={styles.defaultAudioAvatarText}>{authState.user.name?.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <Text style={styles.audioParticipantName}>You</Text>
                {isMuted && (
                  <View style={styles.audioMutedIndicator}>
                    <Ionicons name="mic-off" size={16} color="#FFFFFF" />
                  </View>
                )}
              </View>

              {/* Other participants */}
              {Array.from(activeParticipants.entries()).map(([participantId, participant]) => {
                const status = participantStatus.get(participantId) || {}
                return (
                  <View key={participantId} style={styles.audioParticipant}>
                    {participant.profilePicture ? (
                      <Image
                        source={{ uri: `${API_BASE_URL_FOR_MEDIA}${participant.profilePicture}` }}
                        style={styles.audioParticipantAvatar}
                      />
                    ) : (
                      <View style={styles.defaultAudioAvatar}>
                        <Text style={styles.defaultAudioAvatarText}>{participant.name?.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <Text style={styles.audioParticipantName}>{participant.name}</Text>
                    {status.muted && (
                      <View style={styles.audioMutedIndicator}>
                        <Ionicons name="mic-off" size={16} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                )
              })}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Call Controls */}
      {callState === "ongoing" ? (
        <View style={styles.callControls}>
          <TouchableOpacity style={[styles.controlButton, isMuted && styles.activeControlButton]} onPress={toggleMute}>
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
            onLongPress={() => setShowAudioRouteSelector(true)}
          >
            <Ionicons name={isSpeakerOn ? "volume-high" : "volume-medium"} size={24} color="#FFFFFF" />
            <Text style={styles.controlText}>Speaker</Text>
          </TouchableOpacity>

          {callType === "video" && isVideoEnabled && (
            <TouchableOpacity style={styles.controlButton} onPress={toggleCamera}>
              <Ionicons name="camera-reverse" size={24} color="#FFFFFF" />
              <Text style={styles.controlText}>Flip</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.controlButton} onPress={() => setShowAddParticipants(true)}>
            <Ionicons name="person-add" size={24} color="#FFFFFF" />
            <Text style={styles.controlText}>Add</Text>
          </TouchableOpacity>
        </View>
      ) : isIncoming && callState === "ringing" ? (
        // Incoming group call controls
        <View style={styles.incomingCallControls}>
          <TouchableOpacity style={[styles.incomingCallButton, styles.rejectButton]} onPress={rejectGroupCall}>
            <Ionicons name="call" size={30} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
            <Text style={styles.incomingButtonText}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.incomingCallButton, styles.acceptButton]} onPress={answerGroupCall}>
            <Ionicons name="call" size={30} color="#FFFFFF" />
            <Text style={styles.incomingButtonText}>Join</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* End Call Button */}
      {(callState === "ongoing" || ((callState === "ringing" || callState === "calling") && !isIncoming)) && (
        <View style={styles.endCallContainer}>
          <TouchableOpacity style={styles.endCallButton} onPress={() => handleEndCall("user_ended")}>
            <Ionicons name="call" size={30} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
          </TouchableOpacity>
        </View>
      )}

      {/* Participants List Modal */}
      {renderParticipantsList()}

      {/* Audio Route Selector Modal */}
      <AudioRouteSelector
        visible={showAudioRouteSelector}
        onClose={() => setShowAudioRouteSelector(false)}
        onRouteSelected={(route) => {
          setIsSpeakerOn(route === "speaker")
          if (callId) {
            CallLogAPI.logCallEvent(authState.token, callId, "group", "audio_route_changed", { newRoute: route })
          }
        }}
      />
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
  callInfo: {
    flex: 1,
    alignItems: "center",
  },
  conversationName: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  callStatusText: {
    color: "#CCCCCC",
    fontSize: 14,
    marginTop: 2,
  },
  participantsButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  participantCount: {
    color: "#FFFFFF",
    marginLeft: 5,
    fontSize: 14,
    fontWeight: "bold",
  },
  videoGrid: {
    flex: 1,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 5,
  },
  participantVideo: {
    margin: 2,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  videoStream: {
    width: "100%",
    height: "100%",
  },
  participantPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#333333",
  },
  participantAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  defaultParticipantAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#128C7E",
    justifyContent: "center",
    alignItems: "center",
  },
  defaultAvatarText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
  },
  participantOverlay: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  participantName: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flex: 1,
  },
  participantIndicators: {
    flexDirection: "row",
    alignItems: "center",
  },
  mutedIndicator: {
    backgroundColor: "rgba(244, 67, 54, 0.8)",
    borderRadius: 10,
    padding: 4,
    marginLeft: 4,
  },
  qualityIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 4,
  },
  fullScreenVideo: {
    flex: 1,
    position: "relative",
  },
  fullScreenVideoStream: {
    width: "100%",
    height: "100%",
  },
  fullScreenPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#333333",
  },
  fullScreenName: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
  },
  thumbnailGrid: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    height: 100,
  },
  audioCallContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  conversationNameLarge: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  callStatusLarge: {
    color: "#CCCCCC",
    fontSize: 18,
    textAlign: "center",
    marginBottom: 40,
  },
  audioParticipantsContainer: {
    width: "100%",
    maxHeight: 200,
  },
  audioParticipant: {
    alignItems: "center",
    marginHorizontal: 15,
    position: "relative",
  },
  audioParticipantAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 8,
  },
  defaultAudioAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#128C7E",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  defaultAudioAvatarText: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "bold",
  },
  audioParticipantName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  audioMutedIndicator: {
    position: "absolute",
    top: 55,
    right: 5,
    backgroundColor: "rgba(244, 67, 54, 0.8)",
    borderRadius: 12,
    padding: 4,
  },
  callControls: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  controlButton: {
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    minWidth: 60,
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
  incomingCallControls: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    paddingHorizontal: 30,
    marginBottom: 30,
  },
  incomingCallButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  rejectButton: {
    backgroundColor: "#FF3B30",
  },
  acceptButton: {
    backgroundColor: "#4CD964",
  },
  incomingButtonText: {
    color: "#FFFFFF",
    marginTop: 5,
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  participantListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  participantListAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  participantListInfo: {
    flex: 1,
  },
  participantListName: {
    fontSize: 16,
    fontWeight: "500",
  },
  participantListStatus: {
    fontSize: 14,
    marginTop: 2,
  },
  removeParticipantButton: {
    padding: 8,
  },
  addParticipantButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  addParticipantText: {
    color: "#FFFFFF",
    marginLeft: 8,
    fontSize: 16,
    fontWeight: "500",
  },
})

export default GroupCallScreen
