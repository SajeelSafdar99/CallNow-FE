"use client"

import { useState, useContext, useEffect } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AuthContext } from "../../context/AuthContext"

// Sample country data - you can expand this list
const countries = [
  { code: "+1", name: "United States", flag: "🇺🇸" },
  { code: "+44", name: "United Kingdom", flag: "🇬🇧" },
  { code: "+91", name: "India", flag: "🇮🇳" },
  { code: "+61", name: "Australia", flag: "🇦🇺" },
  { code: "+86", name: "China", flag: "🇨🇳" },
  { code: "+49", name: "Germany", flag: "🇩🇪" },
  { code: "+33", name: "France", flag: "🇫🇷" },
  { code: "+81", name: "Japan", flag: "🇯🇵" },
  { code: "+7", name: "Russia", flag: "🇷🇺" },
  { code: "+55", name: "Brazil", flag: "🇧🇷" },
  { code: "+52", name: "Mexico", flag: "🇲🇽" },
  { code: "+39", name: "Italy", flag: "🇮🇹" },
  { code: "+34", name: "Spain", flag: "🇪🇸" },
  { code: "+82", name: "South Korea", flag: "🇰🇷" },
  { code: "+1", name: "Canada", flag: "🇨🇦" },
  {code: "+92", name: "Pakistan", flag: "🇵🇰"}
];

const LoginScreen = ({ navigation }) => {
  const [selectedCountry, setSelectedCountry] = useState(countries[0])
  const [showCountryModal, setShowCountryModal] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const { login } = useContext(AuthContext)

  const filteredCountries = searchQuery
    ? countries.filter(country =>
      country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      country.code.includes(searchQuery)
    )
    : countries;

  const handleLogin = async () => {
    if (!selectedCountry || !phoneNumber || !password) {
      Alert.alert("Error", "Please enter country code, phone number and password")
      return
    }

    const fullPhoneNumber = `${selectedCountry.code}${phoneNumber}`

    setIsLoading(true)
    try {
      const result = await login(fullPhoneNumber, password)

      if (result.success) {
        // Login successful - navigation will be handled by AppNavigator
      } else if (result.status === "suspended") {
        // Handle suspended account
        let message = result.message || "Your account has been suspended."

        if (result.expiresAt) {
          const expiryDate = new Date(result.expiresAt)
          message += `\n\nYour account will be unsuspended on ${expiryDate.toLocaleDateString()} at ${expiryDate.toLocaleTimeString()}.`
        }

        Alert.alert("Account Suspended", message)
      } else if (result.message === 'Account not verified. Please verify your phone number first.') {
        navigation.navigate("OtpVerification", {
          phoneNumber: fullPhoneNumber,
          purpose: "registration",
          fromLogin: true
        })
      } else {
        // Other login failures
        Alert.alert("Login Failed", result.message)
      }
    } catch (error) {
      Alert.alert("Error", "An unexpected error occurred. Please try again.")
      console.error("Login error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const renderCountryItem = ({ item }) => (
    <TouchableOpacity
      style={styles.countryItem}
      onPress={() => {
        setSelectedCountry(item)
        setShowCountryModal(false)
      }}
    >
      <Text style={styles.countryFlag}>{item.flag}</Text>
      <Text style={styles.countryName}>{item.name}</Text>
      <Text style={styles.countryCode}>{item.code}</Text>
    </TouchableOpacity>
  )

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Image source={require("../../assets/images/splash-logo.png")} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>

          <View style={styles.form}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.phoneContainer}>
              <TouchableOpacity
                style={styles.countrySelector}
                onPress={() => setShowCountryModal(true)}
              >
                <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                <Text style={styles.countryCodeText}>{selectedCountry.code}</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.phoneInput}
                placeholder="Enter your phone number"
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword")} style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={isLoading}>
              {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Login</Text>}
            </TouchableOpacity>

            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate("Register")}>
                <Text style={styles.registerLink}>Register</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Country Selection Modal */}
      <Modal
        visible={showCountryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCountryModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity onPress={() => setShowCountryModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Search country..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />

            <FlatList
              data={filteredCountries}
              renderItem={renderCountryItem}
              keyExtractor={(item, index) => `${item.name}-${index}`}
              style={styles.countryList}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#128C7E",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 30,
  },
  form: {
    width: "100%",
  },
  label: {
    fontSize: 16,
    color: "#333",
    marginBottom: 5,
  },
  phoneContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  countrySelector: {
    backgroundColor: "#F0F0F0",
    borderRadius: 8,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    width: '30%',
    marginRight: 8,
    justifyContent: 'center',
  },
  countryFlag: {
    fontSize: 20,
    marginRight: 5,
  },
  countryCodeText: {
    fontSize: 16,
  },
  phoneInput: {
    backgroundColor: "#F0F0F0",
    borderRadius: 8,
    padding: 15,
    flex: 1,
    fontSize: 16,
  },
  input: {
    backgroundColor: "#F0F0F0",
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: "#128C7E",
    fontSize: 14,
  },
  button: {
    backgroundColor: "#128C7E",
    borderRadius: 8,
    padding: 15,
    alignItems: "center",
    marginBottom: 20,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
  },
  registerText: {
    color: "#666",
    fontSize: 14,
  },
  registerLink: {
    color: "#128C7E",
    fontSize: 14,
    fontWeight: "bold",
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '70%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#128C7E',
  },
  closeButton: {
    fontSize: 20,
    color: '#666',
  },
  searchInput: {
    backgroundColor: "#F0F0F0",
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  countryList: {
    flex: 1,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  countryName: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 10,
  },
  countryCode: {
    fontSize: 16,
    color: '#666',
    marginLeft: 10,
  },
})

export default LoginScreen
