import React, { useState, useEffect, useContext, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native"
import { useNavigation, useFocusEffect } from "@react-navigation/native"
import Ionicons from "react-native-vector-icons/Ionicons"
import { AuthContext } from "../../context/AuthContext"
import { ThemeContext } from "../../context/ThemeContext"
import { getTheme } from "../../utils/theme"
import * as CallAPI from "../../api/call"
import * as CallLogAPI from "../../api/call-log"

const CallHistoryScreen = () => {
  const navigation = useNavigation()
  const { state: authState } = useContext(AuthContext)
  const { theme } = useContext(ThemeContext)
  const currentTheme = getTheme(theme)

  const [callHistory, setCallHistory] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  // Fetch call history
  const fetchCallHistory = async (pageNum = 1, shouldRefresh = false) => {
    try {
      if (shouldRefresh) {
        setIsLoading(true)
      }

      // Using the unified call history endpoint from call-log API
      // which includes both one-to-one and group calls
      const response = await CallLogAPI.getUnifiedCallHistory(
        authState.token,
        pageNum
      )

      if (response.success) {
        if (shouldRefresh || pageNum === 1) {
          setCallHistory(response.calls)
        } else {
          setCallHistory((prev) => [...prev, ...response.calls])
        }

        setHasMore(
          response.pagination.page < response.pagination.totalPages
        )
        setPage(pageNum)
      } else {
        Alert.alert("Error", response.message || "Failed to fetch call history")
      }
    } catch (error) {
      console.error("Error fetching call history:", error)
      Alert.alert("Error", "An unexpected error occurred")
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchCallHistory(1, true)
  }, [])

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchCallHistory(1, true)
      return () => {}
    }, [])
  )

  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true)
    fetchCallHistory(1, true)
  }

  // Load more calls
  const loadMoreCalls = () => {
    if (!isLoading && hasMore) {
      fetchCallHistory(page + 1)
    }
  }

  // Format call duration
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

  // Get call icon based on type and status
  const getCallIcon = (call) => {
    const isMissed = call.status === "missed" || call.status === "rejected"
    const isOutgoing = call.participants.find(p => p.role === "self")?.role === "caller" ||
      call.participants.find(p => p.role === "self")?.role === "initiator"

    if (call.type === "group") {
      return {
        name: isMissed ? "call-missed" : isOutgoing ? "call-made" : "call-received",
        color: isMissed ? "#FF3B30" : isOutgoing ? currentTheme.primary : "#4CD964",
      }
    }

    if (call.callType === "video") {
      return {
        name: isMissed ? "videocam-off" : "videocam",
        color: isMissed ? "#FF3B30" : currentTheme.primary,
      }
    }

    return {
      name: isMissed
        ? "call-missed"
        : isOutgoing
          ? "call-made"
          : "call-received",
      color: isMissed ? "#FF3B30" : isOutgoing ? currentTheme.primary : "#4CD964",
    }
  }

  // Get other participant name for one-to-one calls
  const getCallName = (call) => {
    if (call.type === "group") {
      return call.conversation?.groupName || "Group Call"
    }

    const otherParticipant = call.participants.find(p => p.role !== "self")
    return otherParticipant?.user?.name || otherParticipant?.user?.phoneNumber || "Unknown"
  }

  // Navigate to call details
  const navigateToCallDetails = (call) => {
    navigation.navigate("CallDetails", { callId: call.id, callType: call.type })
  }

  // Initiate a new call
  const initiateCall = (call, callType) => {
    if (call.type === "group") {
      // Handle group call initiation
      Alert.alert("Group Call", "Group call functionality will be implemented soon")
    } else {
      // Get the other participant
      const otherParticipant = call.participants.find(p => p.role !== "self")

      if (otherParticipant?.user?._id) {
        navigation.navigate("Call", {
          receiverId: otherParticipant.user._id,
          receiverName: otherParticipant.user.name || otherParticipant.user.phoneNumber,
          receiverProfilePic: otherParticipant.user.profilePicture,
          callType: callType || call.callType,
        })
      } else {
        Alert.alert("Error", "Could not find call participant")
      }
    }
  }

  // Render call item
  const renderCallItem = ({ item }) => {
    const callIcon = getCallIcon(item)
    const callName = getCallName(item)
    const callTime = new Date(item.startTime).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })
    const callDate = new Date(item.startTime).toLocaleDateString()

    return (
      <TouchableOpacity
        style={[styles.callItem, { borderBottomColor: currentTheme.border }]}
        onPress={() => navigateToCallDetails(item)}
      >
        <View style={styles.callIconContainer}>
          <Ionicons name={callIcon.name} size={24} color={callIcon.color} />
        </View>

        <View style={styles.callInfoContainer}>
          <Text style={[styles.callName, { color: currentTheme.text }]}>
            {callName}
          </Text>

          <View style={styles.callDetailsRow}>
            <Ionicons
              name={item.type === "group" ? "people" : "person"}
              size={14}
              color={currentTheme.placeholder}
              style={styles.smallIcon}
            />
            <Text style={[styles.callDetails, { color: currentTheme.placeholder }]}>
              {item.status === "missed" ? "Missed" :
                item.status === "rejected" ? "Declined" :
                  formatDuration(item.duration)}
            </Text>
            <Text style={[styles.callTime, { color: currentTheme.placeholder }]}>
              {callTime} • {callDate}
            </Text>
          </View>
        </View>

        <View style={styles.callActions}>
          <TouchableOpacity
            style={styles.callActionButton}
            onPress={() => initiateCall(item, "audio")}
          >
            <Ionicons name="call" size={22} color={currentTheme.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.callActionButton}
            onPress={() => initiateCall(item, "video")}
          >
            <Ionicons name="videocam" size={22} color={currentTheme.primary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    )
  }

  // Render empty state
  const renderEmptyState = () => {
    if (isLoading) return null

    return (
      <View style={styles.emptyStateContainer}>
        <Ionicons name="call-outline" size={60} color={currentTheme.placeholder} />
        <Text style={[styles.emptyStateText, { color: currentTheme.text }]}>
          No call history
        </Text>
        <Text style={[styles.emptyStateSubtext, { color: currentTheme.placeholder }]}>
          Your call history will appear here
        </Text>
      </View>
    )
  }

  // Render footer (loading indicator)
  const renderFooter = () => {
    if (!isLoading || refreshing) return null

    return (
      <View style={styles.footerContainer}>
        <ActivityIndicator size="small" color={currentTheme.primary} />
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <FlatList
        data={callHistory}
        renderItem={renderCallItem}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        contentContainerStyle={callHistory.length === 0 && styles.emptyListContent}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        onEndReached={loadMoreCalls}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[currentTheme.primary]}
            tintColor={currentTheme.primary}
          />
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  callItem: {
    flexDirection: "row",
    padding: 15,
    borderBottomWidth: 0.5,
  },
  callIconContainer: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  callInfoContainer: {
    flex: 1,
    marginLeft: 10,
    justifyContent: "center",
  },
  callName: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  callDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  smallIcon: {
    marginRight: 4,
  },
  callDetails: {
    fontSize: 13,
    marginRight: 8,
  },
  callTime: {
    fontSize: 13,
  },
  callActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  callActionButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  emptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: "center",
  },
  footerContainer: {
    padding: 20,
    alignItems: "center",
  },
})

export default CallHistoryScreen
