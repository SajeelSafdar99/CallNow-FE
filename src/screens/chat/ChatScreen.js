"use client"

import React, { useState, useEffect, useContext, useRef } from "react"
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
  Keyboard,
  PermissionsAndroid,
  BackHandler,
  ImageBackground,
  AppState,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import Ionicons from "react-native-vector-icons/Ionicons"
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native"
import { AuthContext } from "../../context/AuthContext"
import { SocketContext } from "../../context/SocketContext"
import { ThemeContext } from "../../context/ThemeContext"
import { getTheme } from "../../utils/theme"
import * as MessagesAPI from "../../api/messages"
import { API_BASE_URL_FOR_MEDIA } from "../../config/api"
import MessageItem from "../../components/chat/MessageItem"
import AttachmentModal from "../../components/chat/AttachmentModal"
import AudioRecordingView from "../../components/chat/AudioRecordingView"
import Clipboard from "@react-native-clipboard/clipboard"
// Import our standard React Native helpers
import {
  pickMultipleDocuments,
  pickMultipleMedia,
  takePhoto,
  startAudioRecording,
  stopAudioRecording,
  stopAudio,
} from "../../utils/media-helpers"

// Import permissions
import { check, request, PERMISSIONS, RESULTS, openSettings } from "react-native-permissions"
import Share from "react-native-share"
import RNFS from "react-native-fs"
import AsyncStorage from "@react-native-async-storage/async-storage"

const ChatScreen = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const { conversation } = route.params
  const { state: authState } = useContext(AuthContext)
  const { theme } = useContext(ThemeContext)
  const currentTheme = getTheme(theme)
  const {
    socket,
    isConnected,
    joinConversation,
    leaveConversation,
    sendMessage,
    markAsRead,
    markAsDelivered, // Added for delivery confirmation
    setTyping,
    setStopTyping,
    setOnlineStatus, // Added for online status management
    checkUserStatus, // Added for user status checking
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
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [keyboardVisible, setKeyboardVisible] = useState(false)

  // Add these new state variables for message selection
  const [selectedMessages, setSelectedMessages] = useState([])
  const [isSelectionMode, setIsSelectionMode] = useState(false)

  const [wallpaper, setWallpaper] = useState(null)
  const [wallpaperId, setWallpaperId] = useState("default")

  const flatListRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const inputRef = useRef(null)
  const recordingTimerRef = useRef(null)
  const appStateRef = useRef(AppState.currentState) // Added for app state tracking

  // Add the new state variable for isOtherUserOnline
  const [isOtherUserOnline, setIsOtherUserOnline] = useState(false)
  // Add state for socket connection status
  const [socketReconnecting, setSocketReconnecting] = useState(false)

  // Hide bottom tabs when this screen is focused
  useFocusEffect(
    React.useCallback(() => {
      // Hide the tab bar
      navigation.getParent()?.setOptions({
        tabBarStyle: { display: "none" },
      })

      return () => {
        // Restore the tab bar when leaving this screen
        navigation.getParent()?.setOptions({
          tabBarStyle: {
            display: "flex",
            backgroundColor: currentTheme.card,
            borderTopColor: currentTheme.border,
          },
        })
      }
    }, [navigation, currentTheme]),
  )

  // Request permissions
  const requestPermissions = async () => {
    if (Platform.OS === "android") {
      try {
        const cameraPermission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
          title: "Camera Permission",
          message: "CallNow needs access to your camera to take photos.",
          buttonNeutral: "Ask Me Later",
          buttonNegative: "Cancel",
          buttonPositive: "OK",
        })

        const storagePermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: "Storage Permission",
            message: "CallNow needs access to your storage to select photos and documents.",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK",
          },
        )

        // For Android 13+ we need to request WRITE_EXTERNAL_STORAGE separately
        if (Number.parseInt(Platform.Version, 10) >= 33) {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES, {
            title: "Media Permission",
            message: "CallNow needs access to your media to select photos.",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK",
          })

          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO, {
            title: "Media Permission",
            message: "CallNow needs access to your media to select videos.",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK",
          })
        }

        const audioPermission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
          title: "Microphone Permission",
          message: "CallNow needs access to your microphone to record audio messages.",
          buttonNeutral: "Ask Me Later",
          buttonNegative: "Cancel",
          buttonPositive: "OK",
        })

        console.log("Permissions granted:", {
          camera: cameraPermission === PermissionsAndroid.RESULTS.GRANTED,
          storage: storagePermission === PermissionsAndroid.RESULTS.GRANTED,
          audio: audioPermission === PermissionsAndroid.RESULTS.GRANTED,
        })
      } catch (err) {
        console.warn(err)
      }
    } else if (Platform.OS === "ios") {
      try {
        const cameraStatus = await check(PERMISSIONS.IOS.CAMERA)
        if (cameraStatus !== RESULTS.GRANTED) {
          await request(PERMISSIONS.IOS.CAMERA)
        }

        const photoStatus = await check(PERMISSIONS.IOS.PHOTO_LIBRARY)
        if (photoStatus !== RESULTS.GRANTED) {
          await request(PERMISSIONS.IOS.PHOTO_LIBRARY)
        }

        const microphoneStatus = await check(PERMISSIONS.IOS.MICROPHONE)
        if (microphoneStatus !== RESULTS.GRANTED) {
          await request(PERMISSIONS.IOS.MICROPHONE)
        }
      } catch (err) {
        console.warn(err)
      }
    }
  }

  // Handle keyboard events
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height)
        setKeyboardVisible(true)
      },
    )

    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardHeight(0)
        setKeyboardVisible(false)
      },
    )

    // Request permissions when component mounts
    requestPermissions()

    return () => {
      keyboardDidShowListener.remove()
      keyboardDidHideListener.remove()
    }
  }, [])

  // NEW: App state change handler for online status
  useEffect(() => {
    // Set online status when component mounts
    if (isConnected) {
      setOnlineStatus("online")
    }

    // Listen for app state changes
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === "active") {
        // App has come to the foreground
        console.log("App has come to the foreground!")
        if (isConnected) {
          setOnlineStatus("online")
        }
      } else if (appStateRef.current === "active" && (nextAppState === "inactive" || nextAppState === "background")) {
        // App has gone to the background
        console.log("App has gone to the background!")
        if (isConnected) {
          setOnlineStatus("away")
        }
      }

      appStateRef.current = nextAppState
    })

    return () => {
      subscription.remove()
      // Set offline when component unmounts
      if (isConnected) {
        setOnlineStatus("offline")
      }
    }
  }, [isConnected])

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
        // Sort messages by date (newest first)
        const sortedMessages = response.messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

        if (append) {
          setMessages((prevMessages) => [...prevMessages, ...sortedMessages])
        } else {
          setMessages(sortedMessages)
        }

        setHasMoreMessages(response.messages.length === 20)

        // Mark messages as delivered via API (batch update)
        if (sortedMessages.length > 0 && isConnected) {
          try {
            // Use the API function to mark all messages as delivered
            await MessagesAPI.markAsDelivered(conversation._id, authState.token)

            // Then use socket to mark individual messages as read
            sortedMessages.forEach((message) => {
              // Only mark other people's messages
              if (message.sender._id !== authState.user.id) {
                // Mark as read via socket
                markAsRead(message._id, conversation._id, authState.user.id)
              }
            })
          } catch (error) {
            console.error("Error marking messages as delivered:", error)
          }
        }
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
    if (!inputMessage.trim()) {
      return
    }

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
        console.log("Emitting message via socket:", response.message._id)
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

  // Find the handleSendMedia function and replace it with this updated version that supports media groups

  // Send a media message
  const handleSendMedia = async (mediaFiles, contentType, content = "") => {
    try {
      // Check if we're sending multiple media files
      const isMediaGroup = Array.isArray(mediaFiles) && mediaFiles.length > 1

      if (isMediaGroup) {
        // For multiple files, send each one as a separate message
        // First, create a loading indicator for the user
        const tempGroupId = `temp-group-${Date.now()}`

        // Show a loading message
        const loadingMessage = {
          conversationId: conversation._id,
          content: `Sending ${mediaFiles.length} ${contentType} files...`,
          contentType: "text",
          sender: {
            _id: authState.user.id,
            name: authState.user.name,
          },
          createdAt: new Date().toISOString(),
          _id: tempGroupId,
          isOptimistic: true,
          isLoading: true,
        }

        // Add loading message to UI
        setMessages((prevMessages) => [loadingMessage, ...prevMessages])

        // Send each file individually
        const sentMessages = []
        for (let i = 0; i < mediaFiles.length; i++) {
          const file = mediaFiles[i]
          const fileType = file.type.startsWith("image/") ? "image" : "video"

          try {
            // Send the individual file
            const response = await MessagesAPI.sendMediaMessage(
              conversation._id,
              content || `${fileType.charAt(0).toUpperCase() + fileType.slice(1)} ${i + 1}`,
              file,
              fileType,
              replyTo?._id,
              authState.token,
            )

            if (response.success) {
              sentMessages.push(response.message)
              // Send via socket
              sendMessage(response.message)
            }
          } catch (error) {
            console.error(`Error sending media file ${i + 1}:`, error)
          }
        }

        // Remove the loading message
        setMessages((prevMessages) => prevMessages.filter((msg) => msg._id !== tempGroupId))

        // Add all the sent messages to the UI
        if (sentMessages.length > 0) {
          setMessages((prevMessages) => [...sentMessages.reverse(), ...prevMessages])
        }

        // Clear reply
        setReplyTo(null)

        // Show result to user
        if (sentMessages.length === mediaFiles.length) {
          // All files sent successfully
          console.log(`All ${mediaFiles.length} files sent successfully`)
        } else {
          // Some files failed
          Alert.alert(
            "Partial Upload",
            `Sent ${sentMessages.length} of ${mediaFiles.length} files. Some files could not be sent.`,
          )
        }
      } else {
        // Single media file - use the original logic
        const mediaFile = Array.isArray(mediaFiles) ? mediaFiles[0] : mediaFiles

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
            prevMessages.map((msg) =>
              msg._id === messageData._id ? { ...msg, failed: true, isUploading: false } : msg,
            ),
          )
        }
      }
    } catch (error) {
      console.error("Error sending media:", error)
      // Handle error
      setMessages((prevMessages) =>
        prevMessages.map((msg) => (msg.isOptimistic ? { ...msg, failed: true, isUploading: false } : msg)),
      )
    }
  }
  // Check and request camera permission
  const checkCameraPermission = async () => {
    if (Platform.OS === "android") {
      try {
        const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA)

        if (!granted) {
          const permissionRequest = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
            title: "Camera Permission",
            message: "CallNow needs access to your camera to take photos.",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK",
          })

          if (permissionRequest !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert(
              "Permission Required",
              "Camera permission is needed to take photos. Please enable it in app settings.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Open Settings", onPress: () => openSettings() },
              ],
            )
            return false
          }
          return true
        }
        return true
      } catch (err) {
        console.warn(err)
        return false
      }
    } else {
      const status = await check(PERMISSIONS.IOS.CAMERA)
      if (status !== RESULTS.GRANTED) {
        const result = await request(PERMISSIONS.IOS.CAMERA)
        if (result !== RESULTS.GRANTED) {
          Alert.alert(
            "Permission Required",
            "Camera permission is needed to take photos. Please enable it in app settings.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Open Settings", onPress: () => openSettings() },
            ],
          )
          return false
        }
        return true
      }
      return true
    }
  }

  // Check and request storage permission
  const checkStoragePermission = async () => {
    if (Platform.OS === "android") {
      try {
        // For Android 13+ (API 33+)
        if (Number.parseInt(Platform.Version, 10) >= 33) {
          const photoPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES)
          const videoPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO)

          if (!photoPermission || !videoPermission) {
            const photoRequest = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES)
            const videoRequest = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO)

            if (
              photoRequest !== PermissionsAndroid.RESULTS.GRANTED ||
              videoRequest !== PermissionsAndroid.RESULTS.GRANTED
            ) {
              Alert.alert(
                "Permission Required",
                "Storage permission is needed to access media. Please enable it in app settings.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Open Settings", onPress: () => openSettings() },
                ],
              )
              return false
            }
            return true
          }
          return true
        }
        // For Android 12 and below
        else {
          const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE)

          if (!granted) {
            const permissionRequest = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
              {
                title: "Storage Permission",
                message: "CallNow needs access to your storage to select photos and documents.",
                buttonNeutral: "Ask Me Later",
                buttonNegative: "Cancel",
                buttonPositive: "OK",
              },
            )

            if (permissionRequest !== PermissionsAndroid.RESULTS.GRANTED) {
              Alert.alert(
                "Permission Required",
                "Storage permission is needed to access media. Please enable it in app settings.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Open Settings", onPress: () => openSettings() },
                ],
              )
              return false
            }
            return true
          }
          return true
        }
      } catch (err) {
        console.warn(err)
        return false
      }
    } else {
      const status = await check(PERMISSIONS.IOS.PHOTO_LIBRARY)
      if (status !== RESULTS.GRANTED) {
        const result = await request(PERMISSIONS.IOS.PHOTO_LIBRARY)
        if (result !== RESULTS.GRANTED) {
          Alert.alert(
            "Permission Required",
            "Photo library permission is needed to select images. Please enable it in app settings.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Open Settings", onPress: () => openSettings() },
            ],
          )
          return false
        }
        return true
      }
      return true
    }
  }

  // Check and request microphone permission
  const checkMicrophonePermission = async () => {
    if (Platform.OS === "android") {
      try {
        const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)

        if (!granted) {
          const permissionRequest = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
            title: "Microphone Permission",
            message: "CallNow needs access to your microphone to record audio messages.",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK",
          })

          if (permissionRequest !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert(
              "Permission Required",
              "Microphone permission is needed to record audio. Please enable it in app settings.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Open Settings", onPress: () => openSettings() },
              ],
            )
            return false
          }
          return true
        }
        return true
      } catch (err) {
        console.warn(err)
        return false
      }
    } else {
      const status = await check(PERMISSIONS.IOS.MICROPHONE)
      if (status !== RESULTS.GRANTED) {
        const result = await request(PERMISSIONS.IOS.MICROPHONE)
        if (result !== RESULTS.GRANTED) {
          Alert.alert(
            "Permission Required",
            "Microphone permission is needed to record audio. Please enable it in app settings.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Open Settings", onPress: () => openSettings() },
            ],
          )
          return false
        }
        return true
      }
      return true
    }
  }

  // Update the handlePickImage function to pass all selected media items to handleSendMedia

  // Pick and send an image - UPDATED to use standard React Native
  const handlePickImage = async () => {
    setIsAttachmentModalVisible(false)

    try {
      const hasPermission = await checkStoragePermission()
      if (!hasPermission) {
        return
      }

      // Use the updated function to pick multiple media items
      const mediaItems = await pickMultipleMedia()
      if (mediaItems && mediaItems.length > 0) {
        // Send all media items as a group if there are multiple items
        if (mediaItems.length > 1) {
          // Determine content type based on majority of items
          const imageCount = mediaItems.filter((item) => item.type.startsWith("image/")).length
          const videoCount = mediaItems.length - imageCount
          const contentType = imageCount >= videoCount ? "image" : "video"

          // Send as a group
          await handleSendMedia(mediaItems, contentType)
        } else {
          // Send as a single item
          const item = mediaItems[0]
          const contentType = item.type.startsWith("image/") ? "image" : "video"
          await handleSendMedia(item, contentType)
        }
      }
    } catch (error) {
      console.error("Error picking media:", error)
      Alert.alert("Error", "Failed to select media. Please try again.")
    }
  }

  // Take and send a photo - UPDATED to use standard React Native
  const handleTakePhoto = async () => {
    setIsAttachmentModalVisible(false)

    try {
      const hasPermission = await checkCameraPermission()
      if (!hasPermission) {
        return
      }

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
      const hasPermission = await checkStoragePermission()
      if (!hasPermission) {
        return
      }

      // Use the new function to pick multiple documents
      const documents = await pickMultipleDocuments()
      if (documents && documents.length > 0) {
        // Send each document as a separate message
        for (const doc of documents) {
          await handleSendMedia(doc, "document", doc.fileName)
        }
      }
    } catch (error) {
      console.error("Error picking documents:", error)
      Alert.alert("Error", "Failed to select documents. Please try again.")
    }
  }
  // Handle audio recording - UPDATED to use react-native-audio-recorder-player with WhatsApp style
  const handleAudioRecording = async () => {
    try {
      const hasPermission = await checkMicrophonePermission()
      if (!hasPermission) {
        return
      }

      if (isRecording) {
        // Stop recording
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null

        const audioFile = await stopAudioRecording()
        setIsRecording(false)
        setAudioPath(null)
        setRecordingDuration(0)

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
          setRecordingDuration(0)

          // Start timer to update recording duration
          recordingTimerRef.current = setInterval(() => {
            setRecordingDuration((prev) => prev + 1)
          }, 1000)
        }
      }
    } catch (error) {
      console.error("Error with audio recording:", error)
      Alert.alert("Error", "Failed to record audio. Please try again.")
      setIsRecording(false)
      setAudioPath(null)
      setRecordingDuration(0)
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
    }
  }

  // Cancel audio recording
  const cancelAudioRecording = async () => {
    try {
      if (isRecording) {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current)
          recordingTimerRef.current = null
        }

        await stopAudioRecording(true) // true means cancel/discard
        setIsRecording(false)
        setAudioPath(null)
        setRecordingDuration(0)
      }
    } catch (error) {
      console.error("Error canceling audio recording:", error)
    }
  }

  // Handle typing indicator
  const handleTyping = () => {
    // Clear any existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Always emit typing event when user types
    setTyping(conversation._id, authState.user.id)

    // Update local state if needed
    if (!isTyping) {
      setIsTyping(true)
    }

    // Set timeout to stop typing after 3 seconds of inactivity
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

  // Add this function to handle message selection
  const handleMessageLongPress = (message) => {
    console.log("Long press on message:", message._id, message.contentType)

    // Enter selection mode if not already in it
    if (!isSelectionMode) {
      console.log("Entering selection mode for the first time")
      setIsSelectionMode(true)
      setSelectedMessages([message._id])
      console.log("Initial selected message:", message._id)
    } else {
      // Toggle selection of this message
      if (selectedMessages.includes(message._id)) {
        console.log("Removing message from selection:", message._id)
        const newSelected = selectedMessages.filter((id) => id !== message._id)
        setSelectedMessages(newSelected)
        console.log("Updated selected messages:", newSelected)

        // Exit selection mode if no messages are selected
        if (newSelected.length === 0) {
          console.log("No messages selected, exiting selection mode")
          setIsSelectionMode(false)
        }
      } else {
        console.log("Adding message to selection:", message._id)
        const newSelected = [...selectedMessages, message._id]
        setSelectedMessages(newSelected)
        console.log("Updated selected messages:", newSelected)
      }
    }
  }

  // Add this function to exit selection mode
  const exitSelectionMode = () => {
    console.log("Manually exiting selection mode")
    setIsSelectionMode(false)
    setSelectedMessages([])
  }

  // Add these functions to handle selection actions
  const handleReplySelected = () => {
    if (selectedMessages.length === 1) {
      const selectedMessage = messages.find((msg) => msg._id === selectedMessages[0])
      if (selectedMessage) {
        handleReply(selectedMessage)
        exitSelectionMode()
      }
    }
  }

  const handleCopySelected = () => {
    if (selectedMessages.length >= 1) {
      const selectedTexts = messages
        .filter((msg) => selectedMessages.includes(msg._id) && msg.contentType === "text")
        .map((msg) => msg.content)
        .join("\n\n")

      if (selectedTexts) {
        Clipboard.setString(selectedTexts)
        Alert.alert("Copied", "Message copied to clipboard")
      } else {
        Alert.alert("Cannot Copy", "Selected messages do not contain text content")
      }
      exitSelectionMode()
    }
  }

  const handleDeleteSelected = () => {
    if (selectedMessages.length >= 1) {
      Alert.alert(
        "Delete Messages",
        `Are you sure you want to delete ${selectedMessages.length} message(s)?`,
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Delete for Me",
            onPress: () => {
              selectedMessages.forEach((messageId) => {
                handleDeleteMessage(messageId, false)
              })
              exitSelectionMode()
            },
            style: "destructive",
          },
          {
            text: "Delete for Everyone",
            onPress: () => {
              selectedMessages.forEach((messageId) => {
                handleDeleteMessage(messageId, true)
              })
              exitSelectionMode()
            },
            style: "destructive",
          },
        ],
        { cancelable: true },
      )
    }
  }

  const handleInfoSelected = () => {
    if (selectedMessages.length === 1) {
      const selectedMessage = messages.find((msg) => msg._id === selectedMessages[0])
      if (selectedMessage) {
        // Show message info (timestamp, read status, etc.)
        Alert.alert(
          "Message Info",
          `Sent: ${new Date(selectedMessage.createdAt).toLocaleString()}\n` +
          `Status: ${
            selectedMessage.readBy?.length > 0
              ? "Read"
              : selectedMessage.deliveredTo?.length > 0
                ? "Delivered"
                : "Sent"
          }`,
        )
      }
      exitSelectionMode()
    }
  }

  // Add a new function to handle sharing selected messages
  const handleShareSelected = () => {
    if (selectedMessages.length >= 1) {
      // Find the selected messages
      const messagesToShare = messages.filter((msg) => selectedMessages.includes(msg._id))

      // Check if any of the selected messages have files that can be shared
      const fileMessages = messagesToShare.filter(
        (msg) => ["document", "image", "video", "audio"].includes(msg.contentType) && msg.mediaUrl,
      )

      if (fileMessages.length > 0) {
        // For simplicity, just share the first file if multiple are selected
        const fileToShare = fileMessages[0]
        console.log("Sharing file:", fileToShare.mediaUrl)

        // Get the file path if it exists locally
        const safeFileName =
          fileToShare.mediaName?.replace(/[^a-zA-Z0-9.-]/g, "_") || `${fileToShare.contentType}_${Date.now()}`
        const appFilesDir = `${RNFS.DocumentDirectoryPath}/CallNowFiles`
        const filePath = `${appFilesDir}/${safeFileName}`

        // Check if file exists locally
        RNFS.exists(filePath)
          .then((exists) => {
            if (exists) {
              console.log("File exists locally, sharing from local path")
              // Get file extension to determine MIME type
              const fileExt = safeFileName.split(".").pop().toLowerCase()
              let mimeType = "*/*"

              // Set common MIME types
              if (["jpg", "jpeg", "png", "gif"].includes(fileExt)) {
                mimeType = "image/*"
              } else if (["mp4", "mov", "3gp"].includes(fileExt)) {
                mimeType = "video/*"
              } else if (["pdf"].includes(fileExt)) {
                mimeType = "application/pdf"
              } else if (["doc", "docx"].includes(fileExt)) {
                mimeType = "application/msword"
              } else if (["xls", "xlsx"].includes(fileExt)) {
                mimeType = "application/vnd.ms-excel"
              } else if (["mp3", "wav", "ogg"].includes(fileExt)) {
                mimeType = "audio/*"
              }

              // Share the file
              Share.open({
                url: `file://${filePath}`,
                type: mimeType,
                failOnCancel: false,
                title: "Share file",
                subject: safeFileName,
              }).catch((error) => {
                console.log("Error sharing file:", error)
                Alert.alert("Error", "Could not share the file.")
              })
            } else {
              console.log("File does not exist locally, downloading first")
              // Download the file first, then share it
              const mediaUrl = `${API_BASE_URL_FOR_MEDIA}/${fileToShare.mediaUrl}`

              Alert.alert(
                "Download Required",
                "The file needs to be downloaded before sharing. Download now?",
                [
                  {
                    text: "Cancel",
                    style: "cancel",
                  },
                  {
                    text: "Download & Share",
                    onPress: () => {
                      // Create directory if it doesn't exist
                      RNFS.mkdir(appFilesDir)
                        .then(() => {
                          // Download the file
                          RNFS.downloadFile({
                            fromUrl: mediaUrl,
                            toFile: filePath,
                          })
                            .promise.then((result) => {
                            if (result.statusCode === 200) {
                              // Share the downloaded file
                              const fileExt = safeFileName.split(".").pop().toLowerCase()
                              let mimeType = "*/*"

                              // Set MIME type based on extension
                              if (["jpg", "jpeg", "png", "gif"].includes(fileExt)) {
                                mimeType = "image/*"
                              } else if (["mp4", "mov", "3gp"].includes(fileExt)) {
                                mimeType = "video/*"
                              } else if (["pdf"].includes(fileExt)) {
                                mimeType = "application/pdf"
                              } else if (["doc", "docx"].includes(fileExt)) {
                                mimeType = "application/msword"
                              } else if (["xls", "xlsx"].includes(fileExt)) {
                                mimeType = "application/vnd.ms-excel"
                              } else if (["mp3", "wav", "ogg"].includes(fileExt)) {
                                mimeType = "audio/*"
                              }

                              Share.open({
                                url: `file://${filePath}`,
                                type: mimeType,
                                failOnCancel: false,
                                title: "Share file",
                                subject: safeFileName,
                              }).catch((error) => {
                                console.log("Error sharing file:", error)
                                Alert.alert("Error", "Could not share the file.")
                              })
                            } else {
                              Alert.alert("Error", "Failed to download the file for sharing.")
                            }
                          })
                            .catch((error) => {
                              console.log("Error downloading file for sharing:", error)
                              Alert.alert("Error", "Failed to download the file for sharing.")
                            })
                        })
                        .catch((error) => {
                          console.log("Error creating directory:", error)
                          Alert.alert("Error", "Could not create directory for file download.")
                        })
                    },
                  },
                ],
                { cancelable: true },
              )
            }
          })
          .catch((error) => {
            console.log("Error checking if file exists:", error)
            Alert.alert("Error", "Could not check if file exists.")
          })
      } else {
        // If no file messages, share text content
        const textToShare = messagesToShare
          .filter((msg) => msg.contentType === "text")
          .map((msg) => msg.content)
          .join("\n\n")

        if (textToShare) {
          Share.open({
            message: textToShare,
            title: "Share message",
          }).catch((error) => {
            console.log("Error sharing text:", error)
            if (!error.message.includes("User did not share")) {
              Alert.alert("Error", "Could not share the message.")
            }
          })
        } else {
          Alert.alert("Nothing to Share", "Selected messages cannot be shared.")
        }
      }

      exitSelectionMode()
    }
  }

  // Add this function to update the navigation options when selection mode changes
  useEffect(() => {
    // This effect runs whenever isSelectionMode or selectedMessages changes
    if (isSelectionMode) {
      console.log("Entering selection mode")
      console.log("Selected messages:", selectedMessages)
      if (selectedMessages.length === 1) {
        // Single selection mode - no title
        navigation.setOptions({
          headerLeft: () => (
            <TouchableOpacity style={styles.headerButton} onPress={exitSelectionMode}>
              <Ionicons name="arrow-back" size={24} color="#ffffff" />
            </TouchableOpacity>
          ),
          headerTitle: () => null, // No title for single selection
          headerRight: () => (
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.headerButton} onPress={handleReplySelected}>
                <Ionicons name="arrow-undo" size={24} color="#ffffff" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.headerButton} onPress={handleInfoSelected}>
                <Ionicons name="information-circle" size={24} color="#ffffff" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.headerButton} onPress={handleShareSelected}>
                <Ionicons name="share-social" size={24} color="#ffffff" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.headerButton} onPress={handleCopySelected}>
                <Ionicons name="copy" size={24} color="#ffffff" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.headerButton} onPress={handleDeleteSelected}>
                <Ionicons name="trash" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
          ),
        })
      } else {
        // Multiple selection mode
        navigation.setOptions({
          headerLeft: () => (
            <TouchableOpacity style={styles.headerButton} onPress={exitSelectionMode}>
              <Ionicons name="arrow-back" size={24} color={currentTheme.primary} />
            </TouchableOpacity>
          ),
          headerTitle: () => (
            <Text style={[styles.headerName, { color: currentTheme.text }]}>{selectedMessages.length} selected</Text>
          ),
          headerRight: () => (
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.headerButton} onPress={handleInfoSelected}>
                <Ionicons name="information-circle" size={24} color={currentTheme.primary} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.headerButton} onPress={handleShareSelected}>
                <Ionicons name="share-social" size={24} color={currentTheme.primary} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.headerButton} onPress={handleCopySelected}>
                <Ionicons name="copy" size={24} color={currentTheme.primary} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.headerButton} onPress={handleDeleteSelected}>
                <Ionicons name="trash" size={24} color={currentTheme.primary} />
              </TouchableOpacity>
            </View>
          ),
        })
      }
    } else {
      // Regular header (unchanged)
      navigation.setOptions({
        headerTitle: () => (
          <TouchableOpacity
            style={styles.headerTitle}
            onPress={() => {
              if (!conversationDetails.isGroup) {
                navigation.navigate("UserProfile", {
                  userId: conversationDetails.participants[0]._id,
                  userName: conversationDetails.name,
                  userImage: conversationDetails.image,
                })
              } else {
                // Replace this Alert with navigation to GroupDetailsScreen
                navigation.navigate("GroupDetails", {
                  conversation: conversation,
                })
              }
            }}
          >
            <View style={styles.headerAvatarContainer}>
              <Image
                source={
                  conversationDetails.image
                    ? {
                      uri: `${API_BASE_URL_FOR_MEDIA}${conversationDetails.image}`,
                    }
                    : require("../../assets/images/default-avatar.png")
                }
                style={styles.headerAvatar}
              />
              {!conversationDetails.isGroup && isOtherUserOnline && <View style={styles.headerOnlineIndicator} />}
            </View>
            <View>
              <Text style={[styles.headerName, { color: currentTheme.text }]}>{conversationDetails.name}</Text>
              {typingUsers.length > 0 && (
                <Text style={[styles.typingText, { color: "#ffffff" }]}>
                  {typingUsers.length === 1
                    ? `${typingUsers[0].name} is typing...`
                    : typingUsers.length === 2
                      ? `${typingUsers[0].name} and ${typingUsers[1].name} are typing...`
                      : `${typingUsers.length} people are typing...`}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        ),
        headerRight: () => (
          <View style={styles.headerRight}>
            {!conversationDetails.isGroup && (
              <>
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={() => {
                    console.log(
                      "[ChatScreen] Navigating to individual AUDIO call. Receiver:",
                      conversationDetails.participants[0]._id,
                    )
                    navigation.navigate("Call", {
                      receiverId: conversationDetails.participants[0]._id,
                      receiverName: conversationDetails.participants[0].name,
                      receiverProfilePic: conversationDetails.participants[0].profilePicture,
                      callType: "audio",
                    })
                  }}
                >
                  <Ionicons name="call" size={24} color={currentTheme.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={() => {
                    console.log(
                      "[ChatScreen] Navigating to individual VIDEO call. Receiver:",
                      conversationDetails.participants[0]._id,
                    )
                    navigation.navigate("Call", {
                      receiverId: conversationDetails.participants[0]._id,
                      receiverName: conversationDetails.participants[0].name,
                      receiverProfilePic: conversationDetails.participants[0].profilePicture,
                      callType: "video",
                    })
                  }}
                >
                  <Ionicons name="videocam" size={24} color={currentTheme.primary} />
                </TouchableOpacity>
              </>
            )}
            {conversationDetails.isGroup && (
              <>
                <TouchableOpacity style={styles.callButton} onPress={() => handleStartGroupAudioCall()}>
                  <Ionicons name="call" size={24} color={currentTheme.primary} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.callButton} onPress={() => handleStartGroupVideoCall()}>
                  <Ionicons name="videocam" size={24} color={currentTheme.primary} />
                </TouchableOpacity>
              </>
            )}
          </View>
        ),
        headerLeft: undefined, // Reset headerLeft if it was set
      })
    }
  }, [
    isSelectionMode,
    selectedMessages,
    navigation,
    conversationDetails,
    currentTheme,
    isTyping,
    typingUsers,
    isOtherUserOnline,
  ])

  // Add online status tracking for one-on-one conversations
  useEffect(() => {
    if (socket && isConnected && !conversation.isGroup) {
      const otherParticipant = conversation.participants.find((p) => p._id !== authState.user.id)

      if (otherParticipant) {
        // NEW: Request initial status immediately
        checkUserStatus(otherParticipant._id)

        // Listen for status updates
        const handleStatusChange = ({ userId, status }) => {
          if (userId === otherParticipant._id) {
            setIsOtherUserOnline(status === "online")
          }
        }

        const handleUserStatus = ({ userId, status }) => {
          if (userId === otherParticipant._id) {
            setIsOtherUserOnline(status === "online")
          }
        }

        socket.on("user-status-change", handleStatusChange)
        socket.on("user-status", handleUserStatus)

        return () => {
          socket.off("user-status-change", handleStatusChange)
          socket.off("user-status", handleUserStatus)
        }
      }
    }
  }, [socket, isConnected, conversation.isGroup, conversation.participants, authState.user.id])

  // NEW: Add socket reconnection handling
  useEffect(() => {
    if (socket) {
      const handleReconnect = () => {
        console.log("Socket reconnected")
        setSocketReconnecting(false)

        // Rejoin conversation room
        joinConversation(conversation._id)

        // Set online status
        setOnlineStatus("online")

        // Check other user's status
        if (!conversation.isGroup) {
          const otherParticipant = conversation.participants.find((p) => p._id !== authState.user.id)
          if (otherParticipant) {
            checkUserStatus(otherParticipant._id)
          }
        }
      }

      const handleReconnecting = () => {
        console.log("Socket reconnecting...")
        setSocketReconnecting(true)
      }

      socket.on("reconnect", handleReconnect)
      socket.on("reconnecting", handleReconnecting)

      return () => {
        socket.off("reconnect", handleReconnect)
        socket.off("reconnecting", handleReconnecting)
      }
    }
  }, [socket, conversation._id])

  const loadWallpaper = async () => {
    try {
      // Get the selected wallpaper ID
      const savedWallpaperId = await AsyncStorage.getItem("selectedWallpaper")

      if (savedWallpaperId) {
        setWallpaperId(savedWallpaperId)

        // If it's a custom wallpaper, load the URI
        if (savedWallpaperId === "custom") {
          const customWallpaperUri = await AsyncStorage.getItem("customWallpaper")
          if (customWallpaperUri) {
            setWallpaper({ uri: customWallpaperUri })
          }
        } else {
          // Load the default wallpaper based on ID
          switch (savedWallpaperId) {
            case "default":
              setWallpaper(require("../../assets/images/wallpapers/default.jpg"))
              break
            case "dark":
              setWallpaper(require("../../assets/images/wallpapers/dark.jpg"))
              break
            case "light":
              setWallpaper(require("../../assets/images/wallpapers/light.jpg"))
              break
            case "pattern1":
              setWallpaper(require("../../assets/images/wallpapers/pattern1.jpg"))
              break
            case "pattern2":
              setWallpaper(require("../../assets/images/wallpapers/pattern2.jpg"))
              break
            default:
              setWallpaper(require("../../assets/images/wallpapers/default.jpg"))
          }
        }
      } else {
        // Default wallpaper if nothing is saved
        setWallpaper(require("../../assets/images/wallpapers/default.jpg"))
      }
    } catch (error) {
      console.error("Error loading wallpaper:", error)
      // Fallback to default wallpaper
      setWallpaper(require("../../assets/images/wallpapers/default.jpg"))
    }
  }

  // Initial setup
  useEffect(() => {
    // Fetch initial messages
    fetchMessages()

    // Load wallpaper
    loadWallpaper()

    // Join conversation room for socket events
    if (isConnected) {
      joinConversation(conversation._id)

      // NEW: Set online status when joining conversation
      setOnlineStatus("online")

      // NEW: Check other user's status if not a group
      if (!conversation.isGroup) {
        const otherParticipant = conversation.participants.find((p) => p._id !== authState.user.id)
        if (otherParticipant) {
          checkUserStatus(otherParticipant._id)
        }
      }
    }

    // Cleanup on unmount
    return () => {
      if (isConnected) {
        leaveConversation(conversation._id)
        // NEW: Set status to offline when leaving conversation
        setOnlineStatus("offline")
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
      // Clear recording timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
    }
  }, [navigation, isConnected])

  // Socket event listeners - UPDATED with try-catch for safety
  useEffect(() => {
    if (socket && isConnected) {
      try {
        // Listen for new messages
        const handleNewMessage = (newMessage) => {
          console.log("Socket: received new message", newMessage._id, newMessage.contentType)

          if (newMessage.conversationId === conversation._id) {
            // Add new message to state
            setMessages((prevMessages) => {
              // Check if message already exists (to avoid duplicates)
              const exists = prevMessages.some((msg) => msg._id === newMessage._id)
              if (exists) {
                console.log("Message already exists, not adding duplicate")
                return prevMessages
              }
              console.log("Adding new message to state")
              return [newMessage, ...prevMessages]
            })

            // Mark conversation as delivered using the API
            MessagesAPI.markAsDelivered(conversation._id, authState.token)
              .then(() => {
                // Then mark individual message as read via socket
                markAsRead(newMessage._id, conversation._id, authState.user.id)
              })
              .catch((error) => {
                console.error("Error marking messages as delivered:", error)
              })
          }
        }
        socket.on("receive-message", handleNewMessage)

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
              setIsOtherUserOnline(status === "online")
              console.log(`User ${userId} is now ${status}`)
            }
          }
        })

        return () => {
          try {
            socket.off("receive-message", handleNewMessage)
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

  // Add hardware back button handler
  useEffect(() => {
    const backAction = () => {
      if (isSelectionMode) {
        console.log("Back button pressed while in selection mode, exiting selection mode first")
        exitSelectionMode()
        return true // Prevent default back action
      }
      return false // Allow default back action (navigate back)
    }

    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction)

    return () => backHandler.remove() // Clean up the event listener on unmount
  }, [isSelectionMode]) // Re-add listener if selection mode changes

  // Render loading state
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: currentTheme.background }]}>
        <ActivityIndicator size="large" color={currentTheme.primary} />
      </View>
    )
  }

  // NEW: Render socket reconnecting indicator
  const renderReconnectingIndicator = () => {
    if (socketReconnecting) {
      return (
        <View style={styles.reconnectingContainer}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.reconnectingText}>Reconnecting...</Text>
        </View>
      )
    }
    return null
  }

  // Add these functions inside the ChatScreen component

  const handleStartGroupAudioCall = () => {
    if (!conversationDetails.isGroup) {
      return
    }
    console.log("[ChatScreen] Navigating to GROUP AUDIO call. Conversation ID:", conversation._id)
    navigation.navigate("GroupCallScreen", {
      conversationId: conversation._id,
      conversationName: conversationDetails.name,
      initialParticipants: conversationDetails.participants,
      callType: "audio",
      isIncoming: false,
      callId: null,
    })
  }

  const handleStartGroupVideoCall = () => {
    if (!conversationDetails.isGroup) {
      return
    }
    console.log("[ChatScreen] Navigating to GROUP VIDEO call. Conversation ID:", conversation._id)
    navigation.navigate("GroupCallScreen", {
      conversationId: conversation._id,
      conversationName: conversationDetails.name,
      initialParticipants: conversationDetails.participants,
      callType: "video",
      isIncoming: false,
      callId: null,
    })
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: currentTheme.background }]}>
      <ImageBackground source={wallpaper} style={styles.container} resizeMode="cover">
        {/* NEW: Socket reconnecting indicator */}
        {renderReconnectingIndicator()}

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.container}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
          enabled={Platform.OS === "ios"}
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
                theme={currentTheme}
                isSelected={selectedMessages.includes(item._id)}
                onLongPress={handleMessageLongPress}
                onPress={(message) => {
                  // If in selection mode, toggle selection on tap
                  if (isSelectionMode) {
                    handleMessageLongPress(message)
                  }
                }}
                allMessages={messages}
              />
            )}
            keyExtractor={(item) => item._id}
            inverted
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              isLoadingMore ? (
                <View style={styles.loadingMore}>
                  <ActivityIndicator size="small" color={currentTheme.primary} />
                </View>
              ) : null
            }
            contentContainerStyle={[
              styles.messagesList,
              {
                paddingBottom: keyboardVisible && Platform.OS === "android" ? keyboardHeight : 10,
              },
            ]}
          />

          {/* Reply Preview */}
          {replyTo && (
            <View
              style={[
                styles.replyContainer,
                {
                  backgroundColor: currentTheme.card,
                  borderTopColor: currentTheme.border,
                },
              ]}
            >
              <View
                style={[
                  styles.replyContent,
                  {
                    backgroundColor: currentTheme.background,
                    borderLeftColor: currentTheme.primary,
                  },
                ]}
              >
                <View style={styles.replyInfo}>
                  <Text style={[styles.replyName, { color: currentTheme.primary }]}>
                    {replyTo.sender._id === authState.user.id ? "You" : replyTo.sender.name}
                  </Text>
                  <Text style={[styles.replyText, { color: currentTheme.placeholder }]} numberOfLines={1}>
                    {replyTo.contentType === "text"
                      ? replyTo.content
                      : `${replyTo.contentType.charAt(0).toUpperCase() + replyTo.contentType.slice(1)}`}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleCancelReply}>
                  <Ionicons name="close" size={20} color={currentTheme.placeholder} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Audio Recording View (WhatsApp style) */}
          {isRecording && (
            <AudioRecordingView
              duration={recordingDuration}
              onCancel={cancelAudioRecording}
              onSend={() => handleAudioRecording()}
              theme={currentTheme}
            />
          )}

          {/* Message Input (hidden when recording) */}
          {!isRecording && !isSelectionMode && (
            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor: currentTheme.card,
                  borderTopColor: currentTheme.border,
                  paddingBottom: Platform.OS === "ios" ? (keyboardVisible ? 5 : 25) : 10,
                },
              ]}
            >
              <TouchableOpacity style={styles.attachButton} onPress={() => setIsAttachmentModalVisible(true)}>
                <Ionicons name="add-circle" size={24} color={currentTheme.primary} />
              </TouchableOpacity>

              <TextInput
                ref={inputRef}
                style={[
                  styles.input,
                  {
                    backgroundColor: currentTheme.background,
                    color: currentTheme.text,
                  },
                ]}
                placeholder="Type a message..."
                placeholderTextColor={currentTheme.placeholder}
                value={inputMessage}
                onChangeText={(text) => {
                  setInputMessage(text)
                  handleTyping()
                }}
                multiline
              />

              {inputMessage.trim() ? (
                <TouchableOpacity
                  style={[styles.sendButton, { backgroundColor: currentTheme.primary }]}
                  onPress={handleSendMessage}
                >
                  <Ionicons name="send" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.micButton} onPress={handleAudioRecording}>
                  <Ionicons name="mic" size={24} color={currentTheme.primary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Attachment Modal */}
          <AttachmentModal
            visible={isAttachmentModalVisible}
            onClose={() => setIsAttachmentModalVisible(false)}
            onPickImage={handlePickImage}
            onTakePhoto={handleTakePhoto}
            onPickDocument={handlePickDocument}
            theme={currentTheme}
          />
        </KeyboardAvoidingView>
      </ImageBackground>
    </SafeAreaView>
  )
}

// Update the styles to accommodate the ImageBackground
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    width: "100%",
  },
  keyboardAvoidingView: {
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
    fontStyle: "italic",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
  },
  headerButton: {
    marginLeft: 15,
    padding: 5,
  },
  messagesList: {
    paddingHorizontal: 10,
  },
  loadingMore: {
    padding: 10,
    alignItems: "center",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderTopWidth: 1,
  },
  attachButton: {
    marginRight: 10,
    padding: 5,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    minHeight: 40,
  },
  sendButton: {
    marginLeft: 10,
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
    backgroundColor: "#f0f0f0",
  },
  replyContainer: {
    borderTopWidth: 1,
    padding: 10,
  },
  replyContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: 8,
  },
  replyInfo: {
    flex: 1,
  },
  replyName: {
    fontWeight: "bold",
  },
  replyText: {},
  headerAvatarContainer: {
    position: "relative",
    marginRight: 10,
  },
  headerOnlineIndicator: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4CAF50",
    borderWidth: 2,
    borderColor: "white",
  },
  callButton: {
    marginLeft: 10,
    padding: 8,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  // NEW: Reconnecting indicator styles
  reconnectingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 5,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  reconnectingText: {
    color: "#fff",
    marginLeft: 8,
    fontSize: 12,
  },
})

export default ChatScreen
