"use client"

import React, { useState, useEffect, useContext } from "react"
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  Share,
} from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import Ionicons from "react-native-vector-icons/Ionicons"
import { AuthContext } from "../../context/AuthContext"
import { ThemeContext } from "../../context/ThemeContext"
import { SocketContext } from "../../context/SocketContext" // Add this import
import { getTheme } from "../../utils/theme"
import * as UsersAPI from "../../api/users"
import * as ConversationsAPI from "../../api/conversations"
import { API_BASE_URL_FOR_MEDIA } from "../../config/api"

const UserProfileScreen = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const { userId, userName, userImage } = route.params
  const { state: authState } = useContext(AuthContext)
  const { theme } = useContext(ThemeContext)
  const { socket, isConnected, checkUserStatus } = useContext(SocketContext) // Add this line
  const currentTheme = getTheme(theme)

  const [userProfile, setUserProfile] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isUserOnline, setIsUserOnline] = useState(false) // Add this state

// Fetch user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        setIsLoading(true)
        const response = await UsersAPI.getUserProfile(userId, authState.token)

        if (response.success) {
          setUserProfile(response.user)
        } else {
          setError(response.error || "Failed to fetch user profile")
        }
      } catch (error) {
        console.error("Error in fetchUserProfile:", error)
        setError("An unexpected error occurred")
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserProfile()
  }, [userId, authState.token])

// Listen for online status changes
  useEffect(() => {
    if (socket && isConnected) {
      // Check if user is already online
      if (socket && typeof checkUserStatus === 'function') { // Ensure checkUserStatus is available
        checkUserStatus(userId)
      } else if (socket) { // Fallback if checkUserStatus is somehow not in context, though it should be
        socket.emit("check-user-status", { userId }) // Use the event name defined in SocketContext
      }

      // Listen for status changes
      const handleStatusChange = ({ userId: changedUserId, status }) => {
        if (changedUserId === userId) {
          setIsUserOnline(status === "online")
        }
      }

      socket.on("user-status-change", handleStatusChange)

      // Listen for initial status response
      socket.on("user-status", ({ userId: checkedUserId, status }) => {
        if (checkedUserId === userId) {
          setIsUserOnline(status === "online")
        }
      })

      return () => {
        socket.off("user-status-change", handleStatusChange)
        socket.off("user-status")
      }
    }
  }, [socket, isConnected, userId, checkUserStatus])

// Start a chat with this user
  const handleStartChat = async () => {
    try {
      // Check if conversation already exists
      const response = await ConversationsAPI.getOrCreateConversation(userId, authState.token)

      if (response.success) {
        navigation.navigate("Chat", { conversation: response.conversation })
      } else {
        Alert.alert("Error", response.error || "Failed to start chat")
      }
    } catch (error) {
      console.error("Error starting chat:", error)
      Alert.alert("Error", "An unexpected error occurred while starting chat")
    }
  }

// Start a voice call
  const handleVoiceCall = () => {
    if (userProfile) {
      navigation.navigate("Call", {
        recipient: {
          _id: userProfile._id,
          name: userProfile.name,
          profilePicture: userProfile.profilePicture,
        },
        isVideo: false,
      })
    }
  }

// Start a video call
  const handleVideoCall = () => {
    if (userProfile) {
      navigation.navigate("Call", {
        recipient: {
          _id: userProfile._id,
          name: userProfile.name,
          profilePicture: userProfile.profilePicture,
        },
        isVideo: true,
      })
    }
  }

// Share contact
  const handleShareContact = () => {
    if (userProfile) {
      Share.share({
        message: `${userProfile.name}\n${userProfile.phoneNumber}`,
        title: "Share Contact",
      }).catch((error) => console.log("Error sharing contact:", error))
    }
  }

// Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

// Loading state
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: currentTheme.background }]}>
        <ActivityIndicator size="large" color={currentTheme.primary} />
      </View>
    )
  }

// Error state
  if (error) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: currentTheme.background }]}>
        <Ionicons name="alert-circle" size={60} color={currentTheme.error} />
        <Text style={[styles.errorText, { color: currentTheme.text }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: currentTheme.primary }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: currentTheme.background }]}>
      {/* Profile Header */}
      <View style={[styles.profileHeader, { backgroundColor: currentTheme.card }]}>
        <View style={styles.profileImageContainer}>
          {userProfile?.profilePicture ? (
            <Image
              source={{ uri: `${API_BASE_URL_FOR_MEDIA}${userProfile.profilePicture}` }}
              style={styles.profileImage}
            />
          ) : (
            <View style={[styles.defaultProfileImage, { backgroundColor: currentTheme.primary }]}>
              <Text style={styles.defaultProfileImageText}>
                {userProfile?.name?.charAt(0).toUpperCase() || "U"}
              </Text>
            </View>
          )}

          {/* Online status indicator */}
          {isUserOnline && (
            <View style={styles.onlineIndicator} />
          )}
        </View>

        <Text style={[styles.userName, { color: currentTheme.text }]}>{userProfile?.name}</Text>
        <Text style={[styles.userPhone, { color: currentTheme.placeholder }]}>{userProfile?.phoneNumber}</Text>

        {/* Online status text */}
        <Text style={[styles.onlineStatus, { color: isUserOnline ? '#4CAF50' : currentTheme.placeholder }]}>
          {isUserOnline ? 'Online' : 'Offline'}
        </Text>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={handleStartChat}>
            <View style={[styles.actionIconContainer, { backgroundColor: currentTheme.primary }]}>
              <Ionicons name="chatbubble" size={22} color="#FFFFFF" />
            </View>
            <Text style={[styles.actionText, { color: currentTheme.text }]}>Message</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleVoiceCall}>
            <View style={[styles.actionIconContainer, { backgroundColor: currentTheme.primary }]}>
              <Ionicons name="call" size={22} color="#FFFFFF" />
            </View>
            <Text style={[styles.actionText, { color: currentTheme.text }]}>Audio</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleVideoCall}>
            <View style={[styles.actionIconContainer, { backgroundColor: currentTheme.primary }]}>
              <Ionicons name="videocam" size={22} color="#FFFFFF" />
            </View>
            <Text style={[styles.actionText, { color: currentTheme.text }]}>Video</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* About Section */}
      <View style={[styles.section, { backgroundColor: currentTheme.card }]}>
        <Text style={[styles.sectionTitle, { color: currentTheme.placeholder }]}>About</Text>
        <Text style={[styles.aboutText, { color: currentTheme.text }]}>{userProfile?.about}</Text>
      </View>


      {/* Additional Info */}
      <View style={[styles.section, { backgroundColor: currentTheme.card }]}>
        <Text style={[styles.sectionTitle, { color: currentTheme.placeholder }]}>Info</Text>

        <View style={styles.infoItem}>
          <Text style={[styles.infoLabel, { color: currentTheme.text }]}>Member since</Text>
          <Text style={[styles.infoValue, { color: currentTheme.placeholder }]}>
            {userProfile?.createdAt ? formatDate(userProfile.createdAt) : "Unknown"}
          </Text>
        </View>
      </View>

      {/* Actions Section */}
      <View style={[styles.section, { backgroundColor: currentTheme.card, marginBottom: 30 }]}>
        <TouchableOpacity style={styles.actionItem} onPress={handleShareContact}>
          <Ionicons name="share-social-outline" size={24} color={currentTheme.primary} />
          <Text style={[styles.actionItemText, { color: currentTheme.text }]}>Share contact</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => Linking.openURL(`tel:${userProfile?.phoneNumber}`)}
        >
          <Ionicons name="call-outline" size={24} color={currentTheme.primary} />
          <Text style={[styles.actionItemText, { color: currentTheme.text }]}>Call on phone</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 20,
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
  },
  profileHeader: {
    alignItems: "center",
    padding: 20,
    marginBottom: 10,
  },
  profileImageContainer: {
    marginBottom: 15,
    position: 'relative',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  defaultProfileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  defaultProfileImageText: {
    color: "#FFFFFF",
    fontSize: 50,
    fontWeight: "bold",
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4CAF50',
    borderWidth: 3,
    borderColor: 'white',
  },
  userName: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 5,
  },
  userPhone: {
    fontSize: 16,
    marginBottom: 5,
  },
  onlineStatus: {
    fontSize: 14,
    marginBottom: 15,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
  actionButton: {
    alignItems: "center",
  },
  actionIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 5,
  },
  actionText: {
    fontSize: 14,
  },
  section: {
    padding: 15,
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 10,
    textTransform: "uppercase",
  },
  aboutText: {
    fontSize: 16,
    lineHeight: 22,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: "500",
  },
  mediaPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
  },
  mediaPlaceholderText: {
    marginTop: 10,
    fontSize: 14,
  },
  infoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "#DDDDDD",
  },
  infoLabel: {
    fontSize: 16,
  },
  infoValue: {
    fontSize: 16,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: "#DDDDDD",
  },
  actionItemText: {
    fontSize: 16,
    marginLeft: 15,
  },
})

export default UserProfileScreen
