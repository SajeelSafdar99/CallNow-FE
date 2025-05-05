"use client"

import { useState, useEffect, useContext } from "react"
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useNavigation } from "@react-navigation/native"
import * as ImagePicker from "expo-image-picker"
import { AuthContext } from "../../context/AuthContext"
import * as ContactsAPI from "../../api/contacts"
import * as ConversationsAPI from "../../api/conversations"
import { API_BASE_URL } from "../../config/api"

const CreateGroupScreen = () => {
  const navigation = useNavigation()
  const { state: authState } = useContext(AuthContext)

  const [groupName, setGroupName] = useState("")
  const [groupDescription, setGroupDescription] = useState("")
  const [groupImage, setGroupImage] = useState(null)
  const [contacts, setContacts] = useState([])
  const [selectedContacts, setSelectedContacts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Fetch contacts on mount
  useEffect(() => {
    fetchContacts()
  }, [])

  // Fetch contacts
  const fetchContacts = async () => {
    try {
      setIsLoading(true)
      const response = await ContactsAPI.getContacts(authState.token)

      if (response.success) {
        setContacts(response.contacts)
      } else {
        Alert.alert("Error", response.message || "Failed to load contacts")
      }

      setIsLoading(false)
    } catch (error) {
      console.error("Error fetching contacts:", error)
      setIsLoading(false)
      Alert.alert("Error", "Failed to load contacts. Please try again.")
    }
  }

  // Pick image from gallery
  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync()

      if (!permissionResult.granted) {
        Alert.alert("Permission Required", "You need to grant access to your photos to set a group image.")
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setGroupImage(result.assets[0].uri)
      }
    } catch (error) {
      console.error("Error picking image:", error)
      Alert.alert("Error", "Failed to pick image. Please try again.")
    }
  }

  // Take photo with camera
  const takePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync()

      if (!permissionResult.granted) {
        Alert.alert("Permission Required", "You need to grant access to your camera to take a photo.")
        return
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setGroupImage(result.assets[0].uri)
      }
    } catch (error) {
      console.error("Error taking photo:", error)
      Alert.alert("Error", "Failed to take photo. Please try again.")
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

  // Create group
  const createGroup = async () => {
    // Validate inputs
    if (!groupName.trim()) {
      Alert.alert("Error", "Please enter a group name")
      return
    }

    if (selectedContacts.length < 1) {
      Alert.alert("Error", "Please select at least one contact")
      return
    }

    try {
      setIsCreating(true)

      // Prepare form data for multipart/form-data request
      const formData = new FormData()
      formData.append("groupName", groupName.trim())
      formData.append("description", groupDescription.trim())

      // Add selected contacts
      selectedContacts.forEach((contact) => {
        formData.append("participants", contact._id)
      })

      // Add group image if selected
      if (groupImage) {
        const filename = groupImage.split("/").pop()
        const match = /\.(\w+)$/.exec(filename)
        const type = match ? `image/${match[1]}` : "image/jpeg"

        formData.append("groupImage", {
          uri: Platform.OS === "android" ? groupImage : groupImage.replace("file://", ""),
          name: filename,
          type,
        })
      }

      // Create group conversation
      const response = await ConversationsAPI.createGroupConversation(formData, authState.token)

      setIsCreating(false)

      if (response.success) {
        Alert.alert("Success", "Group created successfully", [
          { text: "OK", onPress: () => navigation.navigate("Chats") },
        ])
      } else {
        Alert.alert("Error", response.message || "Failed to create group")
      }
    } catch (error) {
      console.error("Error creating group:", error)
      setIsCreating(false)
      Alert.alert("Error", "Failed to create group. Please try again.")
    }
  }

  // Filter contacts based on search query
  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) || contact.phoneNumber.includes(searchQuery),
  )

  // Render contact item
  const renderContactItem = ({ item }) => {
    const isSelected = selectedContacts.some((c) => c._id === item._id)

    return (
      <TouchableOpacity
        style={[styles.contactItem, isSelected && styles.selectedContactItem]}
        onPress={() => toggleContactSelection(item)}
      >
        <View style={styles.contactImageContainer}>
          {item.profilePicture ? (
            <Image source={{ uri: `${API_BASE_URL}${item.profilePicture}` }} style={styles.contactImage} />
          ) : (
            <View style={styles.defaultContactImage}>
              <Text style={styles.contactInitial}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>

        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.contactPhone}>{item.phoneNumber}</Text>
        </View>

        <View style={styles.checkboxContainer}>
          {isSelected ? (
            <Ionicons name="checkmark-circle" size={24} color="#128C7E" />
          ) : (
            <View style={styles.emptyCheckbox} />
          )}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : null}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <ScrollView style={styles.scrollContainer}>
        {/* Group Info Section */}
        <View style={styles.groupInfoSection}>
          <TouchableOpacity style={styles.groupImageContainer} onPress={pickImage}>
            {groupImage ? (
              <Image source={{ uri: groupImage }} style={styles.groupImage} />
            ) : (
              <View style={styles.defaultGroupImage}>
                <Ionicons name="people" size={40} color="#FFFFFF" />
                <Ionicons name="camera" size={20} color="#FFFFFF" style={styles.cameraIcon} />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.imageOptions}>
            <TouchableOpacity style={styles.imageOption} onPress={pickImage}>
              <Ionicons name="images" size={20} color="#128C7E" />
              <Text style={styles.imageOptionText}>Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.imageOption} onPress={takePhoto}>
              <Ionicons name="camera" size={20} color="#128C7E" />
              <Text style={styles.imageOptionText}>Camera</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.groupNameInput}
            placeholder="Group Name"
            value={groupName}
            onChangeText={setGroupName}
            maxLength={25}
          />

          <TextInput
            style={styles.groupDescriptionInput}
            placeholder="Group Description (optional)"
            value={groupDescription}
            onChangeText={setGroupDescription}
            multiline
            maxLength={100}
          />
        </View>

        {/* Selected Contacts Section */}
        {selectedContacts.length > 0 && (
          <View style={styles.selectedContactsSection}>
            <Text style={styles.sectionTitle}>Selected Contacts ({selectedContacts.length})</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectedContactsScroll}>
              {selectedContacts.map((contact) => (
                <TouchableOpacity
                  key={contact._id}
                  style={styles.selectedContactBadge}
                  onPress={() => toggleContactSelection(contact)}
                >
                  {contact.profilePicture ? (
                    <Image
                      source={{ uri: `${API_BASE_URL}${contact.profilePicture}` }}
                      style={styles.selectedContactImage}
                    />
                  ) : (
                    <View style={styles.defaultSelectedContactImage}>
                      <Text style={styles.selectedContactInitial}>{contact.name.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}

                  <Text style={styles.selectedContactName} numberOfLines={1}>
                    {contact.name}
                  </Text>

                  <Ionicons name="close-circle" size={18} color="#FF3B30" style={styles.removeIcon} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Contacts Section */}
        <View style={styles.contactsSection}>
          <Text style={styles.sectionTitle}>Add Participants</Text>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#7F7F7F" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search contacts"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={20} color="#7F7F7F" />
              </TouchableOpacity>
            )}
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#128C7E" />
              <Text style={styles.loadingText}>Loading contacts...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredContacts}
              keyExtractor={(item) => item._id}
              renderItem={renderContactItem}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No contacts found</Text>
                </View>
              }
              scrollEnabled={false}
              nestedScrollEnabled={true}
            />
          )}
        </View>
      </ScrollView>

      {/* Create Button */}
      <View style={styles.createButtonContainer}>
        <TouchableOpacity
          style={[
            styles.createButton,
            (groupName.trim() === "" || selectedContacts.length === 0) && styles.disabledButton,
          ]}
          onPress={createGroup}
          disabled={groupName.trim() === "" || selectedContacts.length === 0 || isCreating}
        >
          {isCreating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.createButtonText}>Create Group</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContainer: {
    flex: 1,
  },
  groupInfoSection: {
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
  cameraIcon: {
    position: "absolute",
    bottom: 5,
    right: 5,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 10,
    padding: 2,
  },
  imageOptions: {
    flexDirection: "row",
    marginBottom: 15,
  },
  imageOption: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 10,
  },
  imageOptionText: {
    marginLeft: 5,
    color: "#128C7E",
  },
  groupNameInput: {
    width: "100%",
    height: 50,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 5,
    paddingHorizontal: 15,
    marginBottom: 10,
    fontSize: 16,
  },
  groupDescriptionInput: {
    width: "100%",
    height: 80,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 5,
    paddingHorizontal: 15,
    paddingTop: 10,
    fontSize: 16,
    textAlignVertical: "top",
  },
  selectedContactsSection: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F2",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
  },
  selectedContactsScroll: {
    flexDirection: "row",
  },
  selectedContactBadge: {
    alignItems: "center",
    marginRight: 15,
    width: 70,
  },
  selectedContactImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 5,
  },
  defaultSelectedContactImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#128C7E",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 5,
  },
  selectedContactInitial: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  selectedContactName: {
    fontSize: 12,
    textAlign: "center",
    width: 70,
  },
  removeIcon: {
    position: "absolute",
    top: -5,
    right: 5,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
  },
  contactsSection: {
    padding: 15,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F2",
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 15,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F2",
  },
  selectedContactItem: {
    backgroundColor: "rgba(18, 140, 126, 0.1)",
  },
  contactImageContainer: {
    marginRight: 15,
  },
  contactImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  defaultContactImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#128C7E",
    justifyContent: "center",
    alignItems: "center",
  },
  contactInitial: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: "500",
  },
  contactPhone: {
    fontSize: 14,
    color: "#7F7F7F",
  },
  checkboxContainer: {
    width: 30,
    alignItems: "center",
  },
  emptyCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E0E0E0",
  },
  loadingContainer: {
    padding: 20,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#7F7F7F",
  },
  emptyContainer: {
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    color: "#7F7F7F",
  },
  createButtonContainer: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F2",
    backgroundColor: "#FFFFFF",
  },
  createButton: {
    backgroundColor: "#128C7E",
    borderRadius: 5,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  disabledButton: {
    backgroundColor: "#CCCCCC",
  },
  createButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
})

export default CreateGroupScreen
