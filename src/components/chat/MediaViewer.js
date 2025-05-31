"use client"

import { useState, useEffect, useRef } from "react"
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  FlatList,
  StatusBar,
  Text,
  BackHandler,
  SafeAreaView,
  Animated,
} from "react-native"
import Ionicons from "react-native-vector-icons/Ionicons"
import Video from "react-native-video"
import { PinchGestureHandler, PanGestureHandler, State, GestureHandlerRootView } from 'react-native-gesture-handler'
import { API_BASE_URL_FOR_MEDIA } from "../../config/api"

const { width, height } = Dimensions.get("window")

// Zoomable Image Component using React Native's built-in Animated API
const ZoomableImage = ({ source, style, onError, index, currentIndex }) => {
  // Animation values
  const scale = useRef(new Animated.Value(1)).current
  const translateX = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(0)).current

  // Last known values for calculations
  const lastScale = useRef(1)
  const lastTranslateX = useRef(0)
  const lastTranslateY = useRef(0)

  // Track if we're currently zoomed in
  const isZoomed = useRef(false)

  // Reset zoom when item is no longer visible
  useEffect(() => {
    if (index !== currentIndex && isZoomed.current) {
      // Reset zoom when navigating away
      lastScale.current = 1
      lastTranslateX.current = 0
      lastTranslateY.current = 0
      isZoomed.current = false

      scale.setValue(1)
      translateX.setValue(0)
      translateY.setValue(0)
    }
  }, [currentIndex, index])

  // Handle pinch gesture
  const onPinchGestureEvent = Animated.event(
    [{ nativeEvent: { scale: scale } }],
    { useNativeDriver: true }
  )

  // Handle pan gesture
  const onPanGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX, translationY: translateY } }],
    { useNativeDriver: true }
  )

  // Handle pinch state changes
  const onPinchHandlerStateChange = (event) => {
    // Prevent event propagation to FlatList
    event.stopPropagation && event.stopPropagation();

    if (event.nativeEvent.oldState === State.ACTIVE) {
      // Save the scale value when the gesture ends
      lastScale.current = lastScale.current * event.nativeEvent.scale

      // Clamp the scale between 1 and 3
      lastScale.current = Math.max(1, Math.min(lastScale.current, 3))

      // Update zoomed state
      isZoomed.current = lastScale.current > 1

      // Animate to the clamped value
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
      }).start()

      // If scale is back to 1, reset translation
      if (lastScale.current === 1) {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start()
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start()
        lastTranslateX.current = 0
        lastTranslateY.current = 0
      }
    }
  }

  // Handle pan state changes
  const onPanHandlerStateChange = (event) => {
    // Prevent event propagation to FlatList when zoomed
    if (isZoomed.current) {
      event.stopPropagation && event.stopPropagation();
    }

    if (event.nativeEvent.oldState === State.ACTIVE) {
      // Only allow panning when zoomed in
      if (lastScale.current > 1) {
        // Save the translation values
        lastTranslateX.current += event.nativeEvent.translationX
        lastTranslateY.current += event.nativeEvent.translationY

        // Calculate boundaries to prevent panning too far
        const maxTranslateX = (width * (lastScale.current - 1)) / 2
        const maxTranslateY = (height * (lastScale.current - 1)) / 2

        // Clamp the translation values
        lastTranslateX.current = Math.max(-maxTranslateX, Math.min(maxTranslateX, lastTranslateX.current))
        lastTranslateY.current = Math.max(-maxTranslateY, Math.min(maxTranslateY, lastTranslateY.current))

        // Reset the animated values for the next gesture
        translateX.setValue(0)
        translateY.setValue(0)

        // Animate to the clamped values
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start()
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start()
      }
    }
  }

  // Handle double tap to zoom in/out
  const handleDoubleTap = () => {
    if (lastScale.current > 1) {
      // Reset zoom
      lastScale.current = 1
      lastTranslateX.current = 0
      lastTranslateY.current = 0
      isZoomed.current = false

      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
      }).start()

      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start()

      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
      }).start()
    } else {
      // Zoom in to 2x
      lastScale.current = 2
      isZoomed.current = true

      Animated.spring(scale, {
        toValue: 2,
        useNativeDriver: true,
      }).start()
    }
  }

  // Last tap timestamp for double tap detection
  const lastTapRef = useRef(0)

  const handleTap = () => {
    const now = Date.now()
    const DOUBLE_TAP_DELAY = 300

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      handleDoubleTap()
    }

    lastTapRef.current = now
  }

  return (
    <PanGestureHandler
      onGestureEvent={onPanGestureEvent}
      onHandlerStateChange={onPanHandlerStateChange}
      enabled={lastScale.current > 1}
      // Higher min distance helps prevent accidental swipes
      minDist={10}
      // Higher activation distance helps distinguish from FlatList swipes
      activateAfterLongPress={200}
    >
      <Animated.View style={[style, { overflow: 'hidden' }]}>
        <PinchGestureHandler
          onGestureEvent={onPinchGestureEvent}
          onHandlerStateChange={onPinchHandlerStateChange}
          // Prevent simultaneous recognition with parent FlatList
          simultaneousHandlers={[]}
        >
          <Animated.View style={StyleSheet.absoluteFill}>
            <TouchableOpacity
              activeOpacity={1}
              onPress={handleTap}
              style={StyleSheet.absoluteFill}
            >
              <Animated.Image
                source={source}
                style={[
                  {
                    width: '100%',
                    height: '100%',
                  },
                  {
                    transform: [
                      { translateX: Animated.add(translateX, new Animated.Value(lastTranslateX.current)) },
                      { translateY: Animated.add(translateY, new Animated.Value(lastTranslateY.current)) },
                      { scale: Animated.multiply(scale, new Animated.Value(lastScale.current)) }
                    ]
                  }
                ]}
                resizeMode="contain"
                onError={onError}
              />
            </TouchableOpacity>
          </Animated.View>
        </PinchGestureHandler>
      </Animated.View>
    </PanGestureHandler>
  )
}

const MediaViewer = ({ visible, mediaItems, initialIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex || 0)
  const flatListRef = useRef(null)
  const videoRefs = useRef({})
  const [isZoomed, setIsZoomed] = useState(false)

  // Reset current index when initialIndex changes
  useEffect(() => {
    if (initialIndex !== undefined) {
      setCurrentIndex(initialIndex)
    }
  }, [initialIndex])

  // Handle Android back button - fixed implementation
  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (visible) {
        onClose()
        return true // Prevent default behavior
      }
      return false // Let default behavior happen
    })

    return () => backHandler.remove()
  }, [visible, onClose])

  // When the modal becomes invisible, stop all videos
  useEffect(() => {
    if (visible && flatListRef.current && initialIndex !== undefined && mediaItems?.length > 0) {
      // Use multiple attempts with increasing timeouts to ensure scrolling works
      const scrollAttempts = [50, 150, 300, 500];

      scrollAttempts.forEach(timeout => {
        setTimeout(() => {
          try {
            // Use scrollToOffset instead of scrollToIndex for more reliable positioning
            const offset = initialIndex * width;
            flatListRef.current.scrollToOffset({
              offset,
              animated: false,
            });
            setCurrentIndex(initialIndex);
          } catch (error) {
            console.error("Error scrolling at timeout", timeout, error);
          }
        }, timeout);
      });
    }
  }, [visible, initialIndex, mediaItems, width]);


  // Helper function to get the correct media URL
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

  // Navigate to previous media
  const goToPrevious = () => {
    if (currentIndex > 0 && flatListRef.current) {
      const newIndex = currentIndex - 1
      flatListRef.current.scrollToIndex({
        index: newIndex,
        animated: true,
        viewPosition: 0.5,
      })
      setCurrentIndex(newIndex)
    }
  }

  // Navigate to next media
  const goToNext = () => {
    if (currentIndex < mediaItems.length - 1 && flatListRef.current) {
      const newIndex = currentIndex + 1
      flatListRef.current.scrollToIndex({
        index: newIndex,
        animated: true,
        viewPosition: 0.5,
      })
      setCurrentIndex(newIndex)
    }
  }

  const handleMomentumScrollEnd = (event) => {
    if (isZoomed) return; // Don't change index when zoomed

    const newIndex = Math.round(event.nativeEvent.contentOffset.x / width)
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < mediaItems.length) {
      setCurrentIndex(newIndex)
    }
  }

  const renderMediaItem = ({ item, index }) => {
    const isVideo = item.contentType === "video"
    const mediaUrl = getMediaUrl(item.mediaUrl)

    console.log(`MediaViewer: Item ${index} URL:`, mediaUrl)

    if (!mediaUrl) {
      return (
        <View style={styles.mediaContainer}>
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={50} color="#FF3B30" />
            <Text style={styles.errorText}>Media URL not available</Text>
          </View>
        </View>
      )
    }

    return (
      <View style={styles.mediaContainer}>
        {isVideo ? (
          <Video
            ref={(ref) => {
              if (ref) {
                videoRefs.current[index] = ref
              }
            }}
            source={{ uri: mediaUrl }}
            style={styles.media}
            resizeMode="contain"
            controls={true}
            paused={index !== currentIndex}
            onError={(e) => console.error("Video error:", e)}
          />
        ) : (
          <ZoomableImage
            source={{ uri: mediaUrl }}
            style={styles.media}
            onError={(e) => console.error("Image error:", e)}
            index={index}
            currentIndex={currentIndex}
          />
        )}
      </View>
    )
  }

  // If no media items or not visible, don't render
  if (!visible || !mediaItems || mediaItems.length === 0) {
    return null
  }

  console.log("MediaViewer: Rendering with items:", mediaItems.length)

  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose}>
      <StatusBar backgroundColor="#000000" barStyle="light-content" />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={onClose}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.counterContainer}>
              <Text style={styles.counterText}>
                {currentIndex + 1} / {mediaItems.length}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <FlatList
            ref={flatListRef}
            data={mediaItems}
            renderItem={renderMediaItem}
            keyExtractor={(item, index) => `media-${index}`}
            horizontal
            pagingEnabled
            initialScrollIndex={initialIndex}
            onMomentumScrollEnd={handleMomentumScrollEnd}
            showsHorizontalScrollIndicator={false}
            scrollEnabled={!isZoomed} // Disable scrolling when zoomed
            getItemLayout={(data, index) => ({
              length: width,
              offset: width * index,
              index,
            })}
            onScrollToIndexFailed={(info) => {
              console.log("Scroll to index failed:", info)
              // Handle the failure by scrolling to the closest item
              setTimeout(() => {
                if (flatListRef.current) {
                  flatListRef.current.scrollToOffset({
                    offset: info.index * width,
                    animated: false,
                  })
                }
              }, 100)
            }}
            // Ensure the FlatList doesn't capture gestures when an image is zoomed
            scrollEventThrottle={16}
            directionalLockEnabled={true}
            disableIntervalMomentum={true}
            snapToInterval={width}
            snapToAlignment="center"
            decelerationRate="fast"
          />
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: "100%",
    zIndex: 10,
  },
  backButton: {
    padding: 8,
  },
  closeButton: {
    padding: 8,
  },
  mediaContainer: {
    width,
    height: height - 120, // Leave space for header and navigation
    justifyContent: "center",
    alignItems: "center",
  },
  media: {
    width: width,
    height: height * 0.8,
  },
  counterContainer: {
    alignItems: "center",
  },
  counterText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  errorText: {
    color: "#FFFFFF",
    marginTop: 10,
    fontSize: 16,
  },
  navigationContainer: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: -25, // Half of the button height
  },
  navButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
})

export default MediaViewer
