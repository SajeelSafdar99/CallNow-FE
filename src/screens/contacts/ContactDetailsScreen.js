"use client"

import { useState, useContext } from "react"
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useNavigation } from "@react-navigation/native"
import { AuthContext } from "../../context/AuthContext"
import * as ContactsAPI from "../../api/contacts"
import { API_BASE_URL } from "../../config/api"

const ContactDetailsScreen = ({ route }) => {
  const { contact } = route.params
  const navigation = useNavigation()
  const { state: authState } = useContext(AuthContext)

  const [isLoading, setIsLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [nickname, setNickname] = useState(contact.nickname || contact.contactUser.name)
  const [isFavorite, setIsFavorite] = useState(contact.isFavorite)

  // Start a chat with this contact
  const handleStartChat = () => {
    navigation.navigate("Chat", {
      contactUser: contact.contactUser,
      isNewConversation: true,
    })
  }

  // Start a call with this contact
  const handleStartCall = (isVideo = false) => {
    navigation.navigate("Call", {
      contactUser: contact.contactUser,
      isVideoCall: isVideo,
    })
  }

  // Toggle favorite status
  const handleToggleFavorite = async () => {
    try {
      setIsLoading(true)
      const response = await ContactsAPI.updateContact(contact._id, { isFavorite: !isFavorite }, authState.token)

      if (response.success) {
        setIsFavorite(!isFavorite)
      } else {
        Alert.alert("Error", "Failed to update favorite status")
      }
    } catch (error) {
      console.error("Error updating favorite status:", error)
      Alert.alert("Error", "Failed to update favorite status")
    } finally {
      setIsLoading(false)
    }
  }

  // Save edited nickname
  const handleSaveNickname = async () => {
    try {
      setIsLoading(true)
      const response = await ContactsAPI.updateContact(contact._id, { nickname }, authState.token)

      if (response.success) {
        setIsEditing(false)
        Alert.alert("Success", "Contact updated successfully")
      } else {
        Alert.alert("Error", "Failed to update contact")
      }
    } catch (error) {
      console.error("Error updating contact:", error)
      Alert.alert("Error", "Failed to update contact")
    } finally {
      setIsLoading(false)
    }
  }

  // Delete contact
  const handleDeleteContact = () => {
    Alert.alert("Delete Contact", "Are you sure you want to delete this contact?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setIsLoading(true)
            const response = await ContactsAPI.deleteContact(contact._id, authState.token)

            if (response.success) {
              Alert.alert("Success", "Contact deleted successfully")
              navigation.goBack()
            } else {
              Alert.alert("Error", "Failed to delete contact")
            }
          } catch (error) {
            console.error("Error deleting contact:", error)
            Alert.alert("Error", "Failed to delete contact")
          } finally {
            setIsLoading(false)
          }
        },
      },
    ])
  }

  return (
    <View style={styles.container}>
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#128C7E" />
        </View>
      )}

      <ScrollView>
        <View style={styles.profileHeader}>
          {contact.contactUser.profilePicture ? (
            <Image
              source={{ uri: `${API_BASE_URL}${contact.contactUser.profilePicture}` }}
              style={styles.profileImage}
            />
          ) : (
            <View style={[styles.profileImage, styles.defaultProfileImage]}>
              <Text style={styles.profileImageText}>
                {(contact.nickname || contact.contactUser.name).charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <Text style={styles.profileName}>{contact.nickname || contact.contactUser.name}</Text>
          <Text style={styles.phoneNumber}>{contact.contactUser.phoneNumber}</Text>

          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>{contact.contactUser.status || "Hey there! I'm using WhatsApp"}</Text>
          </View>
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={handleStartChat}>
            <Ionicons name="chatbubble" size={24} color="#128C7E" />
            <Text style={styles.actionText}>Message</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={() => handleStartCall(false)}>
            <Ionicons name="call" size={24} color="#128C7E" />
            <Text style={styles.actionText}>Audio</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={() => handleStartCall(true)}>
            <Ionicons name="videocam" size={24} color="#128C7E" />
            <Text style={styles.actionText}>Video</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoHeader}>
            <Text style={styles.infoHeaderText}>Contact Info</Text>
          </View>

          <TouchableOpacity style={styles.infoItem} onPress={() => setIsEditing(true)}>
            <View style={styles.infoItemContent}>
              <Ionicons name="person" size={20} color="#666" style={styles.infoIcon} />
              <View>
                <Text style={styles.infoLabel}>Nickname</Text>
                <Text style={styles.infoValue}>{nickname}</Text>
              </View>
            </View>
            <Ionicons name="create-outline" size={20} color="#128C7E" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.infoItem} onPress={handleToggleFavorite}>
            <View style={styles.infoItemContent}>
              <Ionicons
                name={isFavorite ? "star" : "star-outline"}
                size={20}
                color={isFavorite ? "#FFD700" : "#666"}
                style={styles.infoIcon}
              />
              <Text style={styles.infoValue}>{isFavorite ? "Remove from favorites" : "Add to favorites"}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.infoItem, styles.deleteButton]} onPress={handleDeleteContact}>
            <View style={styles.infoItemContent}>
              <Ionicons name="trash-outline" size={20} color="#FF3B30" style={styles.infoIcon} />
              <Text style={styles.deleteText}>Delete Contact</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Nickname Modal */}
      <Modal visible={isEditing} transparent={true} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Nickname</Text>

            <TextInput
              style={styles.modalInput}
              value={nickname}
              onChangeText={setNickname}
              placeholder="Enter nickname"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setNickname(contact.nickname || contact.contactUser.name)
                  setIsEditing(false)
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.modalButton, styles.modalSaveButton]} onPress={handleSaveNickname}>
                <Text style={styles.modalSaveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 15,
  },
  defaultProfileImage: {
    backgroundColor: "#128C7E",
    justifyContent: "center",
    alignItems: "center",
  },
  profileImageText: {
    color: "#FFFFFF",
    fontSize: 40,
    fontWeight: "bold",
  },
  profileName: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 5,
  },
  phoneNumber: {
    fontSize: 16,
    color: "#666",
    marginBottom: 10,
  },
  statusContainer: {
    backgroundColor: "#F8F8F8",
    padding: 10,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
  },
  statusText: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  actionButton: {
    alignItems: "center",
  },
  actionText: {
    marginTop: 5,
    color: "#128C7E",
  },
  infoSection: {
    padding: 15,
  },
  infoHeader: {
    marginBottom: 15,
  },
  infoHeaderText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#128C7E",
  },
  infoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  infoItemContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoIcon: {
    marginRight: 15,
  },
  infoLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 16,
  },
  deleteButton: {
    marginTop: 20,
  },
  deleteText: {
    color: "#FF3B30",
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 20,
    width: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
    color: "#128C7E",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalCancelButton: {
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#128C7E",
  },
  modalCancelButtonText: {
    color: "#128C7E",
    fontWeight: "bold",
  },
  modalSaveButton: {
    backgroundColor: "#128C7E",
  },
  modalSaveButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
})

export default ContactDetailsScreen
