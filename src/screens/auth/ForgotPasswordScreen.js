"use client"

import { useState, useContext } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AuthContext } from "../../context/AuthContext"

const ForgotPasswordScreen = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { forgotPassword } = useContext(AuthContext)

  const handleForgotPassword = async () => {
    if (!phoneNumber) {
      Alert.alert("Error", "Please enter your phone number")
      return
    }

    setIsLoading(true)
    try {
      const result = await forgotPassword(phoneNumber)
      if (result.success) {
        navigation.navigate("OtpVerification", {
          phoneNumber,
          purpose: "password_reset",
        })
      } else {
        Alert.alert("Request Failed", result.message)
      }
    } catch (error) {
      Alert.alert("Error", "An unexpected error occurred. Please try again.")
      console.error("Forgot password error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
        <Image source={require("../../assets/images/splash-logo.png")} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Forgot Password</Text>
        <Text style={styles.subtitle}>Enter your phone number and we'll send you an OTP to reset your password</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your phone number"
            keyboardType="phone-pad"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            autoCapitalize="none"
          />

          <TouchableOpacity style={styles.button} onPress={handleForgotPassword} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Send OTP</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    textAlign: "center",
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
  input: {
    backgroundColor: "#F0F0F0",
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    fontSize: 16,
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
  backButton: {
    alignItems: "center",
  },
  backButtonText: {
    color: "#128C7E",
    fontSize: 16,
  },
})

export default ForgotPasswordScreen
