"use client"

import { useState, useEffect, useContext } from "react"
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, ActivityIndicator, Alert } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useNavigation } from "@react-navigation/native"
import { AuthContext } from "../../context/AuthContext"
import { ThemeContext } from "../../context/ThemeContext"
import { getTheme } from "../../utils/theme"
import * as ConversationsAPI from "../../api/conversations"
import * as EncryptionUtils from "../../utils/encryption"

const EncryptionScreen = () => {
  const navigation = useNavigation()
  const { state: authState } = useContext(AuthContext)
  const { theme } = useContext(ThemeContext)
  const currentTheme = getTheme(theme)

  const [isLoading, setIsLoading] = useState(true)
  const [conversations, setConversations] = useState([])
  const [encryptionStatus, setEncryptionStatus] = useState({})
  const [isUpdating, setIsUpdating] = useState(false)
  const [masterEncryption, setMasterEncryption] = useState(false)

  // Initialize encryption and fetch conversations
  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true)

        // Initialize encryption
        await EncryptionUtils.initializeEncryption()

        // Fetch conversations
        await fetchConversations()

        // Check if master encryption is enabled
        const key = await EncryptionUtils.getUserEncryptionKey()
        setMasterEncryption(!!key)
      } catch (error) {
        console.error("Error initializing encryption:", error)
        Alert.alert("Error", "Failed to initialize encryption settings")
      } finally {
        setIsLoading(false)
      }
    }

    initialize()
  }, [])

  // Fetch conversations
  const fetchConversations = async () => {
    try {
      const response = await ConversationsAPI.getConversations(authState.token)

      if (response.success) {
        setConversations(response.conversations)

        // Check encryption status for each conversation
        const status = {}
        for (const conversation of response.conversations) {
          status[conversation._id] = await EncryptionUtils.getEncryptionStatus(conversation._id)
        }

        setEncryptionStatus(status)
      } else {
        Alert.alert("Error", response.message || "Failed to load conversations")
      }
    } catch (error) {
      console.error("Error fetching conversations:", error)
      Alert.alert("Error", "Failed to load conversations")
    }
  }

  // Toggle encryption for a conversation
  const toggleConversationEncryption = async (conversationId) => {
    try {
      setIsUpdating(true)

      const currentStatus = encryptionStatus[conversationId]
      let success

      if (currentStatus) {
        // Disable encryption
        success = await EncryptionUtils.disableEncryption(conversationId)
      } else {
        // Enable encryption
        success = await EncryptionUtils.enableEncryption(conversationId)
      }

      if (success) {
        // Update state
        setEncryptionStatus({
          ...encryptionStatus,
          [conversationId]: !currentStatus,
        })
      } else {
        Alert.alert("Error", `Failed to ${currentStatus ? "disable" : "enable"} encryption`)
      }
    } catch (error) {
      console.error("Error toggling encryption:", error)
      Alert.alert("Error", "An error occurred while updating encryption settings")
    } finally {
      setIsUpdating(false)
    }
  }

  // Toggle master encryption
  const toggleMasterEncryption = async (value) => {
    try {
      setIsUpdating(true)

      if (value) {
        // Enable master encryption
        await EncryptionUtils.initializeEncryption()
        setMasterEncryption(true)

        // Show success message
        Alert.alert(
          "Encryption Enabled",
          "End-to-end encryption is now enabled. You can choose which conversations to encrypt.",
        )
      } else {
        // Confirm disabling encryption
        Alert.alert(
          'Disable Encryption",yption',
          "Are you sure you want to disable encryption? This will remove encryption from all conversations.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Disable",
              style: "destructive",
              onPress: async () => {
                // Disable encryption for all conversations
                for (const conversation of conversations) {
                  await EncryptionUtils.disableEncryption(conversation._id)
                }

                // Update state
                const newStatus = {}
                for (const conversation of conversations) {
                  newStatus[conversation._id] = false
                }

                setEncryptionStatus(newStatus)
                setMasterEncryption(false)
              },
            },
          ],
        )
      }
    } catch (error) {
      console.error("Error toggling master encryption:", error)
      Alert.alert("Error", "An error occurred while updating encryption settings")
    } finally {
      setIsUpdating(false)
    }
  }

  // Get conversation name
  const getConversationName = (conversation) => {
    if (conversation.isGroup) {
      return conversation.groupName || "Group"
    } else {
      // Find the other participant (not the current user)
      const otherParticipant = conversation.participants.find((p) => p._id !== authState.user.id)
      return otherParticipant?.name || "Unknown"
    }
  }

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: currentTheme.background }]}>
        <ActivityIndicator size="large" color={currentTheme.primary} />
        <Text style={[styles.loadingText, { color: currentTheme.text }]}>Loading encryption settings...</Text>
      </View>
    )
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <View style={[styles.infoCard, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
        <View style={styles.infoHeader}>
          <Ionicons name="lock-closed" size={24} color={currentTheme.primary} />
          <Text style={[styles.infoTitle, { color: currentTheme.text }]}>End-to-End Encryption</Text>
        </View>
        <Text style={[styles.infoText, { color: currentTheme.placeholder }]}>
          End-to-end encryption ensures only you and the person you're communicating with can read what's sent, and
          nobody in between, not even WhatsApp.
        </Text>
      </View>

      <View style={[styles.section, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: currentTheme.text }]}>Enable Encryption</Text>
            <Text style={[styles.settingDescription, { color: currentTheme.placeholder }]}>
              Turn on end-to-end encryption for your messages
            </Text>
          </View>
          <Switch
            value={masterEncryption}
            onValueChange={toggleMasterEncryption}
            disabled={isUpdating}
            trackColor={{ false: "#767577", true: "#128C7E" }}
            thumbColor={masterEncryption ? "#f4f3f4" : "#f4f3f4"}
          />
        </View>
      </View>

      {masterEncryption && (
        <View style={[styles.section, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
          <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>Conversation Encryption</Text>
          <Text style={[styles.sectionDescription, { color: currentTheme.placeholder }]}>
            Choose which conversations to encrypt
          </Text>

          {conversations.map((conversation) => (
            <View key={conversation._id} style={styles.conversationItem}>
              <View style={styles.conversationInfo}>
                <Text style={[styles.conversationName, { color: currentTheme.text }]}>
                  {getConversationName(conversation)}
                </Text>
                <Text style={[styles.conversationType, { color: currentTheme.placeholder }]}>
                  {conversation.isGroup ? "Group" : "Private chat"}
                </Text>
              </View>
              <Switch
                value={encryptionStatus[conversation._id] || false}
                onValueChange={() => toggleConversationEncryption(conversation._id)}
                disabled={isUpdating}
                trackColor={{ false: "#767577", true: "#128C7E" }}
                thumbColor={encryptionStatus[conversation._id] ? "#f4f3f4" : "#f4f3f4"}
              />
            </View>
          ))}

          {conversations.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: currentTheme.placeholder }]}>No conversations found</Text>
            </View>
          )}
        </View>
      )}

      <View style={[styles.section, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
        <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>Security Verification</Text>

        <TouchableOpacity style={styles.verificationButton} onPress={() => navigation.navigate("SecurityVerification")}>
          <Ionicons name="qr-code-outline" size={24} color={currentTheme.primary} style={styles.buttonIcon} />
          <Text style={[styles.buttonText, { color: currentTheme.text }]}>Verify Security Code</Text>
          <Ionicons name="chevron-forward" size={20} color={currentTheme.placeholder} />
        </TouchableOpacity>

        <Text style={[styles.verificationDescription, { color: currentTheme.placeholder }]}>
          Scan this code with your contact to verify that your messages and calls are end-to-end encrypted.
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: currentTheme.placeholder }]}>
          Your messages are secured with locks, and only the recipients have the special keys needed to unlock and read
          them.
        </Text>
      </View>
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
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  infoCard: {
    margin: 16,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 10,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  settingInfo: {
    flex: 1,
    marginRight: 10,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 16,
  },
  conversationItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  conversationInfo: {
    flex: 1,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  conversationType: {
    fontSize: 14,
  },
  emptyContainer: {
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
  },
  verificationButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  buttonIcon: {
    marginRight: 12,
  },
  buttonText: {
    fontSize: 16,
    flex: 1,
  },
  verificationDescription: {
    fontSize: 14,
    marginTop: 8,
  },
  footer: {
    padding: 16,
    alignItems: "center",
  },
  footerText: {
    fontSize: 14,
    textAlign: "center",
  },
})

export default EncryptionScreen
