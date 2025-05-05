"use client"

import { useState, useEffect, useContext, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Share,
  Alert,
} from "react-native"
import { Video } from "expo-av"
import * as FileSystem from "expo-file-system"
import * as MediaLibrary from "expo-media-library"
import { Ionicons } from "@expo/vector-icons"
import { useNavigation, useRoute } from "@react-navigation/native"
import { ThemeContext } from "../../context/ThemeContext"
import { getTheme } from "../../utils/theme"
import { API_BASE_URL } from "../../config/api"

const { width, height } = Dimensions.get("window")

const MediaViewerScreen = () => {
  const route = useRoute()
  const navigation = useNavigation()
  const { theme } = useContext(ThemeContext)
  const currentTheme = getTheme(theme)
  const { mediaItem } = route.params

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showControls, setShowControls] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [isDownloading, setIsDownloading] = useState(false)

  const videoRef = useRef(null)
  const controlsTimeoutRef = useRef(null)

  // Determine media type and source
  const isVideo = mediaItem.contentType === "video"
  const isAudio = mediaItem.contentType === "audio"
  const isDocument = mediaItem.contentType === "document"
  const mediaSource = mediaItem.mediaUrl.startsWith("http")
    ? mediaItem.mediaUrl
    : `${API_BASE_URL}${mediaItem.mediaUrl}`

  // Auto-hide controls after a delay
  useEffect(() => {
    if (showControls && (isVideo || isAudio)) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [showControls, isVideo, isAudio])

  // Handle media loading
  const handleLoadStart = () => {
    setIsLoading(true)
    setError(null)
  }

  const handleLoadEnd = () => {
    setIsLoading(false)
  }

  const handleError = (err) => {
    setIsLoading(false)
    setError(err)
    Alert.alert("Error", "Failed to load media. Please try again.")
  }

  // Toggle video playback
  const togglePlayback = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pauseAsync()
      } else {
        videoRef.current.playAsync()
      }
      setIsPlaying(!isPlaying)
    }
  }

  // Toggle controls visibility
  const toggleControls = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    setShowControls(!showControls)
  }

  // Download media to device
  const downloadMedia = async () => {
    try {
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync()

      if (status !== "granted") {
        Alert.alert("Permission Required", "Please grant permission to save media to your device.")
        return
      }

      // Start downloading
      setIsDownloading(true)
      setDownloadProgress(0)

      // Create a unique filename
      const fileExtension = mediaItem.mediaUrl.split(".").pop()
      const fileName = `whatsapp_${Date.now()}.${fileExtension}`
      const fileUri = `${FileSystem.documentDirectory}${fileName}`

      // Download the file
      const downloadResumable = FileSystem.createDownloadResumable(mediaSource, fileUri, {}, (downloadProgress) => {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite
        setDownloadProgress(progress)
      })

      try {
        const { uri } = await downloadResumable.downloadAsync()

        // Save to media library
        if (isVideo || mediaItem.contentType === "image") {
          const asset = await MediaLibrary.createAssetAsync(uri)
          await MediaLibrary.createAlbumAsync("WhatsApp", asset, false)
        } else {
          // For documents and other files, they're already saved to the app's directory
        }

        Alert.alert("Success", "Media saved to your device")
      } catch (e) {
        console.error("Download error:", e)
        Alert.alert("Error", "Failed to download media")
      } finally {
        setIsDownloading(false)
      }
    } catch (error) {
      console.error("Media download error:", error)
      Alert.alert("Error", "An error occurred while saving media")
      setIsDownloading(false)
    }
  }

  // Share media
  const shareMedia = async () => {
    try {
      // For sharing, we need a local file
      if (mediaItem.mediaUrl.startsWith("http")) {
        // Download first if it's a remote URL
        setIsDownloading(true)
        const fileExtension = mediaItem.mediaUrl.split(".").pop()
        const fileName = `temp_${Date.now()}.${fileExtension}`
        const fileUri = `${FileSystem.cacheDirectory}${fileName}`

        const { uri } = await FileSystem.downloadAsync(mediaSource, fileUri)

        setIsDownloading(false)

        // Share the downloaded file
        await Share.share({
          url: uri,
          title: mediaItem.content || "Shared media from WhatsApp",
        })
      } else {
        // It's already a local file
        await Share.share({
          url: mediaSource,
          title: mediaItem.content || "Shared media from WhatsApp",
        })
      }
    } catch (error) {
      console.error("Share error:", error)
      Alert.alert("Error", "Failed to share media")
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <StatusBar hidden />

      {/* Header */}
      {showControls && (
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {mediaItem.content || (isVideo ? "Video" : isDocument ? "Document" : "Image")}
          </Text>
          <View style={{ width: 40 }} />
        </View>
      )}

      {/* Media Content */}
      <TouchableOpacity
        activeOpacity={isVideo || isAudio ? 0.9 : 1}
        style={styles.mediaContainer}
        onPress={isVideo || isAudio ? toggleControls : undefined}
      >
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={60} color="#F44336" />
            <Text style={styles.errorText}>Failed to load media</Text>
          </View>
        )}

        {isVideo ? (
          <Video
            ref={videoRef}
            source={{ uri: mediaSource }}
            style={styles.video}
            resizeMode="contain"
            shouldPlay={false}
            isLooping
            onPlaybackStatusUpdate={(status) => {
              setIsPlaying(status.isPlaying)
              if (status.isLoaded) {
                setIsLoading(false)
              }
            }}
            onLoadStart={handleLoadStart}
            onError={handleError}
            useNativeControls={false}
          />
        ) : isDocument ? (
          <View style={styles.documentContainer}>
            <Ionicons name="document" size={80} color={currentTheme.primary} />
            <Text style={[styles.documentName, { color: currentTheme.text }]}>{mediaItem.content || "Document"}</Text>
            <TouchableOpacity style={styles.documentButton} onPress={downloadMedia}>
              <Ionicons name="download" size={24} color="#FFFFFF" />
              <Text style={styles.documentButtonText}>Download</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Image
            source={{ uri: mediaSource }}
            style={styles.image}
            resizeMode="contain"
            onLoadStart={handleLoadStart}
            onLoad={handleLoadEnd}
            onError={handleError}
          />
        )}

        {/* Video Controls */}
        {isVideo && showControls && (
          <View style={styles.videoControls}>
            <TouchableOpacity style={styles.playButton} onPress={togglePlayback}>
              <Ionicons name={isPlaying ? "pause" : "play"} size={40} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>

      {/* Bottom Controls */}
      {showControls && (
        <View style={styles.bottomControls}>
          {isDownloading ? (
            <View style={styles.downloadProgressContainer}>
              <Text style={styles.downloadText}>Downloading... {Math.round(downloadProgress * 100)}%</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${downloadProgress * 100}%` }]} />
              </View>
            </View>
          ) : (
            <>
              <TouchableOpacity style={styles.controlButton} onPress={shareMedia}>
                <Ionicons name="share-outline" size={24} color="#FFFFFF" />
                <Text style={styles.controlText}>Share</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.controlButton} onPress={downloadMedia}>
                <Ionicons name="download-outline" size={24} color="#FFFFFF" />
                <Text style={styles.controlText}>Save</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  mediaContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width,
    height: height - 120,
  },
  video: {
    width,
    height: height - 120,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  errorContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: "#FFFFFF",
    fontSize: 16,
    marginTop: 10,
  },
  videoControls: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  bottomControls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  controlButton: {
    alignItems: "center",
  },
  controlText: {
    color: "#FFFFFF",
    marginTop: 5,
  },
  downloadProgressContainer: {
    width: "80%",
    alignItems: "center",
  },
  downloadText: {
    color: "#FFFFFF",
    marginBottom: 10,
  },
  progressBar: {
    width: "100%",
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 2,
  },
  progressFill: {
    height: 4,
    backgroundColor: "#128C7E",
    borderRadius: 2,
  },
  documentContainer: {
    alignItems: "center",
    padding: 20,
  },
  documentName: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 30,
    textAlign: "center",
  },
  documentButton: {
    flexDirection: "row",
    backgroundColor: "#128C7E",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: "center",
  },
  documentButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    marginLeft: 10,
  },
})

export default MediaViewerScreen
