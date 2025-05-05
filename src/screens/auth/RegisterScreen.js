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
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AuthContext } from "../../context/AuthContext"

const RegisterScreen = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState("")
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { register } = useContext(AuthContext)

  const handleRegister = async () => {
    // Validate inputs
    if (!phoneNumber || !name || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields")
      return
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match")
      return
    }

    setIsLoading(true)
    try {
      const result = await register(phoneNumber, password, name)
      if (result.success) {
        navigation.navigate("OtpVerification", {
          phoneNumber,
          purpose: "registration",
        })
      } else {
        Alert.alert("Registration Failed", result.message)
      }
    } catch (error) {
      Alert.alert("Error", "An unexpected error occurred. Please try again.")
      console.error("Registration error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Image source={require("../../assets/images/splash-logo.png")} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up to get started</Text>

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

            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} placeholder="Enter your name" value={name} onChangeText={setName} />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Confirm your password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={isLoading}>
              {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Register</Text>}
            </TouchableOpacity>

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                <Text style={styles.loginLink}>Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
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
  input: {
    backgroundColor: "#F0F0F0",
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
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
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
  },
  loginText: {
    color: "#666",
    fontSize: 14,
  },
  loginLink: {
    color: "#128C7E",
    fontSize: 14,
    fontWeight: "bold",
  },
})

export default RegisterScreen
