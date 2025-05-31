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
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from "@react-navigation/native"
import { AuthContext } from "../../context/AuthContext"
import { SocketContext } from "../../context/SocketContext"
import { ThemeContext } from "../../context/ThemeContext"
import { getTheme } from "../../utils/theme"
import * as ConversationsAPI from "../../api/conversations"
import { formatDate } from "../../utils/formatters"
import {API_BASE_URL_FOR_MEDIA} from '../../config/api'; // Import API base URL

const ChatsListScreen = () => {
  const navigation = useNavigation()
  const { state: authState } = useContext(AuthContext)
  const { socket, isConnected } = useContext(SocketContext)
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
      try {
        // Listen for new messages
        socket.on("receive-message", (message) => {
          // Update conversation with new message
          setConversations((prevConversations) => {
            return prevConversations.map((conv) => {
              if (conv._id === message.conversationId) {
                return {
                  ...conv,
                  lastMessage: message,
                  unreadCounts: conv.unreadCounts.map((uc) => {
                    if (uc.user === authState.user.id) {
                      return { ...uc, count: uc.count + 1 }
                    }
                    return uc
                  }),
                }
              }
              return conv
            })
          })
        })

        // Listen for message read status
        socket.on("message-read", ({ conversationId, userId }) => {
          if (userId !== authState.user.id) {
            // Update read status for messages in this conversation
            setConversations((prevConversations) => {
              return prevConversations.map((conv) => {
                if (conv._id === conversationId) {
                  return {
                    ...conv,
                    unreadCounts: conv.unreadCounts.map((uc) => {
                      if (uc.user === userId) {
                        return { ...uc, count: 0 }
                      }
                      return uc
                    }),
                  }
                }
                return conv
              })
            })
          }
        })

        return () => {
          try {
            socket.off("receive-message")
            socket.off("message-read")
          } catch (error) {
            console.error("Error removing socket listeners:", error)
          }
        }
      } catch (error) {
        console.error("Error setting up socket listeners:", error)
      }
    }
  }, [socket, isConnected])

  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true)
    fetchConversations()
  }

  // Navigate to chat screen
  const handleChatPress = (conversation) => {
    navigation.navigate("Chat", { conversation })
  }

  // Navigate to contacts screen to start a new chat
  const handleNewChat = () => {
    navigation.navigate("Contacts")
  }

  // Render conversation item
  const renderConversationItem = ({ item }) => {
    // Get conversation name and image
    let name, image
    if (item.isGroup) {
      name = item.groupName
      image = item.groupImage || null
    } else {
      // Find the other participant (not the current user)
      const otherParticipant = item.participants.find((p) => p._id !== authState.user.id)
      name = otherParticipant?.name || "Unknown"
      image = otherParticipant?.profilePicture || null
    }

    // Get unread count for current user
    const unreadCount = item.unreadCounts.find((uc) => uc.user === authState.user.id)?.count || 0

    // Get last message preview
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

    return (
      <TouchableOpacity
        style={[
          styles.conversationItem,
          {
            borderBottomColor: currentTheme.border,
            backgroundColor: currentTheme.card
          }
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
            <Text style={[styles.lastMessage, { color: currentTheme.placeholder }]} numberOfLines={1}>
              {lastMessagePreview || "No messages yet"}
            </Text>
            {unreadCount > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: currentTheme.primary }]}>
                <Text style={styles.unreadCount}>{unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  // Loading state
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
        data={conversations}
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
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: currentTheme.primary }]}
        onPress={handleNewChat}
      >
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
    padding: 15,
    borderBottomWidth: 1,
  },
  avatarContainer: {
    marginRight: 15,
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
  conversationInfo: {
    flex: 1,
    justifyContent: "center",
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: "bold",
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
  },
  unreadBadge: {
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
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
