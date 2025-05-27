"use client"

import { createContext, useContext, useEffect, useState, useRef } from "react"
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
  const navigation = useNavigation()
  const { state: authState } = useContext(AuthContext)
  const { socket, isConnected } = useContext(SocketContext)

  const [incomingCall, setIncomingCall] = useState(null)
  const [showIncomingCallModal, setShowIncomingCallModal] = useState(false)
  const [appState, setAppState] = useState(AppState.currentState)

  const callTimeoutRef = useRef(null)
  const isHandlingCall = useRef(false)
  const navigationRef = useRef(navigation)

  // Update navigation ref
  useEffect(() => {
    navigationRef.current = navigation
  }, [navigation])

  // Monitor app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      console.log("App state changed:", appState, "->", nextAppState)
      setAppState(nextAppState)
    })

    return () => {
      subscription?.remove()
    }
  }, [appState])

  // Set up socket listeners for incoming calls
  useEffect(() => {
    if (socket && isConnected && authState.isAuthenticated) {
      console.log("Setting up call notification socket listeners")

      // Listen for incoming call notifications
      socket.on("incoming-call-notification", handleIncomingCallNotification)

      // Listen for call canceled
      socket.on("call-canceled", handleCallCanceled)

      // Listen for caller hung up
      socket.on("call-ended", handleCallEnded)

      // Listen for call rejected by another device
      socket.on("call-rejected-elsewhere", handleCallRejectedElsewhere)

      // Listen for call answered by another device
      socket.on("call-answered-elsewhere", handleCallAnsweredElsewhere)

      return () => {
        console.log("Cleaning up call notification socket listeners")
        socket.off("incoming-call-notification", handleIncomingCallNotification)
        socket.off("call-canceled", handleCallCanceled)
        socket.off("call-ended", handleCallEnded)
        socket.off("call-rejected-elsewhere", handleCallRejectedElsewhere)
        socket.off("call-answered-elsewhere", handleCallAnsweredElsewhere)
      }
    }
  }, [socket, isConnected, authState.isAuthenticated])

  // Handle incoming call notification
  const handleIncomingCallNotification = async (callData) => {
    try {
      console.log("Received incoming call notification:", callData)

      // Prevent handling multiple calls simultaneously
      if (isHandlingCall.current) {
        console.log("Already handling a call, ignoring new incoming call")
        return
      }

      isHandlingCall.current = true

      const { callId, caller, callType, offer, targetDeviceId } = callData

      // Check if this call is targeted to this device
      if (targetDeviceId && targetDeviceId !== authState.user.deviceId) {
        console.log("Call not targeted to this device, ignoring")
        isHandlingCall.current = false
        return
      }

      // Set incoming call data
      const incomingCallData = {
        callId,
        caller,
        callType,
        offer,
        timestamp: Date.now(),
      }

      setIncomingCall(incomingCallData)

      // Show incoming call UI based on app state
      if (appState === "active") {
        // App is in foreground - show modal
        console.log("App is active, showing incoming call modal")
        setShowIncomingCallModal(true)
      } else {
        // App is in background - show system notification
        console.log("App is in background, showing system notification")
        PushNotificationService.showIncomingCallNotification(incomingCallData)

        // Also show modal for when user opens the app
        setShowIncomingCallModal(true)
      }

      // Set timeout for call not answered
      callTimeoutRef.current = setTimeout(() => {
        if (incomingCall && incomingCall.callId === callId) {
          console.log("Call timeout - not answered")
          handleCallTimeout(callId)
        }
      }, 45000) // 45 seconds timeout

      // Log incoming call event
      try {
        await CallLogAPI.logCallEvent(authState.token, callId, "one-to-one", "call_received", {
          callType,
          callerInfo: {
            id: caller.id,
            name: caller.name,
            profilePicture: caller.profilePicture,
          },
        })
      } catch (logError) {
        console.error("Error logging call event:", logError)
      }
    } catch (error) {
      console.error("Error handling incoming call notification:", error)
      isHandlingCall.current = false
    }
  }

  // Handle call canceled by caller
  const handleCallCanceled = (data) => {
    const { callId } = data
    console.log("Call canceled by caller:", callId)

    if (incomingCall && incomingCall.callId === callId) {
      console.log("Clearing incoming call due to cancellation")
      clearIncomingCall()

      // Clear any system notifications
      PushNotificationService.clearAllNotifications()
    }
  }

  // Handle call ended by caller
  const handleCallEnded = (data) => {
    const { callId } = data
    console.log("Call ended by caller:", callId)

    if (incomingCall && incomingCall.callId === callId) {
      console.log("Clearing incoming call due to end")
      clearIncomingCall()

      // Clear any system notifications
      PushNotificationService.clearAllNotifications()
    }
  }

  // Handle call rejected by another device
  const handleCallRejectedElsewhere = (data) => {
    const { callId } = data
    console.log("Call rejected on another device:", callId)

    if (incomingCall && incomingCall.callId === callId) {
      console.log("Clearing incoming call - rejected elsewhere")
      clearIncomingCall()

      // Clear any system notifications
      PushNotificationService.clearAllNotifications()
    }
  }

  // Handle call answered by another device
  const handleCallAnsweredElsewhere = (data) => {
    const { callId } = data
    console.log("Call answered on another device:", callId)

    if (incomingCall && incomingCall.callId === callId) {
      console.log("Clearing incoming call - answered elsewhere")
      clearIncomingCall()

      // Clear any system notifications
      PushNotificationService.clearAllNotifications()
    }
  }

  // Handle call timeout (not answered)
  const handleCallTimeout = async (callId) => {
    try {
      console.log("Handling call timeout for callId:", callId)

      // Update call status to missed
      try {
        await CallAPI.updateCallStatus(authState.token, callId, "missed")
      } catch (apiError) {
        console.error("Error updating call status to missed:", apiError)
      }

      // Log missed call event
      try {
        await CallLogAPI.logCallEvent(authState.token, callId, "one-to-one", "call_missed", {})
      } catch (logError) {
        console.error("Error logging missed call event:", logError)
      }

      // Clear incoming call
      clearIncomingCall()

      // Clear any system notifications
      PushNotificationService.clearAllNotifications()
    } catch (error) {
      console.error("Error handling call timeout:", error)
    }
  }

  // Accept incoming call
  const acceptCall = async (callData) => {
    try {
      console.log("Accepting incoming call:", callData.callId)

      // Clear any system notifications
      PushNotificationService.clearAllNotifications()

      // Clear the incoming call state
      clearIncomingCall()

      // Navigate to call screen
      navigationRef.current.navigate("Call", {
        isIncoming: true,
        callId: callData.callId,
        callerId: callData.caller.id,
        callerName: callData.caller.name,
        callerProfilePic: callData.caller.profilePicture,
        callType: callData.callType,
        offer: callData.offer,
      })

      // Notify other devices that call was answered
      if (socket && isConnected) {
        socket.emit("call-answered-on-device", {
          callId: callData.callId,
          deviceId: authState.user.deviceId,
        })
      }
    } catch (error) {
      console.error("Error accepting call:", error)
      Alert.alert("Error", "Failed to accept call. Please try again.")
    }
  }

  // Reject incoming call
  const rejectCall = async (callData) => {
    try {
      console.log("Rejecting incoming call:", callData.callId)

      // Send rejection via socket
      if (socket && isConnected) {
        socket.emit("reject-call", {
          callId: callData.callId,
          callerId: callData.caller.id,
          deviceId: authState.user.deviceId,
        })
      }

      // Update call status in backend
      try {
        await CallAPI.updateCallStatus(authState.token, callData.callId, "rejected")
      } catch (apiError) {
        console.error("Error updating call status to rejected:", apiError)
      }

      // Log call rejected event
      try {
        await CallLogAPI.logCallEvent(authState.token, callData.callId, "one-to-one", "call_rejected", {})
      } catch (logError) {
        console.error("Error logging call rejected event:", logError)
      }

      // Clear incoming call
      clearIncomingCall()

      // Clear any system notifications
      PushNotificationService.clearAllNotifications()
    } catch (error) {
      console.error("Error rejecting call:", error)
      clearIncomingCall()
    }
  }

  // Clear incoming call state
  const clearIncomingCall = () => {
    console.log("Clearing incoming call state")
    setIncomingCall(null)
    setShowIncomingCallModal(false)
    isHandlingCall.current = false

    // Clear timeout
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current)
      callTimeoutRef.current = null
    }
  }

  // Dismiss incoming call modal
  const dismissIncomingCallModal = () => {
    console.log("Dismissing incoming call modal")
    setShowIncomingCallModal(false)
  }

  // Check if there's an active incoming call
  const hasIncomingCall = () => {
    return incomingCall !== null
  }

  // Get current incoming call data
  const getCurrentIncomingCall = () => {
    return incomingCall
  }

  const contextValue = {
    incomingCall,
    showIncomingCallModal,
    acceptCall,
    rejectCall,
    clearIncomingCall,
    dismissIncomingCallModal,
    hasIncomingCall,
    getCurrentIncomingCall,
  }

  return (
    <CallNotificationContext.Provider value={contextValue}>
      {children}

      {/* Incoming Call Modal */}
      <IncomingCallModal
        visible={showIncomingCallModal}
        callData={incomingCall}
        onAccept={acceptCall}
        onReject={rejectCall}
        onClose={dismissIncomingCallModal}
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
