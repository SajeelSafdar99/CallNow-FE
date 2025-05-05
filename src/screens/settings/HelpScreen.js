import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from "react-native"
import { Ionicons } from "@expo/vector-icons"

const HelpScreen = () => {
  // Open FAQ website
  const openFAQ = () => {
    Linking.openURL("https://faq.whatsapp.com/")
  }

  // Open contact us form
  const contactSupport = () => {
    Linking.openURL("https://www.whatsapp.com/contact/")
  }

  // Open terms of service
  const openTerms = () => {
    Linking.openURL("https://www.whatsapp.com/legal/terms-of-service")
  }

  // Open privacy policy
  const openPrivacyPolicy = () => {
    Linking.openURL("https://www.whatsapp.com/legal/privacy-policy")
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Help</Text>

        <TouchableOpacity style={styles.menuItem} onPress={openFAQ}>
          <View style={styles.menuItemContent}>
            <Ionicons name="help-circle-outline" size={24} color="#666" style={styles.menuIcon} />
            <Text style={styles.menuText}>FAQ</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={contactSupport}>
          <View style={styles.menuItemContent}>
            <Ionicons name="mail-outline" size={24} color="#666" style={styles.menuIcon} />
            <Text style={styles.menuText}>Contact Us</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Legal</Text>

        <TouchableOpacity style={styles.menuItem} onPress={openTerms}>
          <View style={styles.menuItemContent}>
            <Ionicons name="document-text-outline" size={24} color="#666" style={styles.menuIcon} />
            <Text style={styles.menuText}>Terms of Service</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={openPrivacyPolicy}>
          <View style={styles.menuItemContent}>
            <Ionicons name="lock-closed-outline" size={24} color="#666" style={styles.menuIcon} />
            <Text style={styles.menuText}>Privacy Policy</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
      </View>

      <View style={styles.appInfoContainer}>
        <Text style={styles.appName}>WhatsApp Clone</Text>
        <Text style={styles.appVersion}>Version 1.0.0</Text>
        <Text style={styles.copyright}>© 2023 WhatsApp Clone</Text>
        <Text style={styles.disclaimer}>
          This is a demo application created for educational purposes only. It is not affiliated with WhatsApp Inc.
        </Text>
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
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
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
    color: "#666",
    marginBottom: 10,
  },
  copyright: {
    fontSize: 12,
    color: "#999",
    marginBottom: 10,
  },
  disclaimer: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
  },
})

export default HelpScreen
