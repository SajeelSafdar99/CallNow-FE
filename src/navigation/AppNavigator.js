"use client"

import { useContext, useEffect } from "react"
import { createStackNavigator } from "@react-navigation/stack"

// Context
import { AuthContext } from "../context/AuthContext"

// Auth Screens
import SplashScreen from "../screens/auth/SplashScreen"
import LoginScreen from "../screens/auth/LoginScreen"
import RegisterScreen from "../screens/auth/RegisterScreen"
import OtpVerificationScreen from "../screens/auth/OtpVerificationScreen"
import ForgotPasswordScreen from "../screens/auth/ForgotPasswordScreen"

// Main Navigation
import MainTabNavigator from "./MainTabNavigator"

// Admin Screens
import UserDetailScreen from "../screens/admin/UserDetailScreen"
import SuspendUserScreen from "../screens/admin/SuspendUserScreen"

import { ThemeContext } from "../context/ThemeContext"
import { getTheme } from "../utils/theme"
const Stack = createStackNavigator()

const AppNavigator = ({ navigation }) => {
  const { state, checkTokenExpiration } = useContext(AuthContext)
  const { theme } = useContext(ThemeContext)
  const currentTheme = getTheme(theme)

  // Check token expiration on mount and when state.token changes
  useEffect(() => {
    if (state.token) {
      checkTokenExpiration()
    }
  }, [state.token, checkTokenExpiration])

  // Store navigation reference globally for use in other parts of the app
  useEffect(() => {
    if (global.navigationRef) {
      global.navigationRef.current = navigation
    }

    // Debug state changes
    console.log("AppNavigator state changed, token:", state.token)
  }, [state.token])

  // Show splash screen while checking authentication
  if (state.isLoading) {
    return <SplashScreen />
  }

  console.log("state.token", state.token)
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: currentTheme.primary,
        },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: {
          fontWeight: "bold",
        },
      }}
    >
      {state.token === null ? (
        // Auth screens
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ title: "Create Account" }} />
          <Stack.Screen
            name="OtpVerification"
            component={OtpVerificationScreen}
            options={{ title: "Verify Phone Number" }}
          />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: "Reset Password" }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabNavigator} options={{ headerShown: false }} />

          {/* Admin screens */}
          <Stack.Screen name="UserDetail" component={UserDetailScreen} options={{ title: "User Details" }} />
          <Stack.Screen name="SuspendUser" component={SuspendUserScreen} options={{ title: "Suspend User" }} />
        </>
      )}
    </Stack.Navigator>
  )
}

export default AppNavigator
