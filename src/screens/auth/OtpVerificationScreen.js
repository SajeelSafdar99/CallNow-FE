"use client"

import { useState, useContext, useEffect, useRef } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AuthContext } from "../../context/AuthContext"

const OtpVerificationScreen = ({ route, navigation }) => {
  const { phoneNumber, purpose = "registration", fromLogin = false } = route.params
  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [isLoading, setIsLoading] = useState(false)
  const [resendDisabled, setResendDisabled] = useState(true)
  const [countdown, setCountdown] = useState(60)
  const { verifyOTP, resendOTP } = useContext(AuthContext)
  const [initialResendDone, setInitialResendDone] = useState(false)

  const inputRefs = useRef([])

  // Auto-trigger resendOTP when coming from login screen
  useEffect(() => {
    const autoResendOTP = async () => {
      if (fromLogin && !initialResendDone) {
        setIsLoading(true)
        try {
          const result = await resendOTP(phoneNumber, purpose)
          if (result.success) {
            setInitialResendDone(true)
            // No need to show an alert since this is automatic
            console.log("OTP sent automatically")
          } else {
            Alert.alert("OTP Send Failed", result.message)
          }
        } catch (error) {
          Alert.alert("Error", "Failed to send OTP. Please try manually.")
          console.error("Auto resend OTP error:", error)
        } finally {
          setIsLoading(false)
        }
      }
    }

    autoResendOTP()
  }, [fromLogin, phoneNumber, purpose, resendOTP, initialResendDone])

  useEffect(() => {
    let interval = null
    if (resendDisabled && countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prevCountdown) => prevCountdown - 1)
      }, 1000)
    } else if (countdown === 0) {
      setResendDisabled(false)
    }
    return () => clearInterval(interval)
  }, [resendDisabled, countdown])

  const handleOtpChange = (value, index) => {
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)

    // Auto focus to next input
    if (value && index < 5) {
      inputRefs.current[index + 1].focus()
    }
  }

  const handleKeyPress = (e, index) => {
    // Handle backspace
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus()
    }
  }

  const handleVerify = async () => {
    const otpString = otp.join("")
    if (otpString.length !== 6) {
      Alert.alert("Error", "Please enter a valid 6-digit OTP")
      return
    }

    setIsLoading(true)
    try {
      const result = await verifyOTP(phoneNumber, otpString, purpose)
      if (result.success) {
        if (purpose === "password_reset") {
          navigation.navigate("ResetPassword", { phoneNumber, otp: otpString })
        }
        // For registration, the user will be automatically logged in
      } else {
        Alert.alert("Verification Failed", result.message)
      }
    } catch (error) {
      Alert.alert("Error", "An unexpected error occurred. Please try again.")
      console.error("OTP verification error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOTP = async () => {
    setIsLoading(true)
    try {
      const result = await resendOTP(phoneNumber, purpose)
      if (result.success) {
        setResendDisabled(true)
        setCountdown(60)
        Alert.alert("Success", "OTP has been resent to your phone number")
      } else {
        Alert.alert("Resend Failed", result.message)
      }
    } catch (error) {
      Alert.alert("Error", "An unexpected error occurred. Please try again.")
      console.error("Resend OTP error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
        <Text style={styles.title}>Verify Your Number</Text>
        <Text style={styles.subtitle}>
          We have sent a verification code to{"\n"}
          <Text style={styles.phoneNumber}>{phoneNumber}</Text>
        </Text>

        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={styles.otpInput}
              value={digit}
              onChangeText={(value) => handleOtpChange(value, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Verify</Text>}
        </TouchableOpacity>

        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Didn't receive the code? </Text>
          {resendDisabled ? (
            <Text style={styles.countdown}>Resend in {countdown}s</Text>
          ) : (
            <TouchableOpacity onPress={handleResendOTP} disabled={isLoading}>
              <Text style={styles.resendLink}>Resend OTP</Text>
            </TouchableOpacity>
          )}
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
  phoneNumber: {
    fontWeight: "bold",
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "80%",
    marginBottom: 30,
  },
  otpInput: {
    width: 45,
    height: 50,
    borderWidth: 1,
    borderColor: "#128C7E",
    borderRadius: 8,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
  },
  button: {
    backgroundColor: "#128C7E",
    borderRadius: 8,
    padding: 15,
    alignItems: "center",
    width: "80%",
    marginBottom: 20,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  resendContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  resendText: {
    color: "#666",
    fontSize: 14,
  },
  resendLink: {
    color: "#128C7E",
    fontSize: 14,
    fontWeight: "bold",
  },
  countdown: {
    color: "#999",
    fontSize: 14,
  },
})

export default OtpVerificationScreen
