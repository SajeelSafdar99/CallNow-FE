"use client"

import { useState, useContext } from "react"
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, Alert } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { AuthContext } from "../../context/AuthContext"

const PrivacyScreen = () => {
  const { state: authState } = useContext(AuthContext)

  // Privacy settings state
  const [lastSeen, setLastSeen] = useState("everyone") // everyone, contacts, nobody
  const [profilePhoto, setProfilePhoto] = useState("everyone")
  const [status, setStatus] = useState("everyone")
  const [readReceipts, setReadReceipts] = useState(true)
  const [groupsPermission, setGroupsPermission] = useState("everyone")
  const [blockedContacts, setBlockedContacts] = useState([])

  // Toggle read receipts
  const toggleReadReceipts = () => {
    setReadReceipts(!readReceipts)
    // In a real app, you would save this to the backend
  }

  // Show options for privacy settings
  const showPrivacyOptions = (setting, currentValue, onSelect) => {
    Alert.alert(`Who can see your ${setting}?`, "", [
      {
        text: "Everyone",
        onPress: () => onSelect("everyone"),
        style: currentValue === "everyone" ? "destructive" : "default",
      },
      {
        text: "My Contacts",
        onPress: () => onSelect("contacts"),
        style: currentValue === "contacts" ? "destructive" : "default",
      },
      {
        text: "Nobody",
        onPress: () => onSelect("nobody"),
        style: currentValue === "nobody" ? "destructive" : "default",
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ])
  }

  // Format privacy option text
  const formatPrivacyOption = (option) => {
    switch (option) {
      case "everyone":
        return "Everyone"
      case "contacts":
        return "My Contacts"
      case "nobody":
        return "Nobody"
      default:
        return "Everyone"
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Who can see my personal info</Text>

        <TouchableOpacity
          style={styles.settingItem}
          onPress={() => showPrivacyOptions("last seen", lastSeen, setLastSeen)}
        >
          <View>
            <Text style={styles.settingTitle}>Last seen</Text>
            <Text style={styles.settingValue}>{formatPrivacyOption(lastSeen)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingItem}
          onPress={() => showPrivacyOptions("profile photo", profilePhoto, setProfilePhoto)}
        >
          <View>
            <Text style={styles.settingTitle}>Profile photo</Text>
            <Text style={styles.settingValue}>{formatPrivacyOption(profilePhoto)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem} onPress={() => showPrivacyOptions("status", status, setStatus)}>
          <View>
            <Text style={styles.settingTitle}>Status</Text>
            <Text style={styles.settingValue}>{formatPrivacyOption(status)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Chat settings</Text>

        <View style={styles.settingItem}>
          <View>
            <Text style={styles.settingTitle}>Read receipts</Text>
            <Text style={styles.settingDescription}>
              If turned off, you won't send or receive read receipts. Read receipts are always sent for group chats.
            </Text>
          </View>
          <Switch
            value={readReceipts}
            onValueChange={toggleReadReceipts}
            trackColor={{ false: "#D9D9D9", true: "#25D366" }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Groups</Text>

        <TouchableOpacity
          style={styles.settingItem}
          onPress={() => showPrivacyOptions("groups", groupsPermission, setGroupsPermission)}
        >
          <View>
            <Text style={styles.settingTitle}>Groups</Text>
            <Text style={styles.settingValue}>{formatPrivacyOption(groupsPermission)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.settingItem}
          onPress={() => {
            // Navigate to blocked contacts screen
            // navigation.navigate("BlockedContacts");
            Alert.alert("Blocked Contacts", "This feature is not implemented yet.")
          }}
        >
          <View>
            <Text style={styles.settingTitle}>Blocked contacts</Text>
            <Text style={styles.settingValue}>{blockedContacts.length} contacts</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.settingItem}
          onPress={() => {
            Alert.alert(
              "Delete My Account",
              "This will delete your account, remove you from all groups, and delete your message history on this device.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete My Account",
                  style: "destructive",
                  onPress: () => {
                    // In a real app, you would call an API to delete the account
                    Alert.alert("Account Deletion", "This feature is not implemented yet.")
                  },
                },
              ],
            )
          }}
        >
          <Text style={styles.deleteAccountText}>Delete My Account</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F8F8",
  },
  section: {
    backgroundColor: "#FFFFFF",
    marginBottom: 20,
    paddingVertical: 5,
  },
  sectionTitle: {
    fontSize: 14,
    color: "#128C7E",
    fontWeight: "bold",
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  settingTitle: {
    fontSize: 16,
    marginBottom: 3,
  },
  settingValue: {
    fontSize: 14,
    color: "#666",
  },
  settingDescription: {
    fontSize: 12,
    color: "#999",
    marginTop: 5,
    width: "80%",
  },
  deleteAccountText: {
    color: "#FF3B30",
    fontSize: 16,
  },
})

export default PrivacyScreen
