"use client"

import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react"
import { AuthContext } from "./AuthContext"
import { SOCKET_URL } from "../config/api"
import { io } from "socket.io-client"

export const SocketContext = createContext()

// Create a global socket reference to prevent recreation
let globalSocketInstance = null

export const SocketProvider = ({ children }) => {
  const { state: authState } = useContext(AuthContext)
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState([])
  const [messages, setMessages] = useState([])
  const [call, setCall] = useState(null)
  const [callAccepted, setCallAccepted] = useState(false)
  const [callEnded, setCallEnded] = useState(false)
  const [name, setName] = useState("")
  const [stream, setStream] = useState(null)
  const myVideo = useRef()
  const userVideo = useRef()
  const connectionRef = useRef()
  const socketInitializedRef = useRef(false)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5
  const [incomingCallData, setIncomingCallData] = useState(null)


  // Enhanced getSocket function with better error handling
  const getSocket = useCallback(() => {
    if (!socket) {
      console.warn("Socket is not initialized yet. Waiting for connection...")
      return null
    }

    if (!isConnected) {
      console.warn("Socket is initialized but not connected. Operations may fail.")
    }

    return socket
  }, [socket, isConnected])

  // Initialize socket connection
  const initializeSocket = useCallback(() => {
    if (!authState.isAuthenticated || !authState.token || !authState.user?.id) {
      console.log("Cannot initialize socket: missing auth credentials")
      return null
    }

    if (socketInitializedRef.current) {
      console.log("Socket already initialized, skipping")
      return globalSocketInstance
    }

    try {
      console.log("Initializing socket connection to:", SOCKET_URL)
console.log("SocketContext: Auth state:", authState)
      // Create socket instance with proper configuration
      const socketInstance = io(SOCKET_URL, {
        auth: {
          token: authState.token,
          deviceId: authState.user.activeDevice,
        },
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: 1000,
        timeout: 10000,
        forceNew: false,
        path: "/socket.io/",
      })

      // Set up event listeners
      socketInstance.on("connect", () => {
        console.log("Socket connected successfully:", socketInstance.id)
        setIsConnected(true)
        reconnectAttemptsRef.current = 0
      })

      socketInstance.on("connect_error", (error) => {
        console.error("Socket connection error:", error.message)
        setIsConnected(false)

        reconnectAttemptsRef.current += 1
        if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.error("Max reconnection attempts reached")
        }
      })

      socketInstance.on("disconnect", (reason) => {
        console.log("Socket disconnected:", reason)
        setIsConnected(false)
      })

      socketInstance.on("reconnect", (attemptNumber) => {
        console.log("Socket reconnected after", attemptNumber, "attempts")
        setIsConnected(true)
      })

      socketInstance.on("reconnect_error", (error) => {
        console.error("Socket reconnection error:", error.message)
      })

      socketInstance.on("reconnect_failed", () => {
        console.error("Socket reconnection failed after max attempts")
      })

      socketInstance.on("call-session-terminated", (data) => {
        console.log("Call session terminated:", JSON.stringify(data));

        if (data?.callId) {
          // Clear incoming call data immediately
          setIncomingCallData((prevData) => {
            if (prevData?.callId === data.callId) {
              console.log(`Clearing incoming call data for callId: ${data.callId}`);
              return null;
            }
            return prevData;
          });

          // Check if we're currently on the call screen for this call
          if (global.navigationRef) {
            const currentRoute = global.navigationRef.getCurrentRoute();
            if (currentRoute?.name === 'Call') {
              const currentParams = currentRoute.params;
              if (currentParams?.callId === data.callId) {
                console.log("Navigating away from terminated call");
                // Use a timeout to ensure the termination is processed
                setTimeout(() => {
                  if (global.navigationRef.canGoBack()) {
                    global.navigationRef.goBack();
                  } else {
                    global.navigationRef.navigate("AppTabs", { screen: "Chats" });
                  }
                }, 500);
              }
            }
          }
        }
      })
      socketInstance.on("incoming-call-notification", (data) => {
        console.log("Incoming call notification:", JSON.stringify(data));

        const currentActiveDeviceId = authState.user.activeDevice;

        if (data?.callId && data?.caller && data?.offer) {
          // Check if this call was already terminated
          // You might want to add a terminated calls cache here

          if (!data.targetDeviceId || data.targetDeviceId === currentActiveDeviceId) {
            console.log(`Processing incoming call for device: ${currentActiveDeviceId}`);

            // Set incoming call data
            setIncomingCallData(data);

            const navigationParams = {
              callId: data.callId,
              callerInfo: data.caller,
              offer: data.offer,
              callType: data.callType,
              targetDeviceId: data.targetDeviceId,
              isIncoming: true,
            };

            // Add a small delay to ensure any previous call cleanup is complete
            setTimeout(() => {
              if (global.navigationRef) {
                try {
                  global.navigationRef.navigate("Call", navigationParams);
                } catch (navError) {
                  console.error("Navigation error:", navError);
                }
              }
            }, 100);
          }
        }
      });
      // socketInstance.on("incoming-call-notification", (data) => {
      //   console.log("[SocketContext] 'incoming-call-notification' listener triggered. Raw Data:", JSON.stringify(data))
      //   const currentActiveDeviceId = authState.user.activeDevice
      //   if (data && data.callId && data.caller && data.offer) {
      //     // Ensure the call is for this specific device or if no targetDeviceId is specified (broadcast to all user's devices)
      //     if (!data.targetDeviceId || data.targetDeviceId === currentActiveDeviceId) {
      //       console.log(`SocketContext: Incoming call for this device (ID: ${currentActiveDeviceId}). Processing...`)
      //       setIncomingCallData(data) // Store call data
      //       const navigationParams = {
      //         callId: data.callId,
      //         callerInfo: data.caller,
      //         offer: data.offer,
      //         callType: data.callType,
      //         targetDeviceId: data.targetDeviceId, // Pass along the targetDeviceId
      //         isIncoming: true,
      //       }
      //
      //       console.log(
      //         "[SocketContext] Preparing to navigate to CallScreen. Params:",
      //         JSON.stringify(navigationParams),
      //       )
      //
      //       let navigated = false
      //       if (global.navigationRef) {
      //         if (typeof global.navigationRef.navigate === "function") {
      //           console.log("SocketContext: Navigating to CallScreen using global.navigationRef.navigate().")
      //           global.navigationRef.navigate("Call", navigationParams)
      //           navigated = true
      //         } else if (global.navigationRef.current && typeof global.navigationRef.current.navigate === "function") {
      //           console.log("SocketContext: Navigating to CallScreen using global.navigationRef.current.navigate().")
      //           global.navigationRef.current.navigate("Call", navigationParams)
      //           navigated = true
      //         }
      //       }
      //
      //       if (!navigated) {
      //         console.error(
      //           "SocketContext: global.navigationRef is not available or not a valid navigator. Call data stored in incomingCallData. NavigationRef:",
      //           global.navigationRef,
      //         )
      //       }
      //     } else {
      //       console.log(
      //         `SocketContext: Incoming call ignored. Target device (${data.targetDeviceId}) does not match current device (${currentActiveDeviceId}).`,
      //       )
      //     }
      //   } else {
      //     console.warn("SocketContext: 'incoming-call-notification' event received with incomplete/invalid data:", data)
      //   }
      // })
      //
      //   console.log(
      //     `[SocketContext] Own device ID for check: ${ownDeviceId}, Event targetDeviceId: ${data.targetDeviceId}`,
      //   )
      //   console.log("SocketContext: Received 'incoming-call-notification'", data)
      //   if (data && data.callId && data.caller && data.offer) {
      //     if (!data.targetDeviceId || data.targetDeviceId === ownDeviceId) {
      //       console.log(`SocketContext: Incoming call for this device (ID: ${ownDeviceId}).`)
      //       setIncomingCallData(data)
      //
      //       console.log(
      //         "[SocketContext] Preparing to navigate to CallScreen. Params to be sent:",
      //         JSON.stringify({
      //           callId: data.callId,
      //           callerInfo: data.caller,
      //           offer: data.offer ? "Offer Present" : "No Offer",
      //           callType: data.callType,
      //           targetDeviceId: data.targetDeviceId,
      //           isIncoming: true,
      //         }),
      //       )
      //
      //       if (global.navigationRef && typeof global.navigationRef.navigate === "function") {
      //         console.log("SocketContext: Navigating to CallScreen for incoming call.")
      //         global.navigationRef.navigate("Call", {
      //           callId: data.callId,
      //           callerInfo: data.caller,
      //           offer: data.offer,
      //           callType: data.callType,
      //           targetDeviceId: data.targetDeviceId,
      //           isIncoming: true,
      //         })
      //       } else if (!data.targetDeviceId || data.targetDeviceId === ownDeviceId) {
      //         console.log("SocketContext: Navigating to CallScreen for incoming call.")
      //         global.navigationRef.current.navigate("Call", {
      //           callId: data.callId,
      //           callerInfo: data.caller,
      //           offer: data.offer,
      //           callType: data.callType,
      //         })
      //       }
      //
      //       else {
      //         console.error(
      //           "SocketContext: navigationRef not available or not a navigator. Call data stored in incomingCallData.",
      //         )
      //       }
      //     } else {
      //       console.log(
      //         `SocketContext: Incoming call ignored. Target device (${data.targetDeviceId}) does not match current device (${currentDeviceId}).`,
      //       )
      //     }
      //   } else {
      //     console.warn("SocketContext: 'incoming-call-notification' event received with incomplete data:", data)
      //   }
      // })
      // Connect socket
      socketInstance.connect()

      // Set the global and local socket instances
      globalSocketInstance = socketInstance
      socketInitializedRef.current = true

      return socketInstance
    } catch (error) {
      console.error("Error creating socket instance:", error)
      return null
    }
  }, [authState.isAuthenticated, authState.token, authState.user?.id, authState.user?.deviceId])



  const emitWithSocket = useCallback(
    (event, data, ackCallback) => {
      const currentSocket = getSocket()
      if (currentSocket && currentSocket.connected) {
        try {
          if (ackCallback) {
            currentSocket.emit(event, data, ackCallback)
          } else {
            currentSocket.emit(event, data)
          }
          console.log(`SocketContext: Emitted '${event}' with data:`, data)
        } catch (error) {
          console.error(`SocketContext: Error emitting '${event}':`, error)
        }
      } else {
        console.warn(`SocketContext: Cannot emit '${event}'. Socket not available or not connected.`)
      }
    },
    [getSocket],
  )

  const initiateCall = useCallback((callData) => emitWithSocket("initiate-call", callData), [emitWithSocket])
  const acceptCall = useCallback((acceptData) => emitWithSocket("accept-call", acceptData), [emitWithSocket])
  const rejectCall = useCallback((rejectData) => emitWithSocket("reject-call", rejectData), [emitWithSocket])
  const endCall = useCallback((endData) => emitWithSocket("end-call", endData), [emitWithSocket])
  const sendIceCandidate = useCallback((iceData) => emitWithSocket("send-ice-candidate", iceData), [emitWithSocket])
  const requestIceRestart = useCallback(
    (restartData) => emitWithSocket("request-ice-restart", restartData),
    [emitWithSocket],
  )
  const sendGroupCallOffer = useCallback((offer) => emitWithSocket("send-group-call-offer", offer), [emitWithSocket])
  const sendGroupCallAnswer = useCallback(
    (answer) => emitWithSocket("send-group-call-answer", answer),
    [emitWithSocket],
  )
  const sendGroupCallIceCandidate = useCallback(
    (candidate) => emitWithSocket("send-group-call-ice-candidate", candidate),
    [emitWithSocket],
  )
  const notifyGroupCallUserJoined = useCallback(
    (userId) => emitWithSocket("notify-group-call-user-joined", userId),
    [emitWithSocket],
  )
  const notifyGroupCallUserLeft = useCallback(
    (userId) => emitWithSocket("notify-group-call-user-left", userId),
    [emitWithSocket],
  )
  const setGroupCallScreenSharing = useCallback(
    (status) => emitWithSocket("set-group-call-screen-sharing", status),
    [emitWithSocket],
  )
  const sendCallQualityMetrics = useCallback(
    (metrics) => emitWithSocket("send-call-quality-metrics", metrics),
    [emitWithSocket],
  )
  const sendNetworkFallback = useCallback(
    (fallback) => emitWithSocket("send-network-fallback", fallback),
    [emitWithSocket],
  )
  const checkUserStatus = useCallback(
    (userId, ackCallback) => emitWithSocket("check-user-status", { userId }, ackCallback),
    [emitWithSocket],
  )
  const notifyUserCameOnline = useCallback(
    (targetUserId) => emitWithSocket("notify-user-came-online", targetUserId),
    [emitWithSocket],
  )
  const sendCallPushNotification = useCallback(
    (pushData) => emitWithSocket("send-call-push-notification", pushData),
    [emitWithSocket],
  )

  const joinAdminDashboard = useCallback(() => {
    if (authState.user?.isAdmin) emitWithSocket("admin:join-dashboard")
  }, [emitWithSocket, authState.user?.isAdmin])

  const leaveAdminDashboard = useCallback(() => {
    if (authState.user?.isAdmin) emitWithSocket("admin:leave-dashboard")
  }, [emitWithSocket, authState.user?.isAdmin])
  // Initialize or clean up socket on auth state change
  useEffect(() => {
    let socketInstance = null

    if (authState.isAuthenticated && authState.token && authState.user?.id) {
      socketInstance = initializeSocket()
      if (socketInstance) {
        setSocket(socketInstance)
      }
    } else {
      // Clean up if auth state is invalid
      if (globalSocketInstance) {
        console.log("Cleaning up socket due to invalid auth state")
        globalSocketInstance.disconnect()
        globalSocketInstance = null
        socketInitializedRef.current = false
        setSocket(null)
        setIsConnected(false)
      }
    }

    // Cleanup on unmount
    return () => {
      if (socketInstance) {
        console.log("Cleaning up socket on unmount")
        socketInstance.disconnect()
        // Don't reset the global instance here to prevent recreation issues
      }
    }
  }, [authState.isAuthenticated, authState.token, authState.user?.id, initializeSocket])

  // Socket event handlers with better error handling
  const joinConversation = useCallback(
    (conversationId) => {
      const socketInstance = getSocket()
      if (socketInstance) {
        try {
          socketInstance.emit("join-conversation", conversationId)
          console.log(`Joined conversation: ${conversationId}`)
        } catch (error) {
          console.error(`Error joining conversation ${conversationId}:`, error)
        }
      } else {
        console.warn(`Cannot join conversation ${conversationId}: Socket not available`)
      }
    },
    [getSocket],
  )

  const leaveConversation = useCallback(
    (conversationId) => {
      const socketInstance = getSocket()
      if (socketInstance) {
        try {
          socketInstance.emit("leave-conversation", conversationId)
          console.log(`Left conversation: ${conversationId}`)
        } catch (error) {
          console.error(`Error leaving conversation ${conversationId}:`, error)
        }
      } else {
        console.warn(`Cannot leave conversation ${conversationId}: Socket not available`)
      }
    },
    [getSocket],
  )

  const sendMessage = useCallback(
    (message) => {
      const socketInstance = getSocket()
      if (socketInstance) {
        try {
          socketInstance.emit("send-message", message)
          console.log(`Message sent: ${message}`)
        } catch (error) {
          console.error(`Error sending message:`, error)
        }
      } else {
        console.warn(`Cannot send message: Socket not available`)
      }
    },
    [getSocket],
  )

  const markAsRead = useCallback(
    (messageId) => {
      const socketInstance = getSocket()
      if (socketInstance) {
        try {
          socketInstance.emit("mark-as-read", messageId)
          console.log(`Message marked as read: ${messageId}`)
        } catch (error) {
          console.error(`Error marking message as read:`, error)
        }
      } else {
        console.warn(`Cannot mark message as read: Socket not available`)
      }
    },
    [getSocket],
  )

  const markAsDelivered = useCallback(
    (messageId) => {
      const socketInstance = getSocket()
      if (socketInstance) {
        try {
          socketInstance.emit("mark-as-delivered", messageId)
          console.log(`Message marked as delivered: ${messageId}`)
        } catch (error) {
          console.error(`Error marking message as delivered:`, error)
        }
      } else {
        console.warn(`Cannot mark message as delivered: Socket not available`)
      }
    },
    [getSocket],
  )

  const setTyping = useCallback(
    (conversationId) => {
      const socketInstance = getSocket()
      if (socketInstance) {
        try {
          socketInstance.emit("set-typing", conversationId)
          console.log(`Typing status set for conversation: ${conversationId}`)
        } catch (error) {
          console.error(`Error setting typing status:`, error)
        }
      } else {
        console.warn(`Cannot set typing status: Socket not available`)
      }
    },
    [getSocket],
  )

  const setStopTyping = useCallback(
    (conversationId) => {
      const socketInstance = getSocket()
      if (socketInstance) {
        try {
          socketInstance.emit("stop-typing", conversationId)
          console.log(`Typing status stopped for conversation: ${conversationId}`)
        } catch (error) {
          console.error(`Error stopping typing status:`, error)
        }
      } else {
        console.warn(`Cannot stop typing status: Socket not available`)
      }
    },
    [getSocket],
  )

  const setOnlineStatus = useCallback(
    (status) => {
      const socketInstance = getSocket()
      if (socketInstance) {
        try {
          socketInstance.emit("set-online-status", status)
          console.log(`Online status set to: ${status}`)
        } catch (error) {
          console.error(`Error setting online status:`, error)
        }
      } else {
        console.warn(`Cannot set online status: Socket not available`)
      }
    },
    [getSocket],
  )

  // const initiateCall = useCallback(
  //   (callData) => {
  //     // Expects { callId, receiverId, targetDeviceId, offer, callType, callerInfo }
  //     const socketInstance = getSocket()
  //     if (socketInstance) {
  //       try {
  //         socketInstance.emit("initiate-call", callData)
  //         console.log(`Call initiated with data:`, callData)
  //       } catch (error) {
  //         console.error(`Error initiating call:`, error)
  //       }
  //     } else {
  //       console.warn(`Cannot initiate call: Socket not available`)
  //     }
  //   },
  //   [getSocket],
  // )
  //
  // const acceptCall = useCallback(
  //   (acceptData) => {
  //     // Expects { callId, callerId, answer }
  //     const socketInstance = getSocket()
  //     if (socketInstance) {
  //       try {
  //         socketInstance.emit("accept-call", acceptData)
  //         console.log(`Call accepted with data:`, acceptData)
  //       } catch (error) {
  //         console.error(`Error accepting call:`, error)
  //       }
  //     } else {
  //       console.warn(`Cannot accept call: Socket not available`)
  //     }
  //   },
  //   [getSocket],
  // )
  //
  // const rejectCall = useCallback(
  //   (rejectData) => {
  //     // Expects { callId, callerId, deviceId (optional) }
  //     const socketInstance = getSocket()
  //     if (socketInstance) {
  //       try {
  //         socketInstance.emit("reject-call", rejectData)
  //         console.log(`Call rejected with data:`, rejectData)
  //       } catch (error) {
  //         console.error(`Error rejecting call:`, error)
  //       }
  //     } else {
  //       console.warn(`Cannot reject call: Socket not available`)
  //     }
  //   },
  //   [getSocket],
  // )
  //
  // const endCall = useCallback(
  //   (endData) => {
  //     // Expects { callId, recipientId }
  //     const socketInstance = getSocket()
  //     if (socketInstance) {
  //       try {
  //         socketInstance.emit("end-call", endData)
  //         console.log(`Call ended with data:`, endData)
  //       } catch (error) {
  //         console.error(`Error ending call:`, error)
  //       }
  //     } else {
  //       console.warn(`Cannot end call: Socket not available`)
  //     }
  //   },
  //   [getSocket],
  // )
  //
  // const sendIceCandidate = useCallback(
  //   (iceData) => {
  //     // Expects { callId, candidate, recipientId }
  //     const socketInstance = getSocket()
  //     if (socketInstance) {
  //       try {
  //         socketInstance.emit("send-ice-candidate", iceData)
  //         console.log(`ICE candidate sent:`, iceData)
  //       } catch (error) {
  //         console.error(`Error sending ICE candidate:`, error)
  //       }
  //     } else {
  //       console.warn(`Cannot send ICE candidate: Socket not available`)
  //     }
  //   },
  //   [getSocket],
  // )

  const joinGroupCall = useCallback(
    (groupId) => {
      const socketInstance = getSocket()
      if (socketInstance) {
        try {
          socketInstance.emit("join-group-call", groupId)
          console.log(`Joined group call: ${groupId}`)
        } catch (error) {
          console.error(`Error joining group call:`, error)
        }
      } else {
        console.warn(`Cannot join group call: Socket not available`)
      }
    },
    [getSocket],
  )

  const leaveGroupCall = useCallback(
    (groupId) => {
      const socketInstance = getSocket()
      if (socketInstance) {
        try {
          socketInstance.emit("leave-group-call", groupId)
          console.log(`Left group call: ${groupId}`)
        } catch (error) {
          console.error(`Error leaving group call:`, error)
        }
      } else {
        console.warn(`Cannot leave group call: Socket not available`)
      }
    },
    [getSocket],
  )

  // const sendGroupCallOffer = useCallback(
  //   (offer) => {
  //     const socketInstance = getSocket()
  //     if (socketInstance) {
  //       try {
  //         socketInstance.emit("send-group-call-offer", offer)
  //         console.log(`Group call offer sent:`, offer)
  //       } catch (error) {
  //         console.error(`Error sending group call offer:`, error)
  //       }
  //     } else {
  //       console.warn(`Cannot send group call offer: Socket not available`)
  //     }
  //   },
  //   [getSocket],
  // )

  // const sendGroupCallAnswer = useCallback(
  //   (answer) => {
  //     const socketInstance = getSocket()
  //     if (socketInstance) {
  //       try {
  //         socketInstance.emit("send-group-call-answer", answer)
  //         console.log(`Group call answer sent:`, answer)
  //       } catch (error) {
  //         console.error(`Error sending group call answer:`, error)
  //       }
  //     } else {
  //       console.warn(`Cannot send group call answer: Socket not available`)
  //     }
  //   },
  //   [getSocket],
  // )
  //
  // const sendGroupCallIceCandidate = useCallback(
  //   (candidate) => {
  //     const socketInstance = getSocket()
  //     if (socketInstance) {
  //       try {
  //         socketInstance.emit("send-group-call-ice-candidate", candidate)
  //         console.log(`Group call ICE candidate sent:`, candidate)
  //       } catch (error) {
  //         console.error(`Error sending group call ICE candidate:`, error)
  //       }
  //     } else {
  //       console.warn(`Cannot send group call ICE candidate: Socket not available`)
  //     }
  //   },
  //   [getSocket],
  // )
  //
  // const notifyGroupCallUserJoined = useCallback(
  //   (userId) => {
  //     const socketInstance = getSocket()
  //     if (socketInstance) {
  //       try {
  //         socketInstance.emit("notify-group-call-user-joined", userId)
  //         console.log(`Notified group call user joined: ${userId}`)
  //       } catch (error) {
  //         console.error(`Error notifying group call user joined:`, error)
  //       }
  //     } else {
  //       console.warn(`Cannot notify group call user joined: Socket not available`)
  //     }
  //   },
  //   [getSocket],
  // )
  //
  // const notifyGroupCallUserLeft = useCallback(
  //   (userId) => {
  //     const socketInstance = getSocket()
  //     if (socketInstance) {
  //       try {
  //         socketInstance.emit("notify-group-call-user-left", userId)
  //         console.log(`Notified group call user left: ${userId}`)
  //       } catch (error) {
  //         console.error(`Error notifying group call user left:`, error)
  //       }
  //     } else {
  //       console.warn(`Cannot notify group call user left: Socket not available`)
  //     }
  //   },
  //   [getSocket],
  // )
  //
  // const setGroupCallScreenSharing = useCallback(
  //   (status) => {
  //     const socketInstance = getSocket()
  //     if (socketInstance) {
  //       try {
  //         socketInstance.emit("set-group-call-screen-sharing", status)
  //         console.log(`Group call screen sharing set to: ${status}`)
  //       } catch (error) {
  //         console.error(`Error setting group call screen sharing:`, error)
  //       }
  //     } else {
  //       console.warn(`Cannot set group call screen sharing: Socket not available`)
  //     }
  //   },
  //   [getSocket],
  // )
  //
  // const sendCallQualityMetrics = useCallback(
  //   (metrics) => {
  //     const socketInstance = getSocket()
  //     if (socketInstance) {
  //       try {
  //         socketInstance.emit("send-call-quality-metrics", metrics)
  //         console.log(`Call quality metrics sent:`, metrics)
  //       } catch (error) {
  //         console.error(`Error sending call quality metrics:`, error)
  //       }
  //     } else {
  //       console.warn(`Cannot send call quality metrics: Socket not available`)
  //     }
  //   },
  //   [getSocket],
  // )
  //
  // const sendNetworkFallback = useCallback(
  //   (fallback) => {
  //     const socketInstance = getSocket()
  //     if (socketInstance) {
  //       try {
  //         socketInstance.emit("send-network-fallback", fallback)
  //         console.log(`Network fallback sent:`, fallback)
  //       } catch (error) {
  //         console.error(`Error sending network fallback:`, error)
  //       }
  //     } else {
  //       console.warn(`Cannot send network fallback: Socket not available`)
  //     }
  //   },
  //   [getSocket],
  // )
  //
  // const requestIceRestart = useCallback(
  //   (restartData) => {
  //     // Expects { callId, recipientId, callType }
  //     const socketInstance = getSocket()
  //     if (socketInstance) {
  //       try {
  //         socketInstance.emit("request-ice-restart", restartData)
  //         console.log(`ICE restart requested for:`, restartData)
  //       } catch (error) {
  //         console.error(`Error requesting ICE restart:`, error)
  //       }
  //     } else {
  //       console.warn(`Cannot request ICE restart: Socket not available`)
  //     }
  //   },
  //   [getSocket],
  // )
  //
  // const checkUserStatus = useCallback(
  //   (userId) => {
  //     const socketInstance = getSocket()
  //     if (socketInstance) {
  //       try {
  //         socketInstance.emit("check-user-status", { userId }) // Send as an object
  //         console.log(`Checked user status for: ${userId}`)
  //       } catch (error) {
  //         console.error(`Error checking user status:`, error)
  //       }
  //     } else {
  //       console.warn(`Cannot check user status: Socket not available`)
  //     }
  //   },
  //   [getSocket],
  // )
  //
  // const notifyUserCameOnline = useCallback(
  //   (targetUserId) => {
  //     // Changed parameter
  //     const socketInstance = getSocket()
  //     if (socketInstance) {
  //       try {
  //         socketInstance.emit("notify-user-came-online", targetUserId) // Emit just the ID
  //         console.log(`Notified user ${targetUserId} that current user came online`)
  //       } catch (error) {
  //         console.error(`Error notifying user came online:`, error)
  //       }
  //     } else {
  //       console.warn(`Cannot notify user came online: Socket not available`)
  //     }
  //   },
  //   [getSocket],
  // )
  //
  // const sendCallPushNotification = useCallback(
  //   (pushData) => {
  //     // Expects { targetUserId, callId, callerName, callType, ... }
  //     const socketInstance = getSocket()
  //     if (socketInstance) {
  //       try {
  //         socketInstance.emit("send-call-push-notification", pushData)
  //         console.log(`Call push notification sent:`, pushData)
  //       } catch (error) {
  //         console.error(`Error sending call push notification:`, error)
  //       }
  //     } else {
  //       console.warn(`Cannot send call push notification: Socket not available`)
  //     }
  //   },
  //   [getSocket],
  // )
  //
  // const joinAdminDashboard = useCallback(() => {
  //   const socketInstance = getSocket()
  //   if (socketInstance && isConnected && authState.user?.isAdmin) {
  //     socketInstance.emit("admin:join-dashboard")
  //     console.log("Admin dashboard joined via context")
  //   }
  // }, [getSocket, isConnected, authState.user?.isAdmin])
  //
  // const leaveAdminDashboard = useCallback(() => {
  //   const socketInstance = getSocket()
  //   if (socketInstance && isConnected && authState.user?.isAdmin) {
  //     socketInstance.emit("admin:leave-dashboard")
  //     console.log("Admin dashboard left via context")
  //   }
  // }, [getSocket, isConnected, authState.user?.isAdmin])

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        onlineUsers,
        messages,
        getSocket, // Export the getSocket function
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
        joinGroupCall,
        leaveGroupCall,
        sendGroupCallOffer,
        sendGroupCallAnswer,
        sendGroupCallIceCandidate,
        notifyGroupCallUserJoined,
        notifyGroupCallUserLeft,
        setGroupCallScreenSharing,
        sendCallQualityMetrics,
        sendNetworkFallback,
        requestIceRestart,
        checkUserStatus,
        notifyUserCameOnline,
        sendCallPushNotification,
        call,
        setCall,
        callAccepted,
        setCallAccepted,
        callEnded,
        setCallEnded,
        name,
        setName,
        stream,
        setStream,
        myVideo,
        userVideo,
        connectionRef,
        joinConversation,
        leaveConversation,
        // Admin functions
        joinAdminDashboard,
        leaveAdminDashboard,
        incomingCallData,
        setIncomingCallData,
      }}
    >
      {children}
    </SocketContext.Provider>
  )
}
