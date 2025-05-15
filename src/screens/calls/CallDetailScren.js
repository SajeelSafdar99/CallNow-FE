import React, { useState, useEffect, useContext } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import Ionicons from "react-native-vector-icons/Ionicons"
import { AuthContext } from "../../context/AuthContext"
import { ThemeContext } from "../../context/ThemeContext"
import { getTheme } from "../../utils/theme"
import * as CallAPI from "../../api/call"
import * as CallLogAPI from "../../api/call-log"
import { API_BASE_URL_FOR_MEDIA } from "../../config/api"

const CallDetailsScreen = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const { callId, callType } = route.params
  const { state: authState } = useContext(AuthContext)
  const { theme } = useContext(ThemeContext)
  const currentTheme = getTheme(theme)

  const [callDetails, setCallDetails] = useState(null)
  const [callLogs, setCallLogs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingLogs, setIsLoadingLogs] = useState(true)

  // Fetch call details
  useEffect(() => {
    const fetchCallDetails = async () => {
      try {
        setIsLoading(true)

        // For one-to-one calls, use the call API
        if (callType === "one-to-one") {
          const response = await CallAPI.getCallDetails(authState.token, callId)

          if (response.success) {
            setCallDetails(response.call)
          } else {
            Alert.alert("Error", response.message || "Failed to fetch call details")
            navigation.goBack()
          }
        }
        // For unified call history, we need to fetch from call logs
        else {
          const response = await CallLogAPI.getUnifiedCallHistory(authState.token)

          if (response.success) {
            const call = response.calls.find(c => c.id === callId)
            if (call) {
              setCallDetails(call)
            } else {
              Alert.alert("Error", "Call not found")
              navigation.goBack()
            }
          } else {
            Alert.alert("Error", response.message || "Failed to fetch call details")
            navigation.goBack()
          }
        }
      } catch (error) {
        console.error("Error fetching call details:", error)
        Alert.alert("Error", "An unexpected error occurred")
        navigation.goBack()
      } finally {
        setIsLoading(false)
      }
    }

    fetchCallDetails()
  }, [callId, callType, authState.token])

  // Fetch call logs
  useEffect(() => {
    const fetchCallLogs = async () => {
      try {
        setIsLoadingLogs(true)

        const response = await CallLogAPI.getCallLogs(
          authState.token,
          callId,
          callType
        )

        if (response.success) {
          setCallLogs(response.logs)
        } else {
          console.log("Failed to fetch call logs:", response.message)
        }
      } catch (error) {
        console.error("Error fetching call logs:", error)
      } finally {
        setIsLoadingLogs(false)
      }
    }

    if (callDetails) {
      fetchCallLogs()
    }
  }, [callDetails, callId, callType, authState.token])

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return "--:--"

    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }

    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  // Get call status text
  const getCallStatusText = (status) => {
    switch (status) {
      case "completed": return "Completed"
      case "missed": return "Missed"
      case "rejected": return "Declined"
      case "failed": return "Failed"
      default: return status.charAt(0).toUpperCase() + status.slice(1)
    }
  }

  // Get call type icon
  const getCallTypeIcon = (type) => {
    return type === "video" ? "videocam" : "call"
  }

  // Delete call record
  const handleDeleteCall = () => {
    Alert.alert(
      "Delete Call Record",
      "Are you sure you want to delete this call record? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await CallAPI.deleteCall(authState.token, callId)

              if (response.success) {
                Alert.alert("Success", "Call record deleted successfully")
                navigation.goBack()
              } else {
                Alert.alert("Error", response.message || "Failed to delete call record")
              }
            } catch (error) {
              console.error("Error deleting call:", error)
              Alert.alert("Error", "An unexpected error occurred")
            }
          },
        },
      ]
    )
  }

  // Initiate a new call
  const initiateCall = (callType) => {
    if (!callDetails) return

    if (callDetails.type === "group") {
      // Handle group call initiation
      Alert.alert("Group Call", "Group call functionality will be implemented soon")
    } else {
      // Get the other participant
      const otherParticipant = callDetails.participants?.find(p => p.role !== "self") ||
        (callDetails.caller?._id === authState.user?._id ?
          { user: callDetails.receiver } :
          { user: callDetails.caller })

      if (otherParticipant?.user?._id) {
        navigation.navigate("Call", {
          receiverId: otherParticipant.user._id,
          receiverName: otherParticipant.user.name || otherParticipant.user.phoneNumber,
          receiverProfilePic: otherParticipant.user.profilePicture,
          callType,
        })
      } else {
        Alert.alert("Error", "Could not find call participant")
      }
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: currentTheme.background }]}>
        <ActivityIndicator size="large" color={currentTheme.primary} />
      </View>
    )
  }

  // Get participants
  const getParticipants = () => {
    if (!callDetails) return []

    if (callDetails.type === "group") {
      return callDetails.participants || []
    } else {
      // For one-to-one calls from the call API
      if (callDetails.caller && callDetails.receiver) {
        return [
          {
            user: callDetails.caller,
            role: callDetails.caller._id === authState.user?._id ? "self" : "caller"
          },
          {
            user: callDetails.receiver,
            role: callDetails.receiver._id === authState.user?._id ? "self" : "receiver"
          }
        ]
      }
      // For one-to-one calls from the unified history
      return callDetails.participants || []
    }
  }

  // Get call name
  const getCallName = () => {
    if (!callDetails) return "Unknown"

    if (callDetails.type === "group") {
      return callDetails.conversation?.groupName || "Group Call"
    }

    const otherParticipant = getParticipants().find(p => p.role !== "self")
    return otherParticipant?.user?.name || otherParticipant?.user?.phoneNumber || "Unknown"
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: currentTheme.background }]}>
      {/* Call Header */}
      <View style={[styles.callHeader, { backgroundColor: currentTheme.card }]}>
        {callDetails?.type === "group" ? (
          <View style={styles.groupIconContainer}>
            <Ionicons name="people" size={40} color={currentTheme.primary} />
          </View>
        ) : (
          <View style={styles.profileImageContainer}>
            {getParticipants().find(p => p.role !== "self")?.user?.profilePicture ? (
              <Image
                source={{
                  uri: `${API_BASE_URL_FOR_MEDIA}${getParticipants().find(p => p.role !== "self")?.user?.profilePicture}`
                }}
                style={styles.profileImage}
              />
            ) : (
              <View style={[styles.defaultProfileImage, { backgroundColor: currentTheme.primary }]}>
                <Text style={styles.defaultProfileImageText}>
                  {getCallName().charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        )}

        <Text style={[styles.callName, { color: currentTheme.text }]}>
          {getCallName()}
        </Text>

        <View style={styles.callTypeContainer}>
          <Ionicons
            name={getCallTypeIcon(callDetails?.callType || "audio")}
            size={18}
            color={currentTheme.primary}
          />
          <Text style={[styles.callTypeText, { color: currentTheme.primary }]}>
            {callDetails?.callType === "video" ? "Video Call" : "Audio Call"}
          </Text>
        </View>

        <View style={styles.callActions}>
          <TouchableOpacity
            style={[styles.callActionButton, { backgroundColor: currentTheme.primary }]}
            onPress={() => initiateCall("audio")}
          >
            <Ionicons name="call" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.callActionButton, { backgroundColor: currentTheme.primary }]}
            onPress={() => initiateCall("video")}
          >
            <Ionicons name="videocam" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Call Details */}
      <View style={[styles.detailsSection, { backgroundColor: currentTheme.card }]}>
        <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>
          Call Details
        </Text>

        <View style={[styles.detailItem, { borderBottomColor: currentTheme.border }]}>
          <Text style={[styles.detailLabel, { color: currentTheme.placeholder }]}>Status</Text>
          <Text style={[styles.detailValue, { color: currentTheme.text }]}>
            {getCallStatusText(callDetails?.status)}
          </Text>
        </View>

        <View style={[styles.detailItem, { borderBottomColor: currentTheme.border }]}>
          <Text style={[styles.detailLabel, { color: currentTheme.placeholder }]}>Time</Text>
          <Text style={[styles.detailValue, { color: currentTheme.text }]}>
            {formatDate(callDetails?.startTime)}
          </Text>
        </View>

        <View style={[styles.detailItem, { borderBottomColor: currentTheme.border }]}>
          <Text style={[styles.detailLabel, { color: currentTheme.placeholder }]}>Duration</Text>
          <Text style={[styles.detailValue, { color: currentTheme.text }]}>
            {formatDuration(callDetails?.duration)}
          </Text>
        </View>

        {callDetails?.type === "group" && (
          <View style={styles.detailItem}>
            <Text style={[styles.detailLabel, { color: currentTheme.placeholder }]}>Participants</Text>
            <Text style={[styles.detailValue, { color: currentTheme.text }]}>
              {getParticipants().length} participants
            </Text>
          </View>
        )}
      </View>

      {/* Participants (for group calls) */}
      {callDetails?.type === "group" && (
        <View style={[styles.detailsSection, { backgroundColor: currentTheme.card }]}>
          <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>
            Participants
          </Text>

          {getParticipants().map((participant, index) => (
            <View
              key={participant.user?._id || index}
              style={[
                styles.participantItem,
                index < getParticipants().length - 1 && { borderBottomColor: currentTheme.border, borderBottomWidth: 0.5 }
              ]}
            >
              <View style={styles.participantInfo}>
                {participant.user?.profilePicture ? (
                  <Image
                    source={{ uri: `${API_BASE_URL_FOR_MEDIA}${participant.user.profilePicture}` }}
                    style={styles.participantImage}
                  />
                ) : (
                  <View style={[styles.defaultParticipantImage, { backgroundColor: currentTheme.primary }]}>
                    <Text style={styles.defaultParticipantImageText}>
                      {participant.user?.name?.charAt(0).toUpperCase() || "U"}
                    </Text>
                  </View>
                )}

                <View style={styles.participantDetails}>
                  <Text style={[styles.participantName, { color: currentTheme.text }]}>
                    {participant.user?.name || participant.user?.phoneNumber || "Unknown"}
                    {participant.role === "self" && " (You)"}
                    {participant.role === "initiator" && " (Initiator)"}
                  </Text>

                  {participant.joinedAt && (
                    <Text style={[styles.participantTime, { color: currentTheme.placeholder }]}>
                      Joined: {new Date(participant.joinedAt).toLocaleTimeString()}
                      {participant.leftAt && ` • Left: ${new Date(participant.leftAt).toLocaleTimeString()}`}
                    </Text>
                  )}
                </View>
              </View>

              {participant.role !== "self" && (
                <TouchableOpacity
                  style={styles.participantCallButton}
                  onPress={() => {
                    navigation.navigate("Call", {
                      receiverId: participant.user._id,
                      receiverName: participant.user.name || participant.user.phoneNumber,
                      receiverProfilePic: participant.user.profilePicture,
                      callType: "audio",
                    })
                  }}
                >
                  <Ionicons name="call" size={20} color={currentTheme.primary} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Call Logs */}
      {callLogs.length > 0 && (
        <View style={[styles.detailsSection, { backgroundColor: currentTheme.card }]}>
          <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>
            Call Events
          </Text>

          {isLoadingLogs ? (
            <ActivityIndicator size="small" color={currentTheme.primary} style={styles.logsLoading} />
          ) : (
            callLogs.map((log, index) => (
              <View
                key={log._id || index}
                style={[
                  styles.logItem,
                  index < callLogs.length - 1 && { borderBottomColor: currentTheme.border, borderBottomWidth: 0.5 }
                ]}
              >
                <Text style={[styles.logEvent, { color: currentTheme.text }]}>
                  {log.eventType.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                </Text>

                <Text style={[styles.logTime, { color: currentTheme.placeholder }]}>
                  {new Date(log.timestamp).toLocaleTimeString()}
                </Text>

                {log.user && log.user._id && (
                  <Text style={[styles.logUser, { color: currentTheme.placeholder }]}>
                    By: {log.user.name || log.user.phoneNumber || "Unknown"}
                  </Text>
                )}
              </View>
            ))
          )}
        </View>
      )}

      {/* Delete Button */}
      <TouchableOpacity
        style={[styles.deleteButton, { backgroundColor: currentTheme.card }]}
        onPress={handleDeleteCall}
      >
        <Ionicons name="trash" size={20} color="#FF3B30" />
        <Text style={styles.deleteButtonText}>Delete Call Record</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  callHeader: {
    alignItems: "center",
    padding: 20,
    marginBottom: 15,
  },
  profileImageContainer: {
    marginBottom: 15,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  defaultProfileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  defaultProfileImageText: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "bold",
  },
  groupIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  callName: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 5,
  },
  callTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  callTypeText: {
    marginLeft: 5,
    fontSize: 14,
  },
  callActions: {
    flexDirection: "row",
    justifyContent: "center",
  },
  callActionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 10,
  },
  detailsSection: {
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 10,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    padding: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: "#DDDDDD",
  },
  detailItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 15,
    borderBottomWidth: 0.5,
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  participantItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
  },
  participantInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  participantImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  defaultParticipantImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  defaultParticipantImageText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  participantDetails: {
    marginLeft: 10,
    flex: 1,
  },
  participantName: {
    fontSize: 14,
    fontWeight: "500",
  },
  participantTime: {
    fontSize: 12,
    marginTop: 2,
  },
  participantCallButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  logsLoading: {
    padding: 20,
  },
  logItem: {
    padding: 15,
  },
  logEvent: {
    fontSize: 14,
    fontWeight: "500",
  },
  logTime: {
    fontSize: 12,
    marginTop: 2,
  },
  logUser: {
    fontSize: 12,
    marginTop: 2,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 15,
    marginBottom: 30,
    padding: 15,
    borderRadius: 10,
  },
  deleteButtonText: {
    color: "#FF3B30",
    marginLeft: 10,
    fontSize: 16,
    fontWeight: "500",
  },
})

export default CallDetailsScreen
