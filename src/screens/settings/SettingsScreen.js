"use client"

import { useContext } from "react"
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native"
import Ionicons from "react-native-vector-icons/Ionicons"
import { useNavigation } from "@react-navigation/native"
import { AuthContext } from "../../context/AuthContext"
import { ThemeContext } from "../../context/ThemeContext"
import { getTheme } from "../../utils/theme"

const SettingsScreen = () => {
  const navigation = useNavigation()
  const { logout } = useContext(AuthContext)
  const { theme } = useContext(ThemeContext)
  const currentTheme = getTheme(theme)

  // Handle logout
  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              await logout()
            } catch (error) {
              console.error("Logout error:", error)
              Alert.alert("Error", "Failed to logout. Please try again.")
            }
          },
        },
      ],
      { cancelable: true },
    )
  }

  // Settings options
  const settingsOptions = [
    {
      section: "Account",
      items: [
        {
          icon: "person",
          label: "Profile",
          onPress: () => navigation.navigate("Profile"),
          showChevron: true,
        },
        {
          icon: "key",
          label: "Privacy",
          onPress: () => navigation.navigate("Privacy"),
          showChevron: true,
        },
        {
          icon: "shield-checkmark",
          label: "Security",
          onPress: () => navigation.navigate("Security"),
          showChevron: true,
        },
        {
          icon: "phone-portrait",
          label: "Linked Devices",
          onPress: () => navigation.navigate("Devices"),
          showChevron: true,
        },
      ],
    },
    {
      section: "App",
      items: [
        {
          icon: "chatbubbles",
          label: "Chats",
          onPress: () => navigation.navigate("ChatSettings"),
          showChevron: true,
        },
        {
          icon: "notifications",
          label: "Notifications",
          onPress: () => navigation.navigate("NotificationSettings"),
          showChevron: true,
        },
        {
          icon: "color-palette",
          label: "Appearance",
          onPress: () => navigation.navigate("Appearance"),
          showChevron: true,
        },
        {
          icon: "lock-closed",
          label: "Encryption",
          onPress: () => navigation.navigate("Encryption"),
          showChevron: true,
        },
      ],
    },
    {
      section: "Support",
      items: [
        {
          icon: "help-circle",
          label: "Help",
          onPress: () => navigation.navigate("Help"),
          showChevron: true,
        },
        {
          icon: "information-circle",
          label: "About",
          onPress: () => navigation.navigate("About"),
          showChevron: true,
        },
      ],
    },
  ]

  return (
    <ScrollView style={[styles.container, { backgroundColor: currentTheme.background }]}>
      {settingsOptions.map((section, sectionIndex) => (
        <View key={sectionIndex} style={[styles.section, { backgroundColor: currentTheme.card }]}>
          <Text style={[styles.sectionTitle, { color: currentTheme.primary }]}>{section.section}</Text>

          {section.items.map((item, itemIndex) => (
            <TouchableOpacity
              key={itemIndex}
              style={[
                styles.settingItem,
                itemIndex === section.items.length - 1 && styles.lastItem,
                { borderBottomColor: currentTheme.border },
              ]}
              onPress={item.onPress}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.iconContainer, { backgroundColor: currentTheme.primary + "20" }]}>
                  <Ionicons name={item.icon} size={20} color={currentTheme.primary} />
                </View>
                <Text style={[styles.settingLabel, { color: currentTheme.text }]}>{item.label}</Text>
              </View>

              {item.showChevron && <Ionicons name="chevron-forward" size={20} color={currentTheme.placeholder} />}
            </TouchableOpacity>
          ))}
        </View>
      ))}

      <TouchableOpacity style={[styles.logoutButton, { backgroundColor: currentTheme.card }]} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: 20,
    borderRadius: 10,
    overflow: "hidden",
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
  },
  logoutButton: {
    marginHorizontal: 16,
    marginBottom: 30,
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#FF3B30",
  },
})

export default SettingsScreen
