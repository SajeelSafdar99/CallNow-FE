"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { AuthContext } from "./AuthContext"
import { API_BASE_URL } from "../config/api"

export const SocketContext = createContext()

export const SocketProvider = ({ children }) => {
  const { state: authState } = useContext(AuthContext)
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    let socketInstance = null

    // Initialize socket when user is authenticated
    if (authState.isAuthenticated && authState.token && authState.deviceId) {
      // Use a safer approach to initialize socket.io
      const initSocket = async () => {
        try {
          // Dynamically import socket.io-client only when needed
          const { io } = await import("socket.io-client")

          // Create socket instance with proper configuration
          socketInstance = io(API_BASE_URL, {
            auth: {
              token: authState.token,
              deviceId: authState.deviceId,
            },
            transports: ["websocket"],
            autoConnect: false,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            forceNew: true,
          })

          // Connect manually after setup
          socketInstance.connect()

          socketInstance.on("connect", () => {
            console.log("Socket connected")
            setIsConnected(true)
          })

          socketInstance.on("connect_error", (error) => {
            console.error("Socket connection error:", error)
            setIsConnected(false)
          })

          socketInstance.on("disconnect", (reason) => {
            console.log("Socket disconnected:", reason)
            setIsConnected(false)
          })

          // Add additional socket event listeners for call functionality
          socketInstance.on("incoming-call", (callData) => {
            console.log("Incoming call:", callData)
            // This event will be handled in the CallScreen component
          })

          socketInstance.on("call-accepted", (callData) => {
            console.log("Call accepted:", callData)
            // This event will be handled in the CallScreen component
          })

          socketInstance.on("call-rejected", (callData) => {
            console.log("Call rejected:", callData)
            // This event will be handled in the CallScreen component
          })

          socketInstance.on("call-ended", (callData) => {
            console.log("Call ended:", callData)
            // This event will be handled in the CallScreen component
          })

          socketInstance.on("ice-candidate", (data) => {
            console.log("Received ICE candidate")
            // This event will be handled in the CallScreen component
          })

          socketInstance.on("session-description", (data) => {
            console.log("Received session description")
            // This event will be handled in the CallScreen component
          })

          setSocket(socketInstance)
        } catch (error) {
          console.error("Error initializing socket:", error)
        }
      }

      // Initialize socket with a slight delay to ensure React Native is ready
      setTimeout(initSocket, 100)
    }

    // Cleanup on unmount or when auth state changes
    return () => {
      if (socketInstance) {
        socketInstance.disconnect()
        socketInstance.off("connect")
        socketInstance.off("connect_error")
        socketInstance.off("disconnect")
        socketInstance.off("incoming-call")
        socketInstance.off("call-accepted")
        socketInstance.off("call-rejected")
        socketInstance.off("call-ended")
        socketInstance.off("ice-candidate")
        socketInstance.off("session-description")
        setSocket(null)
        setIsConnected(false)
      }
    }
  }, [authState.isAuthenticated, authState.token, authState.deviceId])

  // Socket event handlers
  const joinConversation = (conversationId) => {
    if (socket && isConnected) {
      socket.emit("join-conversation", conversationId)
    }
  }

  const leaveConversation = (conversationId) => {
    if (socket && isConnected) {
      socket.emit("leave-conversation", conversationId)
    }
  }

  const sendMessage = (message) => {
    if (socket && isConnected) {
      socket.emit("send-message", message)
    }
  }

  const markAsRead = (messageId, conversationId, userId) => {
    if (socket && isConnected) {
      socket.emit("read-message", { messageId, conversationId, userId })
    }
  }

  const markAsDelivered = (messageId, conversationId, userId) => {
    if (socket && isConnected) {
      socket.emit("deliver-message", { messageId, conversationId, userId })
    }
  }

  const setTyping = (conversationId, userId) => {
    if (socket && isConnected) {
      socket.emit("typing", { conversationId, userId })
    }
  }

  const setStopTyping = (conversationId, userId) => {
    if (socket && isConnected) {
      socket.emit("stop-typing", { conversationId, userId })
    }
  }

  const setOnlineStatus = (status) => {
    if (socket && isConnected) {
      socket.emit("set-online-status", { status })
    }
  }

  // Call-related socket events
  const initiateCall = (callData) => {
    if (socket && isConnected) {
      socket.emit("initiate-call", callData)
    }
  }

  const acceptCall = (callId, userId) => {
    if (socket && isConnected) {
      socket.emit("accept-call", { callId, userId })
    }
  }

  const rejectCall = (callId, userId) => {
    if (socket && isConnected) {
      socket.emit("reject-call", { callId, userId })
    }
  }

  const endCall = (callId) => {
    if (socket && isConnected) {
      socket.emit("end-call", { callId })
    }
  }

  // ICE candidate exchange for WebRTC
  const sendIceCandidate = (callId, candidate, recipientId) => {
    if (socket && isConnected) {
      socket.emit("ice-candidate", { callId, candidate, recipientId })
    }
  }

  // SDP exchange for WebRTC
  const sendSessionDescription = (callId, description, recipientId) => {
    if (socket && isConnected) {
      socket.emit("session-description", { callId, description, recipientId })
    }
  }

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        joinConversation,
        leaveConversation,
        sendMessage,
        markAsRead,
        markAsDelivered,
        setTyping,
        setStopTyping,
        setOnlineStatus,
        initiateCall,
        acceptCall,
        rejectCall,
        endCall,
        sendIceCandidate,
        sendSessionDescription,
      }}
    >
      {children}
    </SocketContext.Provider>
  )
}
