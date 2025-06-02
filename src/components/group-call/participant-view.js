import { View, Text, StyleSheet, Image } from "react-native"
import { RTCView } from "react-native-webrtc"
import Ionicons from "react-native-vector-icons/Ionicons"
import { API_BASE_URL_FOR_MEDIA } from "../../config/api"

const ParticipantView = ({ participant, stream, isLocal, callType, theme }) => {
  const hasVideo = stream && participant?.isVideoEnabled && callType === "video"
  const displayName = participant?.name || participant?.id || "Participant"

  let profilePictureUri = null
  if (participant?.profilePicture) {
    if (participant.profilePicture.startsWith("http://") || participant.profilePicture.startsWith("https://")) {
      profilePictureUri = participant.profilePicture
    } else {
      const base = API_BASE_URL_FOR_MEDIA.endsWith("/") ? API_BASE_URL_FOR_MEDIA.slice(0, -1) : API_BASE_URL_FOR_MEDIA
      const path = participant.profilePicture.startsWith("/")
        ? participant.profilePicture.slice(1)
        : participant.profilePicture
      profilePictureUri = `${base}/${path}`
    }
  }

  const styles = getParticipantStyles(theme)

  return (
    <View style={styles.participantContainer}>
      {hasVideo && stream?.toURL ? (
        <RTCView streamURL={stream.toURL()} style={styles.videoStream} objectFit="cover" mirror={isLocal} />
      ) : (
        <View style={styles.avatarContainer}>
          {profilePictureUri ? (
            <Image source={{ uri: profilePictureUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.defaultAvatar}>
              <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          {callType === "video" && !participant?.isVideoEnabled && (
            <View style={styles.videoOffIconContainer}>
              <Ionicons name="videocam-off-outline" size={20} color={theme.text} />
            </View>
          )}
        </View>
      )}
      <View style={styles.participantOverlay}>
        <Text style={styles.participantName} numberOfLines={1}>
          {isLocal ? "You" : displayName}
        </Text>
        {participant?.isMuted && (
          <Ionicons name="mic-off-outline" size={16} color={theme.error} style={styles.micIcon} />
        )}
      </View>
    </View>
  )
}

const getParticipantStyles = (theme) =>
  StyleSheet.create({
    participantContainer: {
      flex: 1,
      borderRadius: 8,
      overflow: "hidden",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.card, // Use theme.card for consistency
      position: "relative",
      borderWidth: 1,
      borderColor: theme.border,
    },
    videoStream: {
      width: "100%",
      height: "100%",
    },
    avatarContainer: {
      width: "100%",
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.card, // Base background for avatar view
    },
    avatarImage: {
      width: "70%",
      height: "70%",
      borderRadius: 100,
      aspectRatio: 1,
    },
    defaultAvatar: {
      width: "70%",
      height: "70%",
      borderRadius: 100,
      aspectRatio: 1,
      backgroundColor: theme.primary, // As per theme.js
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: {
      color: "#FFFFFF", // Primary is dark teal, so white text is good
      fontSize: 36,
      fontWeight: "bold",
    },
    participantOverlay: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingVertical: 6,
      paddingHorizontal: 10,
      backgroundColor: theme.overlay, // Use theme.overlay
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    participantName: {
      fontSize: 13,
      fontWeight: "500",
      color: "#FFFFFF", // Overlay is dark, so text must be light
      flexShrink: 1,
    },
    micIcon: {
      marginLeft: 4,
    },
    videoOffIconContainer: {
      position: "absolute",
      top: 6,
      right: 6,
      backgroundColor: "rgba(0,0,0,0.6)", // Keep this dark for visibility on video/avatar
      padding: 5,
      borderRadius: 15,
    },
  })

export default ParticipantView
