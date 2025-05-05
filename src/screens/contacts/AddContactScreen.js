"use client"

import { useState, useContext } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useNavigation } from "@react-navigation/native"
import { AuthContext } from "../../context/AuthContext"
import * as ContactsAPI from "../../api/contacts"

const AddContactScreen = () => {
  const navigation = useNavigation()
  const { state: authState } = useContext(AuthContext)

  const [phoneNumber, setPhoneNumber] = useState("")
  const [nickname, setNickname] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [userExists, setUserExists] = useState(null)
  const [foundUser, setFoundUser] = useState(null)

  // Check if user exists
  const handleCheckUser = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      Alert.alert("Invalid Input", "Please enter a valid phone number")
      return
    }

    try {
      setIsLoading(true)
      const response = await ContactsAPI.checkUserExists(phoneNumber, authState.token)

      if (response.success && response.user) {
        setUserExists(true)
        setFoundUser(response.user)
        setNickname(response.user.name) // Default nickname to user's name
      } else {
        setUserExists(false)
        setFoundUser(null)
        Alert.alert("User Not Found", "No user exists with this phone number")
      }
    } catch (error) {
      console.error("Error checking user:", error)
      Alert.alert("Error", "Failed to check if user exists")
      setUserExists(false)
    } finally {
      setIsLoading(false)
    }
  }

  // Add contact
  const handleAddContact = async () => {
    if (!foundUser) {
      Alert.alert("Error", "Please search for a valid user first")
      return
    }

    try {
      setIsLoading(true)
      const contactData = {
        contactUserId: foundUser._id,
        nickname: nickname || foundUser.name,
        isFavorite: false,
      }

      const response = await ContactsAPI.addContact(authState.user.id, contactData, authState.token)

      if (response.success) {
        Alert.alert("Success", "Contact added successfully")
        navigation.goBack()
      } else {
        Alert.alert("Error", response.message || "Failed to add contact")
      }
    } catch (error) {
      console.error("Error adding contact:", error)

      // Check if this is a duplicate contact error
      if (error.response && error.response.data && error.response.data.message.includes("already exists")) {
        Alert.alert("Error", "This user is already in your contacts")
      } else {
        Alert.alert("Error", "Failed to add contact")
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Add New Contact</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.phoneInputContainer}>
              <TextInput
                style={styles.phoneInput}
                placeholder="Enter phone number"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                autoCapitalize="none"
                editable={!userExists}
              />
              {!userExists && (
                <TouchableOpacity style={styles.searchButton} onPress={handleCheckUser} disabled={isLoading}>
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="search" size={20} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

          {userExists && foundUser && (
            <>
              <View style={styles.userFoundContainer}>
                <Ionicons name="checkmark-circle" size={24} color="#128C7E" />
                <Text style={styles.userFoundText}>User found: {foundUser.name}</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nickname (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter nickname"
                  value={nickname}
                  onChangeText={setNickname}
                />
              </View>

              <TouchableOpacity style={styles.addButton} onPress={handleAddContact} disabled={isLoading}>
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.addButtonText}>Add to Contacts</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
  formContainer: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#128C7E",
    marginBottom: 20,
    textAlign: "center",
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#F9F9F9",
  },
  phoneInputContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#F9F9F9",
  },
  searchButton: {
    backgroundColor: "#128C7E",
    padding: 12,
    borderRadius: 8,
    marginLeft: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  userFoundContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E7F3EF",
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  userFoundText: {
    marginLeft: 10,
    fontSize: 16,
    color: "#128C7E",
  },
  addButton: {
    backgroundColor: "#128C7E",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 15,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  cancelButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#128C7E",
  },
  cancelButtonText: {
    color: "#128C7E",
    fontSize: 16,
    fontWeight: "bold",
  },
})

export default AddContactScreen
