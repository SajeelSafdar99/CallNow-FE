"use client"

import { useState, useContext, useEffect } from "react"
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native"
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as ImagePicker from "expo-image-picker"
import { useNavigation } from "@react-navigation/native"
import { AuthContext } from "../../context/AuthContext"
import * as ProfileAPI from "../../api/profile"
import { API_BASE_URL } from "../../config/api"

const ProfileScreen = () => {
  const navigation = useNavigation()
  const { state: authState, dispatch } = useContext(AuthContext)

  const [user, setUser] = useState(authState.user || {})
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(user.name || "")
  const [status, setStatus] = useState(user.status || "Hey there! I'm using WhatsApp")
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [notifications, setNotifications] = useState(true)
  const [readReceipts, setReadReceipts] = useState(true)

  // Fetch user profile
  const fetchUserProfile = async () => {
    try {
      setIsLoading(true)
      const response = await ProfileAPI.getUserProfile(authState.token)
      if (response.success) {
        setUser(response.user)
        setName(response.user.name)
        setStatus(response.user.status || "Hey there! I'm using WhatsApp")

        // Update auth context with latest user data
        dispatch({
          type: "UPDATE_USER",
          payload: response.user,
        })
      }
    } catch (error) {
      console.error("Error fetching profile:", error)
      Alert.alert("Error", "Failed to load profile")
    } finally {
      setIsLoading(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchUserProfile()
  }, [])

  // Update profile
  const handleUpdateProfile = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Name cannot be empty")
      return
    }

    try {
      setIsLoading(true)
      const response = await ProfileAPI.updateProfile(
        {
          name,
          status,
        },
        authState.token,
      )

      if (response.success) {
        setUser(response.user)
        setIsEditing(false)

        // Update auth context with latest user data
        dispatch({
          type: "UPDATE_USER",
          payload: response.user,
        })

        Alert.alert("Success", "Profile updated successfully")
      } else {
        Alert.alert("Error", "Failed to update profile")
      }
    } catch (error) {
      console.error("Error updating profile:", error)
      Alert.alert("Error", "Failed to update profile")
    } finally {
      setIsLoading(false)
    }
  }

  // Pick and upload profile image
  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync()

      if (!permissionResult.granted) {
        Alert.alert("Permission Required", "You need to grant permission to access your photos")
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        uploadProfileImage(result.assets[0].uri)
      }
    } catch (error) {
      console.error("Error picking image:", error)
      Alert.alert("Error", "Failed to pick image")
    }
  }

  // Upload profile image
  const uploadProfileImage = async (imageUri) => {
    try {
      setIsUploading(true)

      // Create form data
      const formData = new FormData()
      const filename = imageUri.split("/").pop()
      const match = /\.(\w+)$/.exec(filename)
      const type = match ? `image/${match[1]}` : "image"

      formData.append("profilePicture", {
        uri: imageUri,
        name: filename,
        type,
      })

      const response = await ProfileAPI.updateProfilePicture(formData, authState.token)

      if (response.success) {
        setUser(response.user)

        // Update auth context with latest user data
        dispatch({
          type: "UPDATE_USER",
          payload: response.user,
        })

        Alert.alert("Success", "Profile picture updated successfully")
      } else {
        Alert.alert("Error", "Failed to update profile picture")
      }
    } catch (error) {
      console.error("Error uploading image:", error)
      Alert.alert("Error", "Failed to upload profile picture")
    } finally {
      setIsUploading(false)
    }
  }

  // Handle logout
  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => {
          dispatch({ type: "LOGOUT" })
        },
      },
    ])
  }

  return (
    <View style={styles.container}>
      {(isLoading || isUploading) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#128C7E" />
        </View>
      )}

      <ScrollView>
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={handlePickImage} disabled={isUploading}>
            {user.profilePicture ? (
              <Image source={{ uri: `${API_BASE_URL}${user.profilePicture}` }} style={styles.profileImage} />
            ) : (
              <View style={[styles.profileImage, styles.defaultProfileImage]}>
                <Text style={styles.profileImageText}>{name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.cameraIconContainer}>
              <Ionicons name="camera" size={20} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          {isEditing ? (
            <View style={styles.editContainer}>
              <TextInput style={styles.nameInput} value={name} onChangeText={setName} placeholder="Your name" />
              <TextInput
                style={styles.statusInput}
                value={status}
                onChangeText={setStatus}
                placeholder="Status"
                multiline
              />
              <View style={styles.editButtons}>
                <TouchableOpacity
                  style={[styles.editButton, styles.cancelButton]}
                  onPress={() => {
                    setName(user.name)
                    setStatus(user.status || "Hey there! I'm using WhatsApp")
                    setIsEditing(false)
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.editButton, styles.saveButton]} onPress={handleUpdateProfile}>
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user.name}</Text>
              <Text style={styles.profileStatus}>{user.status || "Hey there! I'm using WhatsApp"}</Text>
              <Text style={styles.profilePhone}>{user.phoneNumber}</Text>
              <TouchableOpacity style={styles.editProfileButton} onPress={() => setIsEditing(true)}>
                <Text style={styles.editProfileButtonText}>Edit Profile</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Settings</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="moon-outline" size={24} color="#666" style={styles.settingIcon} />
              <Text style={styles.settingText}>Dark Mode</Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: "#D9D9D9", true: "#25D366" }}
              thumbColor={darkMode ? "#FFFFFF" : "#FFFFFF"}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="notifications-outline" size={24} color="#666" style={styles.settingIcon} />
              <Text style={styles.settingText}>Notifications</Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: "#D9D9D9", true: "#25D366" }}
              thumbColor={notifications ? "#FFFFFF" : "#FFFFFF"}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="checkmark-done-outline" size={24} color="#666" style={styles.settingIcon} />
              <Text style={styles.settingText}>Read Receipts</Text>
            </View>
            <Switch
              value={readReceipts}
              onValueChange={setReadReceipts}
              trackColor={{ false: "#D9D9D9", true: "#25D366" }}
              thumbColor={readReceipts ? "#FFFFFF" : "#FFFFFF"}
            />
          </View>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate("Privacy")}>
            <View style={styles.menuItemContent}>
              <Ionicons name="lock-closed-outline" size={24} color="#666" style={styles.menuIcon} />
              <Text style={styles.menuText}>Privacy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate("Help")}>
            <View style={styles.menuItemContent}>
              <Ionicons name="help-circle-outline" size={24} color="#666" style={styles.menuIcon} />
              <Text style={styles.menuText}>Help</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate("About")}>
            <View style={styles.menuItemContent}>
              <Ionicons name="information-circle-outline" size={24} color="#666" style={styles.menuIcon} />
              <Text style={styles.menuText}>About</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#FF3B30" style={styles.logoutIcon} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  profileHeader: {
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  defaultProfileImage: {
    backgroundColor: "#128C7E",
    justifyContent: "center",
    alignItems: "center",
  },
  profileImageText: {
    color: "#FFFFFF",
    fontSize: 50,
    fontWeight: "bold",
  },
  cameraIconContainer: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#128C7E",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  profileInfo: {
    alignItems: "center",
    marginTop: 15,
    width: "100%",
  },
  profileName: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 5,
  },
  profileStatus: {
    fontSize: 16,
    color: "#666",
    marginBottom: 5,
    textAlign: "center",
  },
  profilePhone: {
    fontSize: 16,
    color: "#666",
    marginBottom: 15,
  },
  editProfileButton: {
    backgroundColor: "#128C7E",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  editProfileButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  editContainer: {
    width: "100%",
    marginTop: 15,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 10,
  },
  statusInput: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
    minHeight: 80,
    textAlignVertical: "top",
  },
  editButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  editButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#128C7E",
  },
  cancelButtonText: {
    color: "#128C7E",
    fontWeight: "bold",
  },
  saveButton: {
    backgroundColor: "#128C7E",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  settingsSection: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#128C7E",
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  settingIcon: {
    marginRight: 15,
  },
  settingText: {
    fontSize: 16,
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  menuItemContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuIcon: {
    marginRight: 15,
  },
  menuText: {
    fontSize: 16,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    paddingVertical: 15,
  },
  logoutIcon: {
    marginRight: 15,
  },
  logoutText: {
    fontSize: 16,
    color: "#FF3B30",
    fontWeight: "bold",
  },
})

export default ProfileScreen
