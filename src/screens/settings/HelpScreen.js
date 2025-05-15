import React, { useContext } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from "react-native"
import Ionicons from 'react-native-vector-icons/Ionicons'
import { ThemeContext } from "../../context/ThemeContext"
import { getTheme } from "../../utils/theme"

const HelpScreen = () => {
  const { theme } = useContext(ThemeContext)
  const currentTheme = getTheme(theme)

  // Open FAQ website
  const openFAQ = () => {
    Linking.openURL("#")
  }

  // Open contact us form
  const contactSupport = () => {
    Linking.openURL("#")
  }

  // Open terms of service
  const openTerms = () => {
    Linking.openURL("#")
  }

  // Open privacy policy
  const openPrivacyPolicy = () => {
    Linking.openURL("#")
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <View style={[styles.section, { backgroundColor: currentTheme.card }]}>
        <Text style={[styles.sectionTitle, { color: currentTheme.primary }]}>Help</Text>

        <TouchableOpacity
          style={[styles.menuItem, { borderBottomColor: currentTheme.border }]}
          onPress={openFAQ}
        >
          <View style={styles.menuItemContent}>
            <Ionicons name="help-circle-outline" size={24} color={currentTheme.primary} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: currentTheme.text }]}>FAQ</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={currentTheme.placeholder} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, { borderBottomColor: currentTheme.border }]}
          onPress={contactSupport}
        >
          <View style={styles.menuItemContent}>
            <Ionicons name="mail-outline" size={24} color={currentTheme.primary} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: currentTheme.text }]}>Contact Us</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={currentTheme.placeholder} />
        </TouchableOpacity>
      </View>

      <View style={[styles.section, { backgroundColor: currentTheme.card }]}>
        <Text style={[styles.sectionTitle, { color: currentTheme.primary }]}>Legal</Text>

        <TouchableOpacity
          style={[styles.menuItem, { borderBottomColor: currentTheme.border }]}
          onPress={openTerms}
        >
          <View style={styles.menuItemContent}>
            <Ionicons name="document-text-outline" size={24} color={currentTheme.primary} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: currentTheme.text }]}>Terms of Service</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={currentTheme.placeholder} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, { borderBottomColor: currentTheme.border }]}
          onPress={openPrivacyPolicy}
        >
          <View style={styles.menuItemContent}>
            <Ionicons name="lock-closed-outline" size={24} color={currentTheme.primary} style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: currentTheme.text }]}>Privacy Policy</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={currentTheme.placeholder} />
        </TouchableOpacity>
      </View>

      <View style={styles.appInfoContainer}>
        <Text style={[styles.appName, { color: currentTheme.text }]}>CALLNOW</Text>
        <Text style={[styles.appVersion, { color: currentTheme.placeholder }]}>Version 1.0.0</Text>
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
  section: {
    marginBottom: 20,
    paddingVertical: 5,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    paddingHorizontal: 15,
    paddingVertical: 10,
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
  appInfoContainer: {
    padding: 20,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 40,
  },
  appName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
  },
  appVersion: {
    fontSize: 14,
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

export default HelpScreen
