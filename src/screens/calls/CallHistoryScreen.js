"use client"

import { useState, useEffect, useContext } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  SectionList,
} from "react-native"
import Ionicons from "react-native-vector-icons/Ionicons"
import { useNavigation } from "@react-navigation/native"
import { AuthContext } from "../../context/AuthContext"
import * as CallsAPI from "../../api/calls"
import * as GroupCallsAPI from "../../api/group-calls"
import { formatDate, formatTime, formatCallDuration } from "../../utils/formatters"

const CallHistoryScreen = () => {
  const navigation = useNavigation()
  const { state: authState } = useContext(AuthContext)

  const [callHistory, setCallHistory] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sections, setSections] = useState([])

  // Fetch call history on mount
  useEffect(() => {
    fetchCallHistory()
  }, [])

  // Process call history into sections
  useEffect(() => {
    if (callHistory.length > 0) {
      const groupedCalls = groupCallsByDate(callHistory)
      setSections(groupedCalls)
    }
  }, [callHistory])

  // Fetch call history
  const fetchCallHistory = async () => {
    try {
      setIsLoading(true)

      // Fetch one-to-one call history
      const callResponse = await CallsAPI.getCallHistory({}, authState.token)

      // Fetch group call history
      const groupCallResponse = await GroupCallsAPI.getGroupCallHistory(authState.token)

      // Combine and sort call history
      let combinedHistory = []

      if (callResponse.success) {
        combinedHistory = [
          ...combinedHistory,
          ...callResponse.calls.map((call) => ({
            ...call,
            isGroupCall: false,
          })),
        ]
      }

      if (groupCallResponse.success) {
        combinedHistory = [
          ...combinedHistory,
          ...groupCallResponse.groupCalls.map((call) => ({
            ...call,
            isGroupCall: true,
          })),
        ]
      }

      // Sort by timestamp (newest first)
      combinedHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

      setCallHistory(combinedHistory)
      setIsLoading(false)
      setRefreshing(false)
    } catch (error) {
      console.error("Error fetching call history:", error)
      setIsLoading(false)
      setRefreshing(false)
      Alert.alert("Error", "Failed to load call history. Please try again.")
    }
  }

  // Group calls by date
  const groupCallsByDate = (calls) => {
    const grouped = {}

    calls.forEach((call) => {
      const date = new Date(call.timestamp)
      const dateString = formatDate(date)

      if (!grouped[dateString]) {
        grouped[dateString] = []
      }

      grouped[dateString].push(call)
    })

    // Convert to sections format
    return Object.keys(grouped).map((date) => ({
      title: date,
      data: grouped[date],
    }))
  }

  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true)
    fetchCallHistory()
  }

  // Delete call from history
  const deleteCall = async (call) => {
    try {
      if (call.isGroupCall) {
        await GroupCallsAPI.deleteGroupCallFromHistory(call._id, authState.token)
      } else {
        await CallsAPI.deleteCall(call._id, authState.token)
      }

      // Update local state
      setCallHistory((prev) => prev.filter((c) => c._id !== call._id))

      Alert.alert("Success", "Call removed from history")
    } catch (error) {
      console.error("Error deleting call:", error)
      Alert.alert("Error", "Failed to delete call. Please try again.")
    }
  }

  // Confirm delete call
  const confirmDeleteCall = (call) => {
    Alert.alert("Delete Call", "Are you sure you want to remove this call from your history?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteCall(call) },
    ])
  }

  // Make a call
  const makeCall = (contact, isVideoCall = false) => {
    navigation.navigate("Call", {
      contactUser: contact,
      isVideoCall,
    })
  }

  // Make a group call
  const makeGroupCall = (conversation, isVideoCall = false) => {
    navigation.navigate("GroupCall", {
      conversation,
      isVideoCall,
    })
  }

  // Render call item
  const renderCallItem = ({ item }) => {
    const isIncoming = item.direction === "incoming"
    const isMissed = isIncoming && item.status === "missed"
    const isGroupCall = item.isGroupCall

    // Determine icon and color
    let iconName = "call"
    let iconColor = "#128C7E"

    if (item.isVideoCall) {
      iconName = "videocam"
    }

    if (isMissed) {
      iconColor = "#FF3B30"
    }

    if (isGroupCall) {
      iconName = item.isVideoCall ? "people" : "call"
    }

    return (
      <TouchableOpacity
        style={styles.callItem}
        onPress={() => {
          if (isGroupCall) {
            makeGroupCall(item.conversation, item.isVideoCall)
          } else {
            makeCall(isIncoming ? item.caller : item.recipient, item.isVideoCall)
          }
        }}
        onLongPress={() => confirmDeleteCall(item)}
      >
        <View style={styles.callIconContainer}>
          <Ionicons name={iconName} size={24} color={iconColor} />
        </View>

        <View style={styles.callInfo}>
          <Text style={styles.callName}>
            {isGroupCall
              ? item.conversation.groupName || "Group Call"
              : isIncoming
                ? item.caller.name
                : item.recipient.name}
          </Text>

          <View style={styles.callDetails}>
            <Ionicons
              name={isIncoming ? "arrow-down" : "arrow-up"}
              size={16}
              color={isMissed ? "#FF3B30" : "#7F7F7F"}
              style={styles.directionIcon}
            />

            <Text style={[styles.callStatus, isMissed && styles.missedCall]}>
              {isMissed ? "Missed" : item.status}
              {item.duration > 0 && ` • ${formatCallDuration(item.duration)}`}
            </Text>
          </View>
        </View>

        <View style={styles.callActions}>
          <Text style={styles.callTime}>{formatTime(new Date(item.timestamp))}</Text>

          <TouchableOpacity
            style={styles.callButton}
            onPress={() => {
              if (isGroupCall) {
                makeGroupCall(item.conversation, item.isVideoCall)
              } else {
                makeCall(isIncoming ? item.caller : item.recipient, item.isVideoCall)
              }
            }}
          >
            <Ionicons name={item.isVideoCall ? "videocam" : "call"} size={22} color="#128C7E" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    )
  }

  // Render section header
  const renderSectionHeader = ({ section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
    </View>
  )

  // Render empty component
  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="call-outline" size={60} color="#CCCCCC" />
      <Text style={styles.emptyText}>No call history</Text>
      <Text style={styles.emptySubText}>Your call history will appear here</Text>
    </View>
  )

  // Render loading state
  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#128C7E" />
        <Text style={styles.loadingText}>Loading call history...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item._id}
        yExtractor={(item) => item._id}
        renderItem={renderCallItem}
        renderSectionHeader={renderSectionHeader}
        ListEmptyComponent={renderEmptyComponent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#128C7E"]} />}
        contentContainerStyle={callHistory.length === 0 ? { flex: 1 } : null}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#7F7F7F",
  },
  sectionHeader: {
    backgroundColor: "#F2F2F2",
    padding: 10,
    paddingHorizontal: 15,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#7F7F7F",
  },
  callItem: {
    flexDirection: "row",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F2",
    alignItems: "center",
  },
  callIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F2F2F2",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  callInfo: {
    flex: 1,
  },
  callName: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 3,
  },
  callDetails: {
    flexDirection: "row",
    alignItems: "center",
  },
  directionIcon: {
    marginRight: 5,
  },
  callStatus: {
    fontSize: 14,
    color: "#7F7F7F",
  },
  missedCall: {
    color: "#FF3B30",
  },
  callActions: {
    alignItems: "flex-end",
  },
  callTime: {
    fontSize: 14,
    color: "#7F7F7F",
    marginBottom: 5,
  },
  callButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F2F2F2",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#7F7F7F",
    marginTop: 15,
  },
  emptySubText: {
    fontSize: 14,
    color: "#7F7F7F",
    marginTop: 5,
    textAlign: "center",
  },
})

export default CallHistoryScreen
