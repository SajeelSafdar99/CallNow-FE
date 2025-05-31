"use client"

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react"
import { AppState, Alert } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { AuthContext } from "./AuthContext"
import { SocketContext } from "./SocketContext"
import IncomingCallModal from "../components/calls/IncomingCallModal"
import PushNotificationService from "../utils/push-notification-service"
import * as CallAPI from "../api/call"
import * as CallLogAPI from "../api/call-log"

export const CallNotificationContext = createContext()

export const CallNotificationProvider = ({ children }) => {
  const navigation = useNavigation() // Initial navigation object
  const { state: authState } = useContext(AuthContext)
  const { socket, isConnected } = useContext(SocketContext)

  const [incomingCall, setIncomingCall] = useState(null)
  const [showIncomingCallModal, setShowIncomingCallModal] = useState(false)
  const [currentAppState, setCurrentAppState] = useState(AppState.currentState)

  const callTimeoutRef = useRef(null)
  const isHandlingCallRef = useRef(false) // Use Ref for mutable flag not triggering re-renders
  const navigationRef = useRef(navigation) // Keep a ref to the latest navigation object

  // Update navigation ref if the navigation prop changes (e.g., context re-renders)
  useEffect(() => {
    navigationRef.current = navigation
  }, [navigation])

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      console.log("App state changed:", currentAppState, "->", nextAppState)
      setCurrentAppState(nextAppState)
    })
    return () => {
      subscription?.remove()
    }
  }, [currentAppState]) // Dependency on currentAppState to re-subscribe if it changes internally

  const clearIncomingCall = useCallback(() => {
    console.log("Clearing incoming call state")
    setIncomingCall(null)
    setShowIncomingCallModal(false)
    isHandlingCallRef.current = false
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current)
      callTimeoutRef.current = null
    }
  }, [])

  const handleCallTimeout = useCallback(
    async (callId) => {
      try {
        console.log("Handling call timeout for callId:", callId)
        if (authState.token && callId) {
          await CallAPI.updateCallStatus(authState.token, callId, "missed")
          await CallLogAPI.logCallEvent(authState.token, callId, "one-to-one", "call_missed", {})
        }
        clearIncomingCall()
        PushNotificationService.clearAllNotifications()
      } catch (error) {
        console.error("Error handling call timeout:", error)
        clearIncomingCall() // Ensure cleanup even on error
      }
    },
    [authState.token, clearIncomingCall],
  )

  const handleIncomingCallNotification = useCallback(
    async (callData) => {
      try {
        console.log("Received incoming call notification:", callData)
        if (isHandlingCallRef.current) {
          console.log("Already handling a call, ignoring new incoming call")
          return
        }
        isHandlingCallRef.current = true

        const { callId, caller, callType, offer, targetDeviceId } = callData

        if (targetDeviceId && authState.user && targetDeviceId !== authState.user.deviceId) {
          console.log(
            "Call not targeted to this device, ignoring. Target:",
            targetDeviceId,
            "Current:",
            authState.user.deviceId,
          )
          isHandlingCallRef.current = false
          return
        }

        const incomingCallData = { callId, caller, callType, offer, timestamp: Date.now() }
        setIncomingCall(incomingCallData)

        if (currentAppState === "active") {
          console.log("App is active, showing incoming call modal")
          setShowIncomingCallModal(true)
        } else {
          console.log("App is in background/inactive, showing system notification")
          PushNotificationService.showIncomingCallNotification(incomingCallData)
          setShowIncomingCallModal(true) // Prepare modal for when app is opened
        }

        if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current) // Clear previous timeout just in case
        callTimeoutRef.current = setTimeout(() => {
          // Check if the call is still the same one we set the timeout for
          setIncomingCall((currentCall) => {
            if (currentCall && currentCall.callId === callId) {
              console.log("Call timeout - not answered for callId:", callId)
              handleCallTimeout(callId)
            }
            return currentCall // Return currentCall for setIncomingCall
          })
        }, 45000)

        if (authState.token && callId) {
          await CallLogAPI.logCallEvent(authState.token, callId, "one-to-one", "call_received", {
            callType,
            callerInfo: { id: caller.id, name: caller.name, profilePicture: caller.profilePicture },
          })
        }
      } catch (error) {
        console.error("Error handling incoming call notification:", error)
        isHandlingCallRef.current = false // Reset flag on error
      }
    },
    [currentAppState, authState.token, handleCallTimeout, clearIncomingCall],
  )

  const handleCallCanceled = useCallback(
    (data) => {
      // Potentially for "caller-canceled-ringing-call"
      const { callId } = data
      console.log("Call canceled by other party (or caller hung up before answer):", callId)
      setIncomingCall((currentVal) => {
        if (currentVal && currentVal.callId === callId) {
          console.log("Clearing incoming call due to cancellation/end by other party")
          clearIncomingCall()
          PushNotificationService.clearAllNotifications()
          return null
        }
        return currentVal
      })
    },
    [clearIncomingCall],
  )

  // This is effectively the same as handleCallCanceled if it means the call ended before pickup.
  // If "call-ended" is for active calls, it should be handled in CallScreen or similar.
  const handleCallEnded = useCallback(
    (data) => {
      const { callId } = data
      console.log("Call ended by other party (event: call-ended):", callId)
      setIncomingCall((currentVal) => {
        if (currentVal && currentVal.callId === callId) {
          console.log("Clearing incoming call due to 'call-ended' event")
          clearIncomingCall()
          PushNotificationService.clearAllNotifications()
          return null
        }
        return currentVal
      })
    },
    [clearIncomingCall],
  )

  const handleCallRejectedElsewhere = useCallback(
    (data) => {
      const { callId } = data
      console.log("Call rejected on another device:", callId)
      setIncomingCall((currentVal) => {
        if (currentVal && currentVal.callId === callId) {
          console.log("Clearing incoming call - rejected elsewhere")
          clearIncomingCall()
          PushNotificationService.clearAllNotifications()
          return null
        }
        return currentVal
      })
    },
    [clearIncomingCall],
  )

  const handleCallAnsweredElsewhere = useCallback(
    (data) => {
      const { callId } = data
      console.log("Call answered on another device:", callId)
      setIncomingCall((currentVal) => {
        if (currentVal && currentVal.callId === callId) {
          console.log("Clearing incoming call - answered elsewhere")
          clearIncomingCall()
          PushNotificationService.clearAllNotifications()
          return null
        }
        return currentVal
      })
    },
    [clearIncomingCall],
  )

  useEffect(() => {
    if (socket && isConnected && authState.isAuthenticated) {
      console.log("CallNotificationContext: Setting up socket listeners")
      socket.on("incoming-call-notification", handleIncomingCallNotification)
      // Assuming "call-rejected" means caller canceled or call terminated before pickup by this user.
      // Or it could be a generic "call-failed-to-connect" type of event.
      socket.on("call-rejected", handleCallCanceled) // Or handleCallEnded if semantics match
      socket.on("call-ended", handleCallEnded) // Typically for calls that were active or caller hung up ringing.

      // Listeners for multi-device sync
      socket.on("call-answered-on-other-device", handleCallAnsweredElsewhere)
      socket.on("call-rejected-on-other-device", handleCallRejectedElsewhere)

      return () => {
        console.log("CallNotificationContext: Cleaning up socket listeners")
        socket.off("incoming-call-notification", handleIncomingCallNotification)
        socket.off("call-rejected", handleCallCanceled)
        socket.off("call-ended", handleCallEnded)
        socket.off("call-answered-on-other-device", handleCallAnsweredElsewhere)
        socket.off("call-rejected-on-other-device", handleCallRejectedElsewhere)
      }
    }
  }, [
    socket,
    isConnected,
    authState.isAuthenticated,
    handleIncomingCallNotification,
    handleCallCanceled,
    handleCallEnded,
    handleCallAnsweredElsewhere,
    handleCallRejectedElsewhere,
  ])

  const acceptCall = useCallback(
    async (callData) => {
      if (!callData || !callData.callId) {
        console.error("acceptCall: Invalid callData", callData)
        return
      }
      try {
        console.log("Accepting incoming call:", callData.callId)
        PushNotificationService.clearAllNotifications()

        // Important: Clear incoming call state *before* navigating to prevent race conditions
        // or modal re-appearing if navigation is slow or context updates.
        const currentCallToAccept = { ...callData } // Capture data before clearing
        clearIncomingCall()

        navigationRef.current?.navigate("Call", {
          isIncoming: true,
          callId: currentCallToAccept.callId,
          callerId: currentCallToAccept.caller.id,
          callerName: currentCallToAccept.caller.name,
          callerProfilePic: currentCallToAccept.caller.profilePicture,
          callType: currentCallToAccept.callType,
          offer: currentCallToAccept.offer,
        })

        if (socket && isConnected && authState.user) {
          socket.emit("call-answered-on-device", {
            callId: currentCallToAccept.callId,
            deviceId: authState.user.deviceId,
          })
        }
      } catch (error) {
        console.error("Error accepting call:", error)
        Alert.alert("Error", "Failed to accept call. Please try again.")
        // Optionally, attempt to restore some state or inform user further
      }
    },
    [socket, isConnected, authState.user, clearIncomingCall, navigationRef],
  )

  const rejectCall = useCallback(
    async (callData) => {
      if (!callData || !callData.callId) {
        console.error("rejectCall: Invalid callData", callData)
        return
      }
      try {
        console.log("Rejecting incoming call:", callData.callId)
        if (socket && isConnected && authState.token && authState.user) {
          socket.emit("reject-call", {
            callId: callData.callId,
            callerId: callData.caller.id, // ID of the person who initiated the call
            deviceId: authState.user.deviceId, // Device that is rejecting
          })
          await CallAPI.updateCallStatus(authState.token, callData.callId, "rejected")
          await CallLogAPI.logCallEvent(authState.token, callData.callId, "one-to-one", "call_rejected", {})
        }
        clearIncomingCall()
        PushNotificationService.clearAllNotifications()
      } catch (error) {
        console.error("Error rejecting call:", error)
        clearIncomingCall() // Ensure cleanup
      }
    },
    [socket, isConnected, authState.token, authState.user, clearIncomingCall],
  )

  const dismissIncomingCallModal = useCallback(() => {
    console.log("Dismissing incoming call modal")
    // Only dismiss if not actively handling (e.g. navigating away)
    // If user explicitly closes modal, it might imply a soft rejection or ignore.
    // For now, just hiding it. Consider if this should also trigger rejectCall.
    setShowIncomingCallModal(false)
  }, [])

  const hasIncomingCall = useCallback(() => {
    return incomingCall !== null
  }, [incomingCall])

  const getCurrentIncomingCall = useCallback(() => {
    return incomingCall
  }, [incomingCall])

  const contextValue = React.useMemo(
    () => ({
      incomingCall,
      showIncomingCallModal,
      acceptCall,
      rejectCall,
      clearIncomingCall,
      dismissIncomingCallModal,
      hasIncomingCall,
      getCurrentIncomingCall,
    }),
    [
      incomingCall,
      showIncomingCallModal,
      acceptCall,
      rejectCall,
      clearIncomingCall,
      dismissIncomingCallModal,
      hasIncomingCall,
      getCurrentIncomingCall,
    ],
  )

  return (
    <CallNotificationContext.Provider value={contextValue}>
      {children}
      <IncomingCallModal
        visible={showIncomingCallModal && incomingCall !== null} // Ensure incomingCall is not null
        callData={incomingCall}
        onAccept={() => incomingCall && acceptCall(incomingCall)} // Pass current incomingCall data
        onReject={() => incomingCall && rejectCall(incomingCall)} // Pass current incomingCall data
        onClose={dismissIncomingCallModal} // onClose might be better named onDismiss
      />
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
