"use client"

import { useContext } from "react"
// import { NavigationContainer } from "@react-navigation/native"
import { createStackNavigator } from "@react-navigation/stack"
// import { Ionicon } from "../components/ui/AppIcons"
// import { TouchableOpacity } from "react-native"

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

// // Chat Screens
// import ChatScreen from "../screens/chat/ChatScreen"
//
// // Contact Screens
// import ContactsScreen from "../screens/contacts/ContactsScreen"
// import AddContactScreen from "../screens/contacts/AddContactScreen"
// import ContactDetailsScreen from "../screens/contacts/ContactDetailsScreen"
//
// // Call Screens
// import CallScreen from "../screens/calls/CallScreen"
// import GroupCallScreen from "../screens/calls/GroupCallScreen"
//
// // Settings Screens
// import PrivacyScreen from "../screens/settings/PrivacyScreen"
// import HelpScreen from "../screens/settings/HelpScreen"
// import AboutScreen from "../screens/settings/AboutScreen"
// import DevicesScreen from '../screens/settings/DevicesScreen';
import { ThemeContext } from '../context/ThemeContext';
import { getTheme } from '../utils/theme';
const Stack = createStackNavigator()

const AppNavigator = () => {
  const { state } = useContext(AuthContext)
  const { theme } = useContext(ThemeContext);
  const currentTheme = getTheme(theme);
  // Show splash screen while checking authentication
  if (state.isLoading) {
    return <SplashScreen />
  }
  console.log("state.token", state.token)
  return (
    // <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: currentTheme.primary,
          },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontWeight: 'bold',
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
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
              options={{ title: "Reset Password" }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} options={{ headerShown: false }} />
          </>
        )}
      </Stack.Navigator>
  )
}

export default AppNavigator
