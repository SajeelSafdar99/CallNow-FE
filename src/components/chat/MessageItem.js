"use client"

import { useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from "react-native"
import { Ionicon } from "../ui/AppIcons"
import { API_BASE_URL } from "../../config/api"
import { formatDistanceToNow } from "date-fns"
import { playAudio, stopAudio } from "../../utils/media-helpers"

const MessageItem = ({ message, isOwnMessage, onDelete, onReply }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [showOptions, setShowOptions] = useState(false)

  // Format timestamp
  const formattedTime = message.createdAt
    ? formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })
    : "just now"

  // Handle message options
  const handleLongPress = () => {
    setShowOptions(true)
  }

  // Handle message deletion
  const handleDelete = () => {
    Alert.alert(
      "Delete Message",
      "Do you want to delete this message?",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => setShowOptions(false),
        },
        {
          text: "Delete for Me",
          style: "destructive",
          onPress: () => {
            onDelete(message._id, false)
            setShowOptions(false)
          },
        },
        ...(isOwnMessage && !message.isOptimistic
          ? [
            {
              text: "Delete for Everyone",
              style: "destructive",
              onPress: () => {
                onDelete(message._id, true)
                setShowOptions(false)
              },
            },
          ]
          : []),
      ],
      { cancelable: true },
    )
  }

  // Handle audio playback
  const handleAudioPlayback = async () => {
    try {
      if (isPlaying) {
        await stopAudio()
        setIsPlaying(false)
      } else {
        const audioUrl = message.mediaUrl.startsWith("http") ? message.mediaUrl : `${API_BASE_URL}${message.mediaUrl}`

        const success = await playAudio(audioUrl)
        if (success) {
          setIsPlaying(true)
          // Auto-stop when audio finishes
          setTimeout(() => {
            setIsPlaying(false)
          }, 60000) // Fallback timeout (1 minute)
        }
      }
    } catch (error) {
      console.error("Error playing audio:", error)
      Alert.alert("Error", "Failed to play audio message")
    }
  }

  // Render message content based on type
  const renderMessageContent = () => {
    if (message.contentType === "text") {
      return <Text style={styles.messageText}>{message.content}</Text>
    } else if (message.contentType === "image") {
      return (
        <Image
          source={{
            uri: message.mediaUrl.startsWith("http") ? message.mediaUrl : `${API_BASE_URL}${message.mediaUrl}`,
          }}
          style={styles.imageContent}
          resizeMode="cover"
        />
      )
    } else if (message.contentType === "audio") {
      return (
        <TouchableOpacity style={styles.audioContainer} onPress={handleAudioPlayback}>
          <Ionicon
            name={isPlaying ? "pause-circle" : "play-circle"}
            size={30}
            color={isOwnMessage ? "#FFFFFF" : "#128C7E"}
          />
          <View style={styles.audioInfo}>
            <Text style={[styles.audioText, isOwnMessage && styles.audioTextOwn]}>Audio Message</Text>
            <Text style={[styles.audioDuration, isOwnMessage && styles.audioDurationOwn]}>
              {isPlaying ? "Playing..." : "Tap to play"}
            </Text>
          </View>
        </TouchableOpacity>
      )
    } else if (message.contentType === "document") {
      return (
        <View style={styles.documentContainer}>
          <Ionicon name="document-text" size={24} color={isOwnMessage ? "#FFFFFF" : "#128C7E"} />
          <Text style={[styles.documentText, isOwnMessage && styles.documentTextOwn]} numberOfLines={1}>
            {message.content}
          </Text>
        </View>
      )
    } else {
      return <Text style={styles.messageText}>{message.content}</Text>
    }
  }

  // Render reply content if message is a reply
  const renderReplyContent = () => {
    if (!message.replyTo) return null

    return (
      <View style={styles.replyContent}>
        <Text style={styles.replyName}>
          {message.replyTo.sender._id === message.sender._id ? "You" : message.replyTo.sender.name}
        </Text>
        <Text style={styles.replyText} numberOfLines={1}>
          {message.replyTo.contentType === "text"
            ? message.replyTo.content
            : `${message.replyTo.contentType.charAt(0).toUpperCase() + message.replyTo.contentType.slice(1)}`}
        </Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer]}>
      {/* Message Bubble */}
      <TouchableOpacity
        style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
          message.failed && styles.failedMessage,
        ]}
        onLongPress={handleLongPress}
        delayLongPress={500}
        activeOpacity={0.8}
      >
        {/* Reply Content */}
        {message.replyTo && renderReplyContent()}

        {/* Message Content */}
        {renderMessageContent()}

        {/* Message Footer */}
        <View style={styles.messageFooter}>
          <Text style={styles.timestamp}>{formattedTime}</Text>
          {isOwnMessage && (
            <Ionicon
              name={
                message.readBy && message.readBy.length > 0
                  ? "checkmark-done"
                  : message.deliveredTo && message.deliveredTo.length > 0
                    ? "checkmark-done"
                    : "checkmark"
              }
              size={16}
              color={message.readBy && message.readBy.length > 0 ? "#4FC3F7" : "#FFFFFF80"}
            />
          )}
        </View>
      </TouchableOpacity>

      {/* Message Options */}
      {showOptions && (
        <View
          style={[
            styles.optionsContainer,
            { right: isOwnMessage ? 0 : undefined, left: !isOwnMessage ? 0 : undefined },
          ]}
        >
          <TouchableOpacity
            style={styles.optionButton}
            onPress={() => {
              onReply(message)
              setShowOptions(false)
            }}
          >
            <Ionicon name="arrow-undo" size={20} color="#128C7E" />
            <Text style={styles.optionText}>Reply</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.optionButton} onPress={handleDelete}>
            <Ionicon name="trash" size={20} color="#FF6B6B" />
            <Text style={[styles.optionText, { color: "#FF6B6B" }]}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.optionButton} onPress={() => setShowOptions(false)}>
            <Ionicon name="close" size={20} color="#999" />
            <Text style={styles.optionText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 5,
    maxWidth: "80%",
  },
  ownMessageContainer: {
    alignSelf: "flex-end",
  },
  otherMessageContainer: {
    alignSelf: "flex-start",
  },
  messageBubble: {
    borderRadius: 12,
    padding: 10,
    maxWidth: "100%",
  },
  ownMessageBubble: {
    backgroundColor: "#128C7E",
  },
  otherMessageBubble: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  failedMessage: {
    backgroundColor: "#FF6B6B40",
  },
  messageText: {
    fontSize: 16,
    color: "#FFFFFF",
  },
  otherMessageText: {
    color: "#333333",
  },
  messageFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 5,
  },
  timestamp: {
    fontSize: 12,
    color: "#FFFFFF80",
    marginRight: 5,
  },
  otherTimestamp: {
    color: "#99999980",
  },
  imageContent: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginVertical: 5,
  },
  audioContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 5,
  },
  audioInfo: {
    marginLeft: 10,
  },
  audioText: {
    fontSize: 14,
    color: "#333333",
    fontWeight: "bold",
  },
  audioTextOwn: {
    color: "#FFFFFF",
  },
  audioDuration: {
    fontSize: 12,
    color: "#666666",
  },
  audioDurationOwn: {
    color: "#FFFFFF80",
  },
  documentContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 5,
  },
  documentText: {
    fontSize: 14,
    color: "#333333",
    marginLeft: 10,
    flex: 1,
  },
  documentTextOwn: {
    color: "#FFFFFF",
  },
  replyContent: {
    backgroundColor: "#00000020",
    borderLeftWidth: 3,
    borderLeftColor: "#FFFFFF",
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  replyName: {
    fontWeight: "bold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  replyText: {
    fontSize: 12,
    color: "#FFFFFFCC",
  },
  optionsContainer: {
    position: "absolute",
    top: -60,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 10,
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
  },
  optionButton: {
    alignItems: "center",
    marginHorizontal: 10,
  },
  optionText: {
    fontSize: 12,
    marginTop: 5,
    color: "#333",
  },
})

export default MessageItem
