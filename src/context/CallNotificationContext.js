// src/context/CallNotificationContext.js
"use client"

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react"
import { AppState, Alert } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { AuthContext } from "./AuthContext"
import { SocketContext } from "./SocketContext"
// REMOVE: import IncomingCallModal from "../components/calls/IncomingCallModal";
import PushNotificationService from "../utils/push-notification-service"
import * as CallAPI from "../api/call"
import * as CallLogAPI from "../api/call-log"
import AudioManager from "../utils/audio-manager"

export const CallNotificationContext = createContext()

export const CallNotificationProvider = ({ children }) => {
  const navigation = useNavigation() // Direct useNavigation here is fine
  const { state: authState } = useContext(AuthContext)
  const {
    socket,
    isConnected,
    incomingCallData: socketIncomingCallData,
    clearIncomingCallDataState,
  } = useContext(SocketContext)

  const [activeIncomingCall, setActiveIncomingCall] = useState(null)
  // REMOVE: const [showIncomingCallModal, setShowIncomingCallModal] = useState(false);
  const [currentAppState, setCurrentAppState] = useState(AppState.currentState)

  const callTimeoutRef = useRef(null)
  const isHandlingCallRef = useRef(false)
  // navigationRef is fine, but direct use of `navigation` from useNavigation is also okay.
  // For consistency with how it was used, keeping navigationRef.
  const navigationRef = useRef(navigation)

  const activeIncomingCallRef = useRef(activeIncomingCall)
  useEffect(() => {
    activeIncomingCallRef.current = activeIncomingCall
  }, [activeIncomingCall])

  useEffect(() => {
    navigationRef.current = navigation
  }, [navigation])

  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      console.log("[CallNotificationContext] App state changed:", currentAppState, "->", nextAppState)
      setCurrentAppState(nextAppState)
    }
    const subscription = AppState.addEventListener("change", handleAppStateChange)
    return () => {
      subscription?.remove()
    }
  }, [currentAppState])

  const clearActiveIncomingCall = useCallback(
    (callIdToClear, source = "unknown") => {
      console.log(
        `[CallNotificationContext] ENTERING clearActiveIncomingCall. Source: ${source}, CallID to clear: ${callIdToClear}.`,
      )
      const currentActiveCall = activeIncomingCallRef.current
      if (currentActiveCall && currentActiveCall.callId !== callIdToClear) {
        console.log(
          `[CallNotificationContext] clearActiveIncomingCall: callIdToClear (${callIdToClear}) does not match current active call (${currentActiveCall.callId}). Not clearing timeout for current call.`,
        )
      } else {
        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current)
          callTimeoutRef.current = null
        }
      }
      setActiveIncomingCall((prev) => (prev && prev.callId === callIdToClear ? null : prev))
      isHandlingCallRef.current = false

      if (callIdToClear && clearIncomingCallDataState) {
        console.log(`[CallNotificationContext] Requesting SocketContext to clear its data for callId: ${callIdToClear}`)
        clearIncomingCallDataState(callIdToClear)
      } else {
        console.warn(
          `[CallNotificationContext] SKIPPING SocketContext.clearIncomingCallDataState. Reason: callIdToClear is '${callIdToClear}', clearIncomingCallDataState exists: ${!!clearIncomingCallDataState}.`,
        )
      }
    },
    [clearIncomingCallDataState],
  )

  const handleCallTimeout = useCallback(
    async (callData) => {
      if (!callData || !callData.callId) return
      const { callId, isGroupCall } = callData // Added isGroupCall
      try {
        console.log("[CallNotificationContext] Handling call timeout for callId:", callId)
        if (activeIncomingCallRef.current?.callId !== callId) {
          console.log(
            `[CallNotificationContext] Stale timeout for ${callId}, current active call is ${activeIncomingCallRef.current?.callId}. Ignoring.`,
          )
          return
        }
        if (authState.token) {
          if (isGroupCall) {
            // For group calls, "missed" might mean the invite expired.
            // The server/inviter might handle this. Client-side, we just clear the notification.
            console.log(`[CallNotificationContext] Group call invite ${callId} timed out.`)
            // Optionally, log an event if your backend supports "invite_timed_out" for group calls
          } else {
            await CallAPI.updateCallStatus(authState.token, callId, "missed")
            await CallLogAPI.logCallEvent(authState.token, callId, "one-to-one", "call_missed", {})
          }
        }
        clearActiveIncomingCall(callId, "timeout")
        PushNotificationService.clearAllNotifications()
      } catch (error) {
        console.error("[CallNotificationContext] Error handling call timeout:", error)
        clearActiveIncomingCall(callId, "timeout_error")
      }
    },
    [authState.token, clearActiveIncomingCall],
  )

  const processIncomingCall = useCallback(
    async (callData) => {
      if (!callData || !callData.callId) {
        console.log("[CallNotificationContext] processIncomingCall: Invalid callData.")
        return
      }
      const { callId, caller, callType, offer, isGroupCall, conversationId, conversationName } = callData // Added isGroupCall, conversationId, conversationName
      const logPrefix = `[CallNotificationContext][CallID: ${callId}]`
      const currentUserId = authState?.user?.id

      if (caller?.id === currentUserId) {
        console.log(
          `${logPrefix} Ignoring processIncomingCall: Caller ID (${caller?.id}) matches current user ID (${currentUserId}). This is a self-initiated call.`,
        )
        if (clearIncomingCallDataState) clearIncomingCallDataState(callId)
        return
      }

      let currentRoute = null
      if (
        global.navigationRef &&
        typeof global.navigationRef.isReady === "function" &&
        global.navigationRef.isReady() &&
        typeof global.navigationRef.getCurrentRoute === "function"
      ) {
        try {
          currentRoute = global.navigationRef.getCurrentRoute()
        } catch (e) {
          console.warn("[CallNotificationContext] Error calling getCurrentRoute in processIncomingCall:", e)
        }
      } else {
        console.warn(
          "[CallNotificationContext] Navigation ref not ready or getCurrentRoute not available in processIncomingCall.",
        )
      }

      const targetScreen = isGroupCall ? "GroupCallScreen" : "Call"
      const targetCallIdParam = isGroupCall ? "groupCallId" : "callId"

      if (
        currentRoute?.name === targetScreen &&
        currentRoute.params?.[targetCallIdParam] === callId &&
        (currentRoute.params?.isIncoming === true || currentRoute.params?.isPreAccepted === true)
      ) {
        console.log(`${logPrefix} ${targetScreen} already active for this call. Aborting notification processing.`)
        if (activeIncomingCallRef.current?.callId === callId) {
          clearActiveIncomingCall(callId, "call_screen_active")
        }
        return
      }

      try {
        console.log(`${logPrefix} Processing incoming ${isGroupCall ? "GROUP" : "1-to-1"} call from SocketContext.`)
        if (isHandlingCallRef.current && activeIncomingCallRef.current?.callId !== callId) {
          console.log(
            `${logPrefix} Already handling call ${activeIncomingCallRef.current?.callId}. Emitting busy/reject for new call.`,
          )
          if (socket && isConnected) {
            if (isGroupCall) {
              // For group calls, declining an invite when busy is more complex.
              // The server might not have a direct "busy" state for group invites.
              // We can choose to ignore or explicitly decline.
              // Emitting group-call-invite-declined might be appropriate.
              socket.emit("group-call-invite-declined", {
                callId: callId,
                inviterId: caller.id,
                inviteeId: authState.user.id,
                reason: "busy",
              })
            } else {
              socket.emit("reject-call", {
                callId: callId,
                callerId: caller.id,
                reason: "busy",
                deviceId: authState.user?.activeDevice || authState.user?.deviceId,
              })
            }
          }
          if (clearIncomingCallDataState) clearIncomingCallDataState(callId)
          return
        }

        isHandlingCallRef.current = true
        const incomingCallToProcess = {
          callId,
          caller,
          callType,
          offer, // Will be null for group calls from socket
          isGroupCall,
          conversationId,
          conversationName,
          targetDeviceId: callData.targetDeviceId,
          timestamp: Date.now(),
        }
        setActiveIncomingCall(incomingCallToProcess)

        if (currentAppState === "active") {
          console.log(`${logPrefix} App active. GlobalCallManager will display the modal.`)
          // AudioManager.startRingtone().catch((e) => console.error("Error starting ringtone for active app", e));
          // No setShowIncomingCallModal(true) here; GlobalCallManager handles UI.
        } else {
          console.log(`${logPrefix} App background/inactive, showing system notification.`)
          PushNotificationService.showIncomingCallNotification(incomingCallToProcess)
        }

        if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current)
        callTimeoutRef.current = setTimeout(() => {
          handleCallTimeout(incomingCallToProcess)
        }, 30000)

        if (authState.token) {
          const eventType = isGroupCall ? "group_call_invite_received" : "call_received"
          const callCategory = isGroupCall ? "group" : "one-to-one"
          await CallLogAPI.logCallEvent(authState.token, callId, callCategory, eventType, {
            callType,
            callerInfo: { id: caller.id, name: caller.name, profilePicture: caller.profilePicture },
            conversationId: isGroupCall ? conversationId : undefined,
          })
        }
      } catch (error) {
        console.error(`${logPrefix} Error processing incoming call:`, error)
        isHandlingCallRef.current = false
        if (callId) clearActiveIncomingCall(callId, "process_error")
      }
    },
    [
      currentAppState,
      authState.token,
      authState.user,
      handleCallTimeout,
      clearActiveIncomingCall,
      socket,
      isConnected,
      clearIncomingCallDataState,
    ],
  )

  useEffect(() => {
    const logPrefix = `[CallNotificationContext][useEffect:socketIncomingCallData]`
    if (socketIncomingCallData && socketIncomingCallData.callId) {
      if (activeIncomingCallRef.current && activeIncomingCallRef.current.callId === socketIncomingCallData.callId) {
        console.log(
          `${logPrefix} socketIncomingCallData for ${socketIncomingCallData.callId} matches activeIncomingCallRef. Ignoring to prevent re-processing.`,
        )
        return
      }
      console.log(
        `${logPrefix} Detected new/changed incomingCallData from SocketContext: ${socketIncomingCallData.callId}, isGroup: ${socketIncomingCallData.isGroupCall}`,
      )
      processIncomingCall(socketIncomingCallData)
    }
  }, [socketIncomingCallData, processIncomingCall])

  const setupTerminationListeners = useCallback(() => {
    const createHandler = (eventName) => (data) => {
      if (!data || !data.callId) return
      const { callId: eventCallId } = data
      const logPrefix = `[CallNotificationContext][Event:${eventName}][CallID:${eventCallId}]`

      if (activeIncomingCallRef.current && activeIncomingCallRef.current.callId === eventCallId) {
        console.log(`${logPrefix} Clearing active call due to event.`)
        AudioManager.stopAllSounds().catch((e) => console.error("Error stopping sounds on termination event", e))
        clearActiveIncomingCall(eventCallId, eventName)
        PushNotificationService.clearAllNotifications()
      }
    }

    const listeners = {
      "call-rejected": createHandler("call-rejected"),
      "call-ended": createHandler("call-ended"),
      "call-answered-on-other-device": createHandler("call-answered-on-other-device"),
      "call-rejected-on-other-device": createHandler("call-rejected-on-other-device"),
      "call-session-terminated": createHandler("call-session-terminated"),
      // Add listener for group call invite declined by inviter if needed, or if call is cancelled by inviter
      "group-call-invite-cancelled": createHandler("group-call-invite-cancelled"), // Example
      "group-call-ended": createHandler("group-call-ended"), // If the whole group call ends while invite is pending
    }

    if (socket && isConnected && authState.isAuthenticated) {
      console.log("[CallNotificationContext] Setting up termination/sync socket listeners.")
      Object.entries(listeners).forEach(([event, handler]) => socket.on(event, handler))
      return () => {
        console.log("[CallNotificationContext] Cleaning up termination/sync socket listeners.")
        Object.entries(listeners).forEach(([event, handler]) => socket.off(event, handler))
      }
    }
  }, [socket, isConnected, authState.isAuthenticated, clearActiveIncomingCall])

  useEffect(setupTerminationListeners, [setupTerminationListeners])

  const acceptCall = useCallback(
    async (callDataFromNotification) => {
      // callDataFromNotification is passed by CallActionHandler from the push notification payload
      const callToAccept = callDataFromNotification || activeIncomingCallRef.current

      if (!callToAccept || !callToAccept.callId) {
        console.error("[CallNotificationContext] acceptCall: No active call data.")
        return
      }
      const logPrefix = `[CallNotificationContext][acceptCall][CallID:${callToAccept.callId}]`

      try {
        console.log(`${logPrefix} Accepting call. Is group: ${callToAccept.isGroupCall}`)
        AudioManager.stopAllSounds().catch((e) => console.error("Error stopping sounds on accept", e))
        PushNotificationService.clearAllNotifications()

        clearActiveIncomingCall(callToAccept.callId, `user_accepted_${callToAccept.isGroupCall ? "group" : "p2p"}`)

        if (callToAccept.isGroupCall) {
          console.log(`${logPrefix} Navigating to GroupCallScreen.`)
          navigationRef.current?.navigate("GroupCallScreen", {
            groupCallId: callToAccept.callId,
            conversationId: callToAccept.conversationId,
            conversationName: callToAccept.conversationName || "Group Call",
            callType: callToAccept.callType,
            initiatorId: callToAccept.caller?.id,
            isIncoming: true,
          })
        } else {
          console.log(`${logPrefix} Navigating to CallScreen.`)
          navigationRef.current?.navigate("Call", {
            isIncoming: true,
            isPreAccepted: true, // CallScreen will handle sending actual "accept-call" with SDP
            callId: callToAccept.callId,
            callerInfo: callToAccept.caller, // Pass full caller info
            offer: callToAccept.offer,
            callType: callToAccept.callType,
            targetDeviceId: callToAccept.targetDeviceId,
          })
        }

        // Notify other devices of this user that the call was answered here
        if (socket && isConnected && authState.user) {
          const deviceIdToReport = authState.user.activeDevice || authState.user.deviceId
          socket.emit("call-answered-on-device", {
            callId: callToAccept.callId,
            deviceId: deviceIdToReport,
            isGroupCall: callToAccept.isGroupCall || false, // Add this flag
          })
        }
      } catch (error) {
        console.error(`${logPrefix} Error accepting call:`, error)
        Alert.alert("Error", "Failed to accept call.")
        if (callToAccept && callToAccept.callId) {
          clearActiveIncomingCall(callToAccept.callId, `accept_error_${callToAccept.isGroupCall ? "group" : "p2p"}`)
        }
      }
    },
    [socket, isConnected, authState.user, clearActiveIncomingCall, navigationRef],
  )

  const rejectCall = useCallback(
    async (callDataFromNotification) => {
      const callToReject = callDataFromNotification || activeIncomingCallRef.current
      if (!callToReject || !callToReject.callId) {
        console.error("[CallNotificationContext] rejectCall: No active call data.")
        return
      }
      const logPrefix = `[CallNotificationContext][rejectCall][CallID:${callToReject.callId}]`

      try {
        console.log(`${logPrefix} Rejecting call. Is group: ${callToReject.isGroupCall}`)
        AudioManager.stopAllSounds().catch((e) => console.error("Error stopping sounds on reject", e))
        PushNotificationService.clearAllNotifications()

        const deviceIdToReport = authState.user?.activeDevice || authState.user?.deviceId

        if (socket && isConnected && authState.token && deviceIdToReport) {
          if (callToReject.isGroupCall) {
            socket.emit("group-call-invite-declined", {
              callId: callToReject.callId,
              inviterId: callToReject.caller.id, // The one who initiated the group call offer
              inviteeId: authState.user.id, // The current user who is declining
              reason: "declined_by_user",
            })
            // Optionally log this action
            CallLogAPI.logCallEvent(authState.token, callToReject.callId, "group", "group_invite_declined", {
              conversationId: callToReject.conversationId,
            }).catch((e) => console.error(`${logPrefix} API error logging group_invite_declined`, e))
          } else {
            socket.emit("reject-call", {
              callId: callToReject.callId,
              callerId: callToReject.caller.id,
              deviceId: deviceIdToReport,
              reason: "rejected_by_user",
            })
            CallAPI.updateCallStatus(authState.token, callToReject.callId, "rejected").catch((e) =>
              console.error(`${logPrefix} API error updating status to rejected`, e),
            )
            CallLogAPI.logCallEvent(authState.token, callToReject.callId, "one-to-one", "call_rejected", {}).catch(
              (e) => console.error(`${logPrefix} API error logging call_rejected`, e),
            )
          }
        }
        clearActiveIncomingCall(callToReject.callId, `user_rejected_${callToReject.isGroupCall ? "group" : "p2p"}`)
      } catch (error) {
        console.error(`${logPrefix} Error rejecting call:`, error)
        if (callToReject && callToReject.callId) {
          clearActiveIncomingCall(callToReject.callId, `reject_error_${callToReject.isGroupCall ? "group" : "p2p"}`)
        }
      }
    },
    [socket, isConnected, authState.token, authState.user, clearActiveIncomingCall],
  )

  const contextValue = React.useMemo(
    () => ({
      // REMOVE: showIncomingCallModal,
      acceptCall, // This acceptCall now handles both types
      rejectCall, // This rejectCall now handles both types
      // REMOVE: dismissIncomingCallModal,
      activeIncomingCallData: activeIncomingCall, // This can be used by GlobalCallManager if needed, or GCM can use SocketContext directly
    }),
    [activeIncomingCall, acceptCall, rejectCall],
  )

  return (
    <CallNotificationContext.Provider value={contextValue}>
      {children}
      {/* REMOVE: The IncomingCallModal rendering from here */}
      {/*
        <IncomingCallModal
          visible={showIncomingCallModal && activeIncomingCall !== null}
          callData={activeIncomingCall}
          onAccept={acceptCall}
          onReject={rejectCall}
          onClose={dismissIncomingCallModal}
        />
      */}
    </CallNotificationContext.Provider>
  )
}

export const useCallNotification = () => {
  const context = useContext(CallNotificationContext)
  if (!context) {
    throw new Error("useCallNotification must be used within a CallNotificationProvider")
  }
  return context
}
