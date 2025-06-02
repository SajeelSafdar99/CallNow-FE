"use client"

import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react"
import { AuthContext } from "./AuthContext"
import { SOCKET_URL } from "../config/api"
import { io } from "socket.io-client"
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from "react-native-webrtc"
import * as GroupCallAPI from "../api/group-calls"
import { Alert } from "react-native"

export const SocketContext = createContext()

let globalSocketInstance = null

const peerConnectionConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  iceCandidatePoolSize: 10,
}

export const SocketProvider = ({ children }) => {
  const { state: authState } = useContext(AuthContext)
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [incomingCallData, setIncomingCallData] = useState(null)
  const [onlineUsers, setOnlineUsers] = useState([])
  const [messages, setMessages] = useState([])

  const lastProcessedCallIdRef = useRef(null)
  const recentlyHandledCallIds = useRef(new Set())

  const socketInitializedRef = useRef(false)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5

  // One-to-one call state
  const [call, setCall] = useState(null)
  const [callAccepted, setCallAccepted] = useState(false)
  const [callEnded, setCallEnded] = useState(false)
  const [name, setName] = useState("")
  const [stream, setStream] = useState(null)
  const myVideo = useRef()
  const userVideo = useRef()
  const connectionRef = useRef()

  // Group Call State
  const [groupCallId, setGroupCallId] = useState(null)
  const groupCallIdRef = useRef(null)
  const [groupParticipants, setGroupParticipants] = useState(new Map())
  const [localGroupStream, setLocalGroupStream] = useState(null)
  const groupPCsRef = useRef(new Map())
  const localGroupStreamRef = useRef(null) // Added ref for local group stream

  const clearIncomingCallDataState = useCallback(
    (callIdToClear) => {
      console.log(
        `[SocketContext] ENTERING clearIncomingCallDataState for callId: ${callIdToClear}. Current incomingCallData ID: ${incomingCallData?.callId}`,
      ) // Log SC1
      if (callIdToClear) {
        recentlyHandledCallIds.current.add(callIdToClear)
        setTimeout(() => {
          recentlyHandledCallIds.current.delete(callIdToClear)
        }, 30000)
      }
      setIncomingCallData((prevData) => {
        if (prevData && prevData.callId === callIdToClear) {
          console.log(`[SocketContext] Clearing incomingCallData for callId: ${callIdToClear}`) // Log SC2
          return null
        }
        console.log(
          `[SocketContext] Not clearing incomingCallData. Prev ID: ${prevData?.callId}, ToClear ID: ${callIdToClear}`,
        ) // Log SC3
        return prevData
      })
      if (lastProcessedCallIdRef.current === callIdToClear) {
        lastProcessedCallIdRef.current = null
      }
    },
    [incomingCallData],
  )

  const getValidSocket = useCallback(() => {
    if (globalSocketInstance && globalSocketInstance.connected) {
      return globalSocketInstance
    }
    return null
  }, [])

  const emitWithSocket = useCallback(
    (event, data, ackCallback) => {
      const currentSocket = getValidSocket()
      if (currentSocket) {
        try {
          if (ackCallback && typeof ackCallback === "function") {
            currentSocket.emit(event, data, ackCallback)
          } else {
            currentSocket.emit(event, data)
          }
        } catch (error) {
          console.error(`[SocketContext] Error emitting '${event}':`, error)
        }
      } else {
        console.error(`[SocketContext] Cannot emit '${event}'. Socket not available or not connected.`)
      }
    },
    [getValidSocket],
  )

  const createGroupPeerConnection = (targetSocketId, targetUserId, currentGroupCallId) => {
    console.log(
      `[SocketContext] createGroupPeerConnection: Creating PC for targetSocketId: ${targetSocketId}, targetUserId: ${targetUserId}, groupCallId: ${currentGroupCallId}`,
    )
    const streamForTracks = localGroupStreamRef.current || localGroupStream
    if (!streamForTracks) {
      console.error("[SocketContext] Local group stream not available to create peer connection.")
      return null
    }
    try {
      const pc = new RTCPeerConnection(peerConnectionConfig)
      groupPCsRef.current.set(targetSocketId, pc)
      streamForTracks.getTracks().forEach((track) => {
        console.log(
          `[SocketContext] createGroupPeerConnection: Adding local track ${track.kind} (id: ${track.id}, enabled: ${track.enabled}) to PC for ${targetSocketId}`,
        )
        pc.addTrack(track, streamForTracks)
      })

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          console.log(
            `[SocketContext] createGroupPeerConnection: Sending ICE candidate for ${targetUserId} (Socket: ${targetSocketId})`,
          )
          emitWithSocket("group-ice-candidate-to-peer", {
            callId: currentGroupCallId,
            toSocketId: targetSocketId,
            candidate,
          })
        }
      }

      pc.ontrack = ({ streams: [remoteStream], track }) => {
        console.log(
          `[SocketContext] createGroupPeerConnection: Received remote track kind: ${track.kind} (id: ${track.id}) for group participant ${targetUserId} (Socket: ${targetSocketId})`,
        )
        setGroupParticipants((prev) => {
          const newMap = new Map(prev)
          const participantData = newMap.get(targetUserId)
          if (participantData) {
            const existingRemoteStream = participantData.stream
            let updatedStream = existingRemoteStream
            if (existingRemoteStream && existingRemoteStream.id !== remoteStream?.id) {
              updatedStream = remoteStream || existingRemoteStream
            } else if (!existingRemoteStream && remoteStream) {
              updatedStream = remoteStream
            }
            newMap.set(targetUserId, { ...participantData, stream: updatedStream })
          } else {
            console.warn(
              `[SocketContext] Participant data for ${targetUserId} not found when receiving track. Adding with minimal data.`,
            )
            newMap.set(targetUserId, {
              id: targetUserId,
              userId: targetUserId,
              socketId: targetSocketId,
              pc,
              stream: remoteStream,
              isMuted: false,
              isVideoEnabled: true,
              name: "Participant",
            })
          }
          return newMap
        })
      }

      pc.oniceconnectionstatechange = () => {
        console.log(
          `[SocketContext] createGroupPeerConnection: ICE connection state change for ${targetUserId} (Socket: ${targetSocketId}): ${pc.iceConnectionState}`,
        )
        if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
          console.warn(`[SocketContext] ICE connection to ${targetSocketId} failed/disconnected.`)
        }
      }
      console.log(
        `[SocketContext] createGroupPeerConnection: Successfully created and configured PC for ${targetSocketId}`,
      )
      return pc
    } catch (error) {
      console.error(`[SocketContext] Error creating RTCPeerConnection for ${targetSocketId}:`, error)
      return null
    }
  }

  const cleanupGroupCall = useCallback(() => {
    console.log("[SocketContext] Cleaning up group call resources.")
    groupPCsRef.current.forEach((pc, socketId) => {
      try {
        pc.close()
      } catch (e) {
        console.error(`[SocketContext] Error closing PC for socketId ${socketId}:`, e)
      }
    })
    groupPCsRef.current.clear()

    if (localGroupStreamRef.current) {
      localGroupStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch (e) {
          console.error(`[SocketContext] Error stopping local group track ${track.kind}:`, e)
        }
      })
      localGroupStreamRef.current = null
    }
    setLocalGroupStream(null)
    setGroupParticipants(new Map())
    setGroupCallId(null)
    groupCallIdRef.current = null
    console.log("[SocketContext] Group call cleanup complete.")
  }, [])

  const initializeSocket = useCallback(() => {
    if (!authState.isAuthenticated || !authState.token || !authState.user?.id || !authState.user?.activeDevice) {
      return null
    }

    if (socketInitializedRef.current && globalSocketInstance) {
      if (!globalSocketInstance.connected) {
        globalSocketInstance.connect()
      } else {
        const currentAuth = { token: authState.token, deviceId: authState.user.activeDevice }
        const socketAuth = globalSocketInstance.auth
        if (socketAuth && (socketAuth.token !== currentAuth.token || socketAuth.deviceId !== currentAuth.deviceId)) {
          globalSocketInstance.disconnect()
          globalSocketInstance = null
          socketInitializedRef.current = false
        } else {
          setSocket(globalSocketInstance)
          setIsConnected(true)
          return globalSocketInstance
        }
      }
    }

    if (!globalSocketInstance) {
      try {
        const newSocketInstance = io(SOCKET_URL, {
          auth: {
            token: authState.token,
            deviceId: authState.user.activeDevice,
          },
          transports: ["websocket"],
          reconnection: true,
          reconnectionAttempts: maxReconnectAttempts,
          reconnectionDelay: 1000,
          timeout: 10000,
          path: "/socket.io/",
        })

        newSocketInstance.on("connect", () => {
          console.log(
            "[SocketContext] Socket connected:",
            newSocketInstance.id,
            "Device:",
            newSocketInstance.auth.deviceId,
          )
          setIsConnected(true)
          reconnectAttemptsRef.current = 0
          setSocket(newSocketInstance)
          globalSocketInstance = newSocketInstance
          socketInitializedRef.current = true
        })

        newSocketInstance.on("connect_error", (error) => {
          console.error("[SocketContext] Socket connection error:", error.message)
          setIsConnected(false)
          if (error.message.includes("Authentication error") || (error.data && error.data.type === "AuthError")) {
            if (globalSocketInstance) globalSocketInstance.disconnect()
            globalSocketInstance = null
            setSocket(null)
            socketInitializedRef.current = false
          }
        })
        newSocketInstance.on("disconnect", (reason) => {
          console.log("[SocketContext] Socket disconnected:", reason)
          setIsConnected(false)
          if (
            reason === "io server disconnect" ||
            (reason === "transport error" && newSocketInstance?.auth?.token !== authState.token)
          ) {
            if (globalSocketInstance === newSocketInstance) {
              globalSocketInstance = null
              socketInitializedRef.current = false
              setSocket(null)
            }
          }
        })
        newSocketInstance.on("reconnect", (attemptNumber) => {
          console.log(
            "[SocketContext] Socket reconnected after",
            attemptNumber,
            "attempts. New ID:",
            newSocketInstance.id,
          )
          setIsConnected(true)
          setSocket(newSocketInstance)
          globalSocketInstance = newSocketInstance
        })
        newSocketInstance.on("reconnect_error", (error) =>
          console.error("[SocketContext] Socket reconnection error:", error.message),
        )
        newSocketInstance.on("reconnect_failed", () => console.error("[SocketContext] Socket reconnection failed"))

        newSocketInstance.on("call-session-terminated", (data) => {
          if (data && data.callId) clearIncomingCallDataState(data.callId)
        })
        newSocketInstance.on("incoming-call-notification", (data) => {
          console.log("[SocketContext] Raw 'incoming-call-notification' received:", JSON.stringify(data))
          const currentActiveDeviceId = authState?.user?.activeDevice
          if (!currentActiveDeviceId || (data.targetDeviceId && data.targetDeviceId !== currentActiveDeviceId)) {
            console.log(
              `[SocketContext] 1-to-1 call for device ${data.targetDeviceId}, but current is ${currentActiveDeviceId}. Ignoring.`,
            )
            return
          }
          if (data && data.callId && data.caller && data.caller.id && data.offer) {
            if (
              recentlyHandledCallIds.current.has(data.callId) ||
              lastProcessedCallIdRef.current === data.callId ||
              (incomingCallData && incomingCallData.callId === data.callId && !incomingCallData.isGroupCall)
            ) {
              console.log(
                `[SocketContext] Already processing or recently handled 1-to-1 call ID ${data.callId}. Ignoring.`,
              )
              return
            }
            const currentRouteName = global.navigationRef?.getCurrentRoute?.()?.name
            const currentRouteParams = global.navigationRef?.getCurrentRoute?.()?.params

            if (currentRouteName === "Call" && currentRouteParams?.callId === data.callId) {
              console.log(`[SocketContext] Already in 1-to-1 call screen for ${data.callId}. Ignoring invite.`)
              return
            }

            console.log(`[SocketContext] Setting incoming 1-to-1 call data for call ID: ${data.callId}`)
            lastProcessedCallIdRef.current = data.callId
            setIncomingCallData({ ...data, isGroupCall: false })
            setTimeout(() => {
              if (lastProcessedCallIdRef.current === data.callId) {
                lastProcessedCallIdRef.current = null
              }
            }, 5000)
          } else {
            console.warn("[SocketContext] Received incomplete incoming-call-notification data:", data)
          }
        })

        newSocketInstance.on("group-call-offer-received", (data) => {
          console.log("[SocketContext] Raw 'group-call-offer-received' received:", JSON.stringify(data))
          const currentActiveDeviceId = authState?.user?.activeDevice
          if (data.targetDeviceId && data.targetDeviceId !== currentActiveDeviceId) {
            console.log(
              `[SocketContext] Group call offer for device ${data.targetDeviceId}, but current is ${currentActiveDeviceId}. Ignoring.`,
            )
            return
          }

          if (data && data.callId && data.callerInfo && data.callerInfo.id && data.conversationId) {
            if (
              recentlyHandledCallIds.current.has(data.callId) ||
              lastProcessedCallIdRef.current === data.callId ||
              (incomingCallData && incomingCallData.callId === data.callId && incomingCallData.isGroupCall)
            ) {
              console.log(
                `[SocketContext] Already processing or recently handled group call ID ${data.callId}. Ignoring.`,
              )
              return
            }

            const currentRouteName = global.navigationRef?.getCurrentRoute?.()?.name
            const currentRouteParams = global.navigationRef?.getCurrentRoute?.()?.params
            if (currentRouteName === "GroupCallScreen" && currentRouteParams?.groupCallId === data.callId) {
              console.log(`[SocketContext] Already in group call screen for ${data.callId}. Ignoring invite.`)
              return
            }

            console.log(`[SocketContext] Setting incoming GROUP call data for call ID: ${data.callId}`)
            lastProcessedCallIdRef.current = data.callId
            setIncomingCallData({
              callId: data.callId,
              caller: data.callerInfo,
              callType: data.callType,
              isGroupCall: true,
              conversationId: data.conversationId,
              offer: null,
            })
            setTimeout(() => {
              if (lastProcessedCallIdRef.current === data.callId) {
                lastProcessedCallIdRef.current = null
              }
            }, 5000)
          } else {
            console.warn("[SocketContext] Received incomplete group-call-offer-received data:", data)
          }
        })

        newSocketInstance.on("existing-group-participants", ({ callId: currentGroupCallId, participants }) => {
          if (groupCallIdRef.current !== currentGroupCallId) {
            console.log(
              `[SocketContext] Ignoring 'existing-group-participants' for call ${currentGroupCallId}, current active group call ID in ref is ${groupCallIdRef.current}`,
            )
            return
          }
          console.log(
            `[SocketContext] Received 'existing-group-participants' for call ${currentGroupCallId}:`,
            participants.map((p) => p.userId),
          )

          setGroupParticipants((prevParticipants) => {
            const updatedParticipants = new Map(prevParticipants)
            console.log(
              `[SocketContext] 'existing-group-participants' setGroupParticipants: prev size ${prevParticipants.size}`,
            )
            participants.forEach((p) => {
              if (p.userId !== authState.user?.id && !updatedParticipants.has(p.userId)) {
                console.log(
                  `[SocketContext] 'existing-group-participants': Processing existing participant ${p.userId}. Creating PC.`,
                )
                const pc = createGroupPeerConnection(p.socketId, p.userId, currentGroupCallId)
                if (pc) {
                  updatedParticipants.set(p.userId, {
                    ...p,
                    id: p.userId,
                    pc,
                    stream: null,
                    isMuted: p.isMuted || false,
                    isVideoEnabled: p.isVideoEnabled === undefined ? true : p.isVideoEnabled,
                  })
                  console.log(
                    `[SocketContext] 'existing-group-participants': Added ${p.userId} to groupParticipants. New map size: ${updatedParticipants.size}`,
                  )

                  pc.createOffer()
                    .then((offer) => {
                      console.log(`[SocketContext] 'existing-group-participants': Offer created for ${p.userId}`)
                      return pc.setLocalDescription(offer)
                    })
                    .then(() => {
                      emitWithSocket("group-offer-to-peer", {
                        callId: currentGroupCallId,
                        toSocketId: p.socketId,
                        offer: pc.localDescription,
                      })
                      console.log(
                        `[SocketContext] 'existing-group-participants': Sent offer to ${p.userId} (socket: ${p.socketId})`,
                      )
                    })
                    .catch((e) =>
                      console.error(
                        "[SocketContext] 'existing-group-participants': Error creating/sending offer for existing participant",
                        p.userId,
                        e,
                      ),
                    )
                } else {
                  console.error(`[SocketContext] 'existing-group-participants': Failed to create PC for ${p.userId}`)
                }
              } else if (p.userId !== authState.user?.id && updatedParticipants.has(p.userId)) {
                console.log(`[SocketContext] 'existing-group-participants': Participant ${p.userId} already in map.`)
              }
            })
            return updatedParticipants
          })
        })

        newSocketInstance.on("participant-joined-group", ({ callId: currentGroupCallId, participant }) => {
          console.log(
            `[SocketContext] Received 'participant-joined-group': callId=${currentGroupCallId}, participantId=${participant?.userId}, participantSocketId=${participant?.socketId}`,
          )

          if (incomingCallData && incomingCallData.callId === currentGroupCallId && incomingCallData.isGroupCall) {
            console.log(
              `[SocketContext] 'participant-joined-group': Matched incomingCallData for call ${currentGroupCallId}. Participant ${participant?.userId} joined. Clearing modal and stopping ringtone on this device.`,
            )
            clearIncomingCallDataState(currentGroupCallId)
          }

          if (groupCallIdRef.current !== currentGroupCallId) {
            console.log(
              `[SocketContext] 'participant-joined-group': Event for call ${currentGroupCallId} but current active call is ${groupCallIdRef.current}. Ignoring PC setup.`,
            )
            return
          }
          if (participant.userId === authState.user?.id) {
            console.log(
              `[SocketContext] 'participant-joined-group': Event for self (${participant.userId}). Ignoring PC setup for self.`,
            )
            return
          }

          console.log(
            `[SocketContext] 'participant-joined-group': Processing join for ${participant.userId} in call ${currentGroupCallId}.`,
          )
          setGroupParticipants((prev) => {
            const newMap = new Map(prev)
            console.log(
              `[SocketContext] 'participant-joined-group' setGroupParticipants: prev size ${prev.size}, for participant ${participant.userId}`,
            )
            if (!newMap.has(participant.userId)) {
              console.log(
                `[SocketContext] 'participant-joined-group': Participant ${participant.userId} not in map. Creating PC.`,
              )
              const pc = createGroupPeerConnection(participant.socketId, participant.userId, currentGroupCallId)
              if (pc) {
                newMap.set(participant.userId, {
                  ...participant,
                  id: participant.userId,
                  pc,
                  stream: null,
                  isMuted: participant.isMuted || false,
                  isVideoEnabled: participant.isVideoEnabled === undefined ? true : participant.isVideoEnabled,
                })
                console.log(
                  `[SocketContext] 'participant-joined-group': Added ${participant.userId} to groupParticipants. New map size: ${newMap.size}`,
                )

                pc.createOffer()
                  .then((offer) => {
                    console.log(`[SocketContext] 'participant-joined-group': Offer created for ${participant.userId}`)
                    return pc.setLocalDescription(offer)
                  })
                  .then(() => {
                    emitWithSocket("group-offer-to-peer", {
                      callId: currentGroupCallId,
                      toSocketId: participant.socketId,
                      offer: pc.localDescription,
                    })
                    console.log(
                      `[SocketContext] 'participant-joined-group': Sent offer to ${participant.userId} (socket: ${participant.socketId})`,
                    )
                  })
                  .catch((e) =>
                    console.error(
                      "[SocketContext] 'participant-joined-group': Error creating/sending offer for new participant",
                      participant.userId,
                      e,
                    ),
                  )
              } else {
                console.error(
                  `[SocketContext] 'participant-joined-group': Failed to create PC for ${participant.userId}`,
                )
              }
            } else {
              console.log(
                `[SocketContext] 'participant-joined-group': Participant ${participant.userId} already in map. Potentially updating socketId or other info if needed.`,
              )
              const existingP = newMap.get(participant.userId)
              if (existingP.socketId !== participant.socketId) {
                console.log(
                  `[SocketContext] 'participant-joined-group': Participant ${participant.userId} reconnected with new socketId ${participant.socketId}. Updating.`,
                )
                if (existingP.pc) {
                  try {
                    existingP.pc.close()
                  } catch (e) {
                    console.warn("Error closing old PC", e)
                  }
                  groupPCsRef.current.delete(existingP.socketId)
                }
                const pc = createGroupPeerConnection(participant.socketId, participant.userId, currentGroupCallId)
                if (pc) {
                  newMap.set(participant.userId, { ...existingP, ...participant, pc })
                  pc.createOffer()
                    .then((offer) => pc.setLocalDescription(offer))
                    .then(() => {
                      emitWithSocket("group-offer-to-peer", {
                        callId: currentGroupCallId,
                        toSocketId: participant.socketId,
                        offer: pc.localDescription,
                      })
                    })
                    .catch((e) =>
                      console.error("Error creating/sending offer for reconnected participant", participant.userId, e),
                    )
                }
              }
            }
            return newMap
          })
        })

        newSocketInstance.on(
          "participant-left-group",
          ({ callId: currentGroupCallId, participantId, socketId: leftSocketId }) => {
            if (groupCallIdRef.current !== currentGroupCallId) return
            console.log(
              `[SocketContext] Participant ${participantId} (Socket: ${leftSocketId}) left group ${currentGroupCallId}`,
            )
            setGroupParticipants((prev) => {
              const newMap = new Map(prev)
              const pData = newMap.get(participantId)
              if (pData && (pData.socketId === leftSocketId || !leftSocketId)) {
                pData.pc?.close()
                groupPCsRef.current.delete(pData.socketId)
                newMap.delete(participantId)
              }
              return newMap
            })
          },
        )

        newSocketInstance.on(
          "group-offer-from-peer",
          async ({ callId: currentGroupCallId, fromSocketId, fromUserId, offer, fromUserName, fromUserProfilePic }) => {
            if (groupCallIdRef.current !== currentGroupCallId) {
              console.log(
                `[SocketContext] 'group-offer-from-peer': Ignoring offer for call ${currentGroupCallId}, current active call is ${groupCallIdRef.current}`,
              )
              return
            }
            console.log(
              `[SocketContext] 'group-offer-from-peer': Received from ${fromUserId} (Socket: ${fromSocketId}) for call ${currentGroupCallId}. Offer:`,
              !!offer,
            )
            if (!localGroupStreamRef.current && !localGroupStream) {
              console.error("[SocketContext] Cannot handle group offer: localGroupStream is not available.")
              return
            }
            let pc = groupPCsRef.current.get(fromSocketId)
            if (!pc) {
              pc = createGroupPeerConnection(fromSocketId, fromUserId, currentGroupCallId)
            }
            if (!pc) {
              console.error(
                `[SocketContext] Failed to create/get peer connection for ${fromSocketId}. Cannot process offer.`,
              )
              return
            }
            try {
              console.log(`[SocketContext] 'group-offer-from-peer': Setting remote description for ${fromSocketId}`)
              await pc.setRemoteDescription(new RTCSessionDescription(offer))
              console.log(`[SocketContext] 'group-offer-from-peer': Creating answer for ${fromSocketId}`)
              const answer = await pc.createAnswer()
              console.log(`[SocketContext] 'group-offer-from-peer': Setting local description for ${fromSocketId}`)
              await pc.setLocalDescription(answer)
              emitWithSocket("group-answer-to-peer", {
                callId: currentGroupCallId,
                toSocketId: fromSocketId,
                answer: pc.localDescription,
              })
              console.log(`[SocketContext] 'group-offer-from-peer': Sent answer to ${fromSocketId}`)
              setGroupParticipants((prev) => {
                const newMap = new Map(prev)
                const existingParticipant = newMap.get(fromUserId)
                newMap.set(fromUserId, {
                  ...(existingParticipant || {}),
                  id: fromUserId,
                  userId: fromUserId,
                  socketId: fromSocketId,
                  pc,
                  name: fromUserName || existingParticipant?.name || "Participant",
                  profilePicture: fromUserProfilePic || existingParticipant?.profilePicture,
                  isMuted: existingParticipant?.isMuted || false,
                  isVideoEnabled:
                    existingParticipant?.isVideoEnabled === undefined ? true : existingParticipant.isVideoEnabled,
                  stream: existingParticipant?.stream || null,
                })
                return newMap
              })
            } catch (e) {
              console.error(
                "[SocketContext] 'group-offer-from-peer': Error handling group offer from peer",
                fromUserId,
                e,
              )
            }
          },
        )

        newSocketInstance.on(
          "group-answer-from-peer",
          async ({ callId: currentGroupCallId, fromSocketId, fromUserId, answer }) => {
            if (groupCallIdRef.current !== currentGroupCallId) {
              console.log(
                `[SocketContext] 'group-answer-from-peer': Ignoring answer for call ${currentGroupCallId}, current active call is ${groupCallIdRef.current}`,
              )
              return
            }
            // console.log(`[SocketContext] 'group-answer-from-peer': Received from ${fromUserId} (Socket: ${fromSocketId}) for call ${currentGroupCallId}. Answer:`, !!answer);
            const pc = groupPCsRef.current.get(fromSocketId)
            if (pc) {
              try {
                console.log(
                  `[SocketContext] 'group-answer-from-peer': Received answer from ${fromUserId} (Socket: ${fromSocketId}). Current PC signalingState: ${pc.signalingState}`,
                )
                if (pc.signalingState === "have-local-offer") {
                  console.log(
                    `[SocketContext] 'group-answer-from-peer': Setting remote description for ${fromSocketId}`,
                  )
                  await pc.setRemoteDescription(new RTCSessionDescription(answer))
                  console.log(
                    `[SocketContext] 'group-answer-from-peer': Remote description successfully set for ${fromSocketId}. New signalingState: ${pc.signalingState}`,
                  )
                } else {
                  console.warn(
                    `[SocketContext] 'group-answer-from-peer': Received answer for ${fromSocketId} but PC signaling state is '${pc.signalingState}' (expected 'have-local-offer'). Ignoring answer. This might indicate a duplicate answer or a previous negotiation error.`,
                  )
                }
              } catch (e) {
                console.error(
                  "[SocketContext] 'group-answer-from-peer': Error setting remote description for group answer",
                  fromUserId,
                  `Current PC signalingState: ${pc.signalingState}`,
                  e,
                )
              }
            } else {
              console.warn(
                `[SocketContext] 'group-answer-from-peer': No PC found for ${fromSocketId} to set group answer.`,
              )
            }
          },
        )

        newSocketInstance.on(
          "group-ice-candidate-from-peer",
          async ({ callId: currentGroupCallId, fromSocketId, fromUserId, candidate }) => {
            if (groupCallIdRef.current !== currentGroupCallId) {
              console.log(
                `[SocketContext] 'group-ice-candidate-from-peer': Ignoring ICE for call ${currentGroupCallId}, current active call is ${groupCallIdRef.current}`,
              )
              return
            }
            // console.log(`[SocketContext] 'group-ice-candidate-from-peer': Received from ${fromUserId} (Socket: ${fromSocketId}) for call ${currentGroupCallId}. Candidate:`, !!candidate);
            const pc = groupPCsRef.current.get(fromSocketId)
            if (pc && candidate) {
              try {
                // console.log(`[SocketContext] 'group-ice-candidate-from-peer': Adding ICE candidate for ${fromSocketId}`);
                await pc.addIceCandidate(new RTCIceCandidate(candidate))
                // console.log(`[SocketContext] 'group-ice-candidate-from-peer': ICE candidate added for ${fromSocketId}`);
              } catch (e) {
                console.error(
                  "[SocketContext] 'group-ice-candidate-from-peer': Error adding group ICE candidate for",
                  fromUserId,
                  e.message.includes("InvalidCandidateType") ? "Invalid Candidate Type" : e.message,
                )
              }
            } else if (!pc) {
              // console.warn(`[SocketContext] 'group-ice-candidate-from-peer': No PC found for ${fromSocketId} to add ICE candidate.`);
            }
          },
        )

        newSocketInstance.on("group-participant-muted", ({ callId: currentGroupCallId, participantId, isMuted }) => {
          if (groupCallIdRef.current !== currentGroupCallId) return
          setGroupParticipants((prev) => {
            // Functional update
            const newMap = new Map(prev)
            if (newMap.has(participantId)) {
              newMap.set(participantId, { ...newMap.get(participantId), isMuted })
            }
            return newMap
          })
        })

        newSocketInstance.on(
          "group-participant-video-changed",
          ({ callId: currentGroupCallId, participantId, isVideoEnabled }) => {
            if (groupCallIdRef.current !== currentGroupCallId) return
            setGroupParticipants((prev) => {
              // Functional update
              const newMap = new Map(prev)
              if (newMap.has(participantId)) {
                newMap.set(participantId, { ...newMap.get(participantId), isVideoEnabled })
              }
              return newMap
            })
          },
        )

        newSocketInstance.on("group-call-ended", ({ callId: currentGroupCallId, endedBy }) => {
          if (groupCallIdRef.current === currentGroupCallId) {
            console.log(`[SocketContext] Group call ${currentGroupCallId} ended by ${endedBy}. Cleaning up.`)
            cleanupGroupCall()
          }
        })

        return newSocketInstance
      } catch (error) {
        console.error("[SocketContext] Error creating socket instance:", error)
        socketInitializedRef.current = false
        return null
      }
    }
    return globalSocketInstance
  }, [
    authState.isAuthenticated,
    authState.token,
    authState.user?.id,
    authState.user?.activeDevice,
    incomingCallData, // state
    clearIncomingCallDataState, // useCallback
    emitWithSocket, // useCallback
    cleanupGroupCall, // useCallback (now stable)
  ])

  useEffect(() => {
    if (authState.isAuthenticated && authState.token && authState.user?.id && authState.user?.activeDevice) {
      if (
        !globalSocketInstance ||
        !globalSocketInstance.connected ||
        (globalSocketInstance.auth && globalSocketInstance.auth.token !== authState.token) ||
        (globalSocketInstance.auth && globalSocketInstance.auth.deviceId !== authState.user.activeDevice)
      ) {
        initializeSocket()
      } else {
        if (socket !== globalSocketInstance) setSocket(globalSocketInstance)
        if (!isConnected) setIsConnected(true)
      }
    } else {
      if (globalSocketInstance) {
        globalSocketInstance.disconnect()
        globalSocketInstance = null
        setSocket(null)
        setIsConnected(false)
        setIncomingCallData(null)
        recentlyHandledCallIds.current.clear()
        lastProcessedCallIdRef.current = null
        socketInitializedRef.current = false
        cleanupGroupCall()
      }
    }
  }, [
    authState.isAuthenticated,
    authState.token,
    authState.user?.id,
    authState.user?.activeDevice,
    initializeSocket,
    socket,
    isConnected,
    cleanupGroupCall,
  ])

  const initiateCall = useCallback(
    (callData) => {
      const dataWithCallerDevice = { ...callData, callerDeviceId: authState.user?.activeDevice }
      emitWithSocket("initiate-call", dataWithCallerDevice)
    },
    [emitWithSocket, authState.user?.activeDevice],
  )
  const acceptCall = useCallback(
    (acceptData) => {
      emitWithSocket("accept-call", acceptData)
    },
    [emitWithSocket],
  )
  const rejectCall = useCallback(
    (rejectData) => {
      const dataWithRejecterDevice = { ...rejectData, rejecterDeviceId: authState.user?.activeDevice }
      emitWithSocket("reject-call", dataWithRejecterDevice)
    },
    [emitWithSocket, authState.user?.activeDevice],
  )
  const endCall = useCallback(
    (endData) => {
      const dataWithEnderDevice = { ...endData, endedByDeviceId: authState.user?.activeDevice }
      emitWithSocket("end-call", dataWithEnderDevice)
    },
    [emitWithSocket, authState.user?.activeDevice],
  )
  const sendIceCandidate = useCallback(
    (iceData) => {
      const dataWithSenderDevice = { ...iceData, senderDeviceId: authState.user?.activeDevice }
      emitWithSocket("send-ice-candidate", dataWithSenderDevice)
    },
    [emitWithSocket, authState.user?.activeDevice],
  )

  const joinGroupCall = useCallback(
    (id, mediaStream) => {
      if (!mediaStream) {
        console.error("[SocketContext] Cannot join group call without a local media stream.")
        Alert.alert("Media Error", "Local camera/microphone stream is required to join the call.")
        return
      }
      if (!getValidSocket()) {
        console.error("[SocketContext] Cannot join group call: Socket not connected.")
        Alert.alert("Connection Error", "Not connected to server. Please try again.")
        return
      }
      console.log(
        `[SocketContext] joinGroupCall: User ${authState.user?.id} joining call ${id}. Setting groupCallIdRef and localGroupStreamRef.`,
      )

      localGroupStreamRef.current = mediaStream
      setLocalGroupStream(mediaStream)

      setGroupCallId(id)
      groupCallIdRef.current = id

      setGroupParticipants((prev) => {
        const newMap = new Map(prev)
        if (authState.user) {
          const audioTracks = mediaStream.getAudioTracks()
          const videoTracks = mediaStream.getVideoTracks()
          newMap.set(authState.user.id, {
            id: authState.user.id,
            userId: authState.user.id,
            name: authState.user.name || "You",
            profilePicture: authState.user.profilePicture,
            stream: mediaStream,
            isLocal: true,
            isMuted: audioTracks.length > 0 ? !audioTracks[0].enabled : false,
            isVideoEnabled: videoTracks.length > 0 ? videoTracks[0].enabled : false,
            pc: null,
          })
        }
        return newMap
      })

      emitWithSocket("join-group-call", id)

      GroupCallAPI.joinGroupCall(id)
        .then((response) => {
          if (response && response.success) {
            console.log(`[SocketContext] Successfully notified backend of joining group call ${id}`)
          } else {
            console.warn(`[SocketContext] Failed to notify backend of joining group call ${id}:`, response?.message)
          }
        })
        .catch((error) => {
          console.error(`[SocketContext] Error calling joinGroupCall API for ${id}:`, error)
        })
    },
    [emitWithSocket, authState.user, getValidSocket],
  )

  const leaveGroupCall = useCallback(() => {
    const currentActiveGroupCallId = groupCallIdRef.current
    if (currentActiveGroupCallId) {
      console.log(`[SocketContext] Leaving group call: ${currentActiveGroupCallId}`)
      emitWithSocket("leave-group-call", currentActiveGroupCallId)
      cleanupGroupCall()
    } else {
      console.warn("[SocketContext] Attempted to leave group call, but no active groupCallIdRef.current found.")
      cleanupGroupCall()
    }
  }, [emitWithSocket, cleanupGroupCall])

  const toggleGroupMute = useCallback(() => {
    const streamToToggle = localGroupStreamRef.current || localGroupStream
    if (streamToToggle) {
      const audioTrack = streamToToggle.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        const newMutedState = !audioTrack.enabled
        emitWithSocket("participant-muted", { callId: groupCallIdRef.current, isMuted: newMutedState })
        setGroupParticipants((prev) => {
          const selfData = prev.get(authState.user.id)
          if (selfData) {
            return new Map(prev).set(authState.user.id, { ...selfData, isMuted: newMutedState })
          }
          return prev
        })
      }
    }
  }, [localGroupStream, emitWithSocket, authState.user?.id])

  const toggleGroupVideo = useCallback(() => {
    const streamToToggle = localGroupStreamRef.current || localGroupStream
    if (streamToToggle) {
      const videoTrack = streamToToggle.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        const newVideoState = videoTrack.enabled
        emitWithSocket("participant-video-toggled", { callId: groupCallIdRef.current, isVideoEnabled: newVideoState })
        setGroupParticipants((prev) => {
          const selfData = prev.get(authState.user.id)
          if (selfData) {
            return new Map(prev).set(authState.user.id, { ...selfData, isVideoEnabled: newVideoState })
          }
          return prev
        })
      }
    }
  }, [localGroupStream, emitWithSocket, authState.user?.id])

  const requestIceRestart = useCallback(
    (restartData) => emitWithSocket("request-ice-restart", restartData),
    [emitWithSocket],
  )
  const sendGroupCallOffer = useCallback((offer) => emitWithSocket("group-call-offer", offer), [emitWithSocket])
  const sendGroupCallAnswer = useCallback((answer) => emitWithSocket("group-call-answer", answer), [emitWithSocket])
  const sendGroupCallIceCandidate = useCallback(
    (candidate) => emitWithSocket("group-ice-candidate", candidate),
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
    (status) => {
      if (groupCallIdRef.current) {
        emitWithSocket("set-group-call-screen-sharing", { callId: groupCallIdRef.current, status })
      } else {
        console.warn("[SocketContext] Cannot set screen sharing: no active group call ID.")
      }
    },
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
  const joinConversation = useCallback(
    (conversationId) => emitWithSocket("join-conversation", conversationId),
    [emitWithSocket],
  )
  const leaveConversation = useCallback(
    (conversationId) => emitWithSocket("leave-conversation", conversationId),
    [emitWithSocket],
  )
  const sendMessage = useCallback((message) => emitWithSocket("send-message", message), [emitWithSocket])
  const markAsRead = useCallback(
    (messageId, conversationId) =>
      emitWithSocket("mark-as-read", { messageId, conversationId, userId: authState.user?.id }),
    [emitWithSocket, authState.user?.id],
  )
  const markAsDelivered = useCallback(
    (messageId, conversationId) =>
      emitWithSocket("mark-as-delivered", { messageId, conversationId, userId: authState.user?.id }),
    [emitWithSocket, authState.user?.id],
  )
  const setTyping = useCallback((conversationId) => emitWithSocket("set-typing", conversationId), [emitWithSocket])
  const setStopTyping = useCallback((conversationId) => emitWithSocket("stop-typing", conversationId), [emitWithSocket])
  const setOnlineStatus = useCallback((status) => emitWithSocket("set-online-status", status), [emitWithSocket])

  const contextValue = {
    socket: globalSocketInstance,
    isConnected,
    incomingCallData,
    clearIncomingCallDataState,
    onlineUsers,
    messages,
    getSocket: getValidSocket,

    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    sendIceCandidate,
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

    groupCallId,
    groupParticipants,
    localGroupStream,
    joinGroupCall,
    leaveGroupCall,
    toggleGroupMute,
    toggleGroupVideo,

    sendMessage,
    markAsRead,
    markAsDelivered,
    setTyping,
    setStopTyping,
    setOnlineStatus,
    requestIceRestart,
    checkUserStatus,
    notifyUserCameOnline,
    sendCallPushNotification,
    sendGroupCallOffer,
    sendGroupCallAnswer,
    sendGroupCallIceCandidate,
    notifyGroupCallUserJoined,
    notifyGroupCallUserLeft,
    setGroupCallScreenSharing,
    sendCallQualityMetrics,
    sendNetworkFallback,
    joinConversation,
    leaveConversation,
    joinAdminDashboard,
    leaveAdminDashboard,
  }

  return <SocketContext.Provider value={contextValue}>{children}</SocketContext.Provider>
}
