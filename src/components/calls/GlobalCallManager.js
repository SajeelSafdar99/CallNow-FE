// components/call/global-call-manager.js
// This component manages the logic for incoming calls and renders the appropriate modal.
"use client"

import { useContext } from "react"
import { useNavigation } from "@react-navigation/native"
import { SocketContext } from "../../context/SocketContext"
import { AuthContext } from "../../context/AuthContext"

// Import BOTH modal components
// Ensure this path points to YOUR UNMODIFIED IncomingCallModal.js
import OriginalIncomingCallModal from "./IncomingCallModal"
import IncomingGroupCallModal from "./IncomingGroupCallModal"

const GlobalCallManager = () => {
  const navigation = useNavigation()
  const { incomingCallData, clearIncomingCallDataState, rejectCall, socket } = useContext(SocketContext)
  const { state: authState } = useContext(AuthContext)

  console.log("[GlobalCallManager] Current incomingCallData:", incomingCallData) // Log 1

  const handleAcceptCall = async (callDetails) => {
    if (!callDetails) return

    const { callId, isGroupCall, conversationId, callType, caller, offer, conversationName } = callDetails
    console.log(`[GlobalCallManager] handleAcceptCall called for callId: ${callId}, isGroupCall: ${isGroupCall}`) // Log 2

    if (isGroupCall) {
      console.log(`[GlobalCallManager] Accepting GROUP call ${callId}, navigating to GroupCallScreen.`)
      navigation.navigate("GroupCallScreen", {
        groupCallId: callId,
        conversationId: conversationId,
        conversationName: conversationName || "Group Call",
        callType: callType,
        initiatorId: caller?.id,
        isIncoming: true,
        callAcceptedFromModal: true, // Add this line
      })
    } else {
      console.log(`[GlobalCallManager] Accepting 1-to-1 call ${callId}, navigating to CallScreen.`)
      navigation.navigate("Call", {
        callId: callId,
        receiverId: caller?.id, // Retained for robustness
        receiverName: caller?.name, // Retained for robustness
        receiverProfilePic: caller?.profilePicture, // Retained for robustness
        callerInfo: caller, // Pass the full caller object
        callType: callType,
        offer: offer,
        isIncoming: true,
        isPreAccepted: true, // Explicitly set for CallScreen
      })
    }
    clearIncomingCallDataState(callId)
  }

  const handleRejectCall = (callDetails) => {
    if (!callDetails) return

    const { callId, isGroupCall, caller } = callDetails
    console.log(`[GlobalCallManager] handleRejectCall called for callId: ${callId}, isGroupCall: ${isGroupCall}`) // Log 3

    if (isGroupCall) {
      if (socket && caller?.id && authState.user?.id) {
        socket.emit("group-call-invite-declined", {
          callId: callId,
          inviterId: caller.id,
          inviteeId: authState.user.id,
          reason: "declined",
        })
      }
    } else {
      if (rejectCall && caller?.id && authState.user?.activeDevice) {
        rejectCall({
          callId: callId,
          callerId: caller.id,
          reason: "rejected",
          rejecterDeviceId: authState.user.activeDevice,
        })
      }
    }
    clearIncomingCallDataState(callId)
  }

  const handleCloseModal = () => {
    console.log("[GlobalCallManager] handleCloseModal called.") // Log 4
    if (incomingCallData) {
      handleRejectCall(incomingCallData)
    }
  }

  if (!incomingCallData) {
    // console.log("[GlobalCallManager] No incomingCallData, rendering null.") // Optional log
    return null
  }

  console.log(`[GlobalCallManager] Processing incomingCallData. isGroupCall: ${incomingCallData.isGroupCall}`) // Log 5

  if (incomingCallData.isGroupCall) {
    console.log("[GlobalCallManager] Rendering IncomingGroupCallModal") // Log 6
    return (
      <IncomingGroupCallModal
        visible={!!incomingCallData}
        callData={incomingCallData}
        onAccept={handleAcceptCall}
        onReject={handleRejectCall}
        onClose={handleCloseModal}
      />
    )
  } else {
    console.log("[GlobalCallManager] Rendering OriginalIncomingCallModal") // Log 7
    return (
      <OriginalIncomingCallModal
        visible={!!incomingCallData}
        callData={incomingCallData}
        onAccept={handleAcceptCall}
        onReject={handleRejectCall}
        onClose={handleCloseModal}
      />
    )
  }
}

export default GlobalCallManager
