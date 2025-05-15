"use client"

import React, { useState, useEffect, useContext } from "react"
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
  ScrollView,
} from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import Ionicons from "react-native-vector-icons/Ionicons"
import { AuthContext } from "../../context/AuthContext"
import { ThemeContext } from "../../context/ThemeContext"
import { getTheme } from "../../utils/theme"
import * as ConversationsAPI from "../../api/conversations"
import * as ContactsAPI from "../../api/contacts"
import { API_BASE_URL_FOR_MEDIA } from "../../config/api"
import { launchImageLibrary } from "react-native-image-picker"

const GroupDetailsScreen = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const { conversation } = route.params
  const { state: authState } = useContext(AuthContext)
  const { theme } = useContext(ThemeContext)
  const currentTheme = getTheme(theme)

  const [groupInfo, setGroupInfo] = useState(conversation)
  const [isLoading, setIsLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [newGroupName, setNewGroupName] = useState(conversation.groupName || "")
  const [newGroupDescription, setNewGroupDescription] = useState(conversation.groupDescription || "")
  const [showAddParticipantsModal, setShowAddParticipantsModal] = useState(false)
  const [contacts, setContacts] = useState([])
  const [filteredContacts, setFilteredContacts] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedContacts, setSelectedContacts] = useState([])
  const [isAddingParticipants, setIsAddingParticipants] = useState(false)
  const [isChangingImage, setIsChangingImage] = useState(false)

  // Check if current user is admin
  useEffect(() => {
    if (groupInfo && groupInfo.groupAdmin) {
      setIsAdmin(groupInfo.groupAdmin.toString() === authState.user.id)
    }
  }, [groupInfo, authState.user.id])

  // Fetch contacts for adding participants
  const fetchContacts = async () => {
    try {
      setIsLoading(true)
      const response = await ContactsAPI.getContacts(authState.token)

      if (response.success) {
        // Filter out contacts that are already in the group
        const existingParticipantIds = groupInfo.participants.map(p => p._id)
        const availableContacts = response.contacts.filter(
          contact => !existingParticipantIds.includes(contact.user._id)
        )

        setContacts(availableContacts)
        setFilteredContacts(availableContacts)
      } else {
        Alert.alert("Error", response.error || "Failed to fetch contacts")
      }
    } catch (error) {
      console.error("Error fetching contacts:", error)
      Alert.alert("Error", "An unexpected error occurred while fetching contacts")
    } finally {
      setIsLoading(false)
    }
  }

  // Filter contacts based on search query
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredContacts(contacts)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = contacts.filter(
        (contact) => {
          const name = contact.nickname || contact.user.name
          return name.toLowerCase().includes(query) ||
            (contact.user.phoneNumber && contact.user.phoneNumber.includes(query))
        }
      )
      setFilteredContacts(filtered)
    }
  }, [searchQuery, contacts])

  // Update group name
  const handleUpdateGroupName = async () => {
    if (!newGroupName.trim()) {
      Alert.alert("Error", "Group name cannot be empty")
      return
    }

    try {
      setIsLoading(true)
      const response = await ConversationsAPI.updateGroupInfo(
        groupInfo._id,
        { name: newGroupName.trim() },
        authState.token
      )

      if (response.success) {
        setGroupInfo(response.conversation)
        setIsEditingName(false)
        Alert.alert("Success", "Group name updated successfully")
      } else {
        Alert.alert("Error", response.error || "Failed to update group name")
      }
    } catch (error) {
      console.error("Error updating group name:", error)
      Alert.alert("Error", "An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  // Update group description
  const handleUpdateGroupDescription = async () => {
    try {
      setIsLoading(true)
      const response = await ConversationsAPI.updateGroupInfo(
        groupInfo._id,
        { description: newGroupDescription.trim() },
        authState.token
      )

      if (response.success) {
        setGroupInfo(response.conversation)
        setIsEditingDescription(false)
        Alert.alert("Success", "Group description updated successfully")
      } else {
        Alert.alert("Error", response.error || "Failed to update group description")
      }
    } catch (error) {
      console.error("Error updating group description:", error)
      Alert.alert("Error", "An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  // Change group image
  const handleChangeGroupImage = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        includeBase64: false,
      })

      if (result.didCancel) return

      if (result.errorCode) {
        Alert.alert("Error", result.errorMessage || "Failed to select image")
        return
      }

      if (result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0]

        setIsChangingImage(true)

        // Create form data for image upload
        const formData = new FormData()
        formData.append('groupImage', {
          uri: selectedImage.uri,
          type: selectedImage.type || 'image/jpeg',
          name: selectedImage.fileName || 'group_image.jpg',
        })

        const response = await ConversationsAPI.updateGroupImage(
          groupInfo._id,
          formData,
          authState.token
        )

        if (response.success) {
          setGroupInfo(response.conversation)
          Alert.alert("Success", "Group image updated successfully")
        } else {
          Alert.alert("Error", response.error || "Failed to update group image")
        }
      }
    } catch (error) {
      console.error("Error changing group image:", error)
      Alert.alert("Error", "An unexpected error occurred")
    } finally {
      setIsChangingImage(false)
    }
  }

  // Add participants to group
  const handleAddParticipants = async () => {
    if (selectedContacts.length === 0) {
      Alert.alert("Error", "Please select at least one contact")
      return
    }

    try {
      setIsAddingParticipants(true)

      // Extract participant IDs
      const participantIds = selectedContacts.map(contact => contact.user._id)

      const response = await ConversationsAPI.addParticipants(
        groupInfo._id,
        participantIds,
        authState.token
      )

      if (response.success) {
        setGroupInfo(response.conversation)
        setShowAddParticipantsModal(false)
        setSelectedContacts([])
        Alert.alert("Success", "Participants added successfully")
      } else {
        Alert.alert("Error", response.error || "Failed to add participants")
      }
    } catch (error) {
      console.error("Error adding participants:", error)
      Alert.alert("Error", "An unexpected error occurred")
    } finally {
      setIsAddingParticipants(false)
    }
  }

  // Remove participant from group
  const handleRemoveParticipant = (participant) => {
    // Don't allow removing yourself this way
    if (participant._id === authState.user.id) {
      Alert.alert("Info", "To leave the group, use the 'Leave Group' option at the bottom")
      return
    }

    Alert.alert(
      "Remove Participant",
      `Are you sure you want to remove ${participant.name} from the group?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true)
              const response = await ConversationsAPI.removeParticipant(
                groupInfo._id,
                participant._id,
                authState.token
              )

              if (response.success) {
                setGroupInfo(response.conversation)
                Alert.alert("Success", "Participant removed successfully")
              } else {
                Alert.alert("Error", response.error || "Failed to remove participant")
              }
            } catch (error) {
              console.error("Error removing participant:", error)
              Alert.alert("Error", "An unexpected error occurred")
            } finally {
              setIsLoading(false)
            }
          },
        },
      ],
      { cancelable: true }
    )
  }

  // Make participant an admin
  const handleMakeAdmin = (participant) => {
    Alert.alert(
      "Make Admin",
      `Are you sure you want to make ${participant.name} an admin? You will no longer be the admin.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Make Admin",
          onPress: async () => {
            try {
              setIsLoading(true)
              const response = await ConversationsAPI.makeAdmin(
                groupInfo._id,
                participant._id,
                authState.token
              )

              if (response.success) {
                setGroupInfo(response.conversation)
                setIsAdmin(false)
                Alert.alert("Success", `${participant.name} is now the admin`)
              } else {
                Alert.alert("Error", response.error || "Failed to change admin")
              }
            } catch (error) {
              console.error("Error making admin:", error)
              Alert.alert("Error", "An unexpected error occurred")
            } finally {
              setIsLoading(false)
            }
          },
        },
      ],
      { cancelable: true }
    )
  }

  // Leave group
  const handleLeaveGroup = () => {
    Alert.alert(
      "Leave Group",
      "Are you sure you want to leave this group?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true)
              const response = await ConversationsAPI.leaveGroup(
                groupInfo._id,
                authState.token
              )

              if (response.success) {
                Alert.alert("Success", "You have left the group")
                navigation.navigate("ChatsList")
              } else {
                Alert.alert("Error", response.error || "Failed to leave group")
              }
            } catch (error) {
              console.error("Error leaving group:", error)
              Alert.alert("Error", "An unexpected error occurred")
            } finally {
              setIsLoading(false)
            }
          },
        },
      ],
      { cancelable: true }
    )
  }

  // Toggle contact selection for adding to group
  const toggleContactSelection = (contact) => {
    if (selectedContacts.some(c => c._id === contact._id)) {
      setSelectedContacts(selectedContacts.filter(c => c._id !== contact._id))
    } else {
      setSelectedContacts([...selectedContacts, contact])
    }
  }

  // Render participant item
// Update the renderParticipantItem function
  const renderParticipantItem = ({ item }) => {
    const isParticipantAdmin = groupInfo.groupAdmin === item._id
    const isCurrentUser = item._id === authState.user.id

    return (
      <View style={[styles.participantItem, { backgroundColor: currentTheme.card }]}>
        <View style={styles.participantInfo}>
          {item.profilePicture ? (
            <Image
              source={{ uri: `${API_BASE_URL_FOR_MEDIA}${item.profilePicture}` }}
              style={styles.participantAvatar}
            />
          ) : (
            <View style={[styles.defaultAvatar, { backgroundColor: currentTheme.primary }]}>
              <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}

          <View style={styles.participantDetails}>
            <Text style={[styles.participantName, { color: currentTheme.text }]}>
              {item.name} {isCurrentUser ? "(You)" : ""}
            </Text>
            {isParticipantAdmin && (
              <Text style={[styles.adminBadge, { color: currentTheme.primary }]}>Admin</Text>
            )}
          </View>
        </View>

        {/* Show actions for all users except for the admin and current user */}
        {!isParticipantAdmin && !isCurrentUser && (
          <View style={styles.participantActions}>
            {isAdmin && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleMakeAdmin(item)}
              >
                <Text style={[styles.actionText, { color: currentTheme.primary }]}>Make Admin</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionButton, { marginLeft: 15 }]}
              onPress={() => {
                if (isAdmin) {
                  handleRemoveParticipant(item)
                } else {
                  Alert.alert("Admin Only", "Only group admins can remove participants from the group.")
                }
              }}
            >
              <Ionicons name="remove-circle-outline" size={24} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    )
  }
  // Render contact item for adding to group
  const renderContactItem = ({ item }) => {
    const contactName = item.nickname || item.user.name
    const isSelected = selectedContacts.some(c => c._id === item._id)

    return (
      <TouchableOpacity
        style={[
          styles.contactItem,
          {
            backgroundColor: isSelected ? `${currentTheme.primary}20` : currentTheme.card,
            borderBottomColor: currentTheme.border,
          },
        ]}
        onPress={() => toggleContactSelection(item)}
      >
        <View style={styles.contactInfo}>
          {item.user.profilePicture ? (
            <Image
              source={{ uri: `${API_BASE_URL_FOR_MEDIA}${item.user.profilePicture}` }}
              style={styles.contactAvatar}
            />
          ) : (
            <View style={[styles.defaultAvatar, { backgroundColor: currentTheme.primary }]}>
              <Text style={styles.avatarText}>{contactName.charAt(0).toUpperCase()}</Text>
            </View>
          )}

          <View style={styles.contactDetails}>
            <Text style={[styles.contactName, { color: currentTheme.text }]}>{contactName}</Text>
            <Text style={[styles.contactPhone, { color: currentTheme.placeholder }]}>
              {item.user.phoneNumber}
            </Text>
          </View>
        </View>

        <View style={styles.checkboxContainer}>
          {isSelected ? (
            <Ionicons name="checkmark-circle" size={24} color={currentTheme.primary} />
          ) : (
            <Ionicons name="ellipse-outline" size={24} color={currentTheme.placeholder} />
          )}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: currentTheme.background }]}>
      {/* Group Image */}
      <View style={styles.imageContainer}>
        {isChangingImage ? (
          <View style={[styles.loadingImageContainer, { backgroundColor: currentTheme.primary }]}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        ) : groupInfo.groupImage ? (
          <Image
            source={{ uri: `${API_BASE_URL_FOR_MEDIA}${groupInfo.groupImage}` }}
            style={styles.groupImage}
          />
        ) : (
          <View style={[styles.defaultGroupImage, { backgroundColor: currentTheme.primary }]}>
            <Ionicons name="people" size={60} color="#FFFFFF" />
          </View>
        )}

        {isAdmin && (
          <TouchableOpacity
            style={[styles.changeImageButton, { backgroundColor: currentTheme.primary }]}
            onPress={handleChangeGroupImage}
          >
            <Ionicons name="camera" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Group Name */}
      <View style={[styles.infoSection, { backgroundColor: currentTheme.card }]}>
        {isEditingName ? (
          <View style={styles.editNameContainer}>
            <TextInput
              style={[styles.nameInput, { color: currentTheme.text, borderBottomColor: currentTheme.border }]}
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholder="Group Name"
              placeholderTextColor={currentTheme.placeholder}
              autoFocus
            />
            <View style={styles.editButtons}>
              <TouchableOpacity
                style={[styles.editButton, { backgroundColor: currentTheme.primary }]}
                onPress={handleUpdateGroupName}
              >
                <Text style={styles.editButtonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editButton, styles.cancelButton, { borderColor: currentTheme.border }]}
                onPress={() => {
                  setIsEditingName(false)
                  setNewGroupName(groupInfo.groupName || "")
                }}
              >
                <Text style={[styles.cancelButtonText, { color: currentTheme.text }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.nameContainer}>
            <Text style={[styles.groupName, { color: currentTheme.text }]}>{groupInfo.groupName}</Text>
            {isAdmin && (
              <TouchableOpacity
                style={styles.editNameButton}
                onPress={() => setIsEditingName(true)}
              >
                <Ionicons name="pencil" size={20} color={currentTheme.primary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        <Text style={[styles.groupCreated, { color: currentTheme.placeholder }]}>
          Created on {new Date(groupInfo.createdAt).toLocaleDateString()}
        </Text>
      </View>

      {/* Group Description */}
      <View style={[styles.infoSection, { backgroundColor: currentTheme.card }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>Description</Text>
          {isAdmin && !isEditingDescription && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setIsEditingDescription(true)}
            >
              <Ionicons name="pencil" size={20} color={currentTheme.primary} />
            </TouchableOpacity>
          )}
        </View>

        {isEditingDescription ? (
          <View style={styles.editDescriptionContainer}>
            <TextInput
              style={[styles.descriptionInput, { color: currentTheme.text, backgroundColor: currentTheme.background }]}
              value={newGroupDescription}
              onChangeText={setNewGroupDescription}
              placeholder="Add a description"
              placeholderTextColor={currentTheme.placeholder}
              multiline
              numberOfLines={3}
              autoFocus
            />
            <View style={styles.editButtons}>
              <TouchableOpacity
                style={[styles.editButton, { backgroundColor: currentTheme.primary }]}
                onPress={handleUpdateGroupDescription}
              >
                <Text style={styles.editButtonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editButton, styles.cancelButton, { borderColor: currentTheme.border }]}
                onPress={() => {
                  setIsEditingDescription(false)
                  setNewGroupDescription(groupInfo.groupDescription || "")
                }}
              >
                <Text style={[styles.cancelButtonText, { color: currentTheme.text }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Text style={[styles.description, { color: currentTheme.text }]}>
            {groupInfo.groupDescription || "No description"}
          </Text>
        )}
      </View>

      {/* Participants */}
      <View style={[styles.infoSection, { backgroundColor: currentTheme.card }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>
            {groupInfo.participants.length} Participants
          </Text>
          {/* Show Add button for all users */}
          <TouchableOpacity
            style={styles.addParticipantButton}
            onPress={() => {
              if (isAdmin) {
                fetchContacts()
                setShowAddParticipantsModal(true)
              } else {
                Alert.alert("Admin Only", "Only group admins can add participants to the group.")
              }
            }}
          >
            <Ionicons name="person-add" size={20} color={currentTheme.primary} />
            <Text style={[styles.addParticipantText, { color: currentTheme.primary }]}>Add</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={groupInfo.participants}
          renderItem={renderParticipantItem}
          keyExtractor={(item) => item._id}
          scrollEnabled={false}
        />
      </View>

      {/* Leave Group Button */}
      <TouchableOpacity
        style={[styles.leaveButton, { borderColor: "#FF3B30" }]}
        onPress={handleLeaveGroup}
      >
        <Ionicons name="exit-outline" size={24} color="#FF3B30" />
        <Text style={styles.leaveButtonText}>Leave Group</Text>
      </TouchableOpacity>

      {/* Add Participants Modal */}
      <Modal
        visible={showAddParticipantsModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowAddParticipantsModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: currentTheme.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: currentTheme.card }]}>
            <TouchableOpacity
              onPress={() => {
                setShowAddParticipantsModal(false)
                setSelectedContacts([])
                setSearchQuery("")
              }}
            >
              <Ionicons name="arrow-back" size={24} color={currentTheme.primary} />
            </TouchableOpacity>

            <Text style={[styles.modalTitle, { color: currentTheme.text }]}>Add Participants</Text>

            <TouchableOpacity
              onPress={handleAddParticipants}
              disabled={selectedContacts.length === 0 || isAddingParticipants}
            >
              {isAddingParticipants ? (
                <ActivityIndicator size="small" color={currentTheme.primary} />
              ) : (
                <Text
                  style={[
                    styles.addButton,
                    {
                      color: currentTheme.primary,
                      opacity: selectedContacts.length === 0 ? 0.5 : 1
                    }
                  ]}
                >
                  Add
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Selected contacts */}
          {selectedContacts.length > 0 && (
            <ScrollView
              horizontal
              style={styles.selectedContactsContainer}
              contentContainerStyle={styles.selectedContactsContent}
              showsHorizontalScrollIndicator={false}
            >
              {selectedContacts.map(contact => {
                const contactName = contact.nickname || contact.user.name
                return (
                  <View
                    key={contact._id}
                    style={[styles.selectedContactChip, { backgroundColor: currentTheme.primary }]}
                  >
                    <Text style={styles.selectedContactName}>{contactName}</Text>
                    <TouchableOpacity
                      style={styles.removeContactButton}
                      onPress={() => toggleContactSelection(contact)}
                    >
                      <Ionicons name="close-circle" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                )
              })}
            </ScrollView>
          )}

          {/* Search bar */}
          <View style={[styles.searchContainer, { backgroundColor: currentTheme.card }]}>
            <Ionicons name="search" size={20} color={currentTheme.placeholder} />
            <TextInput
              style={[styles.searchInput, { color: currentTheme.text }]}
              placeholder="Search contacts..."
              placeholderTextColor={currentTheme.placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={20} color={currentTheme.placeholder} />
              </TouchableOpacity>
            )}
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={currentTheme.primary} />
            </View>
          ) : (
            <FlatList
              data={filteredContacts}
              renderItem={renderContactItem}
              keyExtractor={(item) => item._id}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: currentTheme.primary }]}>
                    {contacts.length === 0 ? "No contacts available" : "No matching contacts found"}
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </Modal>

      {/* Loading overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={currentTheme.primary} />
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  imageContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    position: "relative",
  },
  groupImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  defaultGroupImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  changeImageButton: {
    position: "absolute",
    bottom: 20,
    right: "35%",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  infoSection: {
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 10,
    padding: 15,
  },
  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
  },
  groupName: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
  },
  editNameButton: {
    marginLeft: 10,
    padding: 5,
  },
  groupCreated: {
    fontSize: 12,
    textAlign: "center",
  },
  editNameContainer: {
    width: "100%",
  },
  nameInput: {
    fontSize: 18,
    paddingVertical: 8,
    borderBottomWidth: 1,
    textAlign: "center",
    marginBottom: 10,
  },
  editButtons: {
    flexDirection: "row",
    justifyContent: "center",
  },
  editButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
    marginHorizontal: 5,
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
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  editDescriptionContainer: {
    width: "100%",
  },
  descriptionInput: {
    fontSize: 14,
    padding: 10,
    borderRadius: 5,
    textAlignVertical: "top",
    marginBottom: 10,
  },
  addParticipantButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  addParticipantText: {
    marginLeft: 5,
    fontWeight: "500",
  },
  participantItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "#DDDDDD",
  },
  participantInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  defaultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  participantDetails: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: "500",
  },
  adminBadge: {
    fontSize: 12,
    fontWeight: "bold",
  },
  participantActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    padding: 5,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "500",
  },
  leaveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 15,
    marginVertical: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  leaveButtonText: {
    color: "#FF3B30",
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 10,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 15,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  addButton: {
    fontSize: 16,
    fontWeight: "bold",
  },
  selectedContactsContainer: {
    maxHeight: 60,
    paddingHorizontal: 15,
    marginTop: 10,
  },
  selectedContactsContent: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  selectedContactChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedContactName: {
    color: "#FFFFFF",
    marginRight: 5,
  },
  removeContactButton: {
    padding: 2,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    marginHorizontal: 15,
    marginVertical: 10,
    borderRadius: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 15,
    borderBottomWidth: 0.5,
  },
  contactInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  contactDetails: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: "500",
  },
  contactPhone: {
    fontSize: 14,
  },
  checkboxContainer: {
    padding: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "500",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
})

export default GroupDetailsScreen
