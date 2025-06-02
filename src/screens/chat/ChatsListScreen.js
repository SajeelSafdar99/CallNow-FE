"use client"

import { useState, useEffect, useContext } from "react"
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native"
import Ionicons from "react-native-vector-icons/Ionicons"
import { useNavigation } from "@react-navigation/native"
import { AuthContext } from "../../context/AuthContext"
import { SocketContext } from "../../context/SocketContext" // Assuming this provides onlineUserIds
import { ThemeContext } from "../../context/ThemeContext"
import { getTheme } from "../../utils/theme"
import * as ConversationsAPI from "../../api/conversations"
import { formatDate } from "../../utils/formatters"
import { API_BASE_URL_FOR_MEDIA } from "../../config/api"

const ChatsListScreen = () => {
  const navigation = useNavigation()
  const { state: authState } = useContext(AuthContext)
  // Assume SocketContext provides onlineUserIds (e.g., a Set of user IDs)
  const { socket, isConnected, onlineUserIds } = useContext(SocketContext)
  const { theme } = useContext(ThemeContext)
  const currentTheme = getTheme(theme)

  const [conversations, setConversations] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Fetch conversations
  const fetchConversations = async () => {
    try {
      const response = await ConversationsAPI.getConversations(authState.token)
      if (response.success) {
        setConversations(response.conversations)
      }
    } catch (error) {
      console.error("Error fetching conversations:", error)
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchConversations()
  }, [])

  // Socket event listeners
  useEffect(() => {
    if (socket && isConnected) {
      // Listen for new messages
      const handleReceiveMessage = (message) => {
        setConversations((prevConversations) => {
          // Try to find the conversation and update it
          const updatedConversations = prevConversations.map((conv) => {
            if (conv._id === message.conversationId) {
              return {
                ...conv,
                lastMessage: message,
                // Increment unread count for the current user if the message is not from them
                unreadCounts:
                    message.sender._id !== authState.user.id
                        ? conv.unreadCounts.map((uc) => {
                          if (uc.user === authState.user.id) {
                            return { ...uc, count: (uc.count || 0) + 1 }
                          }
                          return uc
                        })
                        : conv.unreadCounts,
              }
            }
            return conv
          })

          // Sort conversations to bring the one with the new message to the top
          return updatedConversations.sort((a, b) => {
            const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0
            const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0
            return timeB - timeA
          })
        })
      }
      socket.on("receive-message", handleReceiveMessage)

      // Listen for message read status
      const handleMessageRead = ({ conversationId, userId }) => {
        // This event means 'userId' has read messages in 'conversationId'
        // If the current user is 'userId', it means they read it on another device.
        // If not, it means the other participant read the current user's messages.
        setConversations((prevConversations) => {
          return prevConversations.map((conv) => {
            if (conv._id === conversationId) {
              // If the current user is the one who read the messages
              if (userId === authState.user.id) {
                return {
                  ...conv,
                  unreadCounts: conv.unreadCounts.map((uc) =>
                      uc.user === authState.user.id ? { ...uc, count: 0 } : uc,
                  ),
                }
              } else {
                // If another user in the chat read the messages,
                // this typically means messages sent by authState.user are now read by 'userId'.
                // The UI usually reflects this inside the chat screen (e.g., read receipts).
                // For the chats list, unreadCounts are for messages *received by* authState.user.
                // So, this event might not directly change unreadCounts for authState.user here,
                // unless your unreadCounts logic is different.
                // Assuming unreadCounts in conversation list is for *this* user.
              }
            }
            return conv
          })
        })
      }
      socket.on("message-read", handleMessageRead)

      // Placeholder for user status updates - this would update onlineUserIds in SocketContext
      // Example: socket.on('user_status_update', (statusData) => { /* update onlineUserIds in SocketContext */ });

      return () => {
        socket.off("receive-message", handleReceiveMessage)
        socket.off("message-read", handleMessageRead)
      }
    }
  }, [socket, isConnected, authState.user.id])

  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true)
    fetchConversations()
  }

  // Navigate to chat screen
  const handleChatPress = (conversation) => {
    navigation.navigate("Chat", { conversation })
    // Mark conversation as read for the current user locally
    setConversations((prev) =>
        prev.map((conv) => {
          if (conv._id === conversation._id) {
            return {
              ...conv,
              unreadCounts: conv.unreadCounts.map((uc) => (uc.user === authState.user.id ? { ...uc, count: 0 } : uc)),
            }
          }
          return conv
        }),
    )
  }

  // Navigate to contacts screen to start a new chat
  const handleNewChat = () => {
    navigation.navigate("Contacts")
  }

  // Render conversation item
  const renderConversationItem = ({ item }) => {
    let name,
        image,
        otherParticipantId = null
    if (item.isGroup) {
      name = item.groupName
      image = item.groupImage || null
    } else {
      const otherParticipant = item.participants.find((p) => p._id !== authState.user.id)
      name = otherParticipant?.name || "Unknown"
      image = otherParticipant?.profilePicture || null
      otherParticipantId = otherParticipant?._id
    }

    const unreadCount = item.unreadCounts.find((uc) => uc.user === authState.user.id)?.count || 0
    let lastMessagePreview = ""
    if (item.lastMessage) {
      if (item.lastMessage.contentType === "text") {
        lastMessagePreview = item.lastMessage.content
      } else if (item.lastMessage.contentType === "image") {
        lastMessagePreview = "📷 Photo"
      } else if (item.lastMessage.contentType === "video") {
        lastMessagePreview = "🎥 Video"
      } else if (item.lastMessage.contentType === "audio") {
        lastMessagePreview = "🎵 Audio"
      } else if (item.lastMessage.contentType === "document") {
        lastMessagePreview = "📄 Document"
      } else if (item.lastMessage.contentType === "location") {
        lastMessagePreview = "📍 Location"
      }
    }

    // Check if the other user is online (for one-on-one chats)
    const isUserOnline = !item.isGroup && otherParticipantId && onlineUserIds && onlineUserIds.has(otherParticipantId)

    return (
        <TouchableOpacity
            style={[
              styles.conversationItem,
              {
                borderBottomColor: currentTheme.border,
                backgroundColor: currentTheme.card,
              },
            ]}
            onPress={() => handleChatPress(item)}
        >
          <View style={styles.avatarContainer}>
            {image ? (
                <Image source={{ uri: `${API_BASE_URL_FOR_MEDIA}${image}` }} style={styles.avatar} />
            ) : (
                <View style={[styles.avatar, styles.defaultAvatar, { backgroundColor: currentTheme.primary }]}>
                  <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
                </View>
            )}
            {isUserOnline && <View style={[styles.onlineIndicator, { borderColor: currentTheme.card }]} />}
          </View>
          <View style={styles.conversationInfo}>
            <View style={styles.conversationHeader}>
              <Text style={[styles.conversationName, { color: currentTheme.text }]} numberOfLines={1}>
                {name}
              </Text>
              {item.lastMessage && (
                  <Text style={[styles.conversationTime, { color: currentTheme.placeholder }]}>
                    {formatDate(item.lastMessage.createdAt)}
                  </Text>
              )}
            </View>
            <View style={styles.conversationFooter}>
              <Text
                  style={[
                    styles.lastMessage,
                    { color: unreadCount > 0 ? currentTheme.text : currentTheme.placeholder },
                    unreadCount > 0 && styles.unreadMessageText,
                  ]}
                  numberOfLines={1}
              >
                {lastMessagePreview || "No messages yet"}
              </Text>
              {unreadCount > 0 && (
                  <View style={[styles.unreadBadge, { backgroundColor: currentTheme.primary }]}>
                    <Text style={styles.unreadCount}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
                  </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
    )
  }

  if (isLoading) {
    return (
        <View style={[styles.loadingContainer, { backgroundColor: currentTheme.background }]}>
          <ActivityIndicator size="large" color={currentTheme.primary} />
        </View>
    )
  }

  return (
      <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
        <FlatList
            data={conversations.sort((a, b) => {
              // Ensure sorting is applied initially and after updates
              const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0
              const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0
              return timeB - timeA
            })}
            renderItem={renderConversationItem}
            keyExtractor={(item) => item._id}
            refreshControl={
              <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[currentTheme.primary]}
                  tintColor={currentTheme.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: currentTheme.primary }]}>No conversations yet</Text>
                <Text style={[styles.emptySubtext, { color: currentTheme.placeholder }]}>
                  Start a new chat by tapping the button below
                </Text>
              </View>
            }
        />
        <TouchableOpacity style={[styles.fab, { backgroundColor: currentTheme.primary }]} onPress={handleNewChat}>
          <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
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
  conversationItem: {
    flexDirection: "row",
    paddingHorizontal: 15,
    paddingVertical: 12, // Adjusted padding
    borderBottomWidth: 1,
  },
  avatarContainer: {
    marginRight: 15,
    position: "relative", // For positioning the online indicator
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  defaultAvatar: {
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14, // Slightly larger dot
    height: 14,
    borderRadius: 7,
    backgroundColor: "#4CAF50", // A standard green color
    borderWidth: 2,
    // borderColor is set dynamically using currentTheme.card
  },
  conversationInfo: {
    flex: 1,
    justifyContent: "center",
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4, // Adjusted margin
  },
  conversationName: {
    fontSize: 16,
    fontWeight: "600", // Slightly bolder
    flex: 1,
  },
  conversationTime: {
    fontSize: 12,
  },
  conversationFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lastMessage: {
    fontSize: 14,
    flex: 1,
    marginRight: 5, // Add some space before unread badge
  },
  unreadMessageText: {
    // Style for unread message text
    fontWeight: "bold",
  },
  unreadBadge: {
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6, // Adjusted padding
  },
  unreadCount: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    marginTop: 50,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
})

export default ChatsListScreen
