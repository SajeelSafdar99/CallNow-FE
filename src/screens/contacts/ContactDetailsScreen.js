"use client"

import { useState, useEffect, useContext } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native"
import Ionicons from "react-native-vector-icons/Ionicons"
import { useNavigation, useRoute } from "@react-navigation/native"
import { AuthContext } from "../../context/AuthContext"
import { ThemeContext } from "../../context/ThemeContext"
import { getTheme } from "../../utils/theme"
import * as ContactsAPI from "../../api/contacts"
import * as ConversationsAPI from "../../api/conversations"
import { API_BASE_URL } from "../../config/api"

const ContactDetailScreen = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const { contactId } = route.params
  const { state: authState } = useContext(AuthContext)
  const { theme } = useContext(ThemeContext)
  const currentTheme = getTheme(theme)

  const [contact, setContact] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  // Fetch contact details
  const fetchContactDetails = async () => {
    try {
      setIsLoading(true)
      const response = await ContactsAPI.getContactById(contactId, authState.token)
      if (response.success) {
        setContact(response.contact)
        setEditedName(response.contact.name)
      } else {
        Alert.alert("Error", response.error || "Failed to fetch contact details")
        navigation.goBack()
      }
    } catch (error) {
      console.error("Error fetching contact details:", error)
      Alert.alert("Error", "An unexpected error occurred")
      navigation.goBack()
    } finally {
      setIsLoading(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchContactDetails()
  }, [contactId])

  // Save edited contact
  const handleSaveContact = async () => {
    if (!editedName.trim()) {
      Alert.alert("Error", "Name cannot be empty")
      return
    }

    try {
      setIsSaving(true)
      const response = await ContactsAPI.updateContact(contactId, { name: editedName.trim() }, authState.token)

      if (response.success) {
        setContact(response.contact)
        setIsEditing(false)
        Alert.alert("Success", "Contact updated successfully")
      } else {
        Alert.alert("Error", response.error || "Failed to update contact")
      }
    } catch (error) {
      console.error("Error updating contact:", error)
      Alert.alert("Error", "An unexpected error occurred while updating contact")
    } finally {
      setIsSaving(false)
    }
  }

  // Delete contact
  const handleDeleteContact = () => {
    Alert.alert(
      "Delete Contact",
      `Are you sure you want to delete ${contact.name}?`,
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
                Alert.alert("Success", "Contact deleted successfully")
                navigation.goBack()
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

  // Start a chat with the contact
  const handleStartChat = async () => {
    try {
      // Check if conversation already exists
      const response = await ConversationsAPI.getOrCreateConversation(contact.userId, authState.token)

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

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: currentTheme.background }]}>
        <ActivityIndicator size="large" color={currentTheme.primary} />
      </View>
    )
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <View style={styles.header}>
        {contact.profilePicture ? (
          <Image source={{ uri: `${API_BASE_URL}${contact.profilePicture}` }} style={styles.profileImage} />
        ) : (
          <View style={[styles.defaultProfileImage, { backgroundColor: currentTheme.primary }]}>
            <Text style={styles.profileInitial}>{contact.name.charAt(0).toUpperCase()}</Text>
          </View>
        )}

        {isEditing ? (
          <View style={styles.editNameContainer}>
            <TextInput
              style={[
                styles.nameInput,
                {
                  color: currentTheme.text,
                  borderColor: currentTheme.border,
                  backgroundColor: currentTheme.card,
                },
              ]}
              value={editedName}
              onChangeText={setEditedName}
              autoFocus
            />
            <View style={styles.editButtons}>
              <TouchableOpacity
                style={[styles.editButton, { backgroundColor: currentTheme.primary }]}
                onPress={handleSaveContact}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.editButtonText}>Save</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editButton, styles.cancelButton, { borderColor: currentTheme.border }]}
                onPress={() => {
                  setIsEditing(false)
                  setEditedName(contact.name)
                }}
                disabled={isSaving}
              >
                <Text style={[styles.cancelButtonText, { color: currentTheme.text }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.nameContainer}>
            <Text style={[styles.name, { color: currentTheme.text }]}>{contact.name}</Text>
            <TouchableOpacity style={styles.editNameButton} onPress={() => setIsEditing(true)}>
              <Ionicons name="pencil" size={18} color={currentTheme.primary} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={[styles.section, { backgroundColor: currentTheme.card }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="call" size={20} color={currentTheme.primary} />
          <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>Contact Info</Text>
        </View>

        <View style={styles.infoItem}>
          <Text style={[styles.infoLabel, { color: currentTheme.placeholder }]}>Phone</Text>
          <Text style={[styles.infoValue, { color: currentTheme.text }]}>{contact.phoneNumber}</Text>
        </View>

        {contact.email && (
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: currentTheme.placeholder }]}>Email</Text>
            <Text style={[styles.infoValue, { color: currentTheme.text }]}>{contact.email}</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: currentTheme.primary }]}
          onPress={handleStartChat}
        >
          <Ionicons name="chatbubble" size={22} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Message</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: currentTheme.primary }]}
          onPress={() => {
            // Navigate to call screen (if implemented)
            Alert.alert("Call", `Calling ${contact.name}...`)
          }}
        >
          <Ionicons name="call" size={22} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Call</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.deleteButton, { borderColor: "#FF3B30" }]} onPress={handleDeleteContact}>
        <Ionicons name="trash" size={20} color="#FF3B30" />
        <Text style={styles.deleteButtonText}>Delete Contact</Text>
      </TouchableOpacity>
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
  header: {
    alignItems: "center",
    paddingVertical: 30,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 15,
  },
  defaultProfileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  profileInitial: {
    fontSize: 50,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  name: {
    fontSize: 24,
    fontWeight: "bold",
    marginRight: 10,
  },
  editNameButton: {
    padding: 5,
  },
  editNameContainer: {
    width: "80%",
  },
  nameInput: {
    fontSize: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
  },
  editButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  editButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
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
  section: {
    marginHorizontal: 15,
    marginVertical: 10,
    borderRadius: 10,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 10,
  },
  infoItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  infoLabel: {
    fontSize: 14,
    marginBottom: 5,
  },
  infoValue: {
    fontSize: 16,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 20,
    paddingHorizontal: 15,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 120,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "500",
    marginLeft: 8,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 15,
    marginTop: 10,
    marginBottom: 30,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  deleteButtonText: {
    color: "#FF3B30",
    fontWeight: "500",
    marginLeft: 8,
  },
})

export default ContactDetailScreen
