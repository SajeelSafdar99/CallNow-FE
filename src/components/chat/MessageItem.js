"use client"

import { useState, useRef, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  Alert,
  Animated,
  Easing,
  ActivityIndicator,
  PanResponder,
  Platform,
  PermissionsAndroid,
  ToastAndroid,
} from "react-native"
import Ionicons from "react-native-vector-icons/Ionicons"
import { API_BASE_URL_FOR_MEDIA } from "../../config/api"
import { formatTimestamp, formatDuration, formatFileSize } from "../../utils/formatters"
import { playAudio, stopAudio } from "../../utils/media-helpers"
import { createMediaItemsArray, collectMediaItemsFromMessages } from "../../utils/message-helpers"
import RNFS from "react-native-fs"
import Video from "react-native-video"
import Share from "react-native-share"
import { AnimatedCircularProgress } from "react-native-circular-progress"
import SendIntentAndroid from "react-native-send-intent"
import MediaViewer from "./MediaViewer"

// Create a global variable to track the currently swiped message
let currentlySwipedMessageId = null

const MessageItem = ({
                       message,
                       isOwnMessage,
                       onDelete,
                       onReply,
                       onForward,
                       theme,
                       isSelected = false,
                       onLongPress,
                       onPress,
                       allMessages = [], // Add this prop to receive all messages for media gallery
                     }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackProgress, setPlaybackProgress] = useState(0)
  const [showOptions, setShowOptions] = useState(false)
  const [imageLoading, setImageLoading] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [videoThumbnail, setVideoThumbnail] = useState(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [fileExists, setFileExists] = useState(false)
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false)
  const [mediaViewerItems, setMediaViewerItems] = useState([])
  const [mediaViewerIndex, setMediaViewerIndex] = useState(0)
  const [imageAspectRatio, setImageAspectRatio] = useState(1)

  // Create mediaItems array if needed
  const mediaItems = createMediaItemsArray(message)

  const playbackAnimation = useRef(new Animated.Value(0)).current
  const playbackTimer = useRef(null)
  const audioDuration = message.mediaSize ? Math.round(message.mediaSize / 10000) : 30 // Estimate duration from file size
  const videoRef = useRef(null)

  // Add swipe animation values
  const swipeAnim = useRef(new Animated.Value(0)).current
  const replyIconOpacity = useRef(new Animated.Value(0)).current
  const replyIconScale = useRef(new Animated.Value(0.5)).current

  // Format message timestamp
  const timestamp = formatTimestamp(message.createdAt)

  // Get file name and media URL
  const fileName =
    message.mediaName ||
    message.content ||
    (message.contentType === "document"
      ? "Document"
      : message.contentType === "video"
        ? "Video"
        : message.contentType === "audio"
          ? "Audio"
          : "File")

  const mediaUrl = message.mediaUrl ? `${API_BASE_URL_FOR_MEDIA}/${message.mediaUrl}` : null

  // Check if file exists in app storage and auto-download for own messages
  useEffect(() => {
    const checkFileExists = async () => {
      if (!mediaUrl || !["document", "video", "audio"].includes(message.contentType)) return

      const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_")
      const appFilesDir = `${RNFS.DocumentDirectoryPath}/CallNowFiles`
      const filePath = `${appFilesDir}/${safeFileName}`

      try {
        // First check if directory exists
        const dirExists = await RNFS.exists(appFilesDir)
        if (!dirExists) {
          await RNFS.mkdir(appFilesDir)
          setFileExists(false)

          // If it's the user's own message, download it automatically
          if (isOwnMessage && mediaUrl && message.contentType === "document") {
            downloadFile(mediaUrl, safeFileName)
          }
          return
        }

        // Then check if file exists
        const exists = await RNFS.exists(filePath)
        setFileExists(exists)

        // If it's the user's own message and file doesn't exist, download it automatically
        if (isOwnMessage && !exists && mediaUrl && message.contentType === "document") {
          downloadFile(mediaUrl, safeFileName)
        }
      } catch (error) {
        console.error("Error checking if file exists:", error)
        setFileExists(false)
      }
    }

    checkFileExists()
  }, [mediaUrl, fileName, isOwnMessage, message.contentType])

  // Reset swipe animation when another message is swiped
  useEffect(() => {
    if (currentlySwipedMessageId && currentlySwipedMessageId !== message._id) {
      // Reset this message's swipe if another message is being swiped
      Animated.timing(swipeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start()

      // Hide the reply icon
      Animated.parallel([
        Animated.timing(replyIconOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(replyIconScale, {
          toValue: 0.5,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [currentlySwipedMessageId, message._id])

  // Set up pan responder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only respond to horizontal movements
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy * 3)
      },
      onPanResponderGrant: () => {
        // When the gesture starts, show the reply icon and set this as the current message
        currentlySwipedMessageId = message._id

        Animated.parallel([
          Animated.timing(replyIconOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(replyIconScale, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start()
      },
      onPanResponderMove: (evt, gestureState) => {
        // Only allow swiping left (negative dx)
        if (gestureState.dx < 0) {
          // Limit the swipe to -100 pixels
          const newValue = Math.max(gestureState.dx, -100)
          swipeAnim.setValue(newValue)
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        // If swiped far enough to the left, trigger reply
        if (gestureState.dx < -60) {
          // Animate back to original position
          Animated.timing(swipeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start()

          // Hide the reply icon
          Animated.parallel([
            Animated.timing(replyIconOpacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(replyIconScale, {
              toValue: 0.5,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start()

          // Trigger reply
          onReply(message)
        } else {
          // If not swiped far enough, animate back to original position
          Animated.timing(swipeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start()

          // Hide the reply icon
          Animated.parallel([
            Animated.timing(replyIconOpacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(replyIconScale, {
              toValue: 0.5,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start()

          // Clear the currently swiped message
          currentlySwipedMessageId = null
        }
      },
    }),
  ).current

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (playbackTimer.current) {
        clearInterval(playbackTimer.current)
      }
      if (isPlaying) {
        stopAudio().catch((err) => console.error("Error stopping audio on unmount:", err))
      }
      // Clear the currently swiped message if this component unmounts
      if (currentlySwipedMessageId === message._id) {
        currentlySwipedMessageId = null
      }
    }
  }, [isPlaying, message._id])

  // Get correct media URL
  const getMediaUrl = (mediaPath) => {
    if (!mediaPath) {
      return null
    }

    if (mediaPath.startsWith("http")) {
      return mediaPath
    }

    // Ensure the path starts with a slash
    const formattedPath = mediaPath.startsWith("/") ? mediaPath : `/${mediaPath}`
    return `${API_BASE_URL_FOR_MEDIA}${formattedPath}`
  }

  // Request storage permission for downloading files
  const requestStoragePermission = async () => {
    if (Platform.OS === "android") {
      try {
        if (Number.parseInt(Platform.Version, 10) >= 33) {
          // For Android 13+ we need different permissions
          return true // Android 13+ doesn't need explicit permission for downloads
        } else {
          const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE, {
            title: "Storage Permission",
            message: "App needs access to your storage to download files",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK",
          })
          return granted === PermissionsAndroid.RESULTS.GRANTED
        }
      } catch (err) {
        console.error("Error requesting storage permission:", err)
        return false
      }
    } else {
      // iOS doesn't need permission for downloads to app's directory
      return true
    }
  }

  // Download file to device
  const downloadFile = async (url, fileName) => {
    try {
      setIsDownloading(true)
      setDownloadProgress(0)

      // Request permission
      const hasPermission = await requestStoragePermission()
      if (!hasPermission) {
        Alert.alert("Permission Denied", "Storage permission is required to download files")
        setIsDownloading(false)
        return
      }

      // Ensure we have a valid filename
      const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_")

      // Create app-specific directory for saved files (like WhatsApp)
      const appFilesDir = `${RNFS.DocumentDirectoryPath}/CallNowFiles`

      // Check if directory exists, if not create it
      const dirExists = await RNFS.exists(appFilesDir)
      if (!dirExists) {
        await RNFS.mkdir(appFilesDir)
      }

      // Set path to app's files directory
      const filePath = `${appFilesDir}/${safeFileName}`

      // Check if file already exists
      const fileExists = await RNFS.exists(filePath)
      if (fileExists) {
        // If file exists, open it directly
        setIsDownloading(false)
        setFileExists(true)
        openFile(filePath, safeFileName)
      } else {
        // If file doesn't exist, proceed with download
        proceedWithDownload(url, filePath, safeFileName)
      }
    } catch (error) {
      console.error("Error downloading file:", error)
      setIsDownloading(false)
      Alert.alert("Download Failed", "Could not download the file. Please try again.")
    }
  }

  // Helper function to proceed with download
  const proceedWithDownload = async (url, filePath, fileName) => {
    try {
      // Download the file with progress tracking
      const options = {
        fromUrl: url,
        toFile: filePath,
        progress: (res) => {
          const progress = res.bytesWritten / res.contentLength
          setDownloadProgress(progress)
        },
        progressDivider: 2, // Report progress more frequently
      }

      const result = await RNFS.downloadFile(options).promise

      setIsDownloading(false)
      setDownloadProgress(0)

      if (result.statusCode === 200) {
        // Update file exists state
        setFileExists(true)

        // Show success message and open file
        ToastAndroid.show("File downloaded successfully", ToastAndroid.SHORT)
        openFile(filePath, fileName)
      } else {
        Alert.alert("Download Failed", "Could not download the file. Please try again.")
      }
    } catch (error) {
      console.error("Error in download process:", error)
      setIsDownloading(false)
      setDownloadProgress(0)
      Alert.alert("Download Failed", "Could not download the file. Please try again.")
    }
  }

  // Helper function to open file with appropriate app
  const renderDocumentMessage = () => {
    const fileSize = message.mediaSize ? formatFileSize(message.mediaSize) : ""
    console.log("Rendering document message:", fileName)

    return (
      <TouchableOpacity
        style={styles.documentContainer}
        onPress={() => {
          console.log("Document message pressed directly")
          if (fileExists) {
            console.log("File exists, opening file")
            const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_")
            const appFilesDir = `${RNFS.DocumentDirectoryPath}/CallNowFiles`
            const filePath = `${appFilesDir}/${safeFileName}`
            openFile(filePath, safeFileName)
          } else if (mediaUrl) {
            console.log("File does not exist, downloading")
            downloadFile(mediaUrl, fileName)
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.documentIconWrapper}>
          <View
            style={[
              styles.documentIconContainer,
              {
                backgroundColor: isOwnMessage ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.05)",
              },
            ]}
          >
            <Ionicons name="document-text" size={30} color={isOwnMessage ? "#FFFFFF" : theme.primary} />
          </View>

          {/* Download icon overlay or progress circle - only show for non-own messages */}
          {!isOwnMessage && !fileExists && !isDownloading && (
            <TouchableOpacity
              style={styles.downloadIconOverlay}
              onPress={(e) => {
                console.log("Download icon pressed")
                e.stopPropagation()
                if (mediaUrl) {
                  downloadFile(mediaUrl, fileName)
                }
              }}
            >
              <View
                style={[
                  styles.downloadIconCircle,
                  {
                    backgroundColor: theme.primary,
                  },
                ]}
              >
                <Ionicons name="download-outline" size={16} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          )}

          {/* Circular progress indicator */}
          {isDownloading && (
            <View style={styles.progressCircleContainer}>
              <View style={styles.progressBackground} />
              <View style={styles.progressTextContainer}>
                <Text style={styles.progressText}>{Math.round(downloadProgress * 100)}%</Text>
              </View>
              <AnimatedCircularProgress
                size={60}
                width={3}
                fill={downloadProgress * 100}
                tintColor={isOwnMessage ? "#FFFFFF" : theme.primary}
                backgroundColor="rgba(0,0,0,0.1)"
                rotation={0}
                lineCap="round"
              />
            </View>
          )}
        </View>

        <View style={styles.documentInfo}>
          <Text style={[styles.documentName, { color: isOwnMessage ? "#FFFFFF" : theme.text }]} numberOfLines={2}>
            {fileName}
          </Text>
          {fileSize && (
            <Text
              style={[
                styles.documentSize,
                {
                  color: isOwnMessage ? "rgba(255,255,255,0.7)" : theme.placeholder,
                },
              ]}
            >
              {fileSize}
            </Text>
          )}
          {message.isUploading && (
            <Text
              style={[
                styles.uploadingText,
                {
                  color: isOwnMessage ? "rgba(255,255,255,0.7)" : theme.placeholder,
                },
              ]}
            >
              Uploading...
            </Text>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  // Helper function to open file with appropriate app
  const openFile = (filePath, fileName) => {
    try {
      console.log("Opening file - Path:", filePath)
      console.log("Opening file - Name:", fileName)

      // Check if file exists before trying to open it
      RNFS.exists(filePath)
        .then((exists) => {
          console.log("File exists check:", exists)

          if (!exists) {
            console.error("File does not exist at path:", filePath)
            Alert.alert("Error", "File not found. It may have been deleted or moved.")
            return
          }

          // Get file stats to verify it's a valid file
          RNFS.stat(filePath)
            .then((stats) => {
              console.log("File stats:", stats)

              // Get file extension to determine MIME type
              const fileExt = fileName.split(".").pop().toLowerCase()
              console.log("File extension:", fileExt)

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
              } else if (["ppt", "pptx"].includes(fileExt)) {
                mimeType = "application/vnd.ms-powerpoint"
              } else if (["txt"].includes(fileExt)) {
                mimeType = "text/plain"
              } else if (["mp3", "wav", "ogg"].includes(fileExt)) {
                mimeType = "audio/*"
              } else if (["zip", "rar"].includes(fileExt)) {
                mimeType = "application/zip"
              }

              console.log("Using MIME type:", mimeType)

              // Create the file URI
              const fileUri = `file://${filePath}`
              console.log("File URI:", fileUri)

              if (Platform.OS === "android") {
                console.log("Platform: Android - Using SendIntentAndroid to open file")

                try {
                  // According to the type definition, openFileChooser takes options and title
                  const options = {
                    fileUrl: fileUri,
                    type: mimeType,
                  }

                  console.log("Calling openFileChooser with options:", options)
                  SendIntentAndroid.openFileChooser(options, "Open with")

                  console.log("openFileChooser called successfully")
                } catch (intentError) {
                  console.error("Error with openFileChooser:", intentError)

                  // Try alternative method - openAppWithData with empty package name
                  try {
                    console.log("Trying openAppWithData as fallback")
                    SendIntentAndroid.openAppWithData("", fileUri, mimeType, {})
                      .then(() => {
                        console.log("openAppWithData succeeded")
                      })
                      .catch((appError) => {
                        console.error("openAppWithData failed:", appError)

                        // Try using a direct intent URI as last resort
                        try {
                          console.log("Trying openAppWithUri as last resort")
                          const intentUri = `intent:${fileUri}#Intent;action=android.intent.action.VIEW;type=${mimeType};end`
                          SendIntentAndroid.openAppWithUri(intentUri)
                            .then(() => {
                              console.log("openAppWithUri succeeded")
                            })
                            .catch((uriError) => {
                              console.error("openAppWithUri failed:", uriError)
                              fallbackToLinking(fileUri)
                            })
                        } catch (uriError) {
                          console.error("Error with openAppWithUri:", uriError)
                          fallbackToLinking(fileUri)
                        }
                      })
                  } catch (appDataError) {
                    console.error("Error with openAppWithData:", appDataError)
                    fallbackToLinking(fileUri)
                  }
                }
              } else {
                console.log("Platform: iOS - Attempting to open with document picker")

                // For iOS, use the Share API with showAppsToView
                Share.open({
                  url: fileUri,
                  type: mimeType,
                  failOnCancel: false,
                  showAppsToView: true,
                  title: "Open with",
                  excludedActivityTypes: [],
                })
                  .then((result) => {
                    console.log("iOS Share success:", result)
                  })
                  .catch((error) => {
                    console.log("iOS Share error:", error)

                    // Try direct opening as fallback
                    Linking.canOpenURL(fileUri)
                      .then((supported) => {
                        if (supported) {
                          return Linking.openURL(fileUri)
                        } else {
                          throw new Error("No app can open this file type")
                        }
                      })
                      .then(() => {
                        console.log("iOS direct opening success")
                      })
                      .catch((directErr) => {
                        console.error("iOS direct opening error:", directErr)
                        Alert.alert("Error", "Could not open the file. No compatible app found.")
                      })
                  })
              }
            })
            .catch((statError) => {
              console.error("Error getting file stats:", statError)
              Alert.alert("Error", "Could not read file information.")
            })
        })
        .catch((existsError) => {
          console.error("Error checking if file exists:", existsError)
          Alert.alert("Error", "Could not verify if the file exists.")
        })
    } catch (error) {
      console.error("General error opening file:", error)
      Alert.alert("Error", "Could not open the file due to an unexpected error.")
    }
  }

  // Helper function to fall back to Linking API
  const fallbackToLinking = (fileUri) => {
    console.log("Falling back to Linking API")
    Linking.canOpenURL(fileUri)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(fileUri)
        } else {
          throw new Error("No app can open this file type")
        }
      })
      .then(() => {
        console.log("Linking success")
      })
      .catch((linkErr) => {
        console.error("Linking error:", linkErr)
        Alert.alert("Error", "Could not open the file. No compatible app found.")
      })
  }

  // Handle opening media viewer for multiple media items
  const handleOpenMediaViewer = (items, index) => {
    console.log("Opening media viewer with items:", items)

    // If we have allMessages, collect all media items from all messages
    if (allMessages && allMessages.length > 0) {
      // Use the utility function to collect all media items and get the initial index
      const { mediaItems: allMediaItems, initialIndex } = collectMediaItemsFromMessages(
        allMessages.filter(
          (msg) =>
            msg.contentType === "image" || msg.contentType === "video" || (msg.mediaItems && msg.mediaItems.length > 0),
        ),
        message._id,
      )

      if (allMediaItems.length > 0) {
        console.log(`Opening media viewer with ${allMediaItems.length} items from all messages`)
        setMediaViewerItems(allMediaItems)
        setMediaViewerIndex(initialIndex)
        setMediaViewerVisible(true)
        return
      }
    }

    // Fallback to just using the items from this message
    setMediaViewerItems(items)
    setMediaViewerIndex(index)
    setMediaViewerVisible(true)
  }

  const handleDelete = () => {
    Alert.alert(
      "Delete Message",
      "Are you sure you want to delete this message?",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => setShowOptions(false),
        },
        {
          text: isOwnMessage ? "Delete for Everyone" : "Delete",
          onPress: () => {
            onDelete(message._id, isOwnMessage)
            setShowOptions(false)
          },
          style: "destructive",
        },
      ],
      { cancelable: true },
    )
  }

  // Handle message reply
  const handleReply = () => {
    onReply(message)
    setShowOptions(false)
  }

  // Handle message forward
  const handleForward = () => {
    if (onForward) {
      onForward(message)
      setShowOptions(false)
    }
  }

  // Handle audio playback
  const handleAudioPlayback = async () => {
    try {
      if (isPlaying) {
        // Stop playback
        await stopAudio()
        setIsPlaying(false)
        setPlaybackProgress(0)
        playbackAnimation.setValue(0)
        if (playbackTimer.current) {
          clearInterval(playbackTimer.current)
          playbackTimer.current = null
        }
      } else {
        // Start playback
        setIsPlaying(true)

        // Get audio URL
        const audioUrl = getMediaUrl(message.mediaUrl)
        if (!audioUrl) {
          throw new Error("Invalid audio URL")
        }

        // Play audio
        const success = await playAudio(audioUrl)
        if (!success) {
          throw new Error("Failed to play audio")
        }

        // Animate playback progress
        Animated.timing(playbackAnimation, {
          toValue: 1,
          duration: audioDuration * 1000, // Convert seconds to ms
          useNativeDriver: false,
          easing: Easing.linear,
        }).start(({ finished }) => {
          if (finished) {
            setIsPlaying(false)
            setPlaybackProgress(0)
            playbackAnimation.setValue(0)
          }
        })

        // Update progress every second
        let progress = 0
        playbackTimer.current = setInterval(() => {
          progress += 1
          setPlaybackProgress(progress)

          // Stop after duration or 30 seconds max (failsafe)
          if (progress >= audioDuration || progress >= 30) {
            setIsPlaying(false)
            setPlaybackProgress(0)
            clearInterval(playbackTimer.current)
            playbackTimer.current = null
          }
        }, 1000)
      }
    } catch (error) {
      console.error("Error playing audio:", error)
      setIsPlaying(false)
      Alert.alert("Error", "Failed to play audio message")
    }
  }

  // Render audio message
  const renderAudioMessage = () => {
    return (
      <View style={styles.audioContainer}>
        <TouchableOpacity
          style={[
            styles.playButton,
            {
              backgroundColor: isOwnMessage ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.05)",
            },
          ]}
          onPress={(e) => {
            e.stopPropagation()
            handleAudioPlayback()
          }}
        >
          <Ionicons name={isPlaying ? "pause" : "play"} size={24} color={isOwnMessage ? "#FFFFFF" : theme.primary} />
        </TouchableOpacity>

        <View style={styles.audioWaveformContainer}>
          <Animated.View
            style={[
              styles.audioProgress,
              {
                backgroundColor: isOwnMessage ? "rgba(255,255,255,0.5)" : theme.primary,
                width: playbackAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />

          {/* Waveform bars */}
          <View style={styles.waveform}>
            {Array.from({ length: 15 }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.waveformBar,
                  {
                    height: 5 + Math.random() * 15,
                    backgroundColor: isOwnMessage ? "#FFFFFF" : theme.text,
                    opacity: isOwnMessage ? 0.8 : 0.5,
                  },
                ]}
              />
            ))}
          </View>
        </View>

        <Text style={[styles.audioDuration, { color: isOwnMessage ? "#FFFFFF" : theme.text }]}>
          {playbackProgress > 0 ? formatDuration(playbackProgress) : formatDuration(audioDuration)}
        </Text>
      </View>
    )
  }

  // Render image message
  const renderImageMessage = () => {
    const imageUrl = getMediaUrl(message.mediaUrl)

    return (
      <View style={styles.imageContainer}>
        {imageLoading && (
          <View style={styles.imageLoadingContainer}>
            <ActivityIndicator size="small" color={isOwnMessage ? "#FFFFFF" : theme.primary} />
          </View>
        )}

        {imageError ? (
          <View
            style={[
              styles.imageErrorContainer,
              {
                backgroundColor: isOwnMessage ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.05)",
              },
            ]}
          >
            <Ionicons name="image-outline" size={40} color={isOwnMessage ? "#FFFFFF" : theme.primary} />
            <Text
              style={{
                color: isOwnMessage ? "#FFFFFF" : theme.text,
                marginTop: 8,
              }}
            >
              Failed to load image
            </Text>
          </View>
        ) : (
          <Image
            source={{ uri: imageUrl }}
            style={[styles.messageImage, { aspectRatio: imageAspectRatio }]}
            resizeMode="contain"
            onLoadStart={() => setImageLoading(true)}
            onLoad={(event) => {
              const { width: imageWidth, height: imageHeight } = event.nativeEvent.source;
              if (imageWidth && imageHeight) {
                const ratio = imageWidth / imageHeight;
                setImageAspectRatio(ratio);
              }
            }}
            onLoadEnd={() => setImageLoading(false)}
            onError={(e) => {
              console.error("Image error:", e);
              setImageLoading(false);
              setImageError(true);
            }}
          />
        )}

        {message.isUploading && (
          <View style={styles.uploadingOverlay}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.uploadingText}>Uploading...</Text>
          </View>
        )}
      </View>
    )
  }

  // Render video message
  const renderVideoMessage = () => {
    const videoUrl = getMediaUrl(message.mediaUrl)
    // Get the video filename from mediaName or extract it from mediaUrl
    const videoName = message.mediaName || (message.mediaUrl ? message.mediaUrl.split("/").pop() : "")

    return (
      <View style={styles.videoContainer}>
        <View style={styles.videoThumbnail}>
          {/* Use react-native-video to display the video thumbnail */}
          <Video
            ref={videoRef}
            source={{ uri: videoUrl }}
            style={styles.videoBackground}
            resizeMode="contain"
            paused={true}
            muted={true}
            onError={(e) => console.error("Video error:", e)}
          />

          <View style={styles.videoPlayButton}>
            <Ionicons name="play" size={30} color="#FFFFFF" />
          </View>
        </View>
        <Text style={[styles.videoCaption, { color: isOwnMessage ? "#FFFFFF" : theme.text }]}>
          {/* Show content if available, otherwise show the video filename, or fallback to "Video" */}
          {message.content && message.content !== "Video" ? message.content : videoName || "Video"}
        </Text>
      </View>
    )
  }

  // Render message content based on type
  const renderMessageContent = () => {
    // Create mediaItems array if needed
    const mediaItems = createMediaItemsArray(message)
    console.log("MediaItems created:", mediaItems?.length || 0)

    // Check if message has media items
    if (mediaItems && mediaItems.length > 0) {
      console.log("Rendering media item:", mediaItems[0].contentType)

      // Just render the first media item directly
      const mediaItem = mediaItems[0]
      const mediaUrl = getMediaUrl(mediaItem.mediaUrl)

      if (mediaItem.contentType === "image") {
        return (
          <TouchableOpacity
            style={styles.mediaContentContainer}
            onPress={() => handleOpenMediaViewer(mediaItems, 0)}
            onLongPress={() => onLongPress && onLongPress(message)}
          >
            <Image
              source={{ uri: mediaUrl }}
              style={styles.messageImage}
              resizeMode="cover"
              onLoadStart={() => setImageLoading(true)}
              onLoad={(event) => {
                const { width: imageWidth, height: imageHeight } = event.nativeEvent.source;
                if (imageWidth && imageHeight) {
                  const ratio = imageWidth / imageHeight;
                  setImageAspectRatio(ratio);
                }
              }}
              onLoadEnd={() => setImageLoading(false)}
              onError={(e) => {
                console.error("Image error:", e)
                setImageLoading(false)
                setImageError(true)
              }}
            />
            {mediaItems.length > 1 && (
              <View style={styles.multipleMediaIndicator}>
                <Ionicons name="images" size={16} color="#FFFFFF" />
                <Text style={styles.multipleMediaText}>{mediaItems.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        )
      } else if (mediaItem.contentType === "video") {
        return (
          <TouchableOpacity
            style={styles.mediaContentContainer}
            onPress={() => handleOpenMediaViewer(mediaItems, 0)}
            onLongPress={() => onLongPress && onLongPress(message)}
          >
            <View style={styles.videoThumbnail}>
              <Video
                ref={videoRef}
                source={{ uri: mediaUrl }}
                style={styles.videoBackground}
                resizeMode="contain"
                paused={true}
                muted={true}
                onError={(e) => console.error("Video error:", e)}
              />
              <View style={styles.videoPlayButton}>
                <Ionicons name="play" size={30} color="#FFFFFF" />
              </View>
            </View>
            {mediaItems.length > 1 && (
              <View style={styles.multipleMediaIndicator}>
                <Ionicons name="images" size={16} color="#FFFFFF" />
                <Text style={styles.multipleMediaText}>{mediaItems.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        )
      }
    }

    if (message.contentType === "text") {
      return (
        <Text style={[styles.messageText, { color: isOwnMessage ? "#FFFFFF" : theme.text }]}>{message.content}</Text>
      )
    } else if (message.contentType === "image") {
      return renderImageMessage()
    } else if (message.contentType === "video") {
      return renderVideoMessage()
    } else if (message.contentType === "document") {
      return renderDocumentMessage()
    } else if (message.contentType === "audio") {
      return renderAudioMessage()
    } else {
      return (
        <Text style={[styles.messageText, { color: isOwnMessage ? "#FFFFFF" : theme.text }]}>
          Unsupported message type: {message.contentType}
        </Text>
      )
    }
  }

  // Render reply preview if message is a reply
  const renderReplyPreview = () => {
    if (!message.replyTo) {
      return null
    }

    return (
      <View
        style={[
          styles.replyPreview,
          {
            backgroundColor: isOwnMessage ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.05)",
            borderLeftColor: isOwnMessage ? "#FFFFFF" : theme.primary,
          },
        ]}
      >
        <Text style={[styles.replyName, { color: isOwnMessage ? "#FFFFFF" : theme.primary }]}>
          {message.replyTo.sender._id === message.sender._id ? "You" : message.replyTo.sender.name}
        </Text>
        <Text
          style={[styles.replyText, { color: isOwnMessage ? "rgba(255,255,255,0.8)" : theme.text }]}
          numberOfLines={1}
        >
          {message.replyTo.contentType === "text"
            ? message.replyTo.content
            : `${message.replyTo.contentType.charAt(0).toUpperCase() + message.replyTo.contentType.slice(1)}`}
        </Text>
      </View>
    )
  }

  // Handle content press for media items
  const handleContentPress = () => {
    console.log("handleContentPress called for message type:", message.contentType)

    // If in selection mode, don't open media
    if (onPress) {
      console.log("onPress handler exists, calling it instead of opening media")
      onPress(message)
      return
    }

    const mediaUrl = getMediaUrl(message.mediaUrl)
    console.log("Media URL for content press:", mediaUrl)

    if (!mediaUrl) {
      console.log("Invalid media URL")
      Alert.alert("Error", "Invalid media URL")
      return
    }

    if (message.contentType === "image") {
      console.log("Opening image in viewer")
      // Open single image in media viewer
      const mediaItem = {
        contentType: "image",
        mediaUrl: message.mediaUrl,
        mediaName: message.mediaName,
      }
      handleOpenMediaViewer([mediaItem], 0)
    } else if (message.contentType === "video") {
      console.log("Opening video in viewer")
      // Open single video in media viewer
      const mediaItem = {
        contentType: "video",
        mediaUrl: message.mediaUrl,
        mediaName: message.mediaName,
      }
      handleOpenMediaViewer([mediaItem], 0)
    } else if (message.contentType === "document") {
      console.log("Downloading document for viewing")
      // For documents, download instead of opening in browser
      const fileName = message.mediaName || message.content || `document_${Date.now()}`
      downloadFile(mediaUrl, fileName)
    }
  }

  // Determine if this is a media message
  const isMediaMessage = ["image", "video"].includes(message.contentType) ||
    (mediaItems && mediaItems.length > 0);

  return (
    <View style={styles.messageWrapper}>
      {/* Reply icon that appears when swiping */}
      <Animated.View
        style={[
          styles.replyIconContainer,
          {
            opacity: replyIconOpacity,
            transform: [
              { scale: replyIconScale },
              {
                translateX: swipeAnim.interpolate({
                  inputRange: [-100, 0],
                  outputRange: [-40, 0],
                }),
              },
            ],
            // Position the reply icon on the right side for both message types
            right: 0,
          },
        ]}
      >
        <View style={[styles.replyIcon, { backgroundColor: theme.primary }]}>
          <Ionicons name="arrow-undo" size={20} color="#FFFFFF" />
        </View>
      </Animated.View>

      {/* Swipeable message container */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer,
          {
            transform: [
              {
                translateX: swipeAnim,
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onLongPress={() => onLongPress && onLongPress(message)}
          onPress={() => {
            if (onPress) {
              onPress(message)
            } else if (!isMediaMessage) {
              // Only handle content press for non-media messages here
              // Media messages have their own TouchableOpacity with onPress
              if (message.contentType !== "text" && message.contentType !== "audio") {
                handleContentPress()
              }
            }
          }}
          style={{ width: "100%" }}
        >
          <View
            style={[
              styles.messageBubble,
              isOwnMessage
                ? [styles.ownMessageBubble, { backgroundColor: theme.primary }]
                : [styles.otherMessageBubble, { backgroundColor: theme.card }],
              message.failed && styles.failedMessage,
              isSelected && styles.selectedMessage,
              isMediaMessage && styles.mediaBubble, // Apply special styling for media messages
            ]}
          >
            {/* Reply preview */}
            {renderReplyPreview()}

            {/* Message content */}
            {renderMessageContent()}

            {/* Message timestamp and status */}
            <View style={styles.messageFooter}>
              <Text
                style={[
                  styles.timestamp,
                  {
                    color: isOwnMessage ? "rgba(255,255,255,0.7)" : theme.placeholder,
                  },
                ]}
              >
                {timestamp}
              </Text>

              {isOwnMessage && (
                <View style={styles.messageStatus}>
                  {message.failed ? (
                    <Ionicons name="alert-circle" size={14} color="#FF3B30" />
                  ) : message.isOptimistic ? (
                    <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.7)" />
                  ) : message.readBy && message.readBy.length > 0 ? (
                    <Ionicons name="checkmark-done" size={14} color="#34C759" />
                  ) : message.deliveredTo && message.deliveredTo.length > 0 ? (
                    <Ionicons name="checkmark-done" size={14} color="rgba(255,255,255,0.7)" />
                  ) : (
                    <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.7)" />
                  )}
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>

        {/* Message options */}
        {showOptions && (
          <View
            style={[
              styles.optionsContainer,
              isOwnMessage ? styles.ownOptionsContainer : styles.otherOptionsContainer,
              { backgroundColor: theme.card },
            ]}
          >
            <TouchableOpacity style={styles.option} onPress={handleReply}>
              <Ionicons name="arrow-undo" size={20} color={theme.primary} />
              <Text style={[styles.optionText, { color: theme.text }]}>Reply</Text>
            </TouchableOpacity>

            {onForward && (
              <TouchableOpacity style={styles.option} onPress={handleForward}>
                <Ionicons name="arrow-redo" size={20} color={theme.primary} />
                <Text style={[styles.optionText, { color: theme.text }]}>Forward</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.option} onPress={handleDelete}>
              <Ionicons name="trash" size={20} color="#FF3B30" />
              <Text style={[styles.optionText, { color: "#FF3B30" }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
      {/* Media Viewer */}
      <MediaViewer
        visible={mediaViewerVisible}
        mediaItems={mediaViewerItems}
        initialIndex={mediaViewerIndex}
        onClose={() => setMediaViewerVisible(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  messageWrapper: {
    position: "relative",
    width: "100%",
    marginVertical: 4,
    alignItems: "center",
  },
  messageContainer: {
    maxWidth: "80%",
    zIndex: 1,
  },
  ownMessageContainer: {
    alignSelf: "flex-end",
  },
  otherMessageContainer: {
    alignSelf: "flex-start",
  },
  messageBubble: {
    borderRadius: 12,
    padding: 8,
    maxWidth: "100%",
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.1)",
  },
  mediaBubble: {
    padding: 3, // Reduced padding specifically for media messages
    overflow: "hidden",
  },
  ownMessageBubble: {
    borderBottomRightRadius: 4,
    borderColor: "rgba(255,255,255,0.1)",
  },
  otherMessageBubble: {
    borderBottomLeftRadius: 4,
  },
  failedMessage: {
    borderWidth: 1,
    borderColor: "#FF3B30",
  },
  messageText: {
    fontSize: 16,
    padding: 4, // Add padding inside text messages
  },
  messageFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 4,
    paddingHorizontal: 4, // Add horizontal padding to footer
  },
  timestamp: {
    fontSize: 12,
    marginRight: 4,
  },
  messageStatus: {
    marginLeft: 2,
  },
  optionsContainer: {
    position: "absolute",
    top: -50,
    borderRadius: 8,
    padding: 8,
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  ownOptionsContainer: {
    right: 0,
  },
  otherOptionsContainer: {
    left: 0,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  optionText: {
    marginLeft: 4,
    fontSize: 14,
  },
  replyPreview: {
    padding: 8,
    borderLeftWidth: 4,
    borderRadius: 4,
    marginBottom: 8,
  },
  replyName: {
    fontWeight: "bold",
    fontSize: 13,
  },
  replyText: {
    fontSize: 12,
  },
  imageContainer: {
    borderRadius: 8,
    overflow: "hidden",
    maxWidth: 250,
    maxHeight: 250,
    backgroundColor: "#f0f0f0",
  },
  mediaContentContainer: {
    borderRadius: 8,
    overflow: "hidden",
    maxWidth: 250,
    backgroundColor: "transparent",
  },
  imageLoadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  imageErrorContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  messageImage: {
    width: "100%",
    height: "auto",
    aspectRatio: 1,
    minHeight: 150, // Ensure a minimum height
    minWidth: 150, // Ensure a minimum width
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  uploadingText: {
    color: "#FFFFFF",
    fontSize: 14,
    marginTop: 8,
  },
  documentContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 8,
    width: 240,
  },
  documentIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    fontWeight: "500",
    flexWrap: "wrap",
  },
  documentSize: {
    fontSize: 12,
    marginTop: 2,
  },
  downloadButton: {
    marginTop: 5,
    alignSelf: "flex-start",
  },
  downloadIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  downloadingContainer: {
    marginTop: 5,
    width: "100%",
  },
  downloadingText: {
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 2,
    overflow: "hidden",
    width: "100%",
  },
  progressBar: {
    height: "100%",
    borderRadius: 2,
  },
  audioContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: 200,
    padding: 8,
    borderRadius: 8,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  audioWaveformContainer: {
    flex: 1,
    height: 30,
    marginHorizontal: 8,
    position: "relative",
  },
  audioProgress: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: 3,
  },
  waveform: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: "100%",
  },
  waveformBar: {
    width: 3,
    borderRadius: 1.5,
  },
  audioDuration: {
    fontSize: 12,
    marginLeft: 4,
  },
  videoContainer: {
    maxWidth: 250,
    borderRadius: 8,
    overflow: "hidden",
  },
  videoThumbnail: {
    aspectRatio: 16/9,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    minHeight: 150,
    minWidth: 200,
  },
  videoBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: "100%",
    height: "100%",
  },
  videoPlayButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  videoCaption: {
    padding: 8,
    fontSize: 14,
  },
  selectedMessage: {
    borderWidth: 2,
    borderColor: "#2196F3",
    opacity: 0.9,
  },
  replyIconContainer: {
    position: "absolute",
    top: "50%",
    marginTop: -15,
    zIndex: 0,
  },
  replyIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  documentIconWrapper: {
    position: "relative",
    width: 50,
    height: 50,
    marginRight: 10,
  },
  downloadIconOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    zIndex: 2,
  },
  downloadIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  progressCircleContainer: {
    position: "absolute",
    top: -5,
    left: -5,
    width: 60,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  progressBackground: {
    position: "absolute",
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  progressTextContainer: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  progressText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  mediaGridContainer: {
    width: 200,
    borderRadius: 8,
    overflow: "hidden",
  },
  multipleMediaIndicator: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  multipleMediaText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
    marginLeft: 2,
  },
})

export default MessageItem
