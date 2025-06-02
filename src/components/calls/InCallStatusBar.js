"use client"

// Please replace this with the correct code for your InCallStatusBar.js component
// Ensure it has a default export: export default InCallStatusBar;

import { useContext } from "react"
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native"
import Ionicons from "react-native-vector-icons/Ionicons"
import { useNavigation } from "@react-navigation/native"
import { ActiveCallContext } from "../../context/ActiveCallContext" // Adjust path as needed
import { ThemeContext } from "../../context/ThemeContext" // Adjust path as needed
import { getTheme } from "../../utils/theme" // Adjust path as needed

const InCallStatusBar = () => {
  const navigation = useNavigation()
  const { activeCallDetails, formatCallDuration } = useContext(ActiveCallContext)
  const { theme } = useContext(ThemeContext) || { theme: "light" }
  const currentTheme = getTheme(theme)

  if (!activeCallDetails) {
    return null
  }

  const { peerName, callDuration, callState, isVideoCall, peerProfilePic } = activeCallDetails

  const handleTapToReturn = () => {
    if (!activeCallDetails) return

    const {
      callId,
      isVideoCall,
      isIncoming,
      isPreAccepted,
      callerInfo, // Original initiator
      receiverInfo, // Original recipient
      offer, // May be less relevant for an ongoing call rejoin
      targetDeviceId, // May be less relevant for an ongoing call rejoin
      // Ensure all other necessary original params are available in activeCallDetails
      // or passed here if CallScreen needs them.
    } = activeCallDetails

    console.log("[InCallStatusBar] Navigating back to CallScreen with params:", {
      callId,
      callType: isVideoCall ? "video" : "audio",
      isIncoming,
      isPreAccepted,
      callerInfo,
      receiverId: receiverInfo?.id,
      receiverName: receiverInfo?.name,
      receiverProfilePic: receiverInfo?.profilePicture,
      offer,
      targetDeviceId,
      isRejoining: true,
    })

    navigation.navigate("Call", {
      callId: callId,
      callType: isVideoCall ? "video" : "audio",
      isIncoming: isIncoming, // Original direction of the call
      isPreAccepted: isPreAccepted,

      // Pass the original callerInfo and receiverInfo as CallScreen expects them
      callerInfo: callerInfo,
      receiverId: receiverInfo?.id,
      receiverName: receiverInfo?.name,
      receiverProfilePic: receiverInfo?.profilePicture,

      offer: offer, // Pass along; rejoin logic in CallScreen might ignore for signaling
      targetDeviceId: targetDeviceId, // Pass along

      isRejoining: true, // Key flag to indicate a rejoin attempt
    })
  }

  let statusText = "Ongoing Call"
  if (callState === "ringing") {
    statusText = "Incoming Call..."
  } else if (callState === "connecting") {
    statusText = "Connecting..."
  } else if (callState === "ongoing" && callDuration !== undefined) {
    statusText = `Ongoing - ${formatCallDuration(callDuration)}`
  }

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: currentTheme.primary || "#4CAF50" }]}
      onPress={handleTapToReturn}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        {isVideoCall ? (
          <Ionicons name="videocam" size={18} color="#FFFFFF" />
        ) : (
          <Ionicons name="call" size={18} color="#FFFFFF" />
        )}
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.statusText} numberOfLines={1}>
          {peerName || "Call in progress"}
        </Text>
        <Text style={styles.durationText} numberOfLines={1}>
          {statusText} - Tap to return
        </Text>
      </View>
      {peerProfilePic ? (
        <Image source={{ uri: peerProfilePic }} style={styles.profilePic} />
      ) : (
        <View style={styles.defaultProfilePic}>
          <Ionicons name="person" size={18} color="#FFFFFF" />
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 40, // Adjust height as needed
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    zIndex: 1000, // Ensure it's on top
    elevation: 5, // Android shadow
    shadowColor: "#000", // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  iconContainer: {
    marginRight: 8,
  },
  textContainer: {
    flex: 1,
    justifyContent: "center",
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
  },
  durationText: {
    color: "#FFFFFF",
    fontSize: 11,
  },
  profilePic: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginLeft: 8,
  },
  defaultProfilePic: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
})

export default InCallStatusBar
