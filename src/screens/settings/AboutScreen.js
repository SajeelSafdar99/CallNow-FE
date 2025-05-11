import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Linking } from "react-native"
import Ionicons from "react-native-vector-icons/Ionicons"

const AboutScreen = () => {
  // Open website
  const openWebsite = () => {
    Linking.openURL("#")
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerSection}>
        <Image source={require("../../assets/images/splash-logo.png")} style={styles.logo} resizeMode="contain" />
        <Text style={styles.appName}>CALLNOW</Text>
        <Text style={styles.appVersion}>Version 1.0.0</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>

        <View style={styles.aboutItem}>
          <Text style={styles.aboutText}>
            CallNow is a real-time communication app inspired by WhatsApp, built for learning and experimentation.
            It features instant messaging, voice and video calling, and media sharing — all designed to deliver a seamless and secure communication experience.
          </Text>
        </View>

        <TouchableOpacity style={styles.menuItem} onPress={openWebsite}>
          <View style={styles.menuItemContent}>
            <Ionicons name="globe-outline" size={24} color="#666" style={styles.menuIcon} />
            <Text style={styles.menuText}>Visit Website</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Features</Text>

        <View style={styles.featureItem}>
          <Ionicons name="chatbubble-outline" size={24} color="#128C7E" style={styles.featureIcon} />
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Real-time Messaging</Text>
            <Text style={styles.featureDescription}>Send and receive messages instantly with real-time updates.</Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <Ionicons name="call-outline" size={24} color="#128C7E" style={styles.featureIcon} />
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Voice & Video Calls</Text>
            <Text style={styles.featureDescription}>Make high-quality voice and video calls to your contacts.</Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <Ionicons name="image-outline" size={24} color="#128C7E" style={styles.featureIcon} />
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Media Sharing</Text>
            <Text style={styles.featureDescription}>Share photos, videos, documents, and more with your contacts.</Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <Ionicons name="people-outline" size={24} color="#128C7E" style={styles.featureIcon} />
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Group Chats</Text>
            <Text style={styles.featureDescription}>Create groups to chat with multiple contacts at once.</Text>
          </View>
        </View>
      </View>

      <View style={styles.creditsContainer}>
        <Text style={styles.creditsTitle}>Developed By</Text>
        <Text style={styles.developerName}>Sajeel Safdar</Text>
        <Text style={styles.copyright}>© 2025 CALLNOW</Text>
        <Text style={styles.disclaimer}>
          This application created solely for final year project and is not affiliated with or endorsed by WhatsApp Inc. or any other company.</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F8F8",
  },
  headerSection: {
    alignItems: "center",
    padding: 30,
    backgroundColor: "#FFFFFF",
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
    color: "#666",
  },
  section: {
    backgroundColor: "#FFFFFF",
    marginTop: 20,
    paddingVertical: 5,
  },
  sectionTitle: {
    fontSize: 14,
    color: "#128C7E",
    fontWeight: "bold",
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  aboutItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  aboutText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#333",
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
  featureItem: {
    flexDirection: "row",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
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
    color: "#666",
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
    color: "#999",
    marginBottom: 5,
  },
  developerName: {
    fontSize: 18,
    fontWeight: "bold",
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

export default AboutScreen
