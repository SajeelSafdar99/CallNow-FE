"use client" // This directive is for Next.js, not typically used in React Native

import { useState, useEffect, useRef, useContext, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  SafeAreaView,
  Dimensions,
  Alert,
  PermissionsAndroid,
  AppState,
  ActivityIndicator,
} from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import Ionicons from "react-native-vector-icons/Ionicons" // Ensure this is installed
import { AuthContext } from "../../context/AuthContext"
import { SocketContext } from "../../context/SocketContext"
import { ThemeContext } from "../../context/ThemeContext"
import { getTheme } from "../../utils/theme"
import * as CallAPI from "../../api/call"
import * as CallLogAPI from "../../api/call-log"
import * as IceServerAPI from "../../api/ice-server"
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  mediaDevices,
} from "react-native-webrtc" // Ensure this is installed and linked
import { check, request, PERMISSIONS, RESULTS } from "react-native-permissions" // Ensure this is installed
import NetInfo from "@react-native-community/netinfo" // Ensure this is installed
import AudioManager from "../../utils/audio-manager" // Ensure this utility exists and works
import AudioRouteSelector from "../../components/calls/AudioRouteSelector" // Ensure this component exists

const { width, height } = Dimensions.get("window")

const CallScreen = () => {
  const navigation = useNavigation()
  const route = useRoute()

  console.log("[CallScreen] Component mounted. Route Params:", JSON.stringify(route.params))

  const {
    receiverId: initialReceiverId,
    receiverName: initialReceiverName,
    receiverProfilePic: initialReceiverProfilePic,
    callerInfo: initialCallerInfo, // Should contain { id, name, profilePicture }
    callType: initialCallType = "audio", // "audio" or "video"
    isIncoming: initialIsIncoming = false,
    callId: initialCallIdFromParams, // Provided for incoming calls
    offer: initialOffer, // Provided for incoming calls
    targetDeviceId: initialTargetDeviceId, // Provided for incoming calls
  } = route.params || {}

  const { state: authState } = useContext(AuthContext)
  const { getSocket } = useContext(SocketContext)
  const { theme } = useContext(ThemeContext) || { theme: "light" }
  const currentTheme = getTheme(theme)

  const [callState, setCallState] = useState("initializing")
  const [callDuration, setCallDuration] = useState(0)
  const [callEndReason, setCallEndReason] = useState(null)
  const [callId, setCallId] = useState(initialCallIdFromParams)

  const [currentPeer, setCurrentPeer] = useState(
    initialIsIncoming
      ? initialCallerInfo
      : { id: initialReceiverId, name: initialReceiverName, profilePicture: initialReceiverProfilePic },
  )
  const [receiverOnlineStatus, setReceiverOnlineStatus] = useState(null)
  const [receiverActiveDevice, setReceiverActiveDevice] = useState(initialIsIncoming ? initialTargetDeviceId : null)

  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeakerOn, setIsSpeakerOn] = useState(initialCallType === "video")
  const [isVideoEnabled, setIsVideoEnabled] = useState(initialCallType === "video")
  const [isFrontCamera, setIsFrontCamera] = useState(true)
  const [isRemoteVideoEnabled, setIsRemoteVideoEnabled] = useState(initialCallType === "video")

  const [networkType, setNetworkType] = useState(null)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [callQuality, setCallQuality] = useState("good")

  const peerConnectionRef = useRef(null)
  const callTimerRef = useRef(null)
  const qualityMonitorRef = useRef(null)
  const iceServersRef = useRef([])
  const appStateRef = useRef(AppState.currentState)
  const isCallEndingRef = useRef(false)

  const localStreamRef = useRef(localStream)
  useEffect(() => {
    localStreamRef.current = localStream
  }, [localStream])

  const callStateRef = useRef(callState)
  useEffect(() => {
    callStateRef.current = callState
  }, [callState])

  const callIdRef = useRef(callId)
  useEffect(() => {
    callIdRef.current = callId
  }, [callId])

  const currentPeerRef = useRef(currentPeer)
  useEffect(() => {
    currentPeerRef.current = currentPeer
  }, [currentPeer])

  const isReconnectingRef = useRef(isReconnecting)
  useEffect(() => {
    isReconnectingRef.current = isReconnecting
  }, [isReconnecting])

  const requestMediaPermissions = useCallback(async () => {
    console.log("CallScreen: Requesting media permissions. Call type:", initialCallType)
    if (Platform.OS === "android") {
      try {
        const permissionsToRequest = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO]
        if (initialCallType === "video") {
          permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.CAMERA)
        }
        const statuses = await PermissionsAndroid.requestMultiple(permissionsToRequest)
        const audioGranted =
          statuses[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED
        const cameraGranted =
          initialCallType === "video"
            ? statuses[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED
            : true
        console.log("CallScreen: Android Permissions - Audio:", audioGranted, "Camera:", cameraGranted)
        return audioGranted && cameraGranted
      } catch (err) {
        console.error("CallScreen: Error requesting Android permissions:", err)
        return false
      }
    } else {
      try {
        let micStatus = await check(PERMISSIONS.IOS.MICROPHONE)
        if (micStatus !== RESULTS.GRANTED) micStatus = await request(PERMISSIONS.IOS.MICROPHONE)
        let camStatus = RESULTS.GRANTED
        if (initialCallType === "video") {
          camStatus = await check(PERMISSIONS.IOS.CAMERA)
          if (camStatus !== RESULTS.GRANTED) camStatus = await request(PERMISSIONS.IOS.CAMERA)
        }
        console.log("CallScreen: iOS Permissions - Mic:", micStatus, "Cam:", camStatus)
        return micStatus === RESULTS.GRANTED && camStatus === RESULTS.GRANTED
      } catch (err) {
        console.error("CallScreen: Error requesting iOS permissions:", err)
        return false
      }
    }
  }, [initialCallType])

  const setupLocalMediaStream = useCallback(async () => {
    console.log(
      "CallScreen: Setting up local media stream. Video:",
      initialCallType === "video",
      "FrontCam:",
      isFrontCamera,
    )
    try {
      const constraints = {
        audio: true,
        video:
          initialCallType === "video"
            ? {
              facingMode: isFrontCamera ? "user" : "environment",
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 },
              frameRate: { ideal: 30, max: 30 },
            }
            : false,
      }
      const stream = await mediaDevices.getUserMedia(constraints)
      console.log("CallScreen: Local media stream obtained.")
      setLocalStream(stream)
      return stream
    } catch (error) {
      console.error("CallScreen: Error getting user media:", error)
      Alert.alert("Media Error", "Failed to access camera or microphone. Please check permissions.")
      throw error
    }
  }, [initialCallType, isFrontCamera])

  const cleanupResources = useCallback(() => {
    console.log("CallScreen: Cleaning up WebRTC and Audio resources.")
    if (callTimerRef.current) clearInterval(callTimerRef.current)
    if (qualityMonitorRef.current) clearInterval(qualityMonitorRef.current)
    AudioManager.stopAllSounds().catch((e) => console.error("CallScreen: Error stopping sounds", e))
    AudioManager.cleanup().catch((e) => console.error("CallScreen: Error cleaning AudioManager", e))
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
      console.log("CallScreen: Local stream tracks stopped.")
      setLocalStream(null)
      localStreamRef.current = null
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
      console.log("CallScreen: Peer connection closed.")
    }
    setRemoteStream(null)
  }, [])

  const endCallHandler = useCallback(
    async (reason = "user_ended", details = {}) => {
      if (isCallEndingRef.current) {
        console.log("CallScreen (endCallHandler): Already ending, reason:", reason)
        return
      }
      isCallEndingRef.current = true
      console.log(
        `CallScreen (endCallHandler): Initiating. Reason: ${reason}, Call ID: ${callIdRef.current || "N/A"}`,
        details,
      )
      setCallState("ended")
      setCallEndReason(reason)
      cleanupResources()
      const currentSocket = getSocket()
      if (
        currentSocket &&
        currentSocket.connected &&
        callIdRef.current &&
        reason !== "remote_ended" &&
        reason !== "rejected_by_other_device"
      ) {
        console.log("CallScreen (endCallHandler): Emitting 'end-call' to peer:", currentPeerRef.current?.id)
        currentSocket.emit("end-call", { callId: callIdRef.current, recipientId: currentPeerRef.current?.id, reason })
      }
      if (callIdRef.current && authState.token) {
        let callStatusForApi = "completed"
        const failureReasons = [
          "permissions_denied",
          "media_setup_failed",
          "pc_creation_failed",
          "initiate_api_failed",
          "initiate_failed_exception",
          "setup_exception",
          "pc_not_ready_on_accept",
          "accept_processing_failed",
          "answer_failed_missing_data",
          "answer_processing_failed",
          "network_error",
          "ice_failed_permanently",
        ]
        const rejectionReasons = ["rejected_by_user", "rejected_by_other_device", "busy"]
        const missedReasons = ["no_answer", "user_offline", "call_timeout"]
        if (rejectionReasons.includes(reason)) callStatusForApi = reason
        else if (missedReasons.includes(reason)) callStatusForApi = reason
        else if (failureReasons.includes(reason)) callStatusForApi = "failed"
        else if (reason === "user_ended" && callDuration === 0 && !initialIsIncoming) callStatusForApi = "cancelled"
        else if (reason === "user_ended" && callDuration === 0 && initialIsIncoming)
          callStatusForApi = "rejected_by_user"
        console.log(
          `CallScreen (endCallHandler): Updating API status to '${callStatusForApi}' for callId ${callIdRef.current}`,
        )
        try {
          await CallAPI.updateCallStatus(authState.token, callIdRef.current, callStatusForApi, new Date().toISOString())
          await CallLogAPI.logCallEvent(
            authState.token,
            callIdRef.current,
            initialCallType === "group" ? "group" : "one-to-one",
            "call_ended",
            { duration: callDuration, reason, ...details },
          )
        } catch (apiError) {
          console.error("CallScreen (endCallHandler): API error during call end:", apiError)
        }
      }
      setTimeout(() => {
        if (navigation.canGoBack()) {
          navigation.goBack()
        } else {
          navigation.replace("AppTabs", { screen: "Chats" })
        }
      }, 500)
    },
    [callDuration, initialIsIncoming, initialCallType, authState.token, getSocket, cleanupResources, navigation],
  )

  const initializePeerConnection = useCallback(
    async (streamForPC) => {
      if (!iceServersRef.current || iceServersRef.current.length === 0) {
        console.warn("CallScreen (initializePeerConnection): ICE servers not fetched. Using default.")
        iceServersRef.current = [{ urls: "stun:stun.l.google.com:19302" }]
      }
      console.log(
        "CallScreen (initializePeerConnection): Creating PC with ICE servers:",
        JSON.stringify(iceServersRef.current),
      )
      try {
        const pc = new RTCPeerConnection({ iceServers: iceServersRef.current, iceCandidatePoolSize: 10 })
        if (streamForPC) {
          streamForPC.getTracks().forEach((track) => pc.addTrack(track, streamForPC))
          console.log("CallScreen (initializePeerConnection): Local tracks added.")
        }
        pc.onicecandidate = ({ candidate }) => {
          const currentActiveSocket = getSocket()
          if (candidate && currentActiveSocket && currentActiveSocket.connected && callIdRef.current) {
            console.log(
              "CallScreen (initializePeerConnection): Sending ICE candidate to peer:",
              currentPeerRef.current?.id,
            )
            currentActiveSocket.emit("send-ice-candidate", {
              callId: callIdRef.current,
              candidate,
              recipientId: currentPeerRef.current?.id,
            })
          }
        }
        pc.oniceconnectionstatechange = () => {
          console.log("CallScreen (initializePeerConnection): ICE state:", pc.iceConnectionState)
          if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
            if (callStateRef.current === "ongoing" && !isReconnectingRef.current) {
              console.log("CallScreen (initializePeerConnection): ICE failed/disconnected, attempting restart.")
              attemptIceRestartHandler()
            }
          } else if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
            if (isReconnectingRef.current) setIsReconnecting(false)
          }
        }
        pc.ontrack = (event) => {
          console.log("CallScreen (initializePeerConnection): Remote track received.", event.streams)
          if (event.streams && event.streams[0]) {
            setRemoteStream(event.streams[0])
            setIsRemoteVideoEnabled(
              event.streams[0].getVideoTracks().length > 0 && event.streams[0].getVideoTracks().some((t) => t.enabled),
            )
          } else {
            const newStream = new MediaStream()
            newStream.addTrack(event.track)
            setRemoteStream(newStream)
            setIsRemoteVideoEnabled(
              newStream.getVideoTracks().length > 0 && newStream.getVideoTracks().some((t) => t.enabled),
            )
          }
        }
        peerConnectionRef.current = pc
        console.log("CallScreen (initializePeerConnection): PeerConnection created.")
        return pc
      } catch (error) {
        console.error("CallScreen (initializePeerConnection): Error creating PC:", error)
        endCallHandler("pc_creation_failed", { error: error.message })
        throw error
      }
    },
    [getSocket, endCallHandler],
  ) // attemptIceRestartHandler will be defined later

  const attemptIceRestartHandler = useCallback(async () => {
    if (peerConnectionRef.current && callStateRef.current === "ongoing" && !isReconnectingRef.current) {
      console.log("CallScreen (attemptIceRestartHandler): Initiating ICE restart.")
      setIsReconnecting(true)
      try {
        const offer = await peerConnectionRef.current.createOffer({ iceRestart: true })
        await peerConnectionRef.current.setLocalDescription(offer)
        const currentActiveSocket = getSocket()
        if (currentActiveSocket && currentActiveSocket.connected && callIdRef.current) {
          currentActiveSocket.emit("request-ice-restart", {
            callId: callIdRef.current,
            callType: initialCallType,
            recipientId: currentPeerRef.current?.id,
            offer: offer,
          })
          if (authState.token)
            CallLogAPI.logCallEvent(
              authState.token,
              callIdRef.current,
              "one-to-one",
              "ice_restart_initiated",
              {},
            ).catch((e) => console.error("Log API Error", e))
        }
      } catch (error) {
        console.error("CallScreen (attemptIceRestartHandler): Error during ICE restart:", error)
        setIsReconnecting(false)
      }
    } else {
      console.log("CallScreen (attemptIceRestartHandler): Conditions not met for ICE restart.")
    }
  }, [getSocket, initialCallType, authState.token])

  const startOutgoingCallHandler = useCallback(
    async (streamForCall) => {
      console.log("CallScreen (startOutgoingCallHandler): Initiating for receiver:", initialReceiverId)
      setCallState("connecting")
      try {
        console.log(
          `[CallScreen Outgoing] Initializing. ReceiverID: ${initialReceiverId}, CallType: ${initialCallType}`,
        )
        console.log(`[CallScreen Outgoing] Auth User for callerInfo:`, JSON.stringify(authState.user))

        const currentActiveSocket = getSocket()
        let targetDeviceForCall = null
        let resolvedReceiverOnlineStatus = "offline"
        if (currentActiveSocket && currentActiveSocket.connected) {
          console.log(
            "CallScreen (startOutgoingCallHandler): Socket connected, checking user status for:",
            initialReceiverId,
          )
          currentActiveSocket.emit("check-user-status", { userId: initialReceiverId })
          const statusResponse = await new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
              currentActiveSocket.off("user-status-response", handleStatusResponseForCall)
              resolve({ status: "offline", activeDevice: null, isOnline: false, error: "timeout" })
            }, 7000)
            const handleStatusResponseForCall = ({ userId, status, activeDevice, isOnline }) => {
              if (userId === initialReceiverId) {
                clearTimeout(timeoutId)
                currentActiveSocket.off("user-status-response", handleStatusResponseForCall)
                resolve({ status, activeDevice, isOnline })
              }
            }
            currentActiveSocket.on("user-status-response", handleStatusResponseForCall)
          })
          console.log("CallScreen (startOutgoingCallHandler): Receiver status response:", statusResponse)
          setReceiverOnlineStatus(statusResponse.status)
          setReceiverActiveDevice(statusResponse.activeDevice)
          targetDeviceForCall = statusResponse.activeDevice
          resolvedReceiverOnlineStatus = statusResponse.status
          if (statusResponse.isOnline) {
            setCallState("ringing")
            AudioManager.startRingback().catch((e) => console.error("AudioManager Error", e))
          } else {
            setCallState("calling")
          }
        } else {
          setCallState("calling")
          console.warn("CallScreen (startOutgoingCallHandler): Socket not connected.")
        }
        if (!peerConnectionRef.current) {
          await initializePeerConnection(streamForCall)
        }
        if (!peerConnectionRef.current) throw new Error("PC failed to init before offer.")
        const offer = await peerConnectionRef.current.createOffer()
        await peerConnectionRef.current.setLocalDescription(offer)
        console.log("CallScreen (startOutgoingCallHandler): Offer created and set local desc.")
        const callApiData = {
          receiverId: initialReceiverId,
          callType: initialCallType,
          targetDeviceId: targetDeviceForCall,
        }
        console.log("CallScreen (startOutgoingCallHandler): Calling CallAPI.initiateCall:", callApiData)
        const response = await CallAPI.initiateCall(
          authState.token,
          callApiData.receiverId,
          callApiData.callType,
          callApiData.targetDeviceId,
        )
        console.log("CallScreen (startOutgoingCallHandler): CallAPI.initiateCall response:", response)
        if (response.success && response.call?._id) {
          const newCallId = response.call._id
          setCallId(newCallId)
          if (currentActiveSocket && currentActiveSocket.connected) {
            const callPayload = {
              callId: newCallId,
              receiverId: initialReceiverId,
              targetDeviceId: targetDeviceForCall,
              offer,
              callType: initialCallType,
              callerInfo: {
                id: authState.user.id,
                name: authState.user.name || "Caller",
                profilePicture: authState.user.profilePicture || "",
              },
            }
            console.log(
              "[CallScreen Outgoing] Emitting 'initiate-call' via socket. Payload:",
              JSON.stringify(callPayload),
            )
            currentActiveSocket.emit("initiate-call", callPayload)
          }
          if (authState.token)
            CallLogAPI.logCallEvent(authState.token, newCallId, "one-to-one", "call_initiated", {
              callType: initialCallType,
              targetDevice: targetDeviceForCall,
              receiverStatus: resolvedReceiverOnlineStatus,
            }).catch((e) => console.error("Log API Error", e))
          const timeoutDuration = resolvedReceiverOnlineStatus === "online" ? 45000 : 30000
          const timeoutReason = resolvedReceiverOnlineStatus === "online" ? "no_answer" : "user_offline"
          console.log(
            `CallScreen (startOutgoingCallHandler): Setting timeout: ${timeoutDuration}ms, reason: ${timeoutReason}`,
          )
          setTimeout(() => {
            if (callStateRef.current === "ringing" || callStateRef.current === "calling") {
              console.log(`CallScreen (startOutgoingCallHandler): Call timed out (${timeoutReason}).`)
              endCallHandler(timeoutReason)
            }
          }, timeoutDuration)
        } else {
          console.error("CallScreen (startOutgoingCallHandler): API initiate call failed:", response.message)
          endCallHandler("initiate_api_failed", { message: response.message })
        }
      } catch (error) {
        console.error("CallScreen (startOutgoingCallHandler): Error:", error)
        endCallHandler("initiate_failed_exception", { error: error.message })
      }
    },
    [
      getSocket,
      initialReceiverId,
      initialCallType,
      authState.token,
      authState.user,
      initializePeerConnection,
      endCallHandler,
    ],
  )

  useEffect(() => {
    let isMounted = true
    console.log("CallScreen: Main setup. Incoming:", initialIsIncoming, "CallIdParam:", initialCallIdFromParams)
    const setupCall = async () => {
      console.log(
        `[CallScreen Setup] Initializing call. IsIncoming: ${initialIsIncoming}, CallID from params: ${initialCallIdFromParams}, CallerInfo from params: ${JSON.stringify(initialCallerInfo)}, Offer from params: ${!!initialOffer}`,
      )

      try {
        setCallState("initializing")
        const permissionsGranted = await requestMediaPermissions()
        if (!isMounted || !permissionsGranted) {
          if (isMounted)
            Alert.alert("Permissions Denied", "Cannot start call.", [
              { text: "OK", onPress: () => endCallHandler("permissions_denied") },
            ])
          return
        }
        console.log("CallScreen: Media permissions granted.")
        await AudioManager.initializeAudioSession(initialCallType === "video", initialIsIncoming)
        console.log("CallScreen: Audio session initialized.")
        const stream = await setupLocalMediaStream()
        if (!isMounted || !stream) {
          if (isMounted) endCallHandler("media_setup_failed")
          return
        }
        console.log("CallScreen: Local media stream ready.")
        if (authState.token) {
          try {
            const iceResp = await IceServerAPI.getIceServers(authState.token)
            iceServersRef.current =
              iceResp.success && iceResp.iceServers.length > 0
                ? iceResp.iceServers
                : [{ urls: "stun:stun.l.google.com:19302" }]
            console.log("CallScreen: ICE servers fetched/set:", JSON.stringify(iceServersRef.current))
          } catch (iceError) {
            console.warn("CallScreen: Failed to fetch ICE servers, using default.", iceError)
            iceServersRef.current = [{ urls: "stun:stun.l.google.com:19302" }]
          }
        } else {
          iceServersRef.current = [{ urls: "stun:stun.l.google.com:19302" }]
        }
        if (initialIsIncoming) {
          console.log("CallScreen: Handling incoming call flow. Call ID:", initialCallIdFromParams)
          if (!initialCallIdFromParams || !initialOffer || !initialCallerInfo?.id) {
            console.error("CallScreen: Missing data for incoming call. Params:", route.params) // Added more logging
            endCallHandler("setup_failed_missing_data_incoming")
            // DO NOT return here yet if you want to set state to ringing first for UI
          }

          // Set callState to ringing EARLY for incoming calls if basic params are present
          // This allows UI to show accept/decline buttons sooner.
          // The actual media setup will still happen below.
          if (initialCallIdFromParams && initialOffer && initialCallerInfo?.id) {
            setCallState("ringing")
            console.log("CallScreen: State set to 'ringing' for incoming call.")
            // AudioManager.startRingtone().catch(e => console.error("AudioManager Error", e)); // You might want to start ringtone here too
          } else {
            // If critical params are missing even for ringing state, then end.
            console.error(
              "CallScreen: Critical data missing for incoming call, cannot proceed to ringing state. Params:",
              route.params,
            )
            endCallHandler("setup_failed_missing_data_incoming_critical")
            return // Exit setupCall if critical data is missing
          }

          // The rest of the setup (permissions, media, ICE) will continue from here.
          // If permissions or media fail later, acceptIncomingCallHandler or declineIncomingCallHandler
          // will handle it or the call will fail during WebRTC setup.
        } else {
          // Outgoing call logic (this part remains unchanged)
          console.log("CallScreen: Initiating outgoing call flow.")
          // Ensure stream is passed to startOutgoingCallHandler if it's initialized before this else block
          // For now, assuming 'stream' is initialized before this 'else' or within startOutgoingCallHandler
          await startOutgoingCallHandler(stream) // 'stream' should be defined from setupLocalMediaStream call
        }
      } catch (error) {
        console.error("CallScreen: Error in main setup:", error)
        if (isMounted) endCallHandler("setup_exception", { error: error.message })
      }
    }
    setupCall()
    const netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      setNetworkType(state.type)
      if (!state.isConnected && callStateRef.current === "ongoing" && !isReconnectingRef.current) {
        attemptIceRestartHandler()
      } else if (state.isConnected && isReconnectingRef.current) {
        setIsReconnecting(false)
      }
    })
    const appStateSubscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active" &&
        callStateRef.current === "ongoing"
      ) {
        if (
          peerConnectionRef.current &&
          (peerConnectionRef.current.iceConnectionState === "disconnected" ||
            peerConnectionRef.current.iceConnectionState === "failed")
        ) {
          attemptIceRestartHandler()
        }
      }
      appStateRef.current = nextAppState
    })
    return () => {
      isMounted = false
      console.log("CallScreen: Unmounting. Call state:", callStateRef.current)
      if (callStateRef.current !== "ended" && callStateRef.current !== "initializing" && !isCallEndingRef.current) {
        endCallHandler("unmount")
      } else {
        cleanupResources()
      }
      netInfoUnsubscribe()
      appStateSubscription.remove()
    }
  }, [])

  const handleCallAcceptedByPeer = useCallback(
    async ({ callId: acceptedCallId, answer, acceptedBy }) => {
      if (
        callIdRef.current === acceptedCallId &&
        (callStateRef.current === "ringing" || callStateRef.current === "calling")
      ) {
        console.log("CallScreen (handleCallAcceptedByPeer): Accepted by:", acceptedBy, "Answer:", !!answer)
        try {
          if (!peerConnectionRef.current) {
            if (localStreamRef.current) await initializePeerConnection(localStreamRef.current)
            if (!peerConnectionRef.current) {
              endCallHandler("pc_not_ready_on_accept", { detail: "PC failed init" })
              return
            }
          }
          if (!answer) {
            endCallHandler("accept_failed_no_answer_sdp")
            return
          }
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer))
          console.log("CallScreen (handleCallAcceptedByPeer): Remote desc (answer) set.")
          setCallState("ongoing")
          AudioManager.stopRingback().catch((e) => console.error("AudioManager Error", e))
          if (callTimerRef.current) clearInterval(callTimerRef.current)
          setCallDuration(0)
          callTimerRef.current = setInterval(() => setCallDuration((prev) => prev + 1), 1000)
          startCallQualityMonitoringHandler()
          if (authState.token) {
            CallAPI.updateCallStatus(authState.token, callIdRef.current, "ongoing").catch((e) =>
              console.error("API Error", e),
            )
            CallLogAPI.logCallEvent(authState.token, callIdRef.current, "one-to-one", "call_connected", {
              acceptedByDevice: acceptedBy?.deviceId,
            }).catch((e) => console.error("Log API Error", e))
          }
        } catch (error) {
          console.error("CallScreen (handleCallAcceptedByPeer): Error:", error)
          endCallHandler("accept_processing_failed", { error: error.message })
        }
      } else {
        console.log("CallScreen (handleCallAcceptedByPeer): Event for irrelevant call/state.")
      }
    },
    [authState.token, endCallHandler, initializePeerConnection, startCallQualityMonitoringHandler],
  )

  const handleCallRejectedByPeer = useCallback(
    ({ callId: rejectedCallId, reason, deviceId }) => {
      if (
        callIdRef.current === rejectedCallId &&
        (callStateRef.current === "ringing" || callStateRef.current === "calling")
      ) {
        console.log("CallScreen (handleCallRejectedByPeer): Rejected by peer. Reason:", reason, "Device:", deviceId)
        endCallHandler(reason || "rejected_by_other_device", { rejectedByDeviceId: deviceId })
      }
    },
    [endCallHandler],
  )

  const handleCallEndedByPeer = useCallback(
    ({ callId: endedCallId, reason }) => {
      if (callIdRef.current === endedCallId && callStateRef.current !== "ended") {
        console.log("CallScreen (handleCallEndedByPeer): Ended by peer. Reason:", reason)
        endCallHandler(reason || "remote_ended")
      }
    },
    [endCallHandler],
  )

  const handleRemoteIceCandidate = useCallback(async ({ callId: iceCallId, candidate }) => {
    if (callIdRef.current === iceCallId && peerConnectionRef.current && candidate) {
      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (error) {
        console.warn("CallScreen (handleRemoteIceCandidate): Error adding remote ICE:", error.message)
      }
    }
  }, [])

  const handlePeerUserCameOnline = useCallback(({ userId, deviceId: onlineUserDeviceId }) => {
    if (userId === currentPeerRef.current?.id && callStateRef.current === "calling") {
      console.log("CallScreen (handlePeerUserCameOnline): Peer online:", userId, "Device:", onlineUserDeviceId)
      setReceiverOnlineStatus("online")
      setReceiverActiveDevice(onlineUserDeviceId)
      setCallState("ringing")
      AudioManager.startRingback().catch((e) => console.error("AudioManager Error", e))
    }
  }, [])

  const handlePeerUserStatusResponse = useCallback(({ userId, status, activeDevice, isOnline }) => {
    if (userId === currentPeerRef.current?.id) {
      console.log("CallScreen (handlePeerUserStatusResponse): Peer status:", status, activeDevice, isOnline)
      setReceiverOnlineStatus(status)
      setReceiverActiveDevice(activeDevice)
    }
  }, [])

  const handleIceRestartRequestFromPeer = useCallback(
    async ({ callId: restartCallId, offer }) => {
      if (callIdRef.current === restartCallId && callStateRef.current === "ongoing" && peerConnectionRef.current) {
        console.log("CallScreen (handleIceRestartRequestFromPeer): ICE restart requested by peer.")
        setIsReconnecting(true)
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer))
          const answer = await peerConnectionRef.current.createAnswer()
          await peerConnectionRef.current.setLocalDescription(answer)
          const currentActiveSocket = getSocket()
          if (currentActiveSocket && currentActiveSocket.connected) {
            currentActiveSocket.emit("answer-ice-restart", {
              callId: callIdRef.current,
              recipientId: currentPeerRef.current?.id,
              answer,
            })
          }
          if (authState.token)
            CallLogAPI.logCallEvent(authState.token, callIdRef.current, "one-to-one", "ice_restart_answered", {}).catch(
              (e) => console.error("Log API Error", e),
            )
        } catch (error) {
          console.error("CallScreen (handleIceRestartRequestFromPeer): Error:", error)
          setIsReconnecting(false)
        }
      }
    },
    [getSocket, authState.token],
  )

  const handleVideoStateChangedByPeer = useCallback(({ callId: eventCallId, isVideoEnabled: remoteVideoState }) => {
    if (callIdRef.current === eventCallId) {
      console.log(`CallScreen: Peer video state changed to: ${remoteVideoState}`)
      setIsRemoteVideoEnabled(remoteVideoState)
    }
  }, [])

  useEffect(() => {
    const currentActiveSocket = getSocket()
    let isSubscribed = true
    if (currentActiveSocket && currentActiveSocket.connected) {
      console.log("CallScreen: Attaching socket listeners.")
      const listeners = {
        "call-accepted": handleCallAcceptedByPeer,
        "call-rejected": handleCallRejectedByPeer,
        "call-ended": handleCallEndedByPeer,
        "ice-candidate-received": handleRemoteIceCandidate,
        "user-came-online": handlePeerUserCameOnline,
        "user-status-response": handlePeerUserStatusResponse,
        "ice-restart-requested": handleIceRestartRequestFromPeer,
        "video-state-changed": handleVideoStateChangedByPeer,
      }
      Object.entries(listeners).forEach(([event, handler]) => currentActiveSocket.on(event, handler))
      return () => {
        if (isSubscribed) {
          console.log("CallScreen: Detaching socket listeners.")
          Object.entries(listeners).forEach(([event, handler]) => currentActiveSocket.off(event, handler))
        }
      }
    } else {
      console.log("CallScreen: Socket not available for listeners yet.")
    }
    return () => {
      isSubscribed = false
    }
  }, [
    getSocket,
    handleCallAcceptedByPeer,
    handleCallRejectedByPeer,
    handleCallEndedByPeer,
    handleRemoteIceCandidate,
    handlePeerUserCameOnline,
    handlePeerUserStatusResponse,
    handleIceRestartRequestFromPeer,
    handleVideoStateChangedByPeer,
  ])

  const startCallQualityMonitoringHandler = useCallback(() => {
    if (qualityMonitorRef.current) clearInterval(qualityMonitorRef.current)
    qualityMonitorRef.current = setInterval(async () => {
      if (peerConnectionRef.current && callStateRef.current === "ongoing") {
        try {
          const stats = await peerConnectionRef.current.getStats()
          const metricsData = processRtcStatsForQuality(stats)
          updateCallQualityIndicator(metricsData)
          if (callIdRef.current && authState.token)
            CallLogAPI.logCallEvent(authState.token, callIdRef.current, "one-to-one", "quality_metrics", {
              metrics: metricsData,
            }).catch((e) => console.error("Log API Error", e))
        } catch (error) {
          console.warn("CallScreen (startCallQualityMonitoringHandler): Error getting WebRTC stats:", error.message)
        }
      }
    }, 10000)
  }, [authState.token, processRtcStatsForQuality, updateCallQualityIndicator])

  const processRtcStatsForQuality = useCallback(
    (stats) => {
      let rtt = 0,
        jitter = 0,
        audioPacketLoss = 0,
        videoPacketLoss = 0,
        audioLevel = 0
      let videoBitrateIn = 0,
        audioBitrateIn = 0,
        videoBitrateOut = 0,
        audioBitrateOut = 0
      let frameRate = 0,
        frameWidth = 0,
        frameHeight = 0
      const iceConnectionState = peerConnectionRef.current?.iceConnectionState
      stats.forEach((report) => {
        if (report.type === "inbound-rtp") {
          if (report.kind === "audio") {
            jitter = report.jitter ?? jitter
            audioPacketLoss = report.packetsLost ?? audioPacketLoss
            audioLevel = report.audioLevel ?? audioLevel
            audioBitrateIn = report.bytesReceived ? (report.bytesReceived * 8) / 1000 : audioBitrateIn
          } else if (report.kind === "video") {
            videoPacketLoss = report.packetsLost ?? videoPacketLoss
            frameRate = report.framesPerSecond ?? frameRate
            frameWidth = report.frameWidth ?? frameWidth
            frameHeight = report.frameHeight ?? frameHeight
            videoBitrateIn = report.bytesReceived ? (report.bytesReceived * 8) / 1000 : videoBitrateIn
          }
        } else if (report.type === "outbound-rtp") {
          if (report.kind === "audio")
            audioBitrateOut = report.bytesSent ? (report.bytesSent * 8) / 1000 : audioBitrateOut
          else if (report.kind === "video")
            videoBitrateOut = report.bytesSent ? (report.bytesSent * 8) / 1000 : videoBitrateOut
        } else if (report.type === "candidate-pair" && report.state === "succeeded" && report.nominated) {
          rtt = report.currentRoundTripTime ? report.currentRoundTripTime * 1000 : rtt
        }
      })
      const audioQualityScore = calculateAudioQualityScore(rtt, jitter, audioPacketLoss)
      const videoQualityScore =
        initialCallType === "video"
          ? calculateVideoQualityScore(rtt, jitter, videoPacketLoss, frameRate, videoBitrateIn)
          : 5
      return {
        timestamp: new Date().toISOString(),
        rtt,
        jitter,
        audioPacketLoss,
        videoPacketLoss,
        audioLevel,
        bitrateIn: { audio: audioBitrateIn, video: videoBitrateIn },
        bitrateOut: { audio: audioBitrateOut, video: videoBitrateOut },
        frameRate,
        resolution: { width: frameWidth, height: frameHeight },
        iceConnectionState,
        connectionType: networkType,
        qualityScore: { audio: audioQualityScore, video: videoQualityScore },
      }
    },
    [initialCallType, networkType],
  )

  const calculateAudioQualityScore = (rtt, jitter, packetLoss) => 5
  const calculateVideoQualityScore = (rtt, jitter, packetLoss, frameRate, bitrate) => 5

  const updateCallQualityIndicator = useCallback(
    (metrics) => {
      if (!metrics.qualityScore) return
      const overallScore = Math.min(
        metrics.qualityScore.audio,
        initialCallType === "video" ? metrics.qualityScore.video : 5,
      )
      if (overallScore >= 4) setCallQuality("good")
      else if (overallScore >= 2) setCallQuality("fair")
      else setCallQuality("poor")
    },
    [initialCallType],
  )

  const toggleMute = useCallback(async () => {
    try {
      const newMuteState = !isMuted
      const success = await AudioManager.setMicrophoneMute(newMuteState)
      if (success) {
        setIsMuted(newMuteState)
        if (callIdRef.current && authState.token)
          CallLogAPI.logCallEvent(
            authState.token,
            callIdRef.current,
            "one-to-one",
            newMuteState ? "muted" : "unmuted",
            {},
          ).catch((e) => console.error("Log API Error", e))
      } else Alert.alert("Audio Error", "Failed to toggle microphone.")
    } catch (error) {
      console.error("CallScreen (toggleMute): Error:", error)
      Alert.alert("Audio Error", "An error occurred while toggling mute.")
    }
  }, [isMuted, authState.token])

  const toggleSpeakerphone = useCallback(async () => {
    try {
      const result = await AudioManager.toggleSpeaker()
      if (result.success) {
        setIsSpeakerOn(result.isSpeakerOn)
        if (callIdRef.current && authState.token)
          CallLogAPI.logCallEvent(
            authState.token,
            callIdRef.current,
            "one-to-one",
            result.isSpeakerOn ? "speaker_on" : "speaker_off",
            { audioRoute: AudioManager.getCurrentAudioRoute() },
          ).catch((e) => console.error("Log API Error", e))
      } else Alert.alert("Audio Error", "Failed to toggle speaker.")
    } catch (error) {
      console.error("CallScreen (toggleSpeakerphone): Error:", error)
      Alert.alert("Audio Error", "An error occurred while toggling speaker.")
    }
  }, [isSpeakerOn, authState.token])

  const toggleLocalVideo = useCallback(async () => {
    if (!localStreamRef.current || initialCallType !== "video") return
    const videoTracks = localStreamRef.current.getVideoTracks()
    if (videoTracks.length > 0) {
      const newVideoState = !isVideoEnabled
      videoTracks.forEach((track) => (track.enabled = newVideoState))
      setIsVideoEnabled(newVideoState)
      const currentActiveSocket = getSocket()
      if (currentActiveSocket && currentActiveSocket.connected && callIdRef.current) {
        currentActiveSocket.emit("video-state-changed", {
          callId: callIdRef.current,
          recipientId: currentPeerRef.current?.id,
          isVideoEnabled: newVideoState,
        })
      }
      if (callIdRef.current && authState.token)
        CallLogAPI.logCallEvent(
          authState.token,
          callIdRef.current,
          "one-to-one",
          newVideoState ? "video_enabled" : "video_disabled",
          {},
        ).catch((e) => console.error("Log API Error", e))
    } else if (!isVideoEnabled) {
      console.log("CallScreen (toggleLocalVideo): No video track, re-setup stream with video.")
      try {
        const newStreamWithVideo = await setupLocalMediaStream()
        if (peerConnectionRef.current && newStreamWithVideo) {
          const videoTrack = newStreamWithVideo.getVideoTracks()[0]
          const senders = peerConnectionRef.current.getSenders()
          const videoSender = senders.find((s) => s.track?.kind === "video")
          if (videoSender && videoTrack) await videoSender.replaceTrack(videoTrack)
          else if (videoTrack) peerConnectionRef.current.addTrack(videoTrack, newStreamWithVideo)
          setLocalStream(newStreamWithVideo)
          setIsVideoEnabled(true)
        }
      } catch (error) {
        console.error("CallScreen (toggleLocalVideo): Error re-enabling video:", error)
        Alert.alert("Video Error", "Could not enable video.")
      }
    }
  }, [isVideoEnabled, initialCallType, authState.token, getSocket, setupLocalMediaStream])

  const switchCamera = useCallback(async () => {
    if (localStreamRef.current && isVideoEnabled && initialCallType === "video") {
      const videoTracks = localStreamRef.current.getVideoTracks()
      if (videoTracks.length > 0) {
        videoTracks.forEach((track) => track._switchCamera())
        setIsFrontCamera((prev) => !prev)
        if (callIdRef.current && authState.token)
          CallLogAPI.logCallEvent(
            authState.token,
            callIdRef.current,
            "one-to-one",
            !isFrontCamera ? "camera_switched_to_front" : "camera_switched_to_back",
            {},
          ).catch((e) => console.error("Log API Error", e))
      }
    }
  }, [isVideoEnabled, initialCallType, authState.token, isFrontCamera])

  const acceptIncomingCallHandler = useCallback(async () => {
    if (!initialIsIncoming || !initialOffer || !callIdRef.current) {
      endCallHandler("answer_failed_missing_data")
      return
    }
    console.log("CallScreen (acceptIncomingCallHandler): Answering call:", callIdRef.current)
    setCallState("connecting")
    AudioManager.stopRingtone().catch((e) => console.error("AudioManager Error", e))
    try {
      let stream = localStreamRef.current
      if (!stream) stream = await setupLocalMediaStream()
      if (!stream) throw new Error("Local stream not available for answer.")
      let pc = peerConnectionRef.current
      if (!pc) pc = await initializePeerConnection(stream)
      if (!pc) throw new Error("PC failed to init for answer.")
      await pc.setRemoteDescription(new RTCSessionDescription(initialOffer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      console.log("CallScreen (acceptIncomingCallHandler): Answer created, local desc set.")
      const currentActiveSocket = getSocket()
      if (currentActiveSocket && currentActiveSocket.connected) {
        currentActiveSocket.emit("accept-call", {
          callId: callIdRef.current,
          callerId: currentPeerRef.current?.id,
          answer,
          deviceId: authState.user?.deviceId,
        })
      } else {
        throw new Error("Socket not connected to send answer.")
      }
      setCallState("ongoing")
      if (callTimerRef.current) clearInterval(callTimerRef.current)
      setCallDuration(0)
      callTimerRef.current = setInterval(() => setCallDuration((prev) => prev + 1), 1000)
      startCallQualityMonitoringHandler()
      if (authState.token) {
        CallAPI.updateCallStatus(authState.token, callIdRef.current, "ongoing").catch((e) =>
          console.error("API Error", e),
        )
        CallLogAPI.logCallEvent(authState.token, callIdRef.current, "one-to-one", "call_answered", {
          answeredByDevice: authState.user?.deviceId,
        }).catch((e) => console.error("Log API Error", e))
      }
    } catch (error) {
      console.error("CallScreen (acceptIncomingCallHandler): Error:", error)
      endCallHandler("answer_processing_failed", { error: error.message })
    }
  }, [
    initialIsIncoming,
    initialOffer,
    authState.user?.deviceId,
    authState.token,
    getSocket,
    setupLocalMediaStream,
    initializePeerConnection,
    endCallHandler,
    startCallQualityMonitoringHandler,
  ])

  const declineIncomingCallHandler = useCallback(async () => {
    if (!initialIsIncoming || !callIdRef.current) {
      endCallHandler("reject_failed_missing_data")
      return
    }
    console.log("CallScreen (declineIncomingCallHandler): Rejecting call:", callIdRef.current)
    AudioManager.stopRingtone().catch((e) => console.error("AudioManager Error", e))
    const currentActiveSocket = getSocket()
    if (currentActiveSocket && currentActiveSocket.connected) {
      currentActiveSocket.emit("reject-call", {
        callId: callIdRef.current,
        callerId: currentPeerRef.current?.id,
        deviceId: authState.user?.deviceId,
        reason: "rejected_by_user",
      })
    }
    endCallHandler("rejected_by_user")
  }, [initialIsIncoming, authState.user?.deviceId, getSocket, endCallHandler])

  const formatCallDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const getCallStatusDisplay = () => {
    switch (callStateRef.current) {
      case "initializing":
        return "Initializing..."
      case "connecting":
        return "Connecting..."
      case "calling":
        return "Calling..."
      case "ringing":
        return initialIsIncoming ? "Incoming call..." : "Ringing..."
      case "ongoing":
        return isReconnectingRef.current ? "Reconnecting..." : formatCallDuration(callDuration)
      case "ended":
        if (callEndReason === "rejected_by_user" || callEndReason === "rejected_by_other_device") return "Call Rejected"
        if (callEndReason === "remote_ended") return "Call Ended"
        if (callEndReason === "no_answer") return "No Answer"
        if (callEndReason === "user_offline") return "User Offline"
        if (callEndReason === "call_timeout") return "Call Timed Out"
        if (callEndReason === "cancelled") return "Call Cancelled"
        if (callEndReason?.includes("failed") || callEndReason === "error") return "Call Failed"
        return "Call Ended"
      default:
        return ""
    }
  }

  const qualityIndicatorColor = () => {
    if (isReconnectingRef.current) return "#FFA500"
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

  const [isAudioRouteSelectorVisible, setIsAudioRouteSelectorVisible] = useState(false)
  const peerDisplayName = currentPeer?.name || (initialIsIncoming ? "Unknown Caller" : initialReceiverName || "Contact")
  const peerDisplayProfilePic = currentPeer?.profilePicture // Handled by Image component source

  if (callState === "initializing" && !isCallEndingRef.current) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.background }]}>
        <StatusBar barStyle={currentTheme.statusBar || "dark-content"} />
        <View style={styles.centeredStatus}>
          <ActivityIndicator size="large" color={currentTheme.primary} />
          <Text style={[styles.statusText, { color: currentTheme.text }]}>Initializing Call...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeAreaBlack}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.callHeader}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => endCallHandler("user_ended_via_minimize_or_header")}
        >
          <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        {callStateRef.current === "ongoing" && (
          <View style={styles.callQualityContainer}>
            <View style={[styles.qualityIndicatorDot, { backgroundColor: qualityIndicatorColor() }]} />
            {isReconnectingRef.current && <Text style={styles.reconnectingText}>Reconnecting...</Text>}
          </View>
        )}
        {initialCallType === "video" && isVideoEnabled && callStateRef.current === "ongoing" && (
          <TouchableOpacity style={styles.headerButton} onPress={switchCamera}>
            <Ionicons name="camera-reverse-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.callContent}>
        {initialCallType === "video" && callStateRef.current === "ongoing" ? (
          <View style={styles.videoContainer}>
            {remoteStream && isRemoteVideoEnabled ? (
              <RTCView streamURL={remoteStream.toURL()} style={styles.remoteVideo} objectFit="cover" mirror={false} />
            ) : (
              <View style={styles.videoPlaceholder}>{/* Placeholder logic from user's file */}</View>
            )}
            {localStream && isVideoEnabled && (
              <RTCView
                streamURL={localStream.toURL()}
                style={styles.localVideo}
                objectFit="cover"
                mirror={isFrontCamera}
                zOrder={1}
              />
            )}
          </View>
        ) : (
          <View style={styles.audioCallContainer}>
            {/* Placeholder logic from user's file */}
            <Text style={styles.callerName}>{peerDisplayName}</Text>
            <Text style={styles.callStatusText}>{getCallStatusDisplay()}</Text>
            {receiverOnlineStatus && callStateRef.current !== "ongoing" && callStateRef.current !== "ended" && (
              <Text
                style={[styles.onlineStatusText, { color: receiverOnlineStatus === "online" ? "#4CAF50" : "#CCCCCC" }]}
              >
                {receiverOnlineStatus === "online" ? "Online" : "Offline"}
              </Text>
            )}
          </View>
        )}
      </View>
      {callStateRef.current === "ongoing" && (
        <View style={styles.ongoingCallControls}>
          <TouchableOpacity style={[styles.controlButton, isMuted && styles.activeControlButton]} onPress={toggleMute}>
            <Ionicons name={isMuted ? "mic-off-outline" : "mic-outline"} size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {initialCallType === "video" && (
            <TouchableOpacity
              style={[styles.controlButton, !isVideoEnabled && styles.activeControlButton]}
              onPress={toggleLocalVideo}
            >
              <Ionicons name={isVideoEnabled ? "videocam-outline" : "videocam-off-outline"} size={28} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.controlButton, isSpeakerOn && styles.activeControlButton]}
            onPress={toggleSpeakerphone}
            onLongPress={() => setIsAudioRouteSelectorVisible(true)}
          >
            <Ionicons name={isSpeakerOn ? "volume-high-outline" : "volume-medium-outline"} size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
      {initialIsIncoming && callStateRef.current === "ringing" && (
        <View style={styles.incomingCallActionsContainer}>
          <View style={styles.incomingCallButtonWrapper}>
            <TouchableOpacity
              style={[styles.incomingActionButton, styles.rejectButton]}
              onPress={declineIncomingCallHandler}
            >
              <Ionicons name="close" size={30} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.incomingActionText}>Decline</Text>
          </View>
          <View style={styles.incomingCallButtonWrapper}>
            <TouchableOpacity
              style={[styles.incomingActionButton, styles.acceptButton]}
              onPress={acceptIncomingCallHandler}
            >
              <Ionicons name="call" size={30} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.incomingActionText}>Accept</Text>
          </View>
        </View>
      )}
      {(callStateRef.current === "ongoing" ||
        ((callStateRef.current === "ringing" || callStateRef.current === "calling") && !initialIsIncoming)) && (
        <View style={styles.endCallButtonContainer}>
          <TouchableOpacity style={styles.mainEndCallButton} onPress={() => endCallHandler("user_ended")}>
            <Ionicons name="call" size={30} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
          </TouchableOpacity>
        </View>
      )}
      <AudioRouteSelector
        visible={isAudioRouteSelectorVisible}
        onClose={() => setIsAudioRouteSelectorVisible(false)}
        onRouteSelected={async (route) => {
          setIsAudioRouteSelectorVisible(false)
          const success = await AudioManager.setAudioRoute(route)
          if (success) {
            setIsSpeakerOn(AudioManager.getCurrentAudioRoute() === "speaker")
            if (callIdRef.current && authState.token)
              CallLogAPI.logCallEvent(authState.token, callIdRef.current, "one-to-one", "audio_route_changed", {
                newRoute: route,
              }).catch((e) => console.error("Log API Error", e))
          }
        }}
        currentRoute={AudioManager.getCurrentAudioRoute()}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeAreaBlack: { flex: 1, backgroundColor: "#000000" },
  container: { flex: 1 },
  centeredStatus: { flex: 1, justifyContent: "center", alignItems: "center" },
  statusText: { marginTop: 10, fontSize: 16, color: "#FFFFFF" }, // Assuming dark theme for loading
  callHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 10 : 20,
    paddingBottom: 10,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerButton: { padding: 8 },
  callQualityContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  qualityIndicatorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  reconnectingText: { color: "#FFA500", fontSize: 12, fontWeight: "bold" },
  callContent: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" },
  audioCallContainer: { alignItems: "center", paddingHorizontal: 20 },
  callerImage: { width: 140, height: 140, borderRadius: 70, marginBottom: 20 },
  defaultCallerImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#2C2C2E",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  defaultCallerImageText: { color: "#FFFFFF", fontSize: 60, fontWeight: "bold" },
  callerName: { color: "#FFFFFF", fontSize: 28, fontWeight: "600", marginBottom: 8, textAlign: "center" },
  callStatusText: { color: "#AEAEB2", fontSize: 18, marginBottom: 8, textAlign: "center" },
  onlineStatusText: { fontSize: 14, marginTop: 5, fontWeight: "500" },
  videoContainer: { width: "100%", height: "100%", position: "relative", backgroundColor: "#000" },
  remoteVideo: { flex: 1 },
  videoPlaceholder: { flex: 1, backgroundColor: "#1C1C1E", justifyContent: "center", alignItems: "center" },
  placeholderImage: { width: 150, height: 150, borderRadius: 75 },
  defaultPlaceholderImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#2C2C2E",
    justifyContent: "center",
    alignItems: "center",
  },
  defaultPlaceholderText: { color: "#FFFFFF", fontSize: 60, fontWeight: "bold" },
  videoPausedText: {
    color: "#FFFFFF",
    position: "absolute",
    bottom: 30,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    fontSize: 14,
  },
  localVideo: {
    position: "absolute",
    top: Platform.OS === "android" ? StatusBar.currentHeight + 70 : 80,
    right: 15,
    width: width * 0.25,
    height: height * 0.2,
    backgroundColor: "#333333",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
  },
  ongoingCallControls: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: "rgba(28, 28, 30, 0.85)",
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    borderRadius: 25,
  },
  controlButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  activeControlButton: { backgroundColor: "rgba(255, 255, 255, 0.3)" },
  endCallButtonContainer: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 30 : 20,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  mainEndCallButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  incomingCallActionsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-start",
    width: "100%",
    paddingHorizontal: 40,
    position: "absolute",
    bottom: Platform.OS === "ios" ? 60 : 40,
  },
  incomingCallButtonWrapper: { alignItems: "center" },
  incomingActionButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  rejectButton: { backgroundColor: "#FF3B30" },
  acceptButton: { backgroundColor: "#34C759" },
  incomingActionText: { color: "#FFFFFF", fontSize: 13, fontWeight: "500" },
})

export default CallScreen
