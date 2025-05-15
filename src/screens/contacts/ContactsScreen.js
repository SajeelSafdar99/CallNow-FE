"use client"

import { useState, useEffect, useContext, useCallback } from "react"
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Modal,
  ScrollView,
} from "react-native"
import Ionicons from "react-native-vector-icons/Ionicons"
import { useNavigation, useFocusEffect } from "@react-navigation/native"
import { AuthContext } from "../../context/AuthContext"
import { ThemeContext } from "../../context/ThemeContext"
import { getTheme } from "../../utils/theme"
import * as ContactsAPI from "../../api/contacts"
import * as ConversationsAPI from "../../api/conversations"
import { API_BASE_URL_FOR_MEDIA } from "../../config/api"

const ContactsScreen = () => {
  const navigation = useNavigation()
  const { state: authState } = useContext(AuthContext)
  const { theme } = useContext(ThemeContext)
  const currentTheme = getTheme(theme)

  const [contacts, setContacts] = useState([])
  const [filteredContacts, setFilteredContacts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddContactModal, setShowAddContactModal] = useState(false)
  const [newContactName, setNewContactName] = useState("")
  const [newContactPhone, setNewContactPhone] = useState("")
  const [contactGroups, setContactGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState("")

  // Group chat creation states
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
  const [groupName, setGroupName] = useState("")
  const [groupDescription, setGroupDescription] = useState("")
  const [selectedContacts, setSelectedContacts] = useState([])
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)

  // Fetch contact groups
  const fetchContactGroups = async () => {
    try {
      const response = await ContactsAPI.getContactGroups(authState.token)
      if (response.success) {
        setContactGroups(response.groups)
      }
    } catch (error) {
      console.error("Error fetching contact groups:", error)
    }
  }

  // Fetch contacts
  const fetchContacts = async () => {
    try {
      setIsLoading(true)

      // Build query parameters
      let queryParams = {}
      if (selectedGroup) {
        queryParams.group = selectedGroup
      }

      const response = await ContactsAPI.getContacts(authState.token)
      if (response.success) {
        // Sort contacts alphabetically by name
        const sortedContacts = response.contacts.sort((a, b) => {
          const nameA = a.nickname || a.user.name
          const nameB = b.nickname || b.user.name
          return nameA.localeCompare(nameB)
        })
        setContacts(sortedContacts)
        setFilteredContacts(sortedContacts)
      } else {
        Alert.alert("Error", response.error || "Failed to fetch contacts")
      }
    } catch (error) {
      console.error("Error fetching contacts:", error)
      Alert.alert("Error", "An unexpected error occurred while fetching contacts")
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }

  // Initial fetch
  useFocusEffect(
    useCallback(() => {
      fetchContacts()
      fetchContactGroups()
    }, [selectedGroup]),
  )

  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true)
    fetchContacts()
    fetchContactGroups()
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

  // Start a chat with a contact
  const handleStartChat = async (contact) => {
    try {
      // Check if conversation already exists
      const response = await ConversationsAPI.getOrCreateConversation(contact.user._id, authState.token)

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

  // Add a new contact
  const handleAddContact = async () => {
    if (!newContactPhone.trim()) {
      Alert.alert("Error", "Please enter a phone number")
      return
    }

    try {
      // Check if user exists with this phone number
      const checkResponse = await ContactsAPI.checkUserExists(newContactPhone.trim(), authState.token)

      if (!checkResponse.success) {
        Alert.alert("Error", checkResponse.error || "Failed to check if user exists")
        return
      }

      if (!checkResponse.exists) {
        Alert.alert("User Not Found", "No user found with this phone number. Please invite them to join the app.")
        return
      }

      // If user is already in contacts
      if (checkResponse.isContact) {
        Alert.alert("Already Added", "This user is already in your contacts")
        return
      }

      // Add contact
      const contactData = {
        userId: checkResponse.user._id,
        nickname: newContactName.trim() || checkResponse.user.name,
      }

      const response = await ContactsAPI.addContact(contactData, authState.token)

      if (response.success) {
        setShowAddContactModal(false)
        setNewContactName("")
        setNewContactPhone("")
        fetchContacts()
        Alert.alert("Success", "Contact added successfully")
      } else {
        Alert.alert("Error", response.error || "Failed to add contact")
      }
    } catch (error) {
      console.error("Error adding contact:", error)
      Alert.alert("Error", "An unexpected error occurred while adding contact")
    }
  }

  // Delete a contact
  const handleDeleteContact = (contactId, contactName) => {
    Alert.alert(
      "Delete Contact",
      `Are you sure you want to delete ${contactName}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await ContactsAPI.deleteContact(contactId, authState.token)
              if (response.success) {
                fetchContacts()
                Alert.alert("Success", "Contact deleted successfully")
              } else {
                Alert.alert("Error", response.error || "Failed to delete contact")
              }
            } catch (error) {
              console.error("Error deleting contact:", error)
              Alert.alert("Error", "An unexpected error occurred while deleting contact")
            }
          },
        },
      ],
      { cancelable: true },
    )
  }

  // Toggle contact selection for group creation
  const toggleContactSelection = (contact) => {
    if (selectedContacts.some(c => c._id === contact._id)) {
      setSelectedContacts(selectedContacts.filter(c => c._id !== contact._id))
    } else {
      setSelectedContacts([...selectedContacts, contact])
    }
  }

  // Create a new group chat
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert("Error", "Please enter a group name")
      return
    }

    if (selectedContacts.length === 0) {
      Alert.alert("Error", "Please select at least one contact")
      return
    }

    try {
      setIsCreatingGroup(true)

      // Extract participant IDs
      const participantIds = selectedContacts.map(contact => contact.user._id)

      // Create group data
      const groupData = {
        name: groupName.trim(),
        participants: participantIds,
        description: groupDescription.trim()
      }

      const response = await ConversationsAPI.createGroupConversation(groupData, authState.token)

      if (response.success) {
        // Reset states
        setShowCreateGroupModal(false)
        setGroupName("")
        setGroupDescription("")
        setSelectedContacts([])

        // Navigate to the new group chat
        navigation.navigate("Chat", { conversation: response.conversation })
      } else {
        Alert.alert("Error", response.error || "Failed to create group")
      }
    } catch (error) {
      console.error("Error creating group:", error)
      Alert.alert("Error", "An unexpected error occurred while creating group")
    } finally {
      setIsCreatingGroup(false)
    }
  }

  // Render contact item
  const renderContactItem = ({ item }) => {
    const contactName = item.nickname || item.user.name

    return (
      <TouchableOpacity
        style={[
          styles.contactItem,
          {
            borderBottomColor: currentTheme.border,
            backgroundColor: currentTheme.card,
          },
        ]}
        onPress={() => navigation.navigate("ContactDetails", { contactId: item._id })}
        onLongPress={() => handleDeleteContact(item._id, contactName)}
      >
        <View style={styles.avatarContainer}>
          {item.user.profilePicture ? (
            <Image source={{ uri: `${API_BASE_URL_FOR_MEDIA}${item.user.profilePicture}` }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.defaultAvatar, { backgroundColor: currentTheme.primary }]}>
              <Text style={styles.avatarText}>{contactName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          {item.isFavorite && (
            <View style={[styles.favoriteIcon, { backgroundColor: currentTheme.primary }]}>
              <Ionicons name="star" size={12} color="#FFFFFF" />
            </View>
          )}
        </View>
        <View style={styles.contactInfo}>
          <Text style={[styles.contactName, { color: currentTheme.text }]} numberOfLines={1}>
            {contactName}
          </Text>
          <Text style={[styles.contactPhone, { color: currentTheme.placeholder }]} numberOfLines={1}>
            {item.user.phoneNumber}
          </Text>
        </View>
        <TouchableOpacity style={styles.chatButton} onPress={() => handleStartChat(item)}>
          <Ionicons name="chatbubble-outline" size={22} color={currentTheme.primary} />
        </TouchableOpacity>
      </TouchableOpacity>
    )
  }

  // Render contact item for group selection
  const renderGroupContactItem = ({ item }) => {
    const contactName = item.nickname || item.user.name
    const isSelected = selectedContacts.some(c => c._id === item._id)

    return (
      <TouchableOpacity
        style={[
          styles.contactItem,
          {
            borderBottomColor: currentTheme.border,
            backgroundColor: isSelected ? `${currentTheme.primary}20` : currentTheme.card,
          },
        ]}
        onPress={() => toggleContactSelection(item)}
      >
        <View style={styles.avatarContainer}>
          {item.user.profilePicture ? (
            <Image source={{ uri: `${API_BASE_URL_FOR_MEDIA}${item.user.profilePicture}` }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.defaultAvatar, { backgroundColor: currentTheme.primary }]}>
              <Text style={styles.avatarText}>{contactName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>
        <View style={styles.contactInfo}>
          <Text style={[styles.contactName, { color: currentTheme.text }]} numberOfLines={1}>
            {contactName}
          </Text>
          <Text style={[styles.contactPhone, { color: currentTheme.placeholder }]} numberOfLines={1}>
            {item.user.phoneNumber}
          </Text>
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

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: currentTheme.background }]}>
        <ActivityIndicator size="large" color={currentTheme.primary} />
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      {/* Search bar */}
      <View style={[styles.searchContainer, { backgroundColor: currentTheme.card }]}>
        <Ionicons name="search" size={20} color={currentTheme.placeholder} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: currentTheme.text }]}
          placeholder="Search contacts..."
          placeholderTextColor={currentTheme.placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color={currentTheme.placeholder} />
          </TouchableOpacity>
        )}
      </View>

      {/* Group filter */}
      {contactGroups.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.groupsContainer}
          contentContainerStyle={styles.groupsContent}
        >
          <TouchableOpacity
            style={[
              styles.groupChip,
              {
                backgroundColor: selectedGroup === "" ? currentTheme.primary : currentTheme.card,
                borderColor: currentTheme.border
              }
            ]}
            onPress={() => setSelectedGroup("")}
          >
            <Text
              style={[
                styles.groupChipText,
                { color: selectedGroup === "" ? "#FFFFFF" : currentTheme.text }
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          {contactGroups.map((group) => (
            <TouchableOpacity
              key={group}
              style={[
                styles.groupChip,
                {
                  backgroundColor: selectedGroup === group ? currentTheme.primary : currentTheme.card,
                  borderColor: currentTheme.border
                }
              ]}
              onPress={() => setSelectedGroup(group)}
            >
              <Text
                style={[
                  styles.groupChipText,
                  { color: selectedGroup === group ? "#FFFFFF" : currentTheme.text }
                ]}
              >
                {group}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Action buttons */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: currentTheme.primary }]}
          onPress={() => setShowAddContactModal(true)}
        >
          <Ionicons name="person-add" size={18} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Add Contact</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: currentTheme.primary }]}
          onPress={() => setShowCreateGroupModal(true)}
        >
          <Ionicons name="people" size={18} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Create Group</Text>
        </TouchableOpacity>
      </View>

      {/* Contacts list */}
      <FlatList
        data={filteredContacts}
        renderItem={renderContactItem}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[currentTheme.primary]}
            tintColor={currentTheme.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: currentTheme.primary }]}>No contacts found</Text>
            <Text style={[styles.emptySubtext, { color: currentTheme.placeholder }]}>
              {searchQuery.length > 0 ? "Try a different search term" : "Add contacts to start chatting"}
            </Text>
          </View>
        }
      />

      {/* Add contact modal */}
      <Modal
        visible={showAddContactModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddContactModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: currentTheme.card }]}>
            <Text style={[styles.modalTitle, { color: currentTheme.text }]}>Add New Contact</Text>

            <TextInput
              style={[styles.input, { backgroundColor: currentTheme.background, color: currentTheme.text }]}
              placeholder="Name (optional)"
              placeholderTextColor={currentTheme.placeholder}
              value={newContactName}
              onChangeText={setNewContactName}
            />

            <TextInput
              style={[styles.input, { backgroundColor: currentTheme.background, color: currentTheme.text }]}
              placeholder="Phone Number"
              placeholderTextColor={currentTheme.placeholder}
              value={newContactPhone}
              onChangeText={setNewContactPhone}
              keyboardType="phone-pad"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { borderColor: currentTheme.border }]}
                onPress={() => {
                  setShowAddContactModal(false)
                  setNewContactName("")
                  setNewContactPhone("")
                }}
              >
                <Text style={[styles.buttonText, { color: currentTheme.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.addButton, { backgroundColor: currentTheme.primary }]}
                onPress={handleAddContact}
              >
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Group Modal */}
      <Modal
        visible={showCreateGroupModal}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowCreateGroupModal(false)}
      >
        <View style={[styles.groupModalContainer, { backgroundColor: currentTheme.background }]}>
          <View style={[styles.groupModalHeader, { backgroundColor: currentTheme.card }]}>
            <TouchableOpacity
              onPress={() => {
                setShowCreateGroupModal(false)
                setGroupName("")
                setGroupDescription("")
                setSelectedContacts([])
              }}
              style={styles.groupModalBackButton}
            >
              <Ionicons name="arrow-back" size={24} color={currentTheme.primary} />
            </TouchableOpacity>

            <Text style={[styles.groupModalTitle, { color: currentTheme.text }]}>Create Group</Text>

            <TouchableOpacity
              onPress={handleCreateGroup}
              disabled={isCreatingGroup || !groupName.trim() || selectedContacts.length === 0}
              style={[
                styles.groupModalCreateButton,
                {
                  opacity: (isCreatingGroup || !groupName.trim() || selectedContacts.length === 0) ? 0.5 : 1
                }
              ]}
            >
              {isCreatingGroup ? (
                <ActivityIndicator size="small" color={currentTheme.primary} />
              ) : (
                <Text style={[styles.groupModalCreateText, { color: currentTheme.primary }]}>Create</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.groupInfoContainer}>
            <View style={[styles.groupAvatarPlaceholder, { backgroundColor: currentTheme.primary }]}>
              <Ionicons name="people" size={40} color="#FFFFFF" />
            </View>

            <View style={styles.groupInfoInputs}>
              <TextInput
                style={[styles.groupNameInput, { color: currentTheme.text, borderBottomColor: currentTheme.border }]}
                placeholder="Group Name"
                placeholderTextColor={currentTheme.placeholder}
                value={groupName}
                onChangeText={setGroupName}
              />

              <TextInput
                style={[styles.groupDescInput, { color: currentTheme.text, borderBottomColor: currentTheme.border }]}
                placeholder="Group Description (optional)"
                placeholderTextColor={currentTheme.placeholder}
                value={groupDescription}
                onChangeText={setGroupDescription}
              />
            </View>
          </View>

          <View style={styles.participantsContainer}>
            <Text style={[styles.participantsTitle, { color: currentTheme.text }]}>
              Add Participants ({selectedContacts.length} selected)
            </Text>

            {/* Selected contacts chips */}
            {selectedContacts.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.selectedContactsContainer}
                contentContainerStyle={styles.selectedContactsContent}
              >
                {selectedContacts.map(contact => {
                  const contactName = contact.nickname || contact.user.name
                  return (
                    <View key={contact._id} style={[styles.selectedContactChip, { backgroundColor: currentTheme.primary }]}>
                      <Text style={styles.selectedContactName} numberOfLines={1}>
                        {contactName}
                      </Text>
                      <TouchableOpacity
                        onPress={() => toggleContactSelection(contact)}
                        style={styles.removeContactButton}
                      >
                        <Ionicons name="close-circle" size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  )
                })}
              </ScrollView>
            )}

            {/* Search bar for contacts */}
            <View style={[styles.searchContainer, { backgroundColor: currentTheme.card, marginTop: 10 }]}>
              <Ionicons name="search" size={20} color={currentTheme.placeholder} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, { color: currentTheme.text }]}
                placeholder="Search contacts..."
                placeholderTextColor={currentTheme.placeholder}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearButton}>
                  <Ionicons name="close-circle" size={20} color={currentTheme.placeholder} />
                </TouchableOpacity>
              )}
            </View>

            {/* Contacts list for selection */}
            <FlatList
              data={filteredContacts}
              renderItem={renderGroupContactItem}
              keyExtractor={(item) => item._id}
              style={styles.groupContactsList}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: currentTheme.primary }]}>No contacts found</Text>
                  <Text style={[styles.emptySubtext, { color: currentTheme.placeholder }]}>
                    {searchQuery.length > 0 ? "Try a different search term" : "Add contacts first"}
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
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
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginHorizontal: 15,
    marginTop: 15,
    marginBottom: 5,
    borderRadius: 10,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  clearButton: {
    padding: 5,
  },
  groupsContainer: {
    marginHorizontal: 15,
    marginBottom: 10,
  },
  groupsContent: {
    paddingRight: 15,
  },
  groupChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
  },
  groupChipText: {
    fontSize: 14,
    fontWeight: "500",
  },
  actionButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 15,
    marginBottom: 15,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 5,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "500",
    marginLeft: 8,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
  },
  avatarContainer: {
    marginRight: 15,
    position: "relative",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  defaultAvatar: {
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  favoriteIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  contactInfo: {
    flex: 1,
    justifyContent: "center",
  },
  contactName: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 3,
  },
  contactPhone: {
    fontSize: 14,
  },
  chatButton: {
    padding: 10,
  },
  checkboxContainer: {
    padding: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    marginTop: 50,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "80%",
    borderRadius: 10,
    padding: 20,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    marginRight: 10,
    borderWidth: 1,
  },
  addButton: {
    marginLeft: 10,
  },
  buttonText: {
    fontSize: 16,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
  },
  // Group creation modal styles
  groupModalContainer: {
    flex: 1,
  },
  groupModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingVertical: 15,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  groupModalBackButton: {
    padding: 5,
  },
  groupModalTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  groupModalCreateButton: {
    padding: 5,
  },
  groupModalCreateText: {
    fontWeight: "bold",
    fontSize: 16,
  },
  groupInfoContainer: {
    flexDirection: "row",
    padding: 20,
    alignItems: "center",
  },
  groupAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 20,
  },
  groupInfoInputs: {
    flex: 1,
  },
  groupNameInput: {
    fontSize: 18,
    paddingVertical: 10,
    borderBottomWidth: 1,
    marginBottom: 10,
  },
  groupDescInput: {
    fontSize: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  participantsContainer: {
    flex: 1,
    paddingHorizontal: 15,
  },
  participantsTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 10,
  },
  selectedContactsContainer: {
    maxHeight: 50,
  },
  selectedContactsContent: {
    paddingRight: 15,
  },
  selectedContactChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedContactName: {
    color: "#FFFFFF",
    marginRight: 5,
    maxWidth: 100,
  },
  removeContactButton: {
    padding: 2,
  },
  groupContactsList: {
    flex: 1,
    marginTop: 10,
  },
})

export default ContactsScreen
