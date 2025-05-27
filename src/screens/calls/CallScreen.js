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
} from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import Ionicons from "react-native-vector-icons/Ionicons"
import { AuthContext } from "../../context/AuthContext"
import { SocketContext } from "../../context/SocketContext"
import { ThemeContext } from "../../context/ThemeContext"
import { getTheme } from "../../utils/theme"
import * as CallAPI from "../../api/call"
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

const { width, height } = Dimensions.get("window")

const CallScreen = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const { receiverId, receiverName, receiverProfilePic, callType } = route.params
  const { state: authState } = useContext(AuthContext)
  const { socket, isConnected } = useContext(SocketContext)
  const { theme } = useContext(ThemeContext)
  const currentTheme = getTheme(theme)

  // Call state
  const [callState, setCallState] = useState("initializing") // initializing, connecting, calling, ringing, ongoing, ended
  const [callDuration, setCallDuration] = useState(0)
  const [callStartTime, setCallStartTime] = useState(null)
  const [isIncoming, setIsIncoming] = useState(false)
  const [callEndReason, setCallEndReason] = useState(null)
  const [callId, setCallId] = useState(route.params.callId || null)
  const [receiverOnlineStatus, setReceiverOnlineStatus] = useState(null) // null, 'online', 'offline'
  const [receiverActiveDevice, setReceiverActiveDevice] = useState(null)

  // Media state
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeakerOn, setIsSpeakerOn] = useState(callType === "video")
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === "video")
  const [isFrontCamera, setIsFrontCamera] = useState(true)
  const [isRemoteVideoEnabled, setIsRemoteVideoEnabled] = useState(callType === "video")

  // Network state
  const [networkType, setNetworkType] = useState(null)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [callQuality, setCallQuality] = useState("good") // good, fair, poor

  // Refs
  const peerConnectionRef = useRef(null)
  const callTimerRef = useRef(null)
  const qualityMonitorRef = useRef(null)
  const iceServersRef = useRef([])
  const appStateRef = useRef(AppState.currentState)
  const isCallEndingRef = useRef(false)

  // Initialize call
  useEffect(() => {
    const setupCall = async () => {
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
          // Fallback to default STUN servers
          iceServersRef.current = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }]
        }

        // Initialize media stream
        await setupMediaStream()

        // Initialize audio session
        await AudioManager.initializeAudioSession(callType === "video")

        // If this is an outgoing call, initiate it
        if (!route.params.isIncoming) {
          await initiateOutgoingCall()
        } else {
          // Handle incoming call
          setIsIncoming(true)
          setCallId(route.params.callId)
          setCallState("ringing")

          // Start ringtone for incoming calls
          await AudioManager.startRingtone()
        }

        // Set up network monitoring
        setupNetworkMonitoring()

        // Set up app state monitoring
        setupAppStateMonitoring()
      } catch (error) {
        console.error("Error setting up call:", error)
        handleEndCall("setup_failed")
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
    if (socket && isConnected) {
      // Incoming call answer
      socket.on("call-answered", handleCallAnswered)

      // Call rejected
      socket.on("call-rejected", handleCallRejected)

      // Call ended by other party
      socket.on("call-ended", handleCallEndedByOther)

      // ICE candidates
      socket.on("ice-candidate", handleRemoteIceCandidate)

      // Call quality issues
      socket.on("call-quality-issue", handleCallQualityIssue)

      // Network fallback
      socket.on("network-fallback", handleNetworkFallback)

      // ICE restart needed
      socket.on("ice-restart-needed", handleIceRestartNeeded)

      // Enhanced: Listen for receiver coming online during call
      socket.on("receiver-came-online", ({ callId: onlineCallId, activeDevice }) => {
        if (callId === onlineCallId && callState === "calling") {
          setReceiverOnlineStatus("online")
          setReceiverActiveDevice(activeDevice)
          setCallState("ringing")

          // Re-send call offer to the now-active device
          if (socket && peerConnectionRef.current) {
            socket.emit("call-offer", {
              callId,
              receiverId: receiverId,
              targetDeviceId: activeDevice,
              offer: peerConnectionRef.current.localDescription,
              callType: callType,
              callerInfo: {
                id: authState.user.id,
                name: authState.user.name,
                profilePicture: authState.user.profilePicture,
              },
            })
          }
        }
      })

      // Enhanced: Listen for user status response
      socket.on("user-status-response", ({ userId, status, activeDevice }) => {
        if (userId === receiverId) {
          setReceiverOnlineStatus(status)
          setReceiverActiveDevice(activeDevice)

          // Update call state based on status
          if (callState === "connecting") {
            if (status === "online") {
              setCallState("ringing")
            } else {
              setCallState("calling")
            }
          }
        }
      })

      return () => {
        socket.off("call-answered", handleCallAnswered)
        socket.off("call-rejected", handleCallRejected)
        socket.off("call-ended", handleCallEndedByOther)
        socket.off("ice-candidate", handleRemoteIceCandidate)
        socket.off("call-quality-issue", handleCallQualityIssue)
        socket.off("network-fallback", handleNetworkFallback)
        socket.off("ice-restart-needed", handleIceRestartNeeded)
        socket.off("receiver-came-online")
        socket.off("user-status-response")
      }
    }
  }, [socket, isConnected, callId, callState, receiverId])

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
      // iOS
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

  // Set up media stream
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
        // Try to reconnect peer connection
        if (peerConnectionRef.current) {
          restartIce()
        }
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
        // Check connection and restart if needed
        if (
          peerConnectionRef.current?.iceConnectionState === "disconnected" ||
          peerConnectionRef.current?.iceConnectionState === "failed"
        ) {
          restartIce()
        }
      }
      appStateRef.current = nextAppState
    })

    return () => {
      subscription.remove()
    }
  }

  // Enhanced: Initiate outgoing call with device targeting and online status check
  const initiateOutgoingCall = async () => {
    try {
      setCallState("connecting")

      // First, check receiver's online status and active device
      if (socket) {
        socket.emit("check-user-status", { userId: receiverId })

        // Wait for status response with timeout
        const statusPromise = new Promise((resolve) => {
          const handleStatusResponse = ({ userId, status, activeDevice }) => {
            if (userId === receiverId) {
              setReceiverOnlineStatus(status)
              setReceiverActiveDevice(activeDevice)
              socket.off("user-status-response", handleStatusResponse)
              resolve({ status, activeDevice })
            }
          }
          socket.on("user-status-response", handleStatusResponse)

          // Timeout after 5 seconds
          setTimeout(() => {
            socket.off("user-status-response", handleStatusResponse)
            resolve({ status: "offline", activeDevice: null })
          }, 5000)
        })

        const { status, activeDevice } = await statusPromise

        // Update call state based on online status
        if (status === "online") {
          setCallState("ringing")
          // Start ringback tone for online users
          await AudioManager.startRingback()
        } else {
          setCallState("calling")
          // No ringback for offline users
        }
      }

      // Create peer connection
      await createPeerConnection()

      // Create and send offer
      const offer = await peerConnectionRef.current.createOffer()
      await peerConnectionRef.current.setLocalDescription(offer)

      // Initiate call in the backend with device targeting
      const callData = {
        receiverId: receiverId,
        callType: callType,
        targetDeviceId: receiverActiveDevice,
      }

      const response = await CallAPI.initiateCall(authState.token, receiverId, callType)

      if (response.success) {
        const newCallId = response.call._id
        setCallId(newCallId)

        // Send offer via socket with device targeting
        if (socket && isConnected) {
          socket.emit("call-offer", {
            callId: newCallId,
            receiverId: receiverId,
            targetDeviceId: receiverActiveDevice, // Target specific device
            offer: offer,
            callType: callType,
            callerInfo: {
              id: authState.user.id,
              name: authState.user.name,
              profilePicture: authState.user.profilePicture,
            },
          })
        }

        // Log call initiated event
        await CallLogAPI.logCallEvent(authState.token, newCallId, "one-to-one", "call_initiated", {
          callType: callType,
          targetDevice: receiverActiveDevice,
          receiverStatus: receiverOnlineStatus,
        })

        // Update call status based on receiver's online status
        const initialStatus = receiverOnlineStatus === "online" ? "ringing" : "calling"
        await CallAPI.updateCallStatus(authState.token, newCallId, initialStatus)

        // Set timeout for call not answered (longer for offline users)
        const timeoutDuration = receiverOnlineStatus === "online" ? 45000 : 60000
        setTimeout(() => {
          if (callState === "ringing" || callState === "calling") {
            const reason = receiverOnlineStatus === "online" ? "no_answer" : "user_offline"
            handleEndCall(reason)
          }
        }, timeoutDuration)
      } else {
        console.error("Failed to initiate call:", response.message)
        handleEndCall("initiate_failed")
      }
    } catch (error) {
      console.error("Error initiating outgoing call:", error)
      handleEndCall("initiate_failed")
    }
  }

  // Create WebRTC peer connection
  const createPeerConnection = async () => {
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
        if (candidate && socket && isConnected && callId) {
          socket.emit("ice-candidate", {
            callId,
            candidate,
            recipientId: receiverId,
          })
        }
      }

      // Handle ICE connection state changes
      pc.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", pc.iceConnectionState)

        if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
          // Try to restart ICE if connection fails
          if (callState === "ongoing") {
            setIsReconnecting(true)
            restartIce()
          }
        } else if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          setIsReconnecting(false)
        }
      }

      // Handle remote stream
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0])

          // Check if remote stream has video tracks
          const hasVideoTracks = event.streams[0].getVideoTracks().length > 0
          setIsRemoteVideoEnabled(hasVideoTracks)
        }
      }

      peerConnectionRef.current = pc
      return pc
    } catch (error) {
      console.error("Error creating peer connection:", error)
      throw new Error("Failed to create peer connection")
    }
  }

  // Handle incoming call answer
  const handleCallAnswered = async ({ callId: incomingCallId, receiverId, answer }) => {
    try {
      if (callId === incomingCallId && (callState === "ringing" || callState === "calling")) {
        // Set remote description from answer
        const rtcSessionDescription = new RTCSessionDescription(answer)
        await peerConnectionRef.current.setRemoteDescription(rtcSessionDescription)

        // Update call state
        setCallState("ongoing")
        setCallStartTime(new Date())

        // Stop ringback tone
        await AudioManager.stopRingback()

        // Start call timer
        callTimerRef.current = setInterval(() => {
          setCallDuration((prev) => prev + 1)
        }, 1000)

        // Start quality monitoring
        startQualityMonitoring()

        // Update call status in backend
        await CallAPI.updateCallStatus(authState.token, callId, "ongoing")

        // Log call connected event
        await CallLogAPI.logCallEvent(authState.token, callId, "one-to-one", "call_connected", {})
      }
    } catch (error) {
      console.error("Error handling call answer:", error)
      handleEndCall("answer_failed")
    }
  }

  // Handle call rejection
  const handleCallRejected = ({ callId: rejectedCallId }) => {
    if (callId === rejectedCallId && (callState === "ringing" || callState === "calling")) {
      setCallEndReason("rejected")
      handleEndCall("rejected")
    }
  }

  // Handle call ended by other party
  const handleCallEndedByOther = ({ callId: endedCallId }) => {
    if (callId === endedCallId && (callState === "ringing" || callState === "ongoing" || callState === "calling")) {
      setCallEndReason("remote_ended")
      handleEndCall("remote_ended")
    }
  }

  // Handle remote ICE candidate
  const handleRemoteIceCandidate = async ({ callId: iceCandidateCallId, candidate, senderId }) => {
    try {
      if (callId === iceCandidateCallId && peerConnectionRef.current) {
        const iceCandidate = new RTCIceCandidate(candidate)
        await peerConnectionRef.current.addIceCandidate(iceCandidate)
      }
    } catch (error) {
      console.error("Error adding remote ICE candidate:", error)
    }
  }

  // Handle call quality issue notification
  const handleCallQualityIssue = ({ callId: qualityIssueCallId, issueType, metrics }) => {
    if (callId === qualityIssueCallId && callState === "ongoing") {
      // Update UI to show quality issues
      setCallQuality("poor")

      // Log the issue
      console.log("Call quality issue:", issueType, metrics)
    }
  }

  // Handle network fallback notification
  const handleNetworkFallback = ({ callId: fallbackCallId, fallbackType }) => {
    if (callId === fallbackCallId && callState === "ongoing") {
      // Update UI to show fallback mode
      if (fallbackType === "audio_only" && callType === "video") {
        Alert.alert("Network Issue", "Switching to audio only due to poor connection", [{ text: "OK" }])
        setIsVideoEnabled(false)
      }
    }
  }

  // Handle ICE restart request
  const handleIceRestartNeeded = async ({ callId: restartCallId }) => {
    if (callId === restartCallId && callState === "ongoing") {
      await restartIce()
    }
  }

  // Restart ICE connection
  const restartIce = async () => {
    try {
      if (peerConnectionRef.current && callState === "ongoing") {
        // Notify the other party
        if (socket && isConnected) {
          socket.emit("ice-restart-request", {
            callId,
            callType: "one-to-one",
            recipientId: receiverId,
          })
        }

        // Create new offer with ICE restart
        const offer = await peerConnectionRef.current.createOffer({ iceRestart: true })
        await peerConnectionRef.current.setLocalDescription(offer)

        // Send the offer via signaling
        if (socket && isConnected) {
          socket.emit("call-offer", {
            callId,
            receiverId: receiverId,
            offer,
            callType: callType,
          })
        }

        // Log ICE restart event
        await CallLogAPI.logCallEvent(authState.token, callId, "one-to-one", "ice_restart", {})
      }
    } catch (error) {
      console.error("Error restarting ICE:", error)
    }
  }

  // Start call quality monitoring
  const startQualityMonitoring = () => {
    if (peerConnectionRef.current) {
      qualityMonitorRef.current = setInterval(async () => {
        try {
          if (peerConnectionRef.current && callState === "ongoing") {
            const stats = await peerConnectionRef.current.getStats()
            const metricsData = processRTCStats(stats)

            // Update local UI based on metrics
            updateCallQualityUI(metricsData)

            // Send metrics to backend
            await CallLogAPI.logCallEvent(authState.token, callId, "one-to-one", "quality_metrics", {
              metrics: metricsData,
            })

            // If quality is poor, consider fallback options
            if (
              metricsData.qualityScore &&
              (metricsData.qualityScore.audio < 2 || (callType === "video" && metricsData.qualityScore.video < 2))
            ) {
              // If video call with poor quality, suggest falling back to audio
              if (callType === "video" && isVideoEnabled) {
                // Notify the other party
                if (socket && isConnected) {
                  socket.emit("network-fallback", {
                    callId,
                    callType: "one-to-one",
                    fallbackType: "audio_only",
                    recipientId: receiverId,
                  })
                }

                // Ask user if they want to disable video
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
    const iceConnectionState = peerConnectionRef.current?.iceConnectionState

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
    const videoQualityScore =
      callType === "video" ? calculateVideoQualityScore(rtt, jitter, packetLoss, frameRate, videoBitrate) : 0

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

    const overallScore = Math.min(metrics.qualityScore.audio, callType === "video" ? metrics.qualityScore.video : 5)

    if (overallScore >= 4) {
      setCallQuality("good")
    } else if (overallScore >= 2) {
      setCallQuality("fair")
    } else {
      setCallQuality("poor")
    }
  }

  // Handle end call
  const handleEndCall = async (reason = "user_ended") => {
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

      // Determine call status for backend
      let callStatus = "completed"
      if (callState === "connecting" || callState === "ringing" || callState === "calling") {
        callStatus = isIncoming ? "rejected" : "missed"
      } else if (reason === "error" || reason === "setup_failed" || reason === "initiate_failed") {
        callStatus = "failed"
      }

      // Update call status in backend if we have a call ID
      if (callId) {
        // Notify other party via socket
        if (socket && isConnected && callState !== "ended") {
          socket.emit("end-call", {
            callId,
            recipientId: receiverId,
          })
        }

        // Update call status in backend
        await CallAPI.updateCallStatus(authState.token, callId, callStatus, new Date().toISOString())

        // Log call ended event
        await CallLogAPI.logCallEvent(authState.token, callId, "one-to-one", "call_ended", {
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
      console.error("Error ending call:", error)
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

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
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

    // Clean up audio session
    AudioManager.cleanup()

    // Clean up WebRTC
    cleanupWebRTC()
  }

  const [showAudioRouteSelector, setShowAudioRouteSelector] = useState(false)

  // Toggle mute with actual microphone control
  const toggleMute = async () => {
    try {
      const newMuteState = !isMuted
      const success = await AudioManager.setMicrophoneMute(newMuteState)

      if (success) {
        setIsMuted(newMuteState)

        // Log mute toggle event
        if (callId) {
          await CallLogAPI.logCallEvent(authState.token, callId, "one-to-one", newMuteState ? "muted" : "unmuted", {})
        }
      } else {
        Alert.alert("Audio Error", "Failed to toggle microphone. Please try again.")
      }
    } catch (error) {
      console.error("Error toggling mute:", error)
      Alert.alert("Audio Error", "Failed to toggle microphone. Please try again.")
    }
  }

  // Toggle speaker with actual audio routing
  const toggleSpeaker = async () => {
    try {
      const result = await AudioManager.toggleSpeaker()

      if (result.success) {
        setIsSpeakerOn(result.isSpeakerOn)

        // Log speaker toggle event
        if (callId) {
          await CallLogAPI.logCallEvent(
            authState.token,
            callId,
            "one-to-one",
            result.isSpeakerOn ? "speaker_on" : "speaker_off",
            { audioRoute: AudioManager.getCurrentAudioRoute() },
          )
        }
      } else {
        Alert.alert("Audio Error", "Failed to toggle speaker. Please try again.")
      }
    } catch (error) {
      console.error("Error toggling speaker:", error)
      Alert.alert("Audio Error", "Failed to toggle speaker. Please try again.")
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
              facingMode: isFrontCamera ? "user" : "environment",
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
            },
          })

          // Replace tracks in peer connection
          if (peerConnectionRef.current) {
            const senders = peerConnectionRef.current.getSenders()
            const videoTrack = newStream.getVideoTracks()[0]

            // Find video sender and replace track
            const videoSender = senders.find((sender) => sender.track && sender.track.kind === "video")

            if (videoSender) {
              videoSender.replaceTrack(videoTrack)
            } else {
              // Add video track if not already present
              peerConnectionRef.current.addTrack(videoTrack, newStream)
            }

            // Keep audio tracks from current stream
            const audioTracks = localStream.getAudioTracks()
            audioTracks.forEach((track) => {
              newStream.addTrack(track)
            })
          }

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
        if (callId) {
          await CallLogAPI.logCallEvent(
            authState.token,
            callId,
            "one-to-one",
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

        // Replace video track in peer connection
        if (peerConnectionRef.current) {
          const senders = peerConnectionRef.current.getSenders()
          const videoTrack = newStream.getVideoTracks()[0]

          const videoSender = senders.find((sender) => sender.track && sender.track.kind === "video")

          if (videoSender) {
            videoSender.replaceTrack(videoTrack)
          }
        }

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
        if (callId) {
          await CallLogAPI.logCallEvent(
            authState.token,
            callId,
            "one-to-one",
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

  // Answer incoming call
  const answerCall = async () => {
    try {
      setCallState("connecting")

      // Create peer connection
      await createPeerConnection()

      // Get the offer from route params
      const offer = route.params.offer

      // Set remote description
      const rtcSessionDescription = new RTCSessionDescription(offer)
      await peerConnectionRef.current.setRemoteDescription(rtcSessionDescription)

      // Create answer
      const answer = await peerConnectionRef.current.createAnswer()
      await peerConnectionRef.current.setLocalDescription(answer)

      // Send answer via socket
      if (socket && isConnected) {
        socket.emit("call-answer", {
          callId,
          callerId: route.params.callerId,
          answer,
        })
      }

      // Update call state
      setCallState("ongoing")
      setCallStartTime(new Date())

      // Stop ringtone
      await AudioManager.stopRingtone()

      // Start call timer
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)

      // Start quality monitoring
      startQualityMonitoring()

      // Update call status in backend
      await CallAPI.updateCallStatus(authState.token, callId, "ongoing")

      // Log call answered event
      await CallLogAPI.logCallEvent(authState.token, callId, "one-to-one", "call_answered", {})
    } catch (error) {
      console.error("Error answering call:", error)
      handleEndCall("answer_failed")
    }
  }

  // Reject incoming call
  const rejectCall = async () => {
    try {
      // Send rejection via socket
      if (socket && isConnected) {
        socket.emit("reject-call", {
          callId,
          callerId: route.params.callerId,
        })
      }

      // Stop ringtone
      await AudioManager.stopRingtone()

      // Update call status in backend
      await CallAPI.updateCallStatus(authState.token, callId, "rejected")

      // Log call rejected event
      await CallLogAPI.logCallEvent(authState.token, callId, "one-to-one", "call_rejected", {})

      // Navigate back
      navigation.goBack()
    } catch (error) {
      console.error("Error rejecting call:", error)
      navigation.goBack()
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

  // Enhanced: Get call status text with calling vs ringing distinction
  const getCallStatusText = () => {
    switch (callState) {
      case "initializing":
        return "Initializing..."
      case "connecting":
        return "Connecting..."
      case "calling":
        return "Calling..." // For offline users
      case "ringing":
        return isIncoming ? "Incoming call..." : "Ringing..." // For online users
      case "ongoing":
        if (isReconnecting) return "Reconnecting..."
        return formatDuration(callDuration)
      case "ended":
        if (callEndReason === "rejected") return "Call rejected"
        if (callEndReason === "remote_ended") return "Call ended by recipient"
        if (callEndReason === "no_answer") return "No answer"
        if (callEndReason === "user_offline") return "User is offline"
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: "#000000" }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Call Header */}
      <View style={styles.callHeader}>
        <TouchableOpacity
          style={styles.minimizeButton}
          onPress={() => {
            if (callState === "ongoing") {
              // Show confirmation dialog before ending ongoing call
              Alert.alert("End Call", "Are you sure you want to end this call?", [
                { text: "Cancel", style: "cancel" },
                { text: "End Call", style: "destructive", onPress: () => handleEndCall("user_ended") },
              ])
            } else {
              handleEndCall("user_ended")
            }
          }}
        >
          <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        {callState === "ongoing" && (
          <View style={styles.callQualityContainer}>
            <View style={[styles.qualityIndicator, { backgroundColor: getQualityColor() }]} />
            {isReconnecting && <Text style={styles.reconnectingText}>Reconnecting...</Text>}
          </View>
        )}

        {callType === "video" && isVideoEnabled && callState === "ongoing" && (
          <TouchableOpacity style={styles.cameraToggleButton} onPress={toggleCamera}>
            <Ionicons name="camera-reverse" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Call Content */}
      <View style={styles.callContent}>
        {callType === "video" && (isVideoEnabled || isRemoteVideoEnabled) && callState === "ongoing" ? (
          // Video call view
          <View style={styles.videoContainer}>
            {/* Remote video (full screen) */}
            {remoteStream && isRemoteVideoEnabled ? (
              <RTCView streamURL={remoteStream.toURL()} style={styles.remoteVideo} objectFit="cover" />
            ) : (
              <View style={styles.remoteVideoPlaceholder}>
                {receiverProfilePic ? (
                  <Image
                    source={{ uri: `${API_BASE_URL_FOR_MEDIA}${receiverProfilePic}` }}
                    style={styles.remoteUserImage}
                  />
                ) : (
                  <View style={styles.defaultRemoteUserImage}>
                    <Text style={styles.defaultImageText}>{receiverName?.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Local video (picture-in-picture) */}
            {localStream && isVideoEnabled ? (
              <RTCView streamURL={localStream.toURL()} style={styles.localVideo} objectFit="cover" zOrder={1} />
            ) : (
              <View style={styles.localVideoPlaceholder}>
                <Ionicons name="videocam-off" size={20} color="#FFFFFF" />
              </View>
            )}
          </View>
        ) : (
          // Audio call view
          <View style={styles.audioCallContainer}>
            {receiverProfilePic ? (
              <Image source={{ uri: `${API_BASE_URL_FOR_MEDIA}${receiverProfilePic}` }} style={styles.callerImage} />
            ) : (
              <View style={styles.defaultCallerImage}>
                <Text style={styles.defaultCallerImageText}>{receiverName?.charAt(0).toUpperCase()}</Text>
              </View>
            )}

            <Text style={styles.callerName}>{receiverName}</Text>
            <Text style={styles.callStatus}>{getCallStatusText()}</Text>

            {/* Enhanced: Show online status indicator */}
            {receiverOnlineStatus && callState !== "ongoing" && (
              <Text style={styles.onlineStatusText}>
                {receiverOnlineStatus === "online" ? "Online" : "Last seen recently"}
              </Text>
            )}
          </View>
        )}
      </View>

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
        </View>
      ) : isIncoming && callState === "ringing" ? (
        // Incoming call controls
        <View style={styles.incomingCallControls}>
          <TouchableOpacity style={[styles.incomingCallButton, styles.rejectButton]} onPress={rejectCall}>
            <Ionicons name="call" size={30} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
            <Text style={styles.incomingButtonText}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.incomingCallButton, styles.acceptButton]} onPress={answerCall}>
            <Ionicons name="call" size={30} color="#FFFFFF" />
            <Text style={styles.incomingButtonText}>Accept</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* End Call Button (only show for ongoing or outgoing calls) */}
      {(callState === "ongoing" || ((callState === "ringing" || callState === "calling") && !isIncoming)) && (
        <View style={styles.endCallContainer}>
          <TouchableOpacity style={styles.endCallButton} onPress={() => handleEndCall("user_ended")}>
            <Ionicons name="call" size={30} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
          </TouchableOpacity>
        </View>
      )}

      {/* Audio Route Selector Modal */}
      <AudioRouteSelector
        visible={showAudioRouteSelector}
        onClose={() => setShowAudioRouteSelector(false)}
        onRouteSelected={(route) => {
          setIsSpeakerOn(route === "speaker")
          // Log audio route change
          if (callId) {
            CallLogAPI.logCallEvent(authState.token, callId, "one-to-one", "audio_route_changed", { newRoute: route })
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
    padding: 15,
  },
  minimizeButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
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
  onlineStatusText: {
    color: "#4CAF50",
    fontSize: 14,
    marginTop: 5,
  },
  videoContainer: {
    width: width,
    height: height - 200, // Adjust based on your UI
    position: "relative",
  },
  remoteVideo: {
    width: "100%",
    height: "100%",
    backgroundColor: "#333333",
  },
  remoteVideoPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#333333",
    justifyContent: "center",
    alignItems: "center",
  },
  remoteUserImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  defaultRemoteUserImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#128C7E",
    justifyContent: "center",
    alignItems: "center",
  },
  defaultImageText: {
    color: "#FFFFFF",
    fontSize: 50,
    fontWeight: "bold",
  },
  localVideo: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 100,
    height: 150,
    backgroundColor: "#555555",
    borderRadius: 10,
  },
  localVideoPlaceholder: {
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
})

export default CallScreen
