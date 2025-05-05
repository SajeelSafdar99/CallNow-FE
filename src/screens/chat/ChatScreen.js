"use client"

import { useState, useEffect, useContext, useRef } from "react"
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicon } from "../../components/ui/AppIcons"

import { useNavigation, useRoute } from "@react-navigation/native"
import { AuthContext } from "../../context/AuthContext"
import { SocketContext } from "../../context/SocketContext"
import * as MessagesAPI from "../../api/messages"
import { API_BASE_URL } from "../../config/api"
import MessageItem from "../../components/chat/MessageItem"
import AttachmentModal from "../../components/chat/AttachmentModal"
// Import our standard React Native helpers
import {
  pickImage,
  takePhoto,
  pickDocument,
  startAudioRecording,
  stopAudioRecording,
  stopAudio,
} from "../../utils/media-helpers"

const ChatScreen = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const { conversation } = route.params
  const { state: authState } = useContext(AuthContext)
  const {
    socket,
    isConnected,
    joinConversation,
    leaveConversation,
    sendMessage,
    markAsRead,
    setTyping,
    setStopTyping,
  } = useContext(SocketContext)

  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [isAttachmentModalVisible, setIsAttachmentModalVisible] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [typingUsers, setTypingUsers] = useState([])
  const [replyTo, setReplyTo] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [audioPath, setAudioPath] = useState(null)

  const flatListRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  // Get conversation name and image
  const getConversationDetails = () => {
    if (conversation.isGroup) {
      return {
        name: conversation.groupName,
        image: conversation.groupImage,
        isGroup: true,
        participants: conversation.participants,
      }
    } else {
      // Find the other participant (not the current user)
      const otherParticipant = conversation.participants.find((p) => p._id !== authState.user.id)
      return {
        name: otherParticipant?.name || "Unknown",
        image: otherParticipant?.profilePicture,
        isGroup: false,
        participants: [otherParticipant],
      }
    }
  }

  const conversationDetails = getConversationDetails()

  // Fetch messages
  const fetchMessages = async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) {
        setIsLoading(true)
      } else {
        setIsLoadingMore(true)
      }

      const response = await MessagesAPI.getMessages(conversation._id, pageNum, 20, authState.token)

      if (response.success) {
        if (append) {
          setMessages((prevMessages) => [...prevMessages, ...response.messages])
        } else {
          setMessages(response.messages)
        }

        setHasMoreMessages(response.messages.length === 20)
      }
    } catch (error) {
      console.error("Error fetching messages:", error)
      Alert.alert("Error", "Failed to load messages. Please try again.")
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }

  // Load more messages when scrolling up
  const handleLoadMore = () => {
    if (!isLoadingMore && hasMoreMessages) {
      const nextPage = page + 1
      setPage(nextPage)
      fetchMessages(nextPage, true)
    }
  }

  // Send a text message
  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return

    try {
      const messageData = {
        conversationId: conversation._id,
        content: inputMessage.trim(),
        contentType: "text",
        sender: {
          _id: authState.user.id,
          name: authState.user.name,
        },
        createdAt: new Date().toISOString(),
        _id: `temp-${Date.now()}`, // Temporary ID for optimistic UI update
        isOptimistic: true, // Flag to identify optimistic updates
      }

      if (replyTo) {
        messageData.replyTo = replyTo
      }

      // Optimistically add message to UI
      setMessages((prevMessages) => [messageData, ...prevMessages])

      // Clear input and reply
      setInputMessage("")
      setReplyTo(null)

      // Send message to server
      const response = await MessagesAPI.sendTextMessage(
        conversation._id,
        inputMessage.trim(),
        replyTo?._id,
        authState.token,
      )

      if (response.success) {
        // Replace optimistic message with actual message from server
        setMessages((prevMessages) =>
          prevMessages.map((msg) => (msg._id === messageData._id ? { ...response.message, isOptimistic: false } : msg)),
        )

        // Send message via socket for real-time update
        sendMessage(response.message)
      } else {
        // Handle error - mark message as failed
        setMessages((prevMessages) =>
          prevMessages.map((msg) => (msg._id === messageData._id ? { ...msg, failed: true } : msg)),
        )
      }
    } catch (error) {
      console.error("Error sending message:", error)
      // Handle error - mark message as failed
      setMessages((prevMessages) => prevMessages.map((msg) => (msg.isOptimistic ? { ...msg, failed: true } : msg)))
    }
  }

  // Send a media message
  const handleSendMedia = async (mediaFile, contentType, content = "") => {
    try {
      // Optimistically add message to UI
      const messageData = {
        conversationId: conversation._id,
        content: content || `${contentType.charAt(0).toUpperCase() + contentType.slice(1)}`,
        contentType,
        sender: {
          _id: authState.user.id,
          name: authState.user.name,
        },
        createdAt: new Date().toISOString(),
        _id: `temp-${Date.now()}`,
        isOptimistic: true,
        mediaUrl: mediaFile.uri, // Local URI for preview
        isUploading: true,
      }

      if (replyTo) {
        messageData.replyTo = replyTo
      }

      // Add to messages
      setMessages((prevMessages) => [messageData, ...prevMessages])

      // Clear reply
      setReplyTo(null)

      // Send to server
      const response = await MessagesAPI.sendMediaMessage(
        conversation._id,
        content || `${contentType.charAt(0).toUpperCase() + contentType.slice(1)}`,
        mediaFile,
        contentType,
        replyTo?._id,
        authState.token,
      )

      if (response.success) {
        // Replace optimistic message with actual message
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg._id === messageData._id ? { ...response.message, isOptimistic: false, isUploading: false } : msg,
          ),
        )

        // Send via socket
        sendMessage(response.message)
      } else {
        // Handle error
        setMessages((prevMessages) =>
          prevMessages.map((msg) => (msg._id === messageData._id ? { ...msg, failed: true, isUploading: false } : msg)),
        )
      }
    } catch (error) {
      console.error("Error sending media:", error)
      // Handle error
      setMessages((prevMessages) =>
        prevMessages.map((msg) => (msg.isOptimistic ? { ...msg, failed: true, isUploading: false } : msg)),
      )
    }
  }

  // Pick and send an image - UPDATED to use standard React Native
  const handlePickImage = async () => {
    setIsAttachmentModalVisible(false)

    try {
      const result = await pickImage()
      if (result) {
        await handleSendMedia(result, "image")
      }
    } catch (error) {
      console.error("Error picking image:", error)
      Alert.alert("Error", "Failed to select image. Please try again.")
    }
  }

  // Take and send a photo - UPDATED to use standard React Native
  const handleTakePhoto = async () => {
    setIsAttachmentModalVisible(false)

    try {
      const result = await takePhoto()
      if (result) {
        await handleSendMedia(result, "image")
      }
    } catch (error) {
      console.error("Error taking photo:", error)
      Alert.alert("Error", "Failed to take photo. Please try again.")
    }
  }

  // Pick and send a document - UPDATED to use standard React Native
  const handlePickDocument = async () => {
    setIsAttachmentModalVisible(false)

    try {
      const result = await pickDocument()
      if (result) {
        await handleSendMedia(result, "document", result.fileName)
      }
    } catch (error) {
      console.error("Error picking document:", error)
      Alert.alert("Error", "Failed to select document. Please try again.")
    }
  }

  // Handle audio recording - UPDATED to use react-native-audio-recorder-player
  const handleAudioRecording = async () => {
    try {
      if (isRecording) {
        // Stop recording
        const audioFile = await stopAudioRecording()
        setIsRecording(false)
        setAudioPath(null)

        if (audioFile) {
          // Send audio message
          await handleSendMedia(audioFile, "audio", "Audio Message")
        }
      } else {
        // Start recording
        const path = await startAudioRecording()
        if (path) {
          setAudioPath(path)
          setIsRecording(true)
        }
      }
    } catch (error) {
      console.error("Error with audio recording:", error)
      Alert.alert("Error", "Failed to record audio. Please try again.")
      setIsRecording(false)
      setAudioPath(null)
    }
  }

  // Handle typing indicator
  const handleTyping = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    if (!isTyping) {
      setIsTyping(true)
      setTyping(conversation._id, authState.user.id)
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
      setStopTyping(conversation._id, authState.user.id)
    }, 3000)
  }

  // Handle message deletion
  const handleDeleteMessage = async (messageId, deleteForEveryone = false) => {
    try {
      // Optimistically update UI
      setMessages((prevMessages) => prevMessages.filter((msg) => msg._id !== messageId))

      const response = await MessagesAPI.deleteMessage(messageId, deleteForEveryone, authState.token)

      if (!response.success) {
        // If deletion fails, fetch messages again
        fetchMessages()
      }
    } catch (error) {
      console.error("Error deleting message:", error)
      Alert.alert("Error", "Failed to delete message. Please try again.")
      fetchMessages()
    }
  }

  // Handle message reply
  const handleReply = (message) => {
    setReplyTo(message)
  }

  // Cancel reply
  const handleCancelReply = () => {
    setReplyTo(null)
  }

  // Initial setup
  useEffect(() => {
    // Set navigation header
    navigation.setOptions({
      headerTitle: () => (
        <TouchableOpacity
          style={styles.headerTitle}
          onPress={() => {
            if (!conversationDetails.isGroup) {
              // Navigate to user profile for one-to-one chats
              navigation.navigate("UserProfile", {
                userId: conversationDetails.participants[0]._id,
                userName: conversationDetails.name,
                userImage: conversationDetails.image,
              })
            } else {
              // Navigate to group info for group chats
              // This would be implemented separately
              Alert.alert("Group Info", "Group info screen will be implemented soon.")
            }
          }}
        >
          <Image
            source={
              conversationDetails.image
                ? { uri: `${API_BASE_URL}${conversationDetails.image}` }
                : require("../../assets/images/default-avatar.png")
            }
            style={styles.headerAvatar}
          />
          <View>
            <Text style={styles.headerName}>{conversationDetails.name}</Text>
            {isTyping && typingUsers.length > 0 && <Text style={styles.typingText}>typing...</Text>}
          </View>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <View style={styles.headerRight}>
          {conversationDetails.isGroup ? (
            <TouchableOpacity style={styles.headerButton}>
              <Ionicon name="people" size={24} color="#128C7E" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() =>
                navigation.navigate("Call", {
                  recipient: conversationDetails.participants[0],
                  isVideo: false,
                })
              }
            >
              <Ionicon name="call" size={24} color="#128C7E" />
            </TouchableOpacity>
          )}
          {conversationDetails.isGroup ? (
            <TouchableOpacity style={styles.headerButton}>
              <Ionicon name="videocam" size={24} color="#128C7E" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() =>
                navigation.navigate("Call", {
                  recipient: conversationDetails.participants[0],
                  isVideo: true,
                })
              }
            >
              <Ionicon name="videocam" size={24} color="#128C7E" />
            </TouchableOpacity>
          )}
        </View>
      ),
    })

    // Fetch initial messages
    fetchMessages()

    // Join conversation room for socket events
    if (isConnected) {
      joinConversation(conversation._id)
    }

    // Cleanup on unmount
    return () => {
      if (isConnected) {
        leaveConversation(conversation._id)
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      // Clean up recording if component unmounts while recording
      if (isRecording) {
        stopAudioRecording().catch((err) => console.error("Error stopping recording on unmount:", err))
      }
      // Stop any playing audio
      stopAudio().catch((err) => console.error("Error stopping audio on unmount:", err))
    }
  }, [navigation, isConnected])

  // Socket event listeners - UPDATED with try-catch for safety
  useEffect(() => {
    if (socket && isConnected) {
      try {
        // Listen for new messages
        socket.on("receive-message", (newMessage) => {
          if (newMessage.conversationId === conversation._id) {
            // Add new message to state
            setMessages((prevMessages) => {
              // Check if message already exists (to avoid duplicates)
              const exists = prevMessages.some((msg) => msg._id === newMessage._id)
              if (exists) return prevMessages
              return [newMessage, ...prevMessages]
            })

            // Mark as read
            markAsRead(newMessage._id, conversation._id, authState.user.id)
          }
        })

        // Listen for typing indicators
        socket.on("user-typing", ({ conversationId, userId }) => {
          if (conversationId === conversation._id && userId !== authState.user.id) {
            // Find user info
            const typingUser = conversation.participants.find((p) => p._id === userId)
            if (typingUser) {
              setTypingUsers((prev) => {
                if (!prev.some((u) => u._id === userId)) {
                  return [...prev, typingUser]
                }
                return prev
              })
            }
          }
        })

        // Listen for stop typing
        socket.on("user-stop-typing", ({ conversationId, userId }) => {
          if (conversationId === conversation._id) {
            setTypingUsers((prev) => prev.filter((u) => u._id !== userId))
          }
        })

        // Listen for message delivered status
        socket.on("message-delivered", ({ messageId, conversationId, userId }) => {
          if (conversationId === conversation._id) {
            setMessages((prevMessages) => {
              return prevMessages.map((msg) => {
                if (msg._id === messageId) {
                  return {
                    ...msg,
                    deliveredTo: [...(msg.deliveredTo || []), userId],
                  }
                }
                return msg
              })
            })
          }
        })

        // Listen for message read status
        socket.on("message-read", ({ messageId, conversationId, userId }) => {
          if (conversationId === conversation._id) {
            setMessages((prevMessages) => {
              return prevMessages.map((msg) => {
                if (msg._id === messageId) {
                  return {
                    ...msg,
                    readBy: [...(msg.readBy || []), userId],
                  }
                }
                return msg
              })
            })
          }
        })

        // Listen for message deleted
        socket.on("message-deleted", ({ messageId, conversationId }) => {
          if (conversationId === conversation._id) {
            setMessages((prevMessages) => prevMessages.filter((msg) => msg._id !== messageId))
          }
        })

        // Listen for online status changes
        socket.on("user-status-change", ({ userId, status }) => {
          // Update user status if needed
          if (!conversation.isGroup) {
            const otherParticipant = conversation.participants.find((p) => p._id !== authState.user.id)
            if (otherParticipant && otherParticipant._id === userId) {
              // You could update a state variable here to show online status
              console.log(`User ${userId} is now ${status}`)
            }
          }
        })

        return () => {
          try {
            socket.off("receive-message")
            socket.off("user-typing")
            socket.off("user-stop-typing")
            socket.off("message-delivered")
            socket.off("message-read")
            socket.off("message-deleted")
            socket.off("user-status-change")
          } catch (error) {
            console.error("Error removing socket listeners:", error)
          }
        }
      } catch (error) {
        console.error("Error setting up socket listeners:", error)
      }
    }
  }, [socket, isConnected, conversation._id])

  // Render loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#128C7E" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={({ item }) => (
            <MessageItem
              message={item}
              isOwnMessage={item.sender._id === authState.user.id}
              onDelete={handleDeleteMessage}
              onReply={handleReply}
            />
          )}
          keyExtractor={(item) => item._id}
          inverted
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color="#128C7E" />
              </View>
            ) : null
          }
          contentContainerStyle={styles.messagesList}
        />

        {/* Reply Preview */}
        {replyTo && (
          <View style={styles.replyContainer}>
            <View style={styles.replyContent}>
              <View style={styles.replyInfo}>
                <Text style={styles.replyName}>
                  {replyTo.sender._id === authState.user.id ? "You" : replyTo.sender.name}
                </Text>
                <Text style={styles.replyText} numberOfLines={1}>
                  {replyTo.contentType === "text"
                    ? replyTo.content
                    : `${replyTo.contentType.charAt(0).toUpperCase() + replyTo.contentType.slice(1)}`}
                </Text>
              </View>
              <TouchableOpacity onPress={handleCancelReply}>
                <Ionicon name="close" size={20} color="#999" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Message Input */}
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachButton} onPress={() => setIsAttachmentModalVisible(true)}>
            <Ionicon name="add-circle" size={24} color="#128C7E" />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            value={inputMessage}
            onChangeText={(text) => {
              setInputMessage(text)
              handleTyping()
            }}
            multiline
          />

          {inputMessage.trim() ? (
            <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
              <Ionicon name="send" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.micButton, isRecording && styles.recordingButton]}
              onPress={handleAudioRecording}
              onLongPress={handleAudioRecording}
            >
              <Ionicon name={isRecording ? "stop" : "mic"} size={24} color={isRecording ? "#FFFFFF" : "#128C7E"} />
            </TouchableOpacity>
          )}
        </View>

        {/* Attachment Modal */}
        <AttachmentModal
          visible={isAttachmentModalVisible}
          onClose={() => setIsAttachmentModalVisible(false)}
          onPickImage={handlePickImage}
          onTakePhoto={handleTakePhoto}
          onPickDocument={handlePickDocument}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F0F0F0",
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  headerName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  typingText: {
    fontSize: 12,
    color: "#128C7E",
    fontStyle: "italic",
  },
  headerRight: {
    flexDirection: "row",
  },
  headerButton: {
    marginLeft: 15,
  },
  messagesList: {
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  loadingMore: {
    padding: 10,
    alignItems: "center",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  attachButton: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "#F0F0F0",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendButton: {
    marginLeft: 10,
    backgroundColor: "#128C7E",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  micButton: {
    marginLeft: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  replyContainer: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    padding: 10,
  },
  replyContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F0F0F0",
    borderLeftWidth: 4,
    borderLeftColor: "#128C7E",
    borderRadius: 8,
    padding: 8,
  },
  replyInfo: {
    flex: 1,
  },
  replyName: {
    fontWeight: "bold",
    color: "#128C7E",
  },
  replyText: {
    color: "#666",
  },
  recordingButton: {
    backgroundColor: "#FF6B6B",
  },
})

export default ChatScreen
