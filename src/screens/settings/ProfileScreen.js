"use client"

import React, { useState, useEffect, useContext, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  RefreshControl,
} from "react-native"
import { useNavigation, useFocusEffect } from "@react-navigation/native"
import Ionicons from "react-native-vector-icons/Ionicons"
import ImagePicker from 'react-native-image-crop-picker'
import { AuthContext } from "../../context/AuthContext"
import { ThemeContext } from "../../context/ThemeContext"
import { getTheme } from "../../utils/theme"
import * as ProfileAPI from "../../api/profile"
import { API_BASE_URL_FOR_MEDIA } from "../../config/api"

const ProfileScreen = () => {
  const { state: authState, updateProfile, updateProfilePicture } = useContext(AuthContext)
  const { theme } = useContext(ThemeContext)
  const currentTheme = getTheme(theme)

  const [profileData, setProfileData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isChangingPicture, setIsChangingPicture] = useState(false)
  const [name, setName] = useState("")
  const [about, setAbout] = useState("")
  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditingAbout, setIsEditingAbout] = useState(false)
  const [showImagePreview, setShowImagePreview] = useState(false)
  const [showImageOptions, setShowImageOptions] = useState(false)
  const [imageKey, setImageKey] = useState(Date.now())
  const [refreshing, setRefreshing] = useState(false)

  // Fetch profile data function
  const fetchProfile = async () => {
    try {
      setIsLoading(true)
      const response = await ProfileAPI.getProfile(authState.token)

      if (response.success) {
        setProfileData(response.user)
        setName(response.user.name || "")
        setAbout(response.user.about || "")
      } else {
        Alert.alert("Error", response.error || "Failed to fetch profile")
      }
    } catch (error) {
      console.error("Error fetching profile:", error)
      Alert.alert("Error", "An unexpected error occurred")
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchProfile()
  }, [authState.token])

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchProfile()
      return () => {}
    }, [])
  )

  // Pull to refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchProfile()
  }, [])

  // Update profile
  const handleUpdateProfile = async (field) => {
    try {
      setIsUpdating(true)

      let updateData = {}
      if (field === "name") {
        if (!name.trim()) {
          Alert.alert("Error", "Name cannot be empty")
          setIsUpdating(false)
          return
        }
        updateData = { name: name.trim() }
      } else if (field === "about") {
        updateData = { about: about.trim() }
      }

      // Use the context function instead of direct API call
      const response = await updateProfile(updateData)

      if (response.success) {
        // Update local state
        setProfileData(prev => ({
          ...prev,
          ...updateData
        }))

        if (field === "name") {
          setIsEditingName(false)
        } else if (field === "about") {
          setIsEditingAbout(false)
        }

        Alert.alert("Success", response.message || "Profile updated successfully")
      } else {
        Alert.alert("Error", response.message || "Failed to update profile")
      }
    } catch (error) {
      console.error("Error updating profile:", error)
      Alert.alert("Error", "An unexpected error occurred")
    } finally {
      setIsUpdating(false)
    }
  }

  // Show image options
  const handleProfilePicturePress = () => {
    setShowImageOptions(true)
  }

  // Take photo with camera
  const handleTakePhoto = async () => {
    try {
      setShowImageOptions(false)

      const image = await ImagePicker.openCamera({
        width: 800,
        height: 800,
        cropping: true,
        cropperCircleOverlay: true,
        compressImageQuality: 0.8,
        mediaType: 'photo',
      })

      await processSelectedImage(image)
    } catch (error) {
      if (error.code !== 'E_PICKER_CANCELLED') {
        console.error("Error taking photo:", error)
        Alert.alert("Error", "Failed to take photo")
      }
    }
  }

  // Choose from gallery
  const handleChooseFromGallery = async () => {
    try {
      setShowImageOptions(false)

      const image = await ImagePicker.openPicker({
        width: 800,
        height: 800,
        cropping: true,
        cropperCircleOverlay: true,
        compressImageQuality: 0.8,
        mediaType: 'photo',
      })

      await processSelectedImage(image)
    } catch (error) {
      if (error.code !== 'E_PICKER_CANCELLED') {
        console.error("Error selecting image:", error)
        Alert.alert("Error", "Failed to select image")
      }
    }
  }

  // Process and upload selected image
  const processSelectedImage = async (image) => {
    try {
      setIsChangingPicture(true)

      // Create form data for image upload
      const formData = new FormData()
      formData.append('profilePicture', {
        uri: image.path,
        type: image.mime,
        name: `profile_${Date.now()}.${image.path.split('.').pop()}`,
      })

      // Use context function instead of direct API call
      const response = await updateProfilePicture(formData)

      if (response.success) {
        // Force image reload by updating the key
        setImageKey(Date.now())

        // Fetch fresh profile data to ensure we have the latest
        await fetchProfile()

        Alert.alert("Success", response.message || "Profile picture updated successfully")
      } else {
        Alert.alert("Error", response.message || "Failed to update profile picture")
      }
    } catch (error) {
      console.error("Error processing image:", error)
      Alert.alert("Error", "An unexpected error occurred")
    } finally {
      setIsChangingPicture(false)
    }
  }

  // Handle profile picture removal
  const handleRemoveProfilePicture = async () => {
    try {
      setShowImageOptions(false)

      Alert.alert(
        "Remove Profile Picture",
        "Are you sure you want to remove your profile picture?",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              setIsChangingPicture(true)

              // Send empty form data to remove profile picture
              const formData = new FormData()
              formData.append('removeProfilePicture', 'true')

              // Use context function instead of direct API call
              const response = await updateProfilePicture(formData)

              if (response.success) {
                // Update local state
                setProfileData(prev => ({
                  ...prev,
                  profilePicture: null
                }))

                // Force image reload by updating the key
                setImageKey(Date.now())

                Alert.alert("Success", "Profile picture removed")
              } else {
                Alert.alert("Error", response.message || "Failed to remove profile picture")
              }

              setIsChangingPicture(false)
            },
          },
        ]
      )
    } catch (error) {
      console.error("Error removing profile picture:", error)
      Alert.alert("Error", "An unexpected error occurred")
    }
  }

  // Loading state
  if (isLoading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: currentTheme.background }]}>
        <ActivityIndicator size="large" color={currentTheme.primary} />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: currentTheme.background }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[currentTheme.primary]}
            tintColor={currentTheme.primary}
          />
        }
      >
        {/* Profile Picture Section */}
        <View style={[styles.profileImageSection, { backgroundColor: currentTheme.card }]}>
          <View style={styles.profileImageContainer}>
            {isChangingPicture ? (
              <View style={[styles.loadingImageContainer, { backgroundColor: currentTheme.primary }]}>
                <ActivityIndicator size="large" color="#FFFFFF" />
              </View>
            ) : (
              <TouchableOpacity onPress={() => profileData?.profilePicture ? setShowImagePreview(true) : handleProfilePicturePress()}>
                {profileData?.profilePicture ? (
                  <Image
                    key={`profile-image-${imageKey}`}
                    source={{
                      uri: `${API_BASE_URL_FOR_MEDIA}${profileData.profilePicture}?t=${imageKey}`,
                      cache: 'reload'
                    }}
                    style={styles.profileImage}
                    onError={(e) => console.error("Image loading error:", e.nativeEvent.error)}
                  />
                ) : (
                  <View style={[styles.defaultProfileImage, { backgroundColor: currentTheme.primary }]}>
                    <Text style={styles.defaultProfileImageText}>
                      {profileData?.name?.charAt(0).toUpperCase() || "U"}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.changeImageButton, { backgroundColor: currentTheme.primary }]}
              onPress={handleProfilePicturePress}
              disabled={isChangingPicture}
            >
              <Ionicons name="camera" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {profileData?.profilePicture && (
            <TouchableOpacity
              style={styles.removeImageButton}
              onPress={handleRemoveProfilePicture}
            >
              <Text style={styles.removeImageText}>Remove Photo</Text>
            </TouchableOpacity>
          )}

          <Text style={[styles.phoneNumber, { color: currentTheme.placeholder }]}>
            {profileData?.phoneNumber}
          </Text>
        </View>

        {/* Profile Info Section */}
        <View style={[styles.infoSection, { backgroundColor: currentTheme.card }]}>
          <View style={styles.infoHeader}>
            <Ionicons name="person" size={22} color={currentTheme.primary} />
            <Text style={[styles.infoTitle, { color: currentTheme.text }]}>Your Name</Text>
          </View>

          {isEditingName ? (
            <View style={styles.editContainer}>
              <TextInput
                style={[styles.input, { color: currentTheme.text, borderBottomColor: currentTheme.border }]}
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                placeholderTextColor={currentTheme.placeholder}
                autoFocus
              />

              <View style={styles.editButtons}>
                <TouchableOpacity
                  style={[styles.editButton, { backgroundColor: currentTheme.primary }]}
                  onPress={() => handleUpdateProfile("name")}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.editButtonText}>Save</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.editButton, styles.cancelButton, { borderColor: currentTheme.border }]}
                  onPress={() => {
                    setIsEditingName(false)
                    setName(profileData?.name || "")
                  }}
                  disabled={isUpdating}
                >
                  <Text style={[styles.cancelButtonText, { color: currentTheme.text }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.infoContent}>
              <Text style={[styles.infoValue, { color: currentTheme.text }]}>
                {profileData?.name || "Not set"}
              </Text>

              <TouchableOpacity
                style={styles.editIconButton}
                onPress={() => setIsEditingName(true)}
              >
                <Ionicons name="pencil" size={20} color={currentTheme.primary} />
              </TouchableOpacity>
            </View>
          )}

          <Text style={[styles.infoDescription, { color: currentTheme.placeholder }]}>
            This name will be visible to your contacts
          </Text>
        </View>

        {/* About Section */}
        <View style={[styles.infoSection, { backgroundColor: currentTheme.card }]}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle" size={22} color={currentTheme.primary} />
            <Text style={[styles.infoTitle, { color: currentTheme.text }]}>About</Text>
          </View>

          {isEditingAbout ? (
            <View style={styles.editContainer}>
              <TextInput
                style={[
                  styles.input,
                  styles.aboutInput,
                  { color: currentTheme.text, borderBottomColor: currentTheme.border }
                ]}
                value={about}
                onChangeText={setAbout}
                placeholder="Enter about info"
                placeholderTextColor={currentTheme.placeholder}
                multiline
                numberOfLines={3}
                autoFocus
              />

              <View style={styles.editButtons}>
                <TouchableOpacity
                  style={[styles.editButton, { backgroundColor: currentTheme.primary }]}
                  onPress={() => handleUpdateProfile("about")}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.editButtonText}>Save</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.editButton, styles.cancelButton, { borderColor: currentTheme.border }]}
                  onPress={() => {
                    setIsEditingAbout(false)
                    setAbout(profileData?.about || "")
                  }}
                  disabled={isUpdating}
                >
                  <Text style={[styles.cancelButtonText, { color: currentTheme.text }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.infoContent}>
              <Text style={[styles.infoValue, { color: currentTheme.text }]}>
                {profileData?.about || "Not set"}
              </Text>

              <TouchableOpacity
                style={styles.editIconButton}
                onPress={() => setIsEditingAbout(true)}
              >
                <Ionicons name="pencil" size={20} color={currentTheme.primary} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Account Info Section */}
        <View style={[styles.infoSection, { backgroundColor: currentTheme.card }]}>
          <View style={styles.infoHeader}>
            <Ionicons name="calendar" size={22} color={currentTheme.primary} />
            <Text style={[styles.infoTitle, { color: currentTheme.text }]}>Account Info</Text>
          </View>

          <View style={styles.accountInfoItem}>
            <Text style={[styles.accountInfoLabel, { color: currentTheme.text }]}>Joined</Text>
            <Text style={[styles.accountInfoValue, { color: currentTheme.placeholder }]}>
              {profileData?.createdAt ? new Date(profileData.createdAt).toLocaleDateString() : "Unknown"}
            </Text>
          </View>

          <View style={styles.accountInfoItem}>
            <Text style={[styles.accountInfoLabel, { color: currentTheme.text }]}>Phone</Text>
            <Text style={[styles.accountInfoValue, { color: currentTheme.placeholder }]}>
              {profileData?.phoneNumber || "Not available"}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Image Preview Modal */}
      {profileData?.profilePicture && (
        <Modal
          visible={showImagePreview}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowImagePreview(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setShowImagePreview(false)}
          >
            <View style={styles.modalContent}>
              <Image
                key={`preview-image-${imageKey}`}
                source={{
                  uri: `${API_BASE_URL_FOR_MEDIA}${profileData.profilePicture}?t=${imageKey}`,
                  cache: 'reload'
                }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            </View>
          </Pressable>
        </Modal>
      )}

      {/* Image Options Modal */}
      <Modal
        visible={showImageOptions}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowImageOptions(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowImageOptions(false)}
        >
          <View style={[styles.optionsContainer, { backgroundColor: currentTheme.card }]}>
            <Text style={[styles.optionsTitle, { color: currentTheme.text }]}>
              Profile Picture
            </Text>

            <TouchableOpacity
              style={[styles.optionItem, { borderBottomColor: currentTheme.border }]}
              onPress={handleTakePhoto}
            >
              <Ionicons name="camera" size={24} color={currentTheme.primary} />
              <Text style={[styles.optionText, { color: currentTheme.text }]}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionItem, { borderBottomColor: currentTheme.border }]}
              onPress={handleChooseFromGallery}
            >
              <Ionicons name="image" size={24} color={currentTheme.primary} />
              <Text style={[styles.optionText, { color: currentTheme.text }]}>Choose from Gallery</Text>
            </TouchableOpacity>

            {profileData?.profilePicture && (
              <TouchableOpacity
                style={[styles.optionItem, { borderBottomColor: currentTheme.border }]}
                onPress={handleRemoveProfilePicture}
              >
                <Ionicons name="trash" size={24} color="#FF3B30" />
                <Text style={[styles.optionText, { color: "#FF3B30" }]}>Remove Current Photo</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.optionItem, styles.cancelOption]}
              onPress={() => setShowImageOptions(false)}
            >
              <Text style={[styles.cancelOptionText, { color: currentTheme.primary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
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
  profileImageSection: {
    alignItems: "center",
    padding: 20,
    marginBottom: 15,
  },
  profileImageContainer: {
    position: "relative",
    marginBottom: 15,
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
  loadingImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  changeImageButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  removeImageButton: {
    marginTop: 10,
  },
  removeImageText: {
    color: "#FF3B30",
    fontSize: 14,
  },
  phoneNumber: {
    fontSize: 16,
  },
  infoSection: {
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 10,
    padding: 15,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 10,
  },
  infoContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoValue: {
    fontSize: 16,
    flex: 1,
  },
  infoDescription: {
    fontSize: 12,
    marginTop: 5,
  },
  editIconButton: {
    padding: 5,
  },
  editContainer: {
    width: "100%",
  },
  input: {
    fontSize: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    marginBottom: 10,
  },
  aboutInput: {
    minHeight: 60,
    textAlignVertical: "top",
  },
  editButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  editButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
    marginLeft: 10,
    minWidth: 80,
    alignItems: "center",
  },
  cancelButton: {
    borderWidth: 1,
  },
  editButtonText: {
    color: "#FFFFFF",
    fontWeight: "500",
  },
  cancelButtonText: {
    fontWeight: "500",
  },
  accountInfoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "#DDDDDD",
  },
  accountInfoLabel: {
    fontSize: 16,
  },
  accountInfoValue: {
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    height: '70%',
    backgroundColor: 'transparent',
    borderRadius: 10,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  optionsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    padding: 20,
  },
  optionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 0.5,
  },
  optionText: {
    fontSize: 16,
    marginLeft: 15,
  },
  cancelOption: {
    justifyContent: 'center',
    marginTop: 10,
    borderBottomWidth: 0,
  },
  cancelOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
})

export default ProfileScreen
