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

const LoginScreen = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useContext(AuthContext)

  const handleLogin = async () => {
    if (!phoneNumber || !password) {
      Alert.alert("Error", "Please enter both phone number and password")
      return
    }

    setIsLoading(true)
    try {
      const result = await login(phoneNumber, password)
      if (!result.success) {
        Alert.alert("Login Failed", result.message)
      }
    } catch (error) {
      Alert.alert("Error", "An unexpected error occurred. Please try again.")
      console.error("Login error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Image source={require("../../assets/images/splash-logo.png")} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>

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
})

export default LoginScreen
