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
} from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import { AuthContext } from "../../context/AuthContext"
import * as ProfileAPI from "../../api/profile"
import * as ConversationsAPI from "../../api/conversations"
import { API_BASE_URL } from "../../config/api"
import { Ionicon } from "../../components/ui/AppIcons"

const UserProfileScreen = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const { userId, userName, userImage } = route.params
  const { state: authState } = useContext(AuthContext)

  const [userProfile, setUserProfile] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isBlocked, setIsBlocked] = useState(false)

  // Fetch user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        setIsLoading(true)
        const response = await ProfileAPI.getUserProfile(userId, authState.token)
        if (response.success) {
          setUserProfile(response.user)
          // Check if user is blocked
          setIsBlocked(response.user.isBlocked || false)
        }
      } catch (error) {
        console.error("Error fetching user profile:", error)
        Alert.alert("Error", "Failed to load user profile. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserProfile()
  }, [userId])

  // Start a chat with this user
  const handleStartChat = async () => {
    try {
      const response = await ConversationsAPI.getOrCreateConversation(userId, authState.token)
      if (response.success) {
        navigation.navigate("Chat", { conversation: response.conversation })
      }
    } catch (error) {
      console.error("Error starting chat:", error)
      Alert.alert("Error", "Failed to start chat. Please try again.")
    }
  }

  // Make a voice call
  const handleVoiceCall = () => {
    navigation.navigate("Call", {
      recipient: {
        _id: userId,
        name: userProfile?.name || userName,
        profilePicture: userProfile?.profilePicture || userImage,
      },
      isVideo: false,
    })
  }

  // Make a video call
  const handleVideoCall = () => {
    navigation.navigate("Call", {
      recipient: {
        _id: userId,
        name: userProfile?.name || userName,
        profilePicture: userProfile?.profilePicture || userImage,
      },
      isVideo: true,
    })
  }

  // Block/unblock user
  const handleBlockUser = async () => {
    try {
      // This would be implemented in your API
      // For now, just toggle the state
      setIsBlocked(!isBlocked)
      Alert.alert(
        isBlocked ? "User Unblocked" : "User Blocked",
        isBlocked ? "You have unblocked this user." : "You have blocked this user."
      )
    } catch (error) {
      console.error("Error blocking/unblocking user:", error)
      Alert.alert("Error", "Failed to update block status. Please try again.")
    }
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#128C7E" />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <Image
          source={
            userProfile?.profilePicture
              ? { uri: `${API_BASE_URL}${userProfile.profilePicture}` }
              : require("../../assets/images/default-avatar.png")
          }
          style={styles.profileImage}
        />
        <Text style={styles.userName}>{userProfile?.name || userName}</Text>
        <Text style={styles.userStatus}>{userProfile?.status || "Hey there! I'm using CallNow"}</Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.actionButton} onPress={handleStartChat}>
          <View style={[styles.actionIcon, { backgroundColor: "#128C7E" }]}>
            <Ionicon name="chatbubble" size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.actionText}>Chat</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleVoiceCall}>
          <View style={[styles.actionIcon, { backgroundColor: "#4CAF50" }]}>
            <Ionicon name="call" size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.actionText}>Voice Call</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleVideoCall}>
          <View style={[styles.actionIcon, { backgroundColor: "#2196F3" }]}>
            <Ionicon name="videocam" size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.actionText}>Video Call</Text>
        </TouchableOpacity>
      </View>

      {/* User Info */}
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Info</Text>

        {userProfile?.phone && (
          <View style={styles.infoItem}>
            <Ionicon name="call-outline" size={20} color="#128C7E" style={styles.infoIcon} />
            <Text style={styles.infoText}>{userProfile.phone}</Text>
          </View>
        )}

        {userProfile?.email && (
          <View style={styles.infoItem}>
            <Ionicon name="mail-outline" size={20} color="#128C7E" style={styles.infoIcon} />
            <Text style={styles.infoText}>{userProfile.email}</Text>
          </View>
        )}

        {userProfile?.bio && (
          <View style={styles.infoItem}>
            <Ionicon name="information-circle-outline" size={20} color="#128C7E" style={styles.infoIcon} />
            <Text style={styles.infoText}>{userProfile.bio}</Text>
          </View>
        )}
      </View>

      {/* Media Shared */}
      <View style={styles.mediaSection}>
        <Text style={styles.sectionTitle}>Media, Links and Docs</Text>
        <TouchableOpacity style={styles.viewAllButton}>
          <Text style={styles.viewAllText}>View All</Text>
          <Ionicon name="chevron-forward" size={20} color="#128C7E" />
        </TouchableOpacity>

        <View style={styles.mediaPreview}>
          <Text style={styles.emptyMediaText}>No media shared yet</Text>
        </View>
      </View>

      {/* Block User */}
      <TouchableOpacity style={styles.blockButton} onPress={handleBlockUser}>
        <Ionicon name={isBlocked ? "lock-open" : "lock-closed"} size={20} color="#FF6B6B" style={styles.blockIcon} />
        <Text style={styles.blockText}>{isBlocked ? "Unblock User" : "Block User"}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: 30,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 15,
  },
  userName: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 5,
  },
  userStatus: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  actionButton: {
    alignItems: "center",
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  actionText: {
    fontSize: 14,
    color: "#333",
  },
  infoSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  infoIcon: {
    marginRight: 15,
  },
  infoText: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  mediaSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 15,
  },
  viewAllText: {
    fontSize: 14,
    color: "#128C7E",
    marginRight: 5,
  },
  mediaPreview: {
    height: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyMediaText: {
    fontSize: 14,
    color: "#999",
  },
  blockButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
  },
  blockIcon: {
    marginRight: 15,
  },
  blockText: {
    fontSize: 16,
    color: "#FF6B6B",
  },
})

export default UserProfileScreen
