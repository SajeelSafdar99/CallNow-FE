"use client"

import { useState, useEffect, useRef, useContext, useCallback, useMemo } from "react"
import {
  StyleSheet,
  Platform,
  SafeAreaView,
  Dimensions,
  Alert,
  PermissionsAndroid,
  AppState,
  StatusBar,
  View,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Image,
} from "react-native"
import { useNavigation, useRoute, useIsFocused } from "@react-navigation/native"
import { AuthContext } from "../../context/AuthContext"
import { SocketContext } from "../../context/SocketContext"
import { ThemeContext } from "../../context/ThemeContext"
import { getTheme } from "../../utils/theme"
import * as CallAPI from "../../api/call"
import * as CallLogAPI from "../../api/call-log"
import * as IceServerAPI from "../../api/ice-server"
import { recordCallQualityMetrics } from "../../api/call-quality" // Import the new function
import { RTCPeerConnection, RTCSessionDescription, MediaStream, mediaDevices, RTCView } from "react-native-webrtc"
import { check, request, PERMISSIONS, RESULTS } from "react-native-permissions"
import NetInfo from "@react-native-community/netinfo"
import AudioManager from "../../utils/audio-manager"
import Ionicons from "react-native-vector-icons/Ionicons"
import AudioRouteSelector from "../../components/calls/AudioRouteSelector"

const { width, height } = Dimensions.get("window")

const CallScreen = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const isScreenFocused = useIsFocused()

  const instanceIdRef = useRef(Math.random().toString(36).substring(7))
  const activeCallAttemptKeyRef = useRef(null)
  const isCallEndingRef = useRef(false)
  const backNavigationConfirmedRef = useRef(false) // To track if user confirmed back navigation

  console.log(
    `[CallScreen][${instanceIdRef.current}] Component instance CREATED/RE-RENDERED. Route Params:`,
    JSON.stringify(route.params),
    `IsFocused: ${isScreenFocused}, Initial isCallEndingRef: ${isCallEndingRef.current}`,
  )

  const {
    receiverId: initialReceiverId,
    receiverName: initialReceiverName,
    receiverProfilePic: initialReceiverProfilePic,
    callerInfo: initialCallerInfo,
    callType: initialCallType = "audio",
    isIncoming: initialIsIncoming = false,
    isPreAccepted: initialIsPreAccepted = false,
    callId: initialCallIdFromParams,
    offer: initialOffer,
    targetDeviceId: initialTargetDeviceId,
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
    initialIsIncoming || initialIsPreAccepted
      ? initialCallerInfo
      : {
        id: initialReceiverId,
        name: initialReceiverName,
        profilePicture: initialReceiverProfilePic,
      },
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
  const [isRemoteMuted, setIsRemoteMuted] = useState(false)

  const [networkType, setNetworkType] = useState(null)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [callQuality, setCallQuality] = useState("good")

  const peerConnectionRef = useRef(null)
  const callTimerRef = useRef(null)
  const qualityMonitorRef = useRef(null)
  const iceServersRef = useRef([])
  const appStateRef = useRef(AppState.currentState)
  const outgoingCallTimeoutRef = useRef(null)

  const localStreamRef = useRef(localStream)
  useEffect(() => {
    localStreamRef.current = localStream
  }, [localStream])

  const remoteStreamRef = useRef(remoteStream)
  useEffect(() => {
    remoteStreamRef.current = remoteStream
  }, [remoteStream])

  const callStateRef = useRef(callState)
  useEffect(() => {
    callStateRef.current = callState
    // ActiveCallContext related logic removed
  }, [callState])

  const callDurationRef = useRef(callDuration)
  useEffect(() => {
    callDurationRef.current = callDuration
    // ActiveCallContext related logic removed
  }, [callDuration])

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

  const networkTypeRef = useRef(networkType)
  useEffect(() => {
    networkTypeRef.current = networkType
  }, [networkType])

  const isSpeakerOnRef = useRef(isSpeakerOn)
  useEffect(() => {
    isSpeakerOnRef.current = isSpeakerOn
  }, [isSpeakerOn])

  useEffect(() => {
    const unsubscribeFocus = navigation.addListener("focus", () => {
      console.log(
        `[CallScreen][${instanceIdRef.current}] FOCUSED. Call ID: ${callIdRef.current}, State: ${callStateRef.current}, Ending: ${isCallEndingRef.current}, AttemptKey: ${activeCallAttemptKeyRef.current}`,
      )
      backNavigationConfirmedRef.current = false // Reset confirmation on focus
    })
    const unsubscribeBlur = navigation.addListener("blur", () => {
      console.log(
        `[CallScreen][${instanceIdRef.current}] BLURRED. Call ID: ${callIdRef.current}, State: ${callStateRef.current}, Ending: ${isCallEndingRef.current}, AttemptKey: ${activeCallAttemptKeyRef.current}`,
      )
    })
    return () => {
      unsubscribeFocus()
      unsubscribeBlur()
    }
  }, [navigation])

  const requestMediaPermissions = useCallback(
    async (currentAttemptKey) => {
      if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) {
        console.log(
          `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] requestMediaPermissions: Aborting due to call ending or stale attempt.`,
        )
        return false
      }
      console.log(
        `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] Requesting media permissions. Call type:`,
        initialCallType,
      )
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
          console.log(
            `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] Android Permissions - Audio:`,
            audioGranted,
            "Camera:",
            cameraGranted,
          )
          return audioGranted && cameraGranted
        } catch (err) {
          console.error(
            `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] Error requesting Android permissions:`,
            err,
          )
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
          console.log(
            `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] iOS Permissions - Mic:`,
            micStatus,
            "Cam:",
            camStatus,
          )
          return micStatus === RESULTS.GRANTED && camStatus === RESULTS.GRANTED
        } catch (err) {
          console.error(
            `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] Error requesting iOS permissions:`,
            err,
          )
          return false
        }
      }
    },
    [initialCallType],
  )

  const setupLocalMediaStream = useCallback(
    async (currentAttemptKey) => {
      if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) {
        console.log(
          `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] setupLocalMediaStream: Aborting due to call ending or stale attempt.`,
        )
        throw new Error("Call ending or stale attempt during media setup")
      }
      console.log(
        `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] Setting up local media stream. Video:`,
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
        console.log(`[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] Local media stream obtained.`)
        setLocalStream(stream)
        return stream
      } catch (error) {
        console.error(`[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] Error getting user media:`, error)
        Alert.alert("Media Error", "Failed to access camera or microphone. Please check permissions.")
        throw error
      }
    },
    [initialCallType, isFrontCamera],
  )

  const cleanupResources = useCallback(
    (isFullCleanup = true) => {
      const attemptKeyAtCleanup = activeCallAttemptKeyRef.current
      console.log(
        `[CallScreen][${instanceIdRef.current}][${attemptKeyAtCleanup}] cleanupResources: Cleaning up. Full cleanup: ${isFullCleanup}.`,
      )

      if (callTimerRef.current) {
        clearInterval(callTimerRef.current)
        callTimerRef.current = null
      }
      if (qualityMonitorRef.current) {
        clearInterval(qualityMonitorRef.current)
        qualityMonitorRef.current = null
      }

      AudioManager.stopAllSounds().catch((e) =>
        console.error(
          `[CallScreen][${instanceIdRef.current}][${attemptKeyAtCleanup}] cleanupResources: Error stopping sounds`,
          e,
        ),
      )

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop())
        console.log(
          `[CallScreen][${instanceIdRef.current}][${attemptKeyAtCleanup}] cleanupResources: Local stream tracks stopped.`,
        )
        setLocalStream(null)
      }

      if (isFullCleanup) {
        if (outgoingCallTimeoutRef.current) {
          clearTimeout(outgoingCallTimeoutRef.current)
          outgoingCallTimeoutRef.current = null
        }
        AudioManager.cleanup().catch((e) =>
          console.error(
            `[CallScreen][${instanceIdRef.current}][${attemptKeyAtCleanup}] cleanupResources: Error cleaning AudioManager`,
            e,
          ),
        )

        if (remoteStreamRef.current) {
          remoteStreamRef.current.getTracks().forEach((track) => track.stop())
          console.log(
            `[CallScreen][${instanceIdRef.current}][${attemptKeyAtCleanup}] cleanupResources: Remote stream tracks stopped.`,
          )
          setRemoteStream(null)
        }

        if (peerConnectionRef.current) {
          peerConnectionRef.current.close()
          peerConnectionRef.current = null
          console.log(
            `[CallScreen][${instanceIdRef.current}][${attemptKeyAtCleanup}] cleanupResources: Peer connection closed.`,
          )
        }
        // ActiveCallContext related logic removed
      } else {
        console.log(
          `[CallScreen][${instanceIdRef.current}][${attemptKeyAtCleanup}] cleanupResources: Partial cleanup. Peer connection and remote stream preserved if active.`,
        )
      }
    },
    [
      /* ActiveCallContext related dependencies removed */
    ],
  )

  const endCallHandler = useCallback(
    async (reason = "user_ended", details = {}) => {
      const attemptKeyAtEnd = activeCallAttemptKeyRef.current
      console.log(
        `[CallScreen][${instanceIdRef.current}][${attemptKeyAtEnd}] endCallHandler ENTERED. Current isCallEndingRef: ${isCallEndingRef.current}. Reason: ${reason}, Call ID: ${callIdRef.current || "N/A"}`,
        details,
      )
      if (isCallEndingRef.current && reason !== "unmount" && reason !== "user_ended_via_back_navigation") {
        console.log(
          `[CallScreen][${instanceIdRef.current}][${attemptKeyAtEnd}] endCallHandler: Already ending call. New reason: ${reason}. Aborting.`,
        )
        if (
          reason !== "unmount" ||
          (callStateRef.current === "ended" && details.detail?.includes("useEffect cleanup"))
        ) {
          return
        }
      }
      isCallEndingRef.current = true
      console.log(
        `[CallScreen][${instanceIdRef.current}][${attemptKeyAtEnd}] endCallHandler: Set isCallEndingRef=true. Proceeding to end call. Reason: ${reason}`,
      )

      setCallState("ended")
      setCallEndReason(reason)

      if (outgoingCallTimeoutRef.current) {
        clearTimeout(outgoingCallTimeoutRef.current)
        outgoingCallTimeoutRef.current = null
      }

      const currentSocket = getSocket()
      if (
        currentSocket &&
        currentSocket.connected &&
        callIdRef.current &&
        reason !== "remote_ended" &&
        reason !== "rejected_by_other_device" &&
        reason !== "unmount_due_to_remote_end" &&
        reason !== "missed_due_to_unmount_while_ringing" &&
        reason !== "session_terminated_by_peer" &&
        reason !== "unmount" &&
        reason !== "user_ended_via_back_navigation" && // Don't emit if ending due to confirmed back nav
        reason !== "missed_preaccepted_unmount"
      ) {
        console.log(
          `[CallScreen][${instanceIdRef.current}][${attemptKeyAtEnd}] endCallHandler: Emitting 'end-call' for reason: ${reason}`,
        )
        currentSocket.emit("end-call", {
          callId: callIdRef.current,
          recipientId: currentPeerRef.current?.id,
          reason,
        })
      } else {
        console.log(
          `[CallScreen][${instanceIdRef.current}][${attemptKeyAtEnd}] endCallHandler: NOT emitting 'end-call'. Reason: ${reason}, SocketConnected: ${currentSocket?.connected}, CallID: ${callIdRef.current}`,
        )
      }

      cleanupResources(true)

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
          "setup_failed_missing_data_incoming",
          "setup_failed_missing_data_incoming_critical",
          "reject_failed_missing_data",
          "answer_call_failed",
        ]
        const rejectionReasons = ["rejected_by_user", "rejected_by_other_device", "busy"]
        const missedReasons = [
          "no_answer",
          "user_offline",
          "call_timeout",
          "missed_due_to_unmount_while_ringing",
          "missed_preaccepted_unmount",
        ]

        if (rejectionReasons.includes(reason)) {
          callStatusForApi = reason
        } else if (missedReasons.includes(reason)) {
          callStatusForApi = reason
        } else if (failureReasons.includes(reason)) {
          callStatusForApi = "failed"
        } else if (
          (reason === "user_ended" || reason === "user_ended_via_back_navigation") &&
          callDurationRef.current === 0 &&
          !(initialIsIncoming || initialIsPreAccepted)
        ) {
          callStatusForApi = "cancelled"
        } else if (
          (reason === "user_ended" || reason === "user_ended_via_back_navigation") &&
          callDurationRef.current === 0 &&
          (initialIsIncoming || initialIsPreAccepted)
        ) {
          callStatusForApi = "rejected_by_user"
        } else if (reason === "unmount") {
          if (callDurationRef.current > 0) {
            callStatusForApi = "completed"
          } else if (initialIsIncoming || initialIsPreAccepted) {
            callStatusForApi =
              details.detail?.includes("missed_due_to_unmount_while_ringing") ||
              details.detail?.includes("missed_preaccepted_unmount")
                ? reason
                : "missed"
          } else {
            callStatusForApi = "cancelled"
          }
        }

        console.log(
          `[CallScreen][${instanceIdRef.current}][${attemptKeyAtEnd}] endCallHandler: Updating API status to '${callStatusForApi}' for callId ${callIdRef.current}`,
        )
        try {
          await CallAPI.updateCallStatus(authState.token, callIdRef.current, callStatusForApi, new Date().toISOString())
          await CallLogAPI.logCallEvent(
            authState.token,
            callIdRef.current,
            initialCallType === "group" ? "group" : "one-to-one",
            "call_ended",
            {
              duration: callDurationRef.current,
              reason,
              finalStatus: callStatusForApi,
              ...details,
            },
          )
        } catch (apiError) {
          console.error(
            `[CallScreen][${instanceIdRef.current}][${attemptKeyAtEnd}] endCallHandler: API error during call end:`,
            apiError,
          )
        }
      }

      // Navigation is handled by 'beforeRemove' or direct unmount.
      // If endCallHandler is called for other reasons (e.g., remote end), and navigation is desired:
      if (reason !== "user_ended_via_back_navigation" && reason !== "unmount") {
        if (navigation.getState()?.routes.find((r) => r.name === route.name)) {
          console.log(
            `[CallScreen][${instanceIdRef.current}][${attemptKeyAtEnd}] endCallHandler: Scheduling navigation back for non-back-nav/unmount reason: ${reason}`,
          )
          setTimeout(() => {
            if (navigation.canGoBack()) {
              navigation.goBack()
            } else {
              navigation.replace("Main", { screen: "Chats" })
            }
          }, 300)
        }
      }
    },
    [
      initialIsIncoming,
      initialIsPreAccepted,
      initialCallType,
      authState.token,
      getSocket,
      cleanupResources,
      navigation,
      route.name,
    ],
  )

  // Back navigation handler
  useEffect(() => {
    const onBeforeRemove = (e) => {
      const isActiveCall = ["ongoing", "connecting", "ringing", "calling"].includes(callStateRef.current)

      if (!isActiveCall || isCallEndingRef.current || backNavigationConfirmedRef.current) {
        console.log(
          `[CallScreen][${instanceIdRef.current}] onBeforeRemove: Allowing navigation. isActiveCall: ${isActiveCall}, isCallEndingRef: ${isCallEndingRef.current}, confirmed: ${backNavigationConfirmedRef.current}`,
        )
        return
      }

      e.preventDefault() // Prevent default action (navigation)

      Alert.alert(
        "End Call?",
        "Going back will end the current call. Are you sure?",
        [
          { text: "Cancel", style: "cancel", onPress: () => {} },
          {
            text: "End Call",
            style: "destructive",
            onPress: () => {
              console.log(`[CallScreen][${instanceIdRef.current}] onBeforeRemove: User confirmed ending call.`)
              backNavigationConfirmedRef.current = true // Mark as confirmed
              if (!isCallEndingRef.current) {
                endCallHandler("user_ended_via_back_navigation")
              }
              // Use a timeout to allow state updates before navigation
              setTimeout(() => {
                if (navigation.canGoBack()) {
                  navigation.dispatch(e.data.action) // Re-dispatch the original navigation action
                } else {
                  navigation.replace("Main", { screen: "Chats" })
                }
              }, 0)
            },
          },
        ],
        { cancelable: true },
      )
    }

    navigation.addListener("beforeRemove", onBeforeRemove)
    return () => {
      navigation.removeListener("beforeRemove", onBeforeRemove)
    }
  }, [navigation, endCallHandler]) // Dependencies: navigation, endCallHandler

  const attemptIceRestartHandler = useCallback(
    async (currentAttemptKey) => {
      if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) {
        console.log(
          `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] attemptIceRestartHandler: Aborting due to call ending or stale attempt.`,
        )
        return
      }
      if (peerConnectionRef.current && callStateRef.current === "ongoing" && !isReconnectingRef.current) {
        console.log(
          `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] attemptIceRestartHandler: Initiating ICE restart.`,
        )
        setIsReconnecting(true)
        try {
          const offer = await peerConnectionRef.current.createOffer({
            iceRestart: true,
          })
          await peerConnectionRef.current.setLocalDescription(offer)

          const currentActiveSocket = getSocket()
          if (currentActiveSocket && currentActiveSocket.connected && callIdRef.current) {
            currentActiveSocket.emit("request-ice-restart", {
              callId: callIdRef.current,
              callType: initialCallType,
              recipientId: currentPeerRef.current?.id,
              offer: offer,
            })
            if (authState.token) {
              CallLogAPI.logCallEvent(
                authState.token,
                callIdRef.current,
                initialCallType === "group" ? "group" : "one-to-one",
                "ice_restart_initiated",
                {},
              ).catch((e) => console.error("Log API Error", e))
            }
          }
        } catch (error) {
          console.error(
            `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] attemptIceRestartHandler: Error during ICE restart:`,
            error,
          )
          setIsReconnecting(false)
        }
      } else {
        console.log(
          `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] attemptIceRestartHandler: Conditions not met for ICE restart.`,
        )
      }
    },
    [getSocket, initialCallType, authState.token],
  )

  const initializePeerConnection = useCallback(
    async (streamForPC, currentAttemptKey) => {
      if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) {
        console.log(
          `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] initializePeerConnection: Aborting due to call ending or stale attempt.`,
        )
        throw new Error("Call ending or stale attempt during PC initialization")
      }
      if (!iceServersRef.current || iceServersRef.current.length === 0) {
        console.warn(
          `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] initializePeerConnection: ICE servers not fetched. Using default.`,
        )
        iceServersRef.current = [{ urls: "stun:stun.l.google.com:19302" }]
      }
      console.log(
        `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] initializePeerConnection: Creating PC with ICE servers:`,
        JSON.stringify(iceServersRef.current),
      )

      try {
        const pc = new RTCPeerConnection({
          iceServers: iceServersRef.current,
          iceCandidatePoolSize: 10,
        })

        if (streamForPC) {
          streamForPC.getTracks().forEach((track) => pc.addTrack(track, streamForPC))
        }

        pc.onicecandidate = ({ candidate }) => {
          if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) {
            return
          }
          const currentActiveSocket = getSocket()
          if (candidate && currentActiveSocket && currentActiveSocket.connected && callIdRef.current) {
            currentActiveSocket.emit("send-ice-candidate", {
              callId: callIdRef.current,
              candidate,
              recipientId: currentPeerRef.current?.id,
            })
          }
        }

        pc.oniceconnectionstatechange = () => {
          if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) {
            return
          }
          console.log(
            `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] initializePeerConnection: ICE state:`,
            pc.iceConnectionState,
          )
          if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
            if (callStateRef.current === "ongoing" && !isReconnectingRef.current) {
              attemptIceRestartHandler(currentAttemptKey)
            }
          } else if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
            if (isReconnectingRef.current) {
              setIsReconnecting(false)
            }
          }
        }

        pc.ontrack = (event) => {
          const currentAttemptKeyForOntrack = activeCallAttemptKeyRef.current
          if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKeyForOntrack) {
            console.log(
              `[CallScreen][${instanceIdRef.current}][${currentAttemptKeyForOntrack}] pc.ontrack: Aborting due to call ending or stale attempt. Event for track: ${event.track?.id}`,
            )
            return
          }

          console.log(
            `[CallScreen][${
              instanceIdRef.current
            }][${currentAttemptKeyForOntrack}] pc.ontrack: Received remote track. Kind: ${
              event.track?.kind
            }, ID: ${event.track?.id}, Label: ${event.track?.label}, Enabled: ${
              event.track?.enabled
            }, Muted: ${event.track?.muted}, ReadyState: ${
              event.track?.readyState
            }, Stream IDs: ${event.streams.map((s) => s.id).join(", ")}`,
          )

          if (event.track.kind === "audio") {
            console.log(
              `[CallScreen][${instanceIdRef.current}][${currentAttemptKeyForOntrack}] pc.ontrack: Audio track received. Muted status from track: ${event.track.muted}. Setting isRemoteMuted.`,
            )
          }

          if (event.streams && event.streams[0]) {
            const incomingStream = event.streams[0]
            console.log(
              `[CallScreen][${
                instanceIdRef.current
              }][${currentAttemptKeyForOntrack}] pc.ontrack: Event has stream[0] with ID ${
                incomingStream.id
              }. Tracks: ${incomingStream
                .getTracks()
                .map((t) => `${t.kind}:${t.id} (enabled: ${t.enabled}, muted: ${t.muted})`)
                .join(", ")}`,
            )
            setRemoteStream(incomingStream)
            const hasVideo =
              incomingStream.getVideoTracks().length > 0 && incomingStream.getVideoTracks().some((t) => t.enabled)
            setIsRemoteVideoEnabled(hasVideo)
            console.log(
              `[CallScreen][${instanceIdRef.current}][${currentAttemptKeyForOntrack}] pc.ontrack: Set remote stream from event.streams[0]. Remote video enabled: ${hasVideo}`,
            )
          } else {
            console.log(
              `[CallScreen][${instanceIdRef.current}][${currentAttemptKeyForOntrack}] pc.ontrack: Event does not have stream[0]. Adding track ${event.track.id} (${event.track.kind}) individually.`,
            )
            let currentRemoteStream = remoteStreamRef.current
            if (!currentRemoteStream) {
              console.log(
                `[CallScreen][${instanceIdRef.current}][${currentAttemptKeyForOntrack}] pc.ontrack: No existing remote stream, creating new MediaStream.`,
              )
              currentRemoteStream = new MediaStream()
            }

            const existingTrack = currentRemoteStream.getTrackById(event.track.id)
            if (!existingTrack) {
              currentRemoteStream.addTrack(event.track)
              console.log(
                `[CallScreen][${instanceIdRef.current}][${currentAttemptKeyForOntrack}] pc.ontrack: Added track ${
                  event.track.id
                } to remote stream. Stream now has tracks: ${currentRemoteStream
                  .getTracks()
                  .map((t) => `${t.kind}:${t.id} (enabled: ${t.enabled}, muted: ${t.muted})`)
                  .join(", ")}`,
              )
            } else {
              console.log(
                `[CallScreen][${instanceIdRef.current}][${currentAttemptKeyForOntrack}] pc.ontrack: Track ${event.track.id} already exists in remote stream. Not re-adding.`,
              )
            }

            const newStreamInstance = new MediaStream(currentRemoteStream.getTracks())
            setRemoteStream(newStreamInstance)

            const hasVideo =
              newStreamInstance.getVideoTracks().length > 0 && newStreamInstance.getVideoTracks().some((t) => t.enabled)
            setIsRemoteVideoEnabled(hasVideo)
            console.log(
              `[CallScreen][${instanceIdRef.current}][${currentAttemptKeyForOntrack}] pc.ontrack: Set remote stream from individually added tracks. Remote video enabled: ${hasVideo}`,
            )
          }
        }
        peerConnectionRef.current = pc
        return pc
      } catch (error) {
        console.error(
          `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] initializePeerConnection: Error creating PC:`,
          error,
        )
        if (!isCallEndingRef.current && activeCallAttemptKeyRef.current === currentAttemptKey) {
          endCallHandler("pc_creation_failed", { error: error.message })
        }
        throw error
      }
    },
    [getSocket, endCallHandler, attemptIceRestartHandler],
  )

  const startCallQualityMonitoringHandler = useCallback(
    (currentAttemptKey) => {
      if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) {
        return
      }
      if (qualityMonitorRef.current) {
        clearInterval(qualityMonitorRef.current)
      }
      qualityMonitorRef.current = setInterval(async () => {
        if (
          peerConnectionRef.current &&
          callStateRef.current === "ongoing" &&
          !isCallEndingRef.current &&
          activeCallAttemptKeyRef.current === currentAttemptKey
        ) {
          try {
            const stats = await peerConnectionRef.current.getStats()
            const metricsData = processRtcStatsForQuality(stats)
            updateCallQualityIndicator(metricsData)
            if (callIdRef.current && authState.token) {
              // Use recordCallQualityMetrics instead of CallLogAPI.logCallEvent
              recordCallQualityMetrics(
                authState.token,
                callIdRef.current,
                initialCallType === "group" ? "group" : "one-to-one",
                {
                  metrics: metricsData, // Ensure metricsData is in the format expected by your API
                  timestamp: new Date().toISOString(),
                },
              ).catch((e) => console.error("API Error recording quality_metrics", e))
            }
          } catch (error) {
            console.warn(
              `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] startCallQualityMonitoringHandler: Error getting WebRTC stats:`,
              error.message,
            )
          }
        }
      }, 10000)
    },
    [
      authState.token,
      initialCallType /* processRtcStatsForQuality, updateCallQualityIndicator removed as they are stable */,
    ],
  )

  const startOutgoingCallHandler = useCallback(
    async (streamForCall, currentAttemptKey) => {
      if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) {
        console.log(
          `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] startOutgoingCallHandler: Aborting due to call ending or stale attempt.`,
        )
        return
      }
      console.log(
        `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] startOutgoingCallHandler: Initiating for receiver:`,
        initialReceiverId,
      )
      setCallState("connecting")
      try {
        const currentActiveSocket = getSocket()
        let targetDeviceForCall = null
        let resolvedReceiverOnlineStatus = "offline"

        if (currentActiveSocket && currentActiveSocket.connected) {
          const statusPromise = new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
              currentActiveSocket.off("user-status-response", handleStatusResponseForCall)
              resolve({
                status: "offline",
                activeDevice: null,
                isOnline: false,
                error: "timeout",
              })
            }, 7000)
            const handleStatusResponseForCall = ({ userId, status, activeDevice, isOnline }) => {
              if (userId === initialReceiverId) {
                clearTimeout(timeoutId)
                currentActiveSocket.off("user-status-response", handleStatusResponseForCall)
                resolve({ status, activeDevice, isOnline })
              }
            }
            currentActiveSocket.on("user-status-response", handleStatusResponseForCall)
            currentActiveSocket.emit("check-user-status", {
              userId: initialReceiverId,
            })
          })
          const statusResponse = await statusPromise
          if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) return

          setReceiverOnlineStatus(statusResponse.status)
          setReceiverActiveDevice(statusResponse.activeDevice)
          targetDeviceForCall = statusResponse.activeDevice
          resolvedReceiverOnlineStatus = statusResponse.status

          if (statusResponse.isOnline) {
            setCallState("ringing")
            AudioManager.stopRingtone().catch((e) =>
              console.warn("AudioManager: Error stopping system ringtone before ringback", e),
            )
            AudioManager.startRingback("my_custom_ringback.mav").catch((e) =>
              console.error("AudioManager Error starting custom ringback", e),
            )
          } else {
            setCallState("calling")
          }
        } else {
          setCallState("calling")
        }

        if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) return

        if (!peerConnectionRef.current) {
          await initializePeerConnection(streamForCall, currentAttemptKey)
        }
        if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) return
        if (!peerConnectionRef.current) {
          console.error(
            `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] PC failed to initialize before creating offer.`,
          )
          throw new Error("PC failed to initialize before creating offer.")
        }

        const offer = await peerConnectionRef.current.createOffer()
        if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) return
        await peerConnectionRef.current.setLocalDescription(offer)
        if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) return

        console.log(`[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] Calling CallAPI.initiateCall...`)
        const response = await CallAPI.initiateCall(
          authState.token,
          initialReceiverId,
          initialCallType,
          targetDeviceForCall,
        )
        console.log(
          `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] CallAPI.initiateCall response:`,
          response,
        )

        if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) return

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
            currentActiveSocket.emit("initiate-call", callPayload)
            console.log(
              `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] Emitted 'initiate-call' for callId ${newCallId}`,
            )
          } else {
            console.warn(
              `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] Socket not connected when trying to emit 'initiate-call'.`,
            )
          }

          if (authState.token) {
            CallLogAPI.logCallEvent(
              authState.token,
              newCallId,
              initialCallType === "group" ? "group" : "one-to-one",
              "call_initiated",
              {
                callType: initialCallType,
                targetDevice: targetDeviceForCall,
                receiverStatus: resolvedReceiverOnlineStatus,
              },
            ).catch((e) => console.error("Log API Error for call_initiated", e))
          }

          const timeoutDuration = resolvedReceiverOnlineStatus === "online" ? 45000 : 30000
          const timeoutReason = resolvedReceiverOnlineStatus === "online" ? "no_answer" : "user_offline"
          if (outgoingCallTimeoutRef.current) {
            clearTimeout(outgoingCallTimeoutRef.current)
          }
          outgoingCallTimeoutRef.current = setTimeout(() => {
            if (
              (callStateRef.current === "ringing" || callStateRef.current === "calling") &&
              !isCallEndingRef.current &&
              activeCallAttemptKeyRef.current === currentAttemptKey
            ) {
              console.log(
                `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] Outgoing call timed out. Reason: ${timeoutReason}`,
              )
              endCallHandler(timeoutReason)
            }
          }, timeoutDuration)
        } else {
          console.error(
            `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] CallAPI.initiateCall failed:`,
            response.message,
          )
          if (!isCallEndingRef.current && activeCallAttemptKeyRef.current === currentAttemptKey) {
            endCallHandler("initiate_api_failed", { message: response.message })
          }
        }
      } catch (error) {
        console.error(
          `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] startOutgoingCallHandler: Error:`,
          error,
        )
        if (!isCallEndingRef.current && activeCallAttemptKeyRef.current === currentAttemptKey) {
          endCallHandler("initiate_failed_exception", { error: error.message })
        }
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

  const answerIncomingCall = useCallback(
    async (offerToAnswer, currentAttemptKey) => {
      if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) {
        console.warn(
          `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] answerIncomingCall: Aborting due to call ending or stale attempt. isCallEndingRef: ${isCallEndingRef.current}, activeKey: ${activeCallAttemptKeyRef.current}, currentKey: ${currentAttemptKey}`,
        )
        return
      }
      if (!callIdRef.current || !offerToAnswer) {
        console.error(
          `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] answerIncomingCall: Missing callId or offer.`,
          { callId: callIdRef.current, offer: !!offerToAnswer },
        )
        if (!isCallEndingRef.current && activeCallAttemptKeyRef.current === currentAttemptKey) {
          endCallHandler("answer_failed_missing_data")
        }
        return
      }

      console.log(
        `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] answerIncomingCall: Answering call:`,
        callIdRef.current,
      )
      setCallState("connecting")
      AudioManager.stopAllSounds().catch((e) => console.error("AudioManager Error stopping sounds on answer", e))

      if (!isCallEndingRef.current && activeCallAttemptKeyRef.current === currentAttemptKey) {
        const speakerStateToSet = isSpeakerOnRef.current
        console.log(
          `[CallScreen][${
            instanceIdRef.current
          }][${currentAttemptKey}] Syncing speaker state on 'ongoing' (answered incoming). Desired: ${
            speakerStateToSet ? "speaker" : "earpiece"
          }`,
        )
        await AudioManager.setSpeakerOn(speakerStateToSet)
      }
      if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) return

      try {
        let stream = localStreamRef.current
        if (!stream) {
          stream = await setupLocalMediaStream(currentAttemptKey)
        }
        if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) return
        if (!localStreamRef.current) {
          throw new Error("Local stream could not be established for answer.")
        }

        let pc = peerConnectionRef.current
        if (!pc) {
          pc = await initializePeerConnection(localStreamRef.current, currentAttemptKey)
        }
        if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) return
        if (!peerConnectionRef.current) {
          throw new Error("PeerConnection could not be initialized for answer.")
        }

        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offerToAnswer))
        if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) return
        const answer = await peerConnectionRef.current.createAnswer()
        if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) return
        await peerConnectionRef.current.setLocalDescription(answer)
        if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) return

        const currentSocket = getSocket()
        if (currentSocket && currentSocket.connected) {
          currentSocket.emit("accept-call", {
            callId: callIdRef.current,
            callerId: currentPeerRef.current?.id,
            answer,
            deviceId: authState.user?.activeDevice || authState.user?.deviceId,
          })
        } else {
          throw new Error("Socket not connected to send answer.")
        }

        setCallState("ongoing")
        if (callTimerRef.current) {
          clearInterval(callTimerRef.current)
        }
        setCallDuration(0)
        callTimerRef.current = setInterval(() => setCallDuration((prev) => prev + 1), 1000)
        startCallQualityMonitoringHandler(currentAttemptKey)

        if (authState.token && callIdRef.current) {
          CallAPI.updateCallStatus(authState.token, callIdRef.current, "ongoing").catch((e) =>
            console.error("API Error updating call status to ongoing", e),
          )
          CallLogAPI.logCallEvent(
            authState.token,
            callIdRef.current,
            initialCallType === "group" ? "group" : "one-to-one",
            "call_answered",
            {
              answeredByDevice: authState.user?.activeDevice || authState.user?.deviceId,
            },
          ).catch((e) => console.error("Log API Error for call_answered", e))
        }
      } catch (error) {
        console.error(
          `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] answerIncomingCall: Error processing answer:`,
          error,
        )
        if (!isCallEndingRef.current && activeCallAttemptKeyRef.current === currentAttemptKey) {
          endCallHandler("answer_call_failed", { error: error.message })
        }
      }
    },
    [
      authState.user,
      authState.token,
      getSocket,
      setupLocalMediaStream,
      initializePeerConnection,
      endCallHandler,
      startCallQualityMonitoringHandler,
      initialCallType,
    ],
  )

  const stableAttemptKey = useMemo(() => {
    if (initialCallIdFromParams) return initialCallIdFromParams
    if (!initialIsIncoming && !initialCallIdFromParams) return `outgoing-${instanceIdRef.current}-${Date.now()}`
    return `unknown-${instanceIdRef.current}-${Date.now()}`
  }, [initialCallIdFromParams, initialIsIncoming, instanceIdRef])

  useEffect(() => {
    let isMounted = true
    const currentAttemptKeyForEffect = stableAttemptKey

    console.log(
      `[CallScreen][${instanceIdRef.current}][${currentAttemptKeyForEffect}] Main setup useEffect RUNNING. isMounted: ${isMounted}, isIncoming: ${initialIsIncoming}, isPreAccepted: ${initialIsPreAccepted}, CallIdParam: ${initialCallIdFromParams}, Current callState: ${callStateRef.current}, isScreenFocused: ${isScreenFocused}, isCallEndingRef (start): ${isCallEndingRef.current}, activeCallAttemptKey (start): ${activeCallAttemptKeyRef.current}`,
    )

    const setupCall = async () => {
      console.log(
        `[CallScreen Setup][${
          instanceIdRef.current
        }][${currentAttemptKeyForEffect}] Entering setupCall. Current State: ${
          callStateRef.current
        }, PC Exists: ${!!peerConnectionRef.current}, Is Incoming: ${initialIsIncoming}, Active Key Matches: ${
          activeCallAttemptKeyRef.current === currentAttemptKeyForEffect
        }`,
      )

      if (
        activeCallAttemptKeyRef.current === currentAttemptKeyForEffect &&
        (callStateRef.current === "ongoing" ||
          (callStateRef.current === "connecting" && peerConnectionRef.current) ||
          (callStateRef.current === "ringing" && !initialIsIncoming && peerConnectionRef.current))
      ) {
        console.warn(
          `[CallScreen Setup][${
            instanceIdRef.current
          }][${currentAttemptKeyForEffect}] Call in active/stable state. Aborting full re-setup on effect re-run. Current State: ${
            callStateRef.current
          }, PC Exists: ${!!peerConnectionRef.current}, Is Incoming: ${initialIsIncoming}, Active Key Matches: ${
            activeCallAttemptKeyRef.current === currentAttemptKeyForEffect
          }`,
        )
        return
      }

      if (activeCallAttemptKeyRef.current !== currentAttemptKeyForEffect) {
        console.log(
          `[CallScreen Setup][${instanceIdRef.current}][${currentAttemptKeyForEffect}] New call attempt. Previous attempt key: ${activeCallAttemptKeyRef.current}. Resetting state.`,
        )
        isCallEndingRef.current = false
        activeCallAttemptKeyRef.current = currentAttemptKeyForEffect
        setCallState("initializing")
        setCallId(initialCallIdFromParams || null)
        setLocalStream(null)
        setRemoteStream(null)
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close()
          peerConnectionRef.current = null
        }
        setCurrentPeer(
          initialIsIncoming || initialIsPreAccepted
            ? initialCallerInfo
            : { id: initialReceiverId, name: initialReceiverName, profilePicture: initialReceiverProfilePic },
        )
      } else {
        console.log(
          `[CallScreen Setup][${instanceIdRef.current}][${currentAttemptKeyForEffect}] Re-running useEffect for existing attempt. isCallEndingRef: ${isCallEndingRef.current}`,
        )
      }

      if (isCallEndingRef.current) {
        console.log(
          `[CallScreen Setup][${instanceIdRef.current}][${currentAttemptKeyForEffect}] Call is already marked as ending (isCallEndingRef is true), aborting setup.`,
        )
        return
      }

      if (callStateRef.current !== "initializing" && activeCallAttemptKeyRef.current === currentAttemptKeyForEffect) {
        if (!["connecting", "ringing", "calling", "ongoing"].includes(callStateRef.current)) {
          setCallState("initializing")
        }
      }

      try {
        const permissionsGranted = await requestMediaPermissions(currentAttemptKeyForEffect)
        if (!isMounted || isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKeyForEffect)
          return

        if (!permissionsGranted) {
          Alert.alert("Permissions Denied", "Cannot start call without permissions.", [
            {
              text: "OK",
              onPress: () => {
                if (!isCallEndingRef.current && activeCallAttemptKeyRef.current === currentAttemptKeyForEffect)
                  endCallHandler("permissions_denied")
              },
            },
          ])
          return
        }

        await AudioManager.initializeAudioSession(initialCallType === "video", initialIsIncoming, initialIsPreAccepted)
        if (!isMounted || isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKeyForEffect)
          return

        const stream = await setupLocalMediaStream(currentAttemptKeyForEffect)
        if (!isMounted || isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKeyForEffect)
          return

        if (!stream) {
          if (!isCallEndingRef.current && activeCallAttemptKeyRef.current === currentAttemptKeyForEffect)
            endCallHandler("media_setup_failed")
          return
        }

        if (authState.token) {
          const iceResp = await IceServerAPI.getIceServers(authState.token)
          if (!isMounted || isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKeyForEffect)
            return
          iceServersRef.current =
            iceResp.success && iceResp.iceServers.length > 0
              ? iceResp.iceServers
              : [{ urls: "stun:stun.l.google.com:19302" }]
        } else {
          iceServersRef.current = [{ urls: "stun:stun.l.google.com:19302" }]
        }

        if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKeyForEffect) {
          console.log(
            `[CallScreen Setup][${instanceIdRef.current}][${currentAttemptKeyForEffect}] Aborting before call type specific logic due to ending/stale state.`,
          )
          return
        }

        if (initialIsPreAccepted) {
          if (!initialCallIdFromParams || !initialOffer || !initialCallerInfo?.id) {
            if (
              isMounted &&
              !isCallEndingRef.current &&
              activeCallAttemptKeyRef.current === currentAttemptKeyForEffect
            ) {
              endCallHandler("setup_failed_missing_data_incoming_critical")
            }
            return
          }
          setCallId(initialCallIdFromParams)
          setCurrentPeer(initialCallerInfo)
          await answerIncomingCall(initialOffer, currentAttemptKeyForEffect)
        } else if (initialIsIncoming) {
          if (!initialCallIdFromParams || !initialOffer || !initialCallerInfo?.id) {
            if (
              isMounted &&
              !isCallEndingRef.current &&
              activeCallAttemptKeyRef.current === currentAttemptKeyForEffect
            ) {
              endCallHandler("setup_failed_missing_data_incoming_critical")
            }
            return
          }
          setCallId(initialCallIdFromParams)
          setCurrentPeer(initialCallerInfo)
          setCallState("ringing")
          AudioManager.stopRingback().catch((e) =>
            console.warn("AudioManager: Error stopping ringback for incoming", e),
          )
          AudioManager.startRingtone().catch((e) => console.error("AudioManager Error starting ringtone", e))
        } else {
          console.log(
            `[CallScreen][${instanceIdRef.current}][${currentAttemptKeyForEffect}] initialIsIncoming is false, proceeding with outgoing call. Stream ID: ${stream?.id}`,
          )
          await startOutgoingCallHandler(stream, currentAttemptKeyForEffect)
        }
      } catch (error) {
        console.error(
          `[CallScreen Setup][${instanceIdRef.current}][${currentAttemptKeyForEffect}] Error in main setupCall:`,
          error,
        )
        if (isMounted && !isCallEndingRef.current && activeCallAttemptKeyRef.current === currentAttemptKeyForEffect) {
          endCallHandler("setup_exception", { error: error.message })
        }
      }
    }

    if (isScreenFocused || (initialIsPreAccepted && callStateRef.current === "initializing")) {
      setupCall()
    } else {
      console.warn(
        `[CallScreen][${instanceIdRef.current}][${currentAttemptKeyForEffect}] SKIPPING setupCall. Screen not focused (${isScreenFocused}) and not a pre-accepted init. isPreAccepted: ${initialIsPreAccepted}, callState: ${callStateRef.current}`,
      )
    }

    const netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      if (!isMounted || activeCallAttemptKeyRef.current !== currentAttemptKeyForEffect) return
      setNetworkType(state.type)
      if (
        !state.isConnected &&
        callStateRef.current === "ongoing" &&
        !isReconnectingRef.current &&
        !isCallEndingRef.current
      ) {
        attemptIceRestartHandler(currentAttemptKeyForEffect)
      } else if (state.isConnected && isReconnectingRef.current) {
        setIsReconnecting(false)
      }
    })

    const appStateSubscription = AppState.addEventListener("change", (nextAppState) => {
      if (!isMounted || activeCallAttemptKeyRef.current !== currentAttemptKeyForEffect) return
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active" &&
        callStateRef.current === "ongoing" &&
        !isCallEndingRef.current
      ) {
        if (
          peerConnectionRef.current &&
          (peerConnectionRef.current.iceConnectionState === "disconnected" ||
            peerConnectionRef.current.iceConnectionState === "failed")
        ) {
          attemptIceRestartHandler(currentAttemptKeyForEffect)
        }
      }
      appStateRef.current = nextAppState
    })

    return () => {
      isMounted = false
      const cleanupAttemptKey = activeCallAttemptKeyRef.current
      const effectKeyWhenDefined = currentAttemptKeyForEffect

      console.warn(
        `[CallScreen][${instanceIdRef.current}][${cleanupAttemptKey}] Unmounting (useEffect cleanup). EffectKeyWhenDefined: ${effectKeyWhenDefined}. Current state: ${callStateRef.current}, isCallEndingRef: ${isCallEndingRef.current}, callId: ${callIdRef.current}`,
      )

      if (outgoingCallTimeoutRef.current) {
        clearTimeout(outgoingCallTimeoutRef.current)
        outgoingCallTimeoutRef.current = null
      }

      if (cleanupAttemptKey === effectKeyWhenDefined && !isCallEndingRef.current) {
        const isActiveCallState = ["ongoing", "connecting", "ringing", "calling"].includes(callStateRef.current)
        // No 'isCurrentlyFocused' check here, as 'beforeRemove' handles confirmed back navigation.
        // This cleanup is for other unmounts (e.g., app close, unexpected navigation).
        if (isActiveCallState) {
          console.log(
            `[CallScreen][${instanceIdRef.current}][${cleanupAttemptKey}] Cleanup: Call was active (${callStateRef.current}) and not ending. Forcing endCallHandler due to unmount.`,
          )
          let unmountReason = "unmount"
          if (initialIsIncoming && !initialIsPreAccepted && callStateRef.current === "ringing") {
            unmountReason = "missed_due_to_unmount_while_ringing"
          } else if (
            initialIsPreAccepted &&
            (callStateRef.current === "connecting" ||
              callStateRef.current === "initializing" ||
              callStateRef.current === "ringing")
          ) {
            unmountReason = "missed_preaccepted_unmount"
          }
          endCallHandler(unmountReason, { detail: `useEffect cleanup for attempt ${cleanupAttemptKey}` })
        }
      } else {
        console.log(
          `[CallScreen][${instanceIdRef.current}][${cleanupAttemptKey}] Cleanup: No action. isCallEndingRef: ${isCallEndingRef.current}, or attempt keys mismatch (cleanupAttemptKey: ${cleanupAttemptKey} vs effectKeyWhenDefined: ${effectKeyWhenDefined}).`,
        )
      }

      netInfoUnsubscribe()
      appStateSubscription.remove()
    }
  }, [
    stableAttemptKey,
    initialIsIncoming,
    initialIsPreAccepted,
    initialOffer,
    initialCallerInfo,
    initialReceiverId,
    initialReceiverName,
    initialReceiverProfilePic,
    initialCallType,
    requestMediaPermissions,
    setupLocalMediaStream,
    startOutgoingCallHandler,
    answerIncomingCall,
    endCallHandler,
    attemptIceRestartHandler,
    authState.token,
    isScreenFocused,
    navigation, // For navigation.isFocused() in original logic, now for 'beforeRemove'
    initialCallIdFromParams,
  ])

  const handleCallAcceptedByPeer = useCallback(
    async (data) => {
      const currentAttemptKey = activeCallAttemptKeyRef.current
      const logPrefix = `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}][handleCallAcceptedByPeer]`
      if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) {
        console.log(`${logPrefix} Aborting: Call ending or stale attempt.`)
        return
      }
      console.log(`${logPrefix} RAW EVENT DATA RECEIVED:`, JSON.stringify(data, null, 2))

      const acceptedCallId = data?.callId
      const answerSdp = data?.answer
      const acceptedBy = data?.acceptedBy

      if (
        callIdRef.current === acceptedCallId &&
        (callStateRef.current === "ringing" || callStateRef.current === "calling")
      ) {
        if (outgoingCallTimeoutRef.current) {
          clearTimeout(outgoingCallTimeoutRef.current)
          outgoingCallTimeoutRef.current = null
        }
        try {
          if (!peerConnectionRef.current) {
            if (localStreamRef.current) {
              await initializePeerConnection(localStreamRef.current, currentAttemptKey)
            }
            if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) return
            if (!peerConnectionRef.current) {
              console.error(`${logPrefix} PC not ready on accept, localStream: ${!!localStreamRef.current}`)
              if (!isCallEndingRef.current) endCallHandler("pc_not_ready_on_accept")
              return
            }
          }
          if (!answerSdp) {
            console.error(`${logPrefix} No answer SDP received.`)
            if (!isCallEndingRef.current) endCallHandler("accept_failed_no_answer_sdp")
            return
          }
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answerSdp))
          if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) return

          setCallState("ongoing")
          AudioManager.stopAllSounds().catch((e) =>
            console.error(`${logPrefix} AudioManager Error stopping sounds on accept`, e),
          )

          if (!isCallEndingRef.current && activeCallAttemptKeyRef.current === currentAttemptKey) {
            const speakerStateToSet = isSpeakerOnRef.current
            await AudioManager.setSpeakerOn(speakerStateToSet)
          }
          if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) return

          if (callTimerRef.current) {
            clearInterval(callTimerRef.current)
          }
          setCallDuration(0)
          callTimerRef.current = setInterval(() => setCallDuration((prev) => prev + 1), 1000)
          startCallQualityMonitoringHandler(currentAttemptKey)

          if (authState.token && callIdRef.current) {
            CallAPI.updateCallStatus(authState.token, callIdRef.current, "ongoing").catch((e) =>
              console.error("API Error updating status to ongoing", e),
            )
            CallLogAPI.logCallEvent(
              authState.token,
              callIdRef.current,
              initialCallType === "group" ? "group" : "one-to-one",
              "call_connected",
              {
                acceptedByDevice: acceptedBy?.deviceId,
              },
            ).catch((e) => console.error("API Error logging call_connected", e))
          }
        } catch (error) {
          console.error(`${logPrefix} Error processing call acceptance:`, error)
          if (!isCallEndingRef.current && activeCallAttemptKeyRef.current === currentAttemptKey) {
            endCallHandler("accept_processing_failed", { error: error.message })
          }
        }
      } else {
        console.warn(
          `${logPrefix} Ignoring 'call-accepted'. CallId mismatch or invalid state. Event CallId: ${acceptedCallId}, Current CallId: ${callIdRef.current}, State: ${callStateRef.current}`,
        )
      }
    },
    [authState.token, endCallHandler, initializePeerConnection, startCallQualityMonitoringHandler, initialCallType],
  )

  const handleCallRejectedByPeer = useCallback(
    ({ callId: rejectedCallId, reason, deviceId }) => {
      const currentAttemptKey = activeCallAttemptKeyRef.current
      if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) {
        return
      }
      if (
        callIdRef.current === rejectedCallId &&
        (callStateRef.current === "ringing" || callStateRef.current === "calling")
      ) {
        if (outgoingCallTimeoutRef.current) {
          clearTimeout(outgoingCallTimeoutRef.current)
          outgoingCallTimeoutRef.current = null
        }
        endCallHandler(reason || "rejected_by_other_device", {
          rejectedByDeviceId: deviceId,
        })
      }
    },
    [endCallHandler],
  )

  const handleCallEndedByPeer = useCallback(
    (data) => {
      const currentAttemptKey = activeCallAttemptKeyRef.current
      if (callIdRef.current === data?.callId && !isCallEndingRef.current) {
        console.log(
          `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] handleCallEndedByPeer: Processing. CallId matches and not ending. Data:`,
          data,
        )
        const reasonFromServer =
          data?.reason || (data?.type === "call-session-terminated" ? "session_terminated_by_peer" : "remote_ended")
        endCallHandler(reasonFromServer, {
          endedByEventData: data,
          detail: "terminated_by_peer_event",
        })
      } else if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) {
        console.log(
          `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] handleCallEndedByPeer: Aborting. Call already ending, or stale attempt and callId mismatch. Data:`,
          data,
        )
      } else {
        console.log(
          `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] handleCallEndedByPeer: Aborting. CallId mismatch. Event CallId: ${data?.callId}, Current CallId: ${callIdRef.current}. Data:`,
          data,
        )
      }
    },
    [endCallHandler],
  )

  const handleRemoteIceCandidate = useCallback(async ({ callId: iceCallId, candidate }) => {
    const currentAttemptKey = activeCallAttemptKeyRef.current
    if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) {
      return
    }
    if (callIdRef.current === iceCallId && peerConnectionRef.current && candidate) {
      try {
        await peerConnectionRef.current.addIceCandidate(candidate)
      } catch (error) {
        console.error(
          `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] Error adding remote ICE candidate:`,
          error,
        )
      }
    }
  }, [])

  const handlePeerUserCameOnline = useCallback(({ userId, deviceId: onlineUserDeviceId }) => {
    const currentAttemptKey = activeCallAttemptKeyRef.current
    if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) {
      return
    }
    if (userId === currentPeerRef.current?.id && callStateRef.current === "calling") {
      setReceiverOnlineStatus("online")
      setReceiverActiveDevice(onlineUserDeviceId)
      setCallState("ringing")
      AudioManager.stopRingtone().catch((e) => console.warn("AudioManager: Error stopping ringtone before ringback", e))
      AudioManager.startRingback("my_custom_ringback.mav").catch((e) =>
        console.error("AudioManager Error starting ringback", e),
      )
    }
  }, [])

  const handlePeerUserStatusResponse = useCallback(({ userId, status, activeDevice }) => {
    const currentAttemptKey = activeCallAttemptKeyRef.current
    if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) {
      return
    }
    if (userId === currentPeerRef.current?.id) {
      setReceiverOnlineStatus(status)
      setReceiverActiveDevice(activeDevice)
    }
  }, [])

  const handleIceRestartRequestFromPeer = useCallback(
    async ({ callId: restartCallId, offer }) => {
      const currentAttemptKey = activeCallAttemptKeyRef.current
      if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) {
        return
      }
      if (
        callIdRef.current === restartCallId &&
        callStateRef.current === "ongoing" &&
        peerConnectionRef.current &&
        !isReconnectingRef.current
      ) {
        setIsReconnecting(true)
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer))
          if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) return
          const answer = await peerConnectionRef.current.createAnswer()
          if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) return
          await peerConnectionRef.current.setLocalDescription(answer)
          if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) return

          const currentActiveSocket = getSocket()
          if (currentActiveSocket && currentActiveSocket.connected) {
            currentActiveSocket.emit("answer-ice-restart", {
              callId: callIdRef.current,
              recipientId: currentPeerRef.current?.id,
              answer,
            })
          }
          if (authState.token && callIdRef.current) {
            CallLogAPI.logCallEvent(
              authState.token,
              callIdRef.current,
              initialCallType === "group" ? "group" : "one-to-one",
              "ice_restart_answered",
              {},
            ).catch((e) => console.error("Log API Error for ice_restart_answered", e))
          }
        } catch (error) {
          console.error(
            `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] Error handling ICE restart request:`,
            error,
          )
          setIsReconnecting(false)
        }
      }
    },
    [getSocket, authState.token, initialCallType],
  )

  const handleVideoStateChangedByPeer = useCallback(({ callId: eventCallId, isVideoEnabled: remoteVideoState }) => {
    const currentAttemptKey = activeCallAttemptKeyRef.current
    if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) {
      return
    }
    if (callIdRef.current === eventCallId) {
      setIsRemoteVideoEnabled(remoteVideoState)
    }
  }, [])

  const handleMicStateChangedByPeer = useCallback(({ callId: eventCallId, isMuted: remoteMuteState }) => {
    const currentAttemptKey = activeCallAttemptKeyRef.current
    if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) {
      return
    }
    if (callIdRef.current === eventCallId) {
      setIsRemoteMuted(remoteMuteState)
    }
  }, [])

  useEffect(() => {
    const currentActiveSocket = getSocket()
    let isSubscribed = true
    if (currentActiveSocket && currentActiveSocket.connected) {
      const listeners = {
        "call-accepted": handleCallAcceptedByPeer,
        "call-rejected": handleCallRejectedByPeer,
        "call-ended": handleCallEndedByPeer,
        "call-session-terminated": handleCallEndedByPeer,
        "ice-candidate-received": handleRemoteIceCandidate,
        "user-came-online": handlePeerUserCameOnline,
        "user-status-response": handlePeerUserStatusResponse,
        "ice-restart-requested": handleIceRestartRequestFromPeer,
        "video-state-changed": handleVideoStateChangedByPeer,
        "mic-state-changed": handleMicStateChangedByPeer,
      }
      Object.entries(listeners).forEach(([event, handler]) => currentActiveSocket.on(event, handler))

      console.log(`[CallScreen][${instanceIdRef.current}] Socket event listeners registered.`)

      return () => {
        if (isSubscribed && currentActiveSocket) {
          Object.entries(listeners).forEach(([event, handler]) => currentActiveSocket.off(event, handler))
          console.log(`[CallScreen][${instanceIdRef.current}] Socket event listeners removed.`)
        }
      }
    } else {
      console.warn(
        `[CallScreen][${instanceIdRef.current}] Socket not available or not connected. Listeners not registered.`,
      )
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
    handleMicStateChangedByPeer,
  ])

  const toggleMute = useCallback(async () => {
    if (isCallEndingRef.current) return

    const newMuteState = !isMuted
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = !newMuteState
        })
      }
      const audioManagerSuccess = await AudioManager.setMicrophoneMute(newMuteState)
      if (audioManagerSuccess) {
        setIsMuted(newMuteState)
        const currentActiveSocket = getSocket()
        if (currentActiveSocket && currentActiveSocket.connected && callIdRef.current) {
          currentActiveSocket.emit("mic-state-changed", {
            callId: callIdRef.current,
            recipientId: currentPeerRef.current?.id,
            isMuted: newMuteState,
          })
        }
        if (callIdRef.current && authState.token) {
          CallLogAPI.logCallEvent(
            authState.token,
            callIdRef.current,
            initialCallType === "group" ? "group" : "one-to-one",
            newMuteState ? "muted" : "unmuted",
            {},
          ).catch((e) => console.error("Log API Error for mute/unmute", e))
        }
      } else {
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach((track) => (track.enabled = isMuted))
        }
        console.warn("AudioManager.setMicrophoneMute failed, UI might be out of sync with actual mute state.")
      }
    } catch (error) {
      console.error("Error toggling mute:", error)
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => (track.enabled = isMuted))
      }
    }
  }, [isMuted, authState.token, initialCallType, getSocket])

  const toggleSpeakerphone = useCallback(async () => {
    if (isCallEndingRef.current) return
    try {
      const result = await AudioManager.toggleSpeaker()
      if (result.success) {
        setIsSpeakerOn(result.isSpeakerOn)
        if (callIdRef.current && authState.token) {
          CallLogAPI.logCallEvent(
            authState.token,
            callIdRef.current,
            initialCallType === "group" ? "group" : "one-to-one",
            result.isSpeakerOn ? "speaker_on" : "speaker_off",
            { audioRoute: AudioManager.getCurrentAudioRoute() },
          ).catch((e) => console.error("Log API Error for speaker toggle", e))
        }
      } else {
        console.warn("AudioManager.toggleSpeaker failed.")
      }
    } catch (error) {
      console.error("Error toggling speakerphone", error)
    }
  }, [authState.token, initialCallType])

  const toggleLocalVideo = useCallback(async () => {
    const currentAttemptKey = activeCallAttemptKeyRef.current
    if (
      isCallEndingRef.current ||
      initialCallType !== "video" ||
      activeCallAttemptKeyRef.current !== currentAttemptKey
    ) {
      return
    }

    if (!localStreamRef.current && !isVideoEnabled) {
      console.warn(
        `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] toggleLocalVideo: Attempting to enable video but no local stream. Re-acquiring.`,
      )
      try {
        const newStream = await setupLocalMediaStream(currentAttemptKey)
        if (!newStream || isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) return

        if (peerConnectionRef.current) {
          const videoTrack = newStream.getVideoTracks()[0]
          if (videoTrack) {
            const senders = peerConnectionRef.current.getSenders()
            const videoSender = senders.find((s) => s.track?.kind === "video")
            if (videoSender) {
              await videoSender.replaceTrack(videoTrack)
            } else {
              peerConnectionRef.current.addTrack(videoTrack, newStream)
            }
            setIsVideoEnabled(true)
          }
        } else {
          setIsVideoEnabled(true)
        }
      } catch (error) {
        Alert.alert("Video Error", "Could not re-enable video stream.")
        return
      }
    } else if (!localStreamRef.current && isVideoEnabled) {
      console.warn(
        `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] toggleLocalVideo: Video enabled but no local stream. Attempting to disable.`,
      )
      setIsVideoEnabled(false)
    }

    if (localStreamRef.current) {
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
        if (callIdRef.current && authState.token) {
          CallLogAPI.logCallEvent(
            authState.token,
            callIdRef.current,
            initialCallType === "group" ? "group" : "one-to-one",
            newVideoState ? "video_on" : "video_off",
            {},
          ).catch((e) => console.error("Log API Error for video toggle", e))
        }
      } else if (!isVideoEnabled) {
        console.warn(
          `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] toggleLocalVideo: No video tracks found, attempting to re-acquire for enabling.`,
        )
      }
    }
  }, [isVideoEnabled, initialCallType, authState.token, getSocket, setupLocalMediaStream])

  const switchCamera = useCallback(async () => {
    const currentAttemptKey = activeCallAttemptKeyRef.current
    console.log(
      `[CallScreen][${
        instanceIdRef.current
      }][${currentAttemptKey}] switchCamera called. isVideoEnabled: ${isVideoEnabled}, initialCallType: ${initialCallType}, localStream exists: ${!!localStreamRef.current}, isFrontCamera (before): ${isFrontCamera}`,
    )
    if (
      isCallEndingRef.current ||
      !localStreamRef.current ||
      !isVideoEnabled ||
      initialCallType !== "video" ||
      activeCallAttemptKeyRef.current !== currentAttemptKey
    ) {
      console.warn(
        `[CallScreen][${
          instanceIdRef.current
        }][${currentAttemptKey}] switchCamera: Aborting due to conditions not met. isCallEndingRef: ${
          isCallEndingRef.current
        }, localStream: ${!!localStreamRef.current}, isVideoEnabled: ${isVideoEnabled}, initialCallType: ${initialCallType}, activeKey: ${
          activeCallAttemptKeyRef.current
        }, currentKey: ${currentAttemptKey}`,
      )
      return
    }

    const videoTracks = localStreamRef.current.getVideoTracks()
    if (videoTracks.length > 0) {
      videoTracks.forEach((track) => {
        if (typeof track._switchCamera === "function") {
          track._switchCamera()
        } else {
          console.warn(
            `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] track._switchCamera is not a function on track ${track.id}. Camera switch might not work as expected.`,
          )
        }
      })
      const newFrontCameraState = !isFrontCamera
      setIsFrontCamera(newFrontCameraState)
      console.log(
        `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] Camera switch attempted. New isFrontCamera state: ${newFrontCameraState}.`,
      )

      if (callIdRef.current && authState.token) {
        CallLogAPI.logCallEvent(
          authState.token,
          callIdRef.current,
          initialCallType === "group" ? "group" : "one-to-one",
          "camera_switched",
          { to: newFrontCameraState ? "front" : "rear" },
        ).catch((e) => console.error("Log API Error for camera_switched", e))
      }
    } else {
      console.warn(`[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] No video tracks found to switch.`)
    }
  }, [isVideoEnabled, initialCallType, authState.token, isFrontCamera])

  const acceptIncomingCallHandler = useCallback(async () => {
    const currentAttemptKey = activeCallAttemptKeyRef.current
    if (isCallEndingRef.current || activeCallAttemptKeyRef.current !== currentAttemptKey) {
      return
    }
    if (!initialIsIncoming || initialIsPreAccepted || !initialOffer || !callIdRef.current) {
      if (!isCallEndingRef.current && activeCallAttemptKeyRef.current === currentAttemptKey) {
        endCallHandler("answer_failed_missing_data")
      }
      return
    }
    await answerIncomingCall(initialOffer, currentAttemptKey)
  }, [initialIsIncoming, initialIsPreAccepted, initialOffer, answerIncomingCall, endCallHandler])

  const declineIncomingCallHandler = useCallback(async () => {
    const currentAttemptKey = activeCallAttemptKeyRef.current
    if (isCallEndingRef.current) {
      return
    }

    if (!initialIsIncoming || initialIsPreAccepted || !callIdRef.current) {
      if (!isCallEndingRef.current) {
        console.warn(
          `[CallScreen][${instanceIdRef.current}][${currentAttemptKey}] Decline failed: missing data. isIncoming: ${initialIsIncoming}, isPreAccepted: ${initialIsPreAccepted}, callId: ${callIdRef.current}`,
        )
        endCallHandler("reject_failed_missing_data")
      }
      return
    }
    AudioManager.stopAllSounds()
    const currentActiveSocket = getSocket()
    if (currentActiveSocket && currentActiveSocket.connected) {
      currentActiveSocket.emit("reject-call", {
        callId: callIdRef.current,
        callerId: currentPeerRef.current?.id,
        deviceId: authState.user?.activeDevice || authState.user?.deviceId,
        reason: "rejected_by_user",
      })
    }
    endCallHandler("rejected_by_user")
  }, [initialIsIncoming, initialIsPreAccepted, authState.user, getSocket, endCallHandler])

  const formatCallDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const getCallStatusDisplay = () => {
    let status = ""
    switch (callStateRef.current) {
      case "initializing":
        status = "Initializing..."
        break
      case "connecting":
        status = "Connecting..."
        break
      case "calling":
        status = "Calling..."
        break
      case "ringing":
        status = initialIsIncoming && !initialIsPreAccepted ? "Incoming call..." : "Ringing..."
        break
      case "ongoing":
        status = isReconnectingRef.current ? "Reconnecting..." : formatCallDuration(callDuration)
        break
      case "ended":
        if (callEndReason === "rejected_by_user" || callEndReason === "rejected_by_other_device") {
          status = "Call Rejected"
        } else if (
          callEndReason === "remote_ended" ||
          callEndReason === "unmount_due_to_remote_end" ||
          callEndReason === "session_terminated_by_peer"
        ) {
          status = "Call Ended"
        } else if (callEndReason === "no_answer") {
          status = "No Answer"
        } else if (callEndReason === "user_offline") {
          status = "User Offline"
        } else if (callEndReason === "cancelled") {
          status = "Call Cancelled"
        } else if (
          callEndReason === "missed_due_to_unmount_while_ringing" ||
          callEndReason === "missed_preaccepted_unmount" ||
          callEndReason === "missed"
        ) {
          status = "Call Missed"
        } else if (callEndReason?.includes("failed") || callEndReason?.includes("exception")) {
          status = "Call Failed"
        } else {
          status = "Call Ended"
        }
        break
      default:
        status = `Status: ${callStateRef.current}`
    }
    if (callStateRef.current === "ongoing" && isRemoteMuted) {
      return `${status} (Peer Muted)`
    }
    return status
  }

  const qualityIndicatorColor = () => {
    if (isReconnectingRef.current) {
      return "#FFA500"
    }
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
  const peerDisplayName =
    currentPeer?.name ||
    (initialIsIncoming || initialIsPreAccepted
      ? initialCallerInfo?.name || "Unknown Caller"
      : initialReceiverName || "Contact")
  const peerDisplayProfilePic =
    currentPeer?.profilePicture ||
    (initialIsIncoming || initialIsPreAccepted ? initialCallerInfo?.profilePicture : initialReceiverProfilePic)

  const processRtcStatsForQuality = useCallback(
    (stats) => {
      let quality = "good"
      const issues = []
      let packetsLostAudio = 0
      let packetsReceivedAudio = 0
      let jitterAudio = 0
      let packetsLostVideo = 0
      let packetsReceivedVideo = 0

      stats.forEach((report) => {
        if (report.type === "inbound-rtp") {
          if (report.kind === "audio") {
            packetsLostAudio += report.packetsLost || 0
            packetsReceivedAudio += report.packetsReceived || 0
            if (report.jitter) jitterAudio = Math.max(jitterAudio, report.jitter)
          } else if (report.kind === "video" && initialCallType === "video") {
            packetsLostVideo += report.packetsLost || 0
            packetsReceivedVideo += report.packetsReceived || 0
          }
        }
      })

      if (packetsReceivedAudio + packetsLostAudio > 0) {
        const lossPercentageAudio = (packetsLostAudio / (packetsReceivedAudio + packetsLostAudio)) * 100
        if (lossPercentageAudio > 5) quality = "poor"
        else if (lossPercentageAudio > 2 && quality !== "poor") quality = "fair"
        if (lossPercentageAudio > 0) issues.push(`Audio Pkt Loss: ${lossPercentageAudio.toFixed(1)}%`)
      }

      if (jitterAudio > 0.03) {
        if (quality !== "poor") quality = "fair"
        issues.push(`Audio Jitter: ${(jitterAudio * 1000).toFixed(0)}ms`)
      }

      if (initialCallType === "video" && packetsReceivedVideo + packetsLostVideo > 0) {
        const lossPercentageVideo = (packetsLostVideo / (packetsReceivedVideo + packetsLostVideo)) * 100
        if (lossPercentageVideo > 10) quality = "poor"
        else if (lossPercentageVideo > 5 && quality !== "poor") quality = "fair"
        if (lossPercentageVideo > 0) issues.push(`Video Pkt Loss: ${lossPercentageVideo.toFixed(1)}%`)
      }
      return { quality, issues, packetsLostAudio, jitterAudio, packetsLostVideo }
    },
    [initialCallType],
  )
  const updateCallQualityIndicator = useCallback(
    (metrics) => {
      if (metrics && metrics.quality !== callQuality) {
        setCallQuality(metrics.quality)
      }
    },
    [callQuality],
  )

  if (
    callState === "initializing" &&
    !isCallEndingRef.current &&
    activeCallAttemptKeyRef.current === null &&
    !initialCallIdFromParams &&
    !initialIsIncoming
  ) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.background || "#000000" }]}>
        <StatusBar barStyle={currentTheme.statusBar || "light-content"} />
        <View style={styles.centeredStatus}>
          <ActivityIndicator size="large" color={currentTheme.primary || "#FFFFFF"} />
          <Text style={[styles.statusTextLoading, { color: currentTheme.text || "#FFFFFF" }]}>
            Initializing Call...
          </Text>
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
          onPress={() => {
            // Navigation is handled by 'beforeRemove' listener
            if (navigation.canGoBack()) navigation.goBack()
            else navigation.replace("Main", { screen: "Chats" })
          }}
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
        {initialCallType === "video" &&
        (callStateRef.current === "ongoing" ||
          callStateRef.current === "connecting" ||
          (callStateRef.current === "ringing" && isVideoEnabled)) ? (
          <View style={styles.videoContainer}>
            {remoteStream && isRemoteVideoEnabled ? (
              <RTCView
                key={`remote-${remoteStream.id}-${isRemoteVideoEnabled}`}
                streamURL={remoteStream.toURL()}
                style={styles.remoteVideo}
                objectFit="cover"
                mirror={false}
              />
            ) : (
              <View style={styles.videoPlaceholder}>
                <Ionicons name="videocam-off-outline" size={60} color="#555" />
                <Text style={styles.videoPlaceholderText}>
                  {callStateRef.current === "ended"
                    ? "Video ended"
                    : isRemoteVideoEnabled
                      ? `${peerDisplayName || "Remote"} video connecting...`
                      : `${peerDisplayName || "Remote"} video is off.`}
                  {isRemoteMuted && !isRemoteVideoEnabled && `\nThey are also muted.`}
                  {isRemoteMuted && isRemoteVideoEnabled && ` (${peerDisplayName || "Remote"} is muted)`}
                </Text>
              </View>
            )}
            {localStream && isVideoEnabled && (
              <RTCView
                key={`local-${localStream.id}-${isFrontCamera}`}
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
            {peerDisplayProfilePic ? (
              <Image source={{ uri: peerDisplayProfilePic }} style={styles.callerImage} />
            ) : (
              <View style={styles.defaultCallerImage}>
                <Text style={styles.defaultCallerImageText}>{(peerDisplayName || " ").charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.callerName}>{peerDisplayName}</Text>
            <Text style={styles.callStatusText}>{getCallStatusDisplay()}</Text>
            {receiverOnlineStatus && callStateRef.current !== "ongoing" && callStateRef.current !== "ended" && (
              <Text
                style={[
                  styles.onlineStatusText,
                  {
                    color: receiverOnlineStatus === "online" ? "#4CAF50" : "#CCCCCC",
                  },
                ]}
              >
                {receiverOnlineStatus === "online" ? "Online" : "Offline"}
              </Text>
            )}
          </View>
        )}
      </View>

      {callStateRef.current === "ongoing" && !isCallEndingRef.current && (
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

      {initialIsIncoming && !initialIsPreAccepted && callStateRef.current === "ringing" && !isCallEndingRef.current && (
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

      {callStateRef.current !== "ended" &&
        callStateRef.current !== "initializing" &&
        !(initialIsIncoming && !initialIsPreAccepted && callStateRef.current === "ringing") &&
        !isCallEndingRef.current && (
          <View style={styles.endCallButtonContainer}>
            <TouchableOpacity
              style={styles.mainEndCallButton}
              onPress={() => {
                if (!isCallEndingRef.current) {
                  endCallHandler("user_ended")
                }
              }}
            >
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
            if (callIdRef.current && authState.token) {
              CallLogAPI.logCallEvent(
                authState.token,
                callIdRef.current,
                initialCallType === "group" ? "group" : "one-to-one",
                "audio_route_changed",
                { newRoute: route },
              ).catch((e) => console.error("Log API Error for audio_route_changed", e))
            }
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
  statusTextLoading: { marginTop: 10, fontSize: 16, color: "#FFFFFF" },
  callHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 10 : 40,
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
  callContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  audioCallContainer: { alignItems: "center", paddingHorizontal: 20 },
  callerImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
    marginBottom: 20,
    backgroundColor: "#2C2C2E",
  },
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
  callerName: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  callStatusText: {
    color: "#AEAEB2",
    fontSize: 18,
    marginBottom: 8,
    textAlign: "center",
  },
  onlineStatusText: { fontSize: 14, marginTop: 5, fontWeight: "500" },
  videoContainer: {
    width: "100%",
    height: "100%",
    position: "relative",
    backgroundColor: "#000",
  },
  remoteVideo: { flex: 1 },
  videoPlaceholder: {
    flex: 1,
    backgroundColor: "#1C1C1E",
    justifyContent: "center",
    alignItems: "center",
  },
  videoPlaceholderText: { color: "#888", marginTop: 10, textAlign: "center" },
  localVideo: {
    position: "absolute",
    top: Platform.OS === "android" ? StatusBar.currentHeight + 70 : 80,
    right: 15,
    width: width * 0.28,
    height: height * 0.22,
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
  activeControlButton: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
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
  incomingCallButtonWrapper: {
    alignItems: "center",
  },
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
