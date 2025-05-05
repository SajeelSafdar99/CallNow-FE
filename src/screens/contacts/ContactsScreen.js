"use client"

import { useState, useEffect, useContext } from "react"
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useNavigation } from "@react-navigation/native"
import { AuthContext } from "../../context/AuthContext"
import * as ContactsAPI from "../../api/contacts"
import { API_BASE_URL } from "../../config/api"

const ContactsScreen = ({ route }) => {
  const navigation = useNavigation()
  const { state: authState } = useContext(AuthContext)
  const isNewChat = route.params?.isNewChat || false

  const [contacts, setContacts] = useState([])
  const [filteredContacts, setFilteredContacts] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Fetch contacts
  const fetchContacts = async () => {
    try {
      setIsLoading(true)
      const response = await ContactsAPI.getContacts({}, authState.token)
      if (response.success) {
        const sortedContacts = response.contacts.sort((a, b) => {
          const nameA = a.nickname || a.contactUser.name
          const nameB = b.nickname || b.contactUser.name
          return nameA.localeCompare(nameB)
        })
        setContacts(sortedContacts)
        setFilteredContacts(sortedContacts)
      }
    } catch (error) {
      console.error("Error fetching contacts:", error)
      Alert.alert("Error", "Failed to load contacts")
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchContacts()
  }, [])

  // Filter contacts based on search query
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredContacts(contacts)
    } else {
      const filtered = contacts.filter((contact) => {
        const contactName = contact.nickname || contact.contactUser.name
        const contactPhone = contact.contactUser.phoneNumber
        return contactName.toLowerCase().includes(searchQuery.toLowerCase()) || contactPhone.includes(searchQuery)
      })
      setFilteredContacts(filtered)
    }
  }, [searchQuery, contacts])

  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true)
    fetchContacts()
  }

  // Navigate to add contact screen
  const handleAddContact = () => {
    navigation.navigate("AddContact")
  }

  // Navigate to contact details screen
  const handleContactPress = (contact) => {
    if (isNewChat) {
      // Start a new chat with this contact
      navigation.navigate("Chat", {
        contactUser: contact.contactUser,
        isNewConversation: true,
      })
    } else {
      // View contact details
      navigation.navigate("ContactDetails", { contact })
    }
  }

  // Group contacts by first letter
  const groupedContacts = filteredContacts.reduce((groups, contact) => {
    const contactName = contact.nickname || contact.contactUser.name
    const firstLetter = contactName.charAt(0).toUpperCase()

    if (!groups[firstLetter]) {
      groups[firstLetter] = []
    }

    groups[firstLetter].push(contact)
    return groups
  }, {})

  // Convert grouped contacts to array for FlatList
  const sections = Object.keys(groupedContacts)
    .sort()
    .map((letter) => ({
      title: letter,
      data: groupedContacts[letter],
    }))

  // Render contact item
  const renderContactItem = ({ item }) => {
    const contactName = item.nickname || item.contactUser.name
    const profilePicture = item.contactUser.profilePicture

    return (
      <TouchableOpacity style={styles.contactItem} onPress={() => handleContactPress(item)}>
        <View style={styles.avatarContainer}>
          {profilePicture ? (
            <Image source={{ uri: `${API_BASE_URL}${profilePicture}` }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.defaultAvatar]}>
              <Text style={styles.avatarText}>{contactName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{contactName}</Text>
          <Text style={styles.contactStatus}>{item.contactUser.status || "Hey there! I'm using WhatsApp"}</Text>
        </View>
        {item.isFavorite && <Ionicons name="star" size={20} color="#FFD700" style={styles.favoriteIcon} />}
      </TouchableOpacity>
    )
  }

  // Render section header
  const renderSectionHeader = ({ section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
    </View>
  )

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#128C7E" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {filteredContacts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No contacts found</Text>
          <Text style={styles.emptySubtext}>
            {searchQuery ? "Try a different search term" : "Add contacts to get started"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          renderItem={({ item }) => (
            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{item.title}</Text>
              </View>
              {item.data.map((contact) => renderContactItem({ item: contact }))}
            </View>
          )}
          keyExtractor={(item) => item.title}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={handleAddContact}>
        <Ionicons name="person-add" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
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
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F0F0",
    borderRadius: 20,
    margin: 10,
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
  },
  sectionHeader: {
    backgroundColor: "#F8F8F8",
    padding: 8,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  sectionHeaderText: {
    fontWeight: "bold",
    color: "#128C7E",
  },
  contactItem: {
    flexDirection: "row",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    alignItems: "center",
  },
  avatarContainer: {
    marginRight: 15,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  defaultAvatar: {
    backgroundColor: "#128C7E",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 3,
  },
  contactStatus: {
    fontSize: 14,
    color: "#666",
  },
  favoriteIcon: {
    marginLeft: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#128C7E",
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#128C7E",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
})

export default ContactsScreen
