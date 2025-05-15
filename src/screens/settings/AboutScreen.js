import React, { useContext } from "react"
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Linking } from "react-native"
import Ionicons from "react-native-vector-icons/Ionicons"
import { ThemeContext } from "../../context/ThemeContext"
import { getTheme } from "../../utils/theme"

const AboutScreen = () => {
  const { theme } = useContext(ThemeContext)
  const currentTheme = getTheme(theme)

  // Open website
  const openWebsite = () => {
    Linking.openURL("#")
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <View style={[styles.headerSection, { backgroundColor: currentTheme.card }]}>
        <Image source={require("../../assets/images/splash-logo.png")} style={styles.logo} resizeMode="contain" />
        <Text style={[styles.appName, { color: currentTheme.text }]}>CALLNOW</Text>
        <Text style={[styles.appVersion, { color: currentTheme.placeholder }]}>Version 1.0.0</Text>
      </View>

      <View style={[styles.section, { backgroundColor: currentTheme.card }]}>
        <Text style={[styles.sectionTitle, { color: currentTheme.primary }]}>About</Text>

        <View style={[styles.aboutItem, { borderBottomColor: currentTheme.border }]}>
          <Text style={[styles.aboutText, { color: currentTheme.text }]}>
            CallNow is a real-time communication app inspired by WhatsApp, built for learning and experimentation.
            It features instant messaging, voice and video calling, and media sharing — all designed to deliver a seamless and secure communication experience.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.menuItem, { borderBottomColor: currentTheme.border }]}
          onPress={openWebsite}
        >
          <View style={styles.menuItemContent}>
            <Ionicons name="globe-outline" size={24} color={currentTheme.primary} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: currentTheme.text }]}>Visit Website</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={currentTheme.placeholder} />
        </TouchableOpacity>
      </View>

      <View style={[styles.section, { backgroundColor: currentTheme.card }]}>
        <Text style={[styles.sectionTitle, { color: currentTheme.primary }]}>Features</Text>

        <View style={[styles.featureItem, { borderBottomColor: currentTheme.border }]}>
          <Ionicons name="chatbubble-outline" size={24} color={currentTheme.primary} style={styles.featureIcon} />
          <View style={styles.featureContent}>
            <Text style={[styles.featureTitle, { color: currentTheme.text }]}>Real-time Messaging</Text>
            <Text style={[styles.featureDescription, { color: currentTheme.placeholder }]}>
              Send and receive messages instantly with real-time updates.
            </Text>
          </View>
        </View>

        <View style={[styles.featureItem, { borderBottomColor: currentTheme.border }]}>
          <Ionicons name="call-outline" size={24} color={currentTheme.primary} style={styles.featureIcon} />
          <View style={styles.featureContent}>
            <Text style={[styles.featureTitle, { color: currentTheme.text }]}>Voice & Video Calls</Text>
            <Text style={[styles.featureDescription, { color: currentTheme.placeholder }]}>
              Make high-quality voice and video calls to your contacts.
            </Text>
          </View>
        </View>

        <View style={[styles.featureItem, { borderBottomColor: currentTheme.border }]}>
          <Ionicons name="image-outline" size={24} color={currentTheme.primary} style={styles.featureIcon} />
          <View style={styles.featureContent}>
            <Text style={[styles.featureTitle, { color: currentTheme.text }]}>Media Sharing</Text>
            <Text style={[styles.featureDescription, { color: currentTheme.placeholder }]}>
              Share photos, videos, documents, and more with your contacts.
            </Text>
          </View>
        </View>

        <View style={[styles.featureItem, { borderBottomColor: currentTheme.border }]}>
          <Ionicons name="people-outline" size={24} color={currentTheme.primary} style={styles.featureIcon} />
          <View style={styles.featureContent}>
            <Text style={[styles.featureTitle, { color: currentTheme.text }]}>Group Chats</Text>
            <Text style={[styles.featureDescription, { color: currentTheme.placeholder }]}>
              Create groups to chat with multiple contacts at once.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.creditsContainer}>
        <Text style={[styles.creditsTitle, { color: currentTheme.placeholder }]}>Developed By</Text>
        <Text style={[styles.developerName, { color: currentTheme.text }]}>Sajeel Safdar</Text>
        <Text style={[styles.copyright, { color: currentTheme.placeholder }]}>© 2025 CALLNOW</Text>
        <Text style={[styles.disclaimer, { color: currentTheme.placeholder }]}>
          This application created solely for final year project and is not affiliated with or endorsed by WhatsApp Inc. or any other company.
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSection: {
    alignItems: "center",
    padding: 30,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 15,
  },
  appName: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 5,
  },
  appVersion: {
    fontSize: 14,
  },
  section: {
    marginTop: 20,
    paddingVertical: 5,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  aboutItem: {
    padding: 15,
    borderBottomWidth: 1,
  },
  aboutText: {
    fontSize: 14,
    lineHeight: 20,
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
  },
  menuItemContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuIcon: {
    marginRight: 15,
  },
  menuText: {
    fontSize: 16,
  },
  featureItem: {
    flexDirection: "row",
    padding: 15,
    borderBottomWidth: 1,
  },
  featureIcon: {
    marginRight: 15,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  creditsContainer: {
    padding: 20,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 40,
  },
  creditsTitle: {
    fontSize: 14,
    marginBottom: 5,
  },
  developerName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  copyright: {
    fontSize: 12,
    marginBottom: 10,
  },
  disclaimer: {
    fontSize: 12,
    textAlign: "center",
  },
})

export default AboutScreen
