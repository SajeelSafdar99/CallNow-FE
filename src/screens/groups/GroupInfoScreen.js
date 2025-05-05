"use client"

import { useState, useEffect, useContext } from "react"
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  Modal,
  TextInput,
  Platform,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useNavigation, useRoute } from "@react-navigation/native"
import * as ImagePicker from "expo-image-picker"
import { AuthContext } from "../../context/AuthContext"
import * as ConversationsAPI from "../../api/conversations"
import { API_BASE_URL } from "../../config/api"

const GroupInfoScreen = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const { conversationId } = route.params
  const { state: authState } = useContext(AuthContext)

  const [groupInfo, setGroupInfo] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [showEditNameModal, setShowEditNameModal] = useState(false)
  const [showEditDescriptionModal, setShowEditDescriptionModal] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [newGroupDescription, setNewGroupDescription] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)

  // Fetch group info on mount
  useEffect(() => {
    fetchGroupInfo()
  }, [conversationId])

  // Fetch group info
  const fetchGroupInfo = async () => {
    try {
      setIsLoading(true)
      const response = await ConversationsAPI.getConversationDetails(conversationId, authState.token)

      if (response.success) {
        setGroupInfo(response.conversation)

        // Check if current user is admin
        const isUserAdmin = response.conversation.admins.includes(authState.user.id)
        setIsAdmin(isUserAdmin)

        // Check if group is muted
        const isGroupMuted = response.conversation.mutedBy?.includes(authState.user.id) || false
        setIsMuted(isGroupMuted)

        // Set initial values for edit modals
        setNewGroupName(response.conversation.groupName || "")
        setNewGroupDescription(response.conversation.description || "")
      } else {
        Alert.alert("Error", response.message || "Failed to load group information")
        navigation.goBack()
      }

      setIsLoading(false)
    } catch (error) {
      console.error("Error fetching group info:", error)
      setIsLoading(false)
      Alert.alert("Error", "Failed to load group information. Please try again.")
      navigation.goBack()
    }
  }

  // Change group image
  const changeGroupImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync()

      if (!permissionResult.granted) {
        Alert.alert("Permission Required", "You need to grant access to your photos to change the group image.")
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        uploadGroupImage(result.assets[0].uri)
      }
    } catch (error) {
      console.error("Error picking image:", error)
      Alert.alert("Error", "Failed to pick image. Please try again.")
    }
  }

  // Upload group image
  const uploadGroupImage = async (imageUri) => {
    try {
      setIsUpdating(true)

      const filename = imageUri.split("/").pop()
      const match = /\.(\w+)$/.exec(filename)
      const type = match ? `image/${match[1]}` : "image/jpeg"

      const formData = new FormData()
      formData.append("groupImage", {
        uri: Platform.OS === "android" ? imageUri : imageUri.replace("file://", ""),
        name: filename,
        type,
      })

      const response = await ConversationsAPI.updateGroupImage(conversationId, formData, authState.token)

      setIsUpdating(false)

      if (response.success) {
        // Update local state
        setGroupInfo((prev) => ({
          ...prev,
          groupImage: response.groupImage,
        }))

        Alert.alert("Success", "Group image updated successfully")
      } else {
        Alert.alert("Error", response.message || "Failed to update group image")
      }
    } catch (error) {
      console.error("Error uploading group image:", error)
      setIsUpdating(false)
      Alert.alert("Error", "Failed to update group image. Please try again.")
    }
  }

  // Update group name
  const updateGroupName = async () => {
    if (!newGroupName.trim()) {
      Alert.alert("Error", "Group name cannot be empty")
      return
    }

    try {
      setIsUpdating(true)

      const response = await ConversationsAPI.updateGroupInfo(
        conversationId,
        { groupName: newGroupName.trim() },
        authState.token,
      )

      setIsUpdating(false)

      if (response.success) {
        // Update local state
        setGroupInfo((prev) => ({
          ...prev,
          groupName: newGroupName.trim(),
        }))

        setShowEditNameModal(false)
        Alert.alert("Success", "Group name updated successfully")
      } else {
        Alert.alert("Error", response.message || "Failed to update group name")
      }
    } catch (error) {
      console.error("Error updating group name:", error)
      setIsUpdating(false)
      Alert.alert("Error", "Failed to update group name. Please try again.")
    }
  }

  // Update group description
  const updateGroupDescription = async () => {
    try {
      setIsUpdating(true)

      const response = await ConversationsAPI.updateGroupInfo(
        conversationId,
        { description: newGroupDescription.trim() },
        authState.token,
      )

      setIsUpdating(false)

      if (response.success) {
        // Update local state
        setGroupInfo((prev) => ({
          ...prev,
          description: newGroupDescription.trim(),
        }))

        setShowEditDescriptionModal(false)
        Alert.alert("Success", "Group description updated successfully")
      } else {
        Alert.alert("Error", response.message || "Failed to update group description")
      }
    } catch (error) {
      console.error("Error updating group description:", error)
      setIsUpdating(false)
      Alert.alert("Error", "Failed to update group description. Please try again.")
    }
  }

  // Toggle mute group
  const toggleMuteGroup = async () => {
    try {
      const response = await ConversationsAPI.toggleMuteGroup(conversationId, { muted: !isMuted }, authState.token)

      if (response.success) {
        // Update local state
        setIsMuted(!isMuted)

        // Update group info
        setGroupInfo((prev) => {
          let mutedBy = [...(prev.mutedBy || [])]

          if (!isMuted) {
            // Add user to mutedBy
            mutedBy.push(authState.user.id)
          } else {
            // Remove user from mutedBy
            mutedBy = mutedBy.filter((id) => id !== authState.user.id)
          }

          return {
            ...prev,
            mutedBy,
          }
        })
      } else {
        Alert.alert("Error", response.message || "Failed to update notification settings")
      }
    } catch (error) {
      console.error("Error toggling mute:", error)
      Alert.alert("Error", "Failed to update notification settings. Please try again.")
    }
  }

  // Leave group
  const leaveGroup = async () => {
    Alert.alert("Leave Group", "Are you sure you want to leave this group?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          try {
            const response = await ConversationsAPI.leaveGroup(conversationId, authState.token)

            if (response.success) {
              Alert.alert("Success", "You have left the group", [
                { text: "OK", onPress: () => navigation.navigate("Chats") },
              ])
            } else {
              Alert.alert("Error", response.message || "Failed to leave group")
            }
          } catch (error) {
            console.error("Error leaving group:", error)
            Alert.alert("Error", "Failed to leave group. Please try again.")
          }
        },
      },
    ])
  }

  // Add participants
  const addParticipants = () => {
    navigation.navigate("AddParticipants", { conversationId })
  }

  // Remove participant
  const removeParticipant = async (participantId) => {
    try {
      const response = await ConversationsAPI.removeParticipant(conversationId, { participantId }, authState.token)

      if (response.success) {
        // Update local state
        setGroupInfo((prev) => ({
          ...prev,
          participants: prev.participants.filter((p) => p._id !== participantId),
        }))

        Alert.alert("Success", "Participant removed successfully")
      } else {
        Alert.alert("Error", response.message || "Failed to remove participant")
      }
    } catch (error) {
      console.error("Error removing participant:", error)
      Alert.alert("Error", "Failed to remove participant. Please try again.")
    }
  }

  // Make admin
  const makeAdmin = async (participantId) => {
    try {
      const response = await ConversationsAPI.makeAdmin(conversationId, { participantId }, authState.token)

      if (response.success) {
        // Update local state
        setGroupInfo((prev) => ({
          ...prev,
          admins: [...prev.admins, participantId],
        }))

        Alert.alert("Success", "Admin privileges granted successfully")
      } else {
        Alert.alert("Error", response.message || "Failed to grant admin privileges")
      }
    } catch (error) {
      console.error("Error making admin:", error)
      Alert.alert("Error", "Failed to grant admin privileges. Please try again.")
    }
  }

  // Remove admin
  const removeAdmin = async (participantId) => {
    try {
      const response = await ConversationsAPI.removeAdmin(conversationId, { participantId }, authState.token)

      if (response.success) {
        // Update local state
        setGroupInfo((prev) => ({
          ...prev,
          admins: prev.admins.filter((id) => id !== participantId),
        }))

        Alert.alert("Success", "Admin privileges revoked successfully")
      } else {
        Alert.alert("Error", response.message || "Failed to revoke admin privileges")
      }
    } catch (error) {
      console.error("Error removing admin:", error)
      Alert.alert("Error", "Failed to revoke admin privileges. Please try again.")
    }
  }

  // Render participant options
  const showParticipantOptions = (participant) => {
    // Don't show options for current user
    if (participant._id === authState.user.id) return

    // Only admins can manage participants
    if (!isAdmin) return

    const isParticipantAdmin = groupInfo.admins.includes(participant._id)

    const options = [{ text: "Cancel", style: "cancel" }]

    // Add or remove admin option
    if (isParticipantAdmin) {
      options.push({
        text: "Remove as Admin",
        onPress: () => removeAdmin(participant._id),
      })
    } else {
      options.push({
        text: "Make Group Admin",
        onPress: () => makeAdmin(participant._id),
      })
    }

    // Remove from group option
    options.push({
      text: "Remove from Group",
      style: "destructive",
      onPress: () => removeParticipant(participant._id),
    })

    Alert.alert(participant.name, null, options)
  }

  // Render loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#128C7E" />
        <Text style={styles.loadingText}>Loading group information...</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      {/* Group Image and Name */}
      <View style={styles.headerSection}>
        <TouchableOpacity
          style={styles.groupImageContainer}
          onPress={isAdmin ? changeGroupImage : null}
          disabled={!isAdmin || isUpdating}
        >
          {isUpdating ? (
            <View style={styles.loadingImageContainer}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          ) : groupInfo.groupImage ? (
            <Image source={{ uri: `${API_BASE_URL}${groupInfo.groupImage}` }} style={styles.groupImage} />
          ) : (
            <View style={styles.defaultGroupImage}>
              <Ionicons name="people" size={50} color="#FFFFFF" />
            </View>
          )}

          {isAdmin && (
            <View style={styles.editImageIcon}>
              <Ionicons name="camera" size={20} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.groupNameContainer}>
          <Text style={styles.groupName}>{groupInfo.groupName}</Text>

          {isAdmin && (
            <TouchableOpacity style={styles.editButton} onPress={() => setShowEditNameModal(true)}>
              <Ionicons name="pencil" size={16} color="#128C7E" />
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.groupMeta}>Group · {groupInfo.participants.length} participants</Text>
      </View>

      {/* Group Description */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Description</Text>

          {isAdmin && (
            <TouchableOpacity style={styles.editButton} onPress={() => setShowEditDescriptionModal(true)}>
              <Ionicons name="pencil" size={16} color="#128C7E" />
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.descriptionText}>{groupInfo.description || "No description provided"}</Text>
      </View>

      {/* Group Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="notifications" size={24} color="#128C7E" style={styles.settingIcon} />
            <Text style={styles.settingText}>Mute Notifications</Text>
          </View>

          <Switch
            value={isMuted}
            onValueChange={toggleMuteGroup}
            trackColor={{ false: "#D1D1D1", true: "#25D366" }}
            thumbColor="#FFFFFF"
          />
        </View>

        <TouchableOpacity style={styles.settingItem} onPress={leaveGroup}>
          <View style={styles.settingInfo}>
            <Ionicons name="exit-outline" size={24} color="#FF3B30" style={styles.settingIcon} />
            <Text style={[styles.settingText, styles.leaveText]}>Leave Group</Text>
          </View>

          <Ionicons name="chevron-forward" size={20} color="#7F7F7F" />
        </TouchableOpacity>
      </View>

      {/* Participants */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{groupInfo.participants.length} Participants</Text>

          {isAdmin && (
            <TouchableOpacity style={styles.addParticipantButton} onPress={addParticipants}>
              <Ionicons name="person-add" size={20} color="#128C7E" />
              <Text style={styles.addParticipantText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>

        {groupInfo.participants.map((participant) => {
          const isParticipantAdmin = groupInfo.admins.includes(participant._id)
          const isCurrentUser = participant._id === authState.user.id

          return (
            <TouchableOpacity
              key={participant._id}
              style={styles.participantItem}
              onPress={() => showParticipantOptions(participant)}
              disabled={!isAdmin || isCurrentUser}
            >
              {participant.profilePicture ? (
                <Image
                  source={{ uri: `${API_BASE_URL}${participant.profilePicture}` }}
                  style={styles.participantImage}
                />
              ) : (
                <View style={styles.defaultParticipantImage}>
                  <Text style={styles.participantInitial}>{participant.name.charAt(0).toUpperCase()}</Text>
                </View>
              )}

              <View style={styles.participantInfo}>
                <View style={styles.participantNameContainer}>
                  <Text style={styles.participantName}>
                    {participant.name}
                    {isCurrentUser ? " (You)" : ""}
                  </Text>

                  {isParticipantAdmin && <Text style={styles.adminBadge}>Admin</Text>}
                </View>

                <Text style={styles.participantStatus}>{participant.about || "Hey there! I am using WhatsApp."}</Text>
              </View>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Edit Group Name Modal */}
      <Modal
        visible={showEditNameModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEditNameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Edit Group Name</Text>

            <TextInput
              style={styles.modalInput}
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholder="Group Name"
              maxLength={25}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setShowEditNameModal(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalPrimaryButton]}
                onPress={updateGroupName}
                disabled={isUpdating || !newGroupName.trim()}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalPrimaryButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Group Description Modal */}
      <Modal
        visible={showEditDescriptionModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEditDescriptionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Edit Group Description</Text>

            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              value={newGroupDescription}
              onChangeText={setNewGroupDescription}
              placeholder="Group Description"
              multiline
              maxLength={100}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setShowEditDescriptionModal(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalPrimaryButton]}
                onPress={updateGroupDescription}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalPrimaryButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    backgroundColor: "#FFFFFF",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#7F7F7F",
  },
  headerSection: {
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F2",
  },
  groupImageContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 15,
  },
  loadingImageContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  groupImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  defaultGroupImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#128C7E",
    justifyContent: "center",
    alignItems: "center",
  },
  editImageIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#128C7E",
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  groupNameContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  groupName: {
    fontSize: 22,
    fontWeight: "bold",
  },
  editButton: {
    marginLeft: 10,
    padding: 5,
  },
  groupMeta: {
    fontSize: 14,
    color: "#7F7F7F",
    marginTop: 5,
  },
  section: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F2",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
  },
  descriptionText: {
    fontSize: 15,
    color: "#333333",
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
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
  leaveText: {
    color: "#FF3B30",
  },
  addParticipantButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  addParticipantText: {
    color: "#128C7E",
    marginLeft: 5,
    fontWeight: "500",
  },
  participantItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  participantImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  defaultParticipantImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#128C7E",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  participantInitial: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  participantInfo: {
    flex: 1,
  },
  participantNameContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  participantName: {
    fontSize: 16,
    fontWeight: "500",
  },
  adminBadge: {
    fontSize: 12,
    color: "#128C7E",
    marginLeft: 10,
    fontWeight: "bold",
  },
  participantStatus: {
    fontSize: 14,
    color: "#7F7F7F",
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "80%",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    marginBottom: 15,
  },
  modalTextArea: {
    height: 100,
    textAlignVertical: "top",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  modalButton: {
    padding: 10,
    marginLeft: 10,
  },
  modalButtonText: {
    fontSize: 16,
    color: "#7F7F7F",
  },
  modalPrimaryButton: {
    backgroundColor: "#128C7E",
    borderRadius: 5,
    paddingHorizontal: 15,
  },
  modalPrimaryButtonText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "500",
  },
})

export default GroupInfoScreen
