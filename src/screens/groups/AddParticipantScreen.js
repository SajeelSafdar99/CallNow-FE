"use client"

import { useState, useEffect, useContext } from "react"
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useNavigation, useRoute } from "@react-navigation/native"
import { AuthContext } from "../../context/AuthContext"
import { ThemeContext } from "../../context/ThemeContext"
import { getTheme } from "../../utils/theme"
import * as ContactsAPI from "../../api/contacts"
import * as ConversationsAPI from "../../api/conversations"
import { API_BASE_URL } from "../../config/api"

const AddParticipantsScreen = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const { conversationId } = route.params
  const { state: authState } = useContext(AuthContext)
  const { theme } = useContext(ThemeContext)
  const currentTheme = getTheme(theme)

  const [contacts, setContacts] = useState([])
  const [selectedContacts, setSelectedContacts] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [existingParticipants, setExistingParticipants] = useState([])

  // Fetch contacts and existing participants on mount
  useEffect(() => {
    fetchContacts()
    fetchExistingParticipants()
  }, [])

  // Fetch user's contacts
  const fetchContacts = async () => {
    try {
      setIsLoading(true)
      const response = await ContactsAPI.getContacts({}, authState.token)

      if (response.success) {
        setContacts(response.contacts)
      } else {
        Alert.alert("Error", response.message || "Failed to load contacts")
      }
    } catch (error) {
      console.error("Error fetching contacts:", error)
      Alert.alert("Error", "An error occurred while loading contacts")
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch existing participants to exclude them
  const fetchExistingParticipants = async () => {
    try {
      const response = await ConversationsAPI.getConversationDetails(conversationId, authState.token)

      if (response.success) {
        // Extract participant IDs
        const participantIds = response.conversation.participants.map((p) => p._id || p.userId)
        setExistingParticipants(participantIds)
      } else {
        Alert.alert("Error", response.message || "Failed to load group information")
      }
    } catch (error) {
      console.error("Error fetching group info:", error)
      Alert.alert("Error", "An error occurred while loading group information")
    }
  }

  // Toggle contact selection
  const toggleContactSelection = (contact) => {
    if (selectedContacts.some((c) => c._id === contact._id)) {
      setSelectedContacts(selectedContacts.filter((c) => c._id !== contact._id))
    } else {
      setSelectedContacts([...selectedContacts, contact])
    }
  }

  // Add selected contacts to the group
  const addParticipants = async () => {
    if (selectedContacts.length === 0) {
      Alert.alert("No Contacts Selected", "Please select at least one contact to add to the group")
      return
    }

    try {
      setIsAdding(true)

      // Extract user IDs from selected contacts
      const participantIds = selectedContacts.map((contact) => contact.userId || contact._id)

      const response = await ConversationsAPI.addParticipants(conversationId, participantIds, authState.token)

      if (response.success) {
        Alert.alert(
          "Success",
          `Added ${selectedContacts.length} participant${selectedContacts.length > 1 ? "s" : ""} to the group`,
          [{ text: "OK", onPress: () => navigation.goBack() }],
        )
      } else {
        Alert.alert("Error", response.message || "Failed to add participants")
      }
    } catch (error) {
      console.error("Error adding participants:", error)
      Alert.alert("Error", "An error occurred while adding participants")
    } finally {
      setIsAdding(false)
    }
  }

  // Filter contacts based on search query and exclude existing participants
  const filteredContacts = contacts.filter((contact) => {
    // Exclude existing participants
    if (existingParticipants.includes(contact._id) || existingParticipants.includes(contact.userId)) {
      return false
    }

    // Apply search filter if query exists
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return contact.name.toLowerCase().includes(query) || (contact.phoneNumber && contact.phoneNumber.includes(query))
    }

    return true
  })

  // Render contact item
  const renderContactItem = ({ item }) => {
    const isSelected = selectedContacts.some((c) => c._id === item._id)

    return (
      <TouchableOpacity
        style={[styles.contactItem, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}
        onPress={() => toggleContactSelection(item)}
      >
        <View style={styles.contactInfo}>
          {item.profilePicture ? (
            <Image source={{ uri: `${API_BASE_URL}${item.profilePicture}` }} style={styles.contactImage} />
          ) : (
            <View style={[styles.defaultContactImage, { backgroundColor: currentTheme.primary }]}>
              <Text style={styles.contactInitial}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}

          <View style={styles.contactDetails}>
            <Text style={[styles.contactName, { color: currentTheme.text }]}>{item.name}</Text>
            <Text style={[styles.contactPhone, { color: currentTheme.placeholder }]}>
              {item.phoneNumber || "No phone number"}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.checkbox,
            isSelected
              ? { backgroundColor: currentTheme.primary, borderColor: currentTheme.primary }
              : { borderColor: currentTheme.border },
          ]}
        >
          {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <View style={[styles.header, { backgroundColor: currentTheme.primary }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Participants</Text>
        {selectedContacts.length > 0 && (
          <TouchableOpacity
            style={[styles.addButton, isAdding && styles.addButtonDisabled]}
            onPress={addParticipants}
            disabled={isAdding}
          >
            {isAdding ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.addButtonText}>Add</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.searchContainer, { backgroundColor: currentTheme.card }]}>
        <Ionicons name="search" size={20} color={currentTheme.placeholder} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: currentTheme.text }]}
          placeholder="Search contacts"
          placeholderTextColor={currentTheme.placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={20} color={currentTheme.placeholder} />
          </TouchableOpacity>
        ) : null}
      </View>

      {selectedContacts.length > 0 && (
        <View
          style={[styles.selectedContainer, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}
        >
          <Text style={[styles.selectedTitle, { color: currentTheme.text }]}>
            Selected Contacts ({selectedContacts.length})
          </Text>
          <FlatList
            data={selectedContacts}
            keyExtractor={(item) => item._id}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.selectedContact} onPress={() => toggleContactSelection(item)}>
                {item.profilePicture ? (
                  <Image source={{ uri: `${API_BASE_URL}${item.profilePicture}` }} style={styles.selectedImage} />
                ) : (
                  <View style={[styles.defaultSelectedImage, { backgroundColor: currentTheme.primary }]}>
                    <Text style={styles.selectedInitial}>{item.name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <Text style={[styles.selectedName, { color: currentTheme.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={[styles.removeButton, { backgroundColor: currentTheme.primary }]}>
                  <Ionicons name="close" size={12} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.selectedList}
          />
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={currentTheme.primary} />
          <Text style={[styles.loadingText, { color: currentTheme.text }]}>Loading contacts...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => item._id}
          renderItem={renderContactItem}
          contentContainerStyle={styles.contactsList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={60} color={currentTheme.placeholder} />
              <Text style={[styles.emptyText, { color: currentTheme.text }]}>
                {searchQuery ? "No contacts found matching your search" : "No contacts available to add"}
              </Text>
              {!searchQuery && (
                <Text style={[styles.emptySubText, { color: currentTheme.placeholder }]}>
                  All your contacts are already in this group
                </Text>
              )}
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    height: 60,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    flex: 1,
    marginLeft: 15,
  },
  addButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  addButtonDisabled: {
    opacity: 0.7,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginHorizontal: 15,
    marginTop: 15,
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
  selectedContainer: {
    marginHorizontal: 15,
    marginTop: 10,
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
  },
  selectedTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
  },
  selectedList: {
    paddingVertical: 5,
  },
  selectedContact: {
    alignItems: "center",
    marginRight: 15,
    position: "relative",
    width: 70,
  },
  selectedImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 5,
  },
  defaultSelectedImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 5,
  },
  selectedInitial: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  selectedName: {
    fontSize: 12,
    textAlign: "center",
    width: 70,
  },
  removeButton: {
    position: "absolute",
    top: -5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  contactsList: {
    padding: 15,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
  },
  contactInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  contactImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  defaultContactImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  contactInitial: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  contactDetails: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 3,
  },
  contactPhone: {
    fontSize: 14,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 10,
    textAlign: "center",
  },
  emptySubText: {
    fontSize: 14,
    marginTop: 5,
    textAlign: "center",
  },
})

export default AddParticipantsScreen
