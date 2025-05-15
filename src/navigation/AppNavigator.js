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
          // Main app screens
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} options={{ headerShown: false }} />
            {/*<Stack.Screen*/}
            {/*  name="Chat"*/}
            {/*  component={ChatScreen}*/}
            {/*  options={({ route, navigation }) => ({*/}
            {/*    title: route.params?.conversation?.isGroup*/}
            {/*      ? route.params?.conversation?.groupName*/}
            {/*      : route.params?.contactUser?.name || "Chat",*/}
            {/*    headerRight: () => (*/}
            {/*      <TouchableOpacity*/}
            {/*        style={{ marginRight: 15 }}*/}
            {/*        onPress={() => {*/}
            {/*          if (route.params?.conversation?.isGroup) {*/}
            {/*            navigation.navigate("GroupInfo", {*/}
            {/*              groupId: route.params.conversation._id,*/}
            {/*            })*/}
            {/*          } else {*/}
            {/*            navigation.navigate("ContactDetails", {*/}
            {/*              contact: { contactUser: route.params.contactUser },*/}
            {/*            })*/}
            {/*          }*/}
            {/*        }}*/}
            {/*      >*/}
            {/*        <Ionicon name="ellipsis-vertical" size={24} color="#FFFFFF" />*/}
            {/*      </TouchableOpacity>*/}
            {/*    ),*/}
            {/*  })}*/}
            {/*/>*/}
            {/*<Stack.Screen*/}
            {/*  name="Contacts"*/}
            {/*  component={ContactsScreen}*/}
            {/*  options={({ route }) => ({*/}
            {/*    title: route.params?.isNewChat ? "New Chat" : "Contacts",*/}
            {/*  })}*/}
            {/*/>*/}
            {/*<Stack.Screen name="AddContact" component={AddContactScreen} options={{ title: "Add Contact" }} />*/}
            {/*<Stack.Screen name="ContactDetails" component={ContactDetailsScreen} options={{ title: "Contact Info" }} />*/}
            {/*<Stack.Screen*/}
            {/*  name="Call"*/}
            {/*  component={CallScreen}*/}
            {/*  options={{*/}
            {/*    headerShown: false,*/}
            {/*    gestureEnabled: false,*/}
            {/*  }}*/}
            {/*/>*/}
            {/*<Stack.Screen*/}
            {/*  name="GroupCall"*/}
            {/*  component={GroupCallScreen}*/}
            {/*  options={{*/}
            {/*    headerShown: false,*/}
            {/*    gestureEnabled: false,*/}
            {/*  }}*/}
            {/*/>*/}
            {/*<Stack.Screen name="Privacy" component={PrivacyScreen} options={{ title: "Privacy" }} />*/}
            {/*<Stack.Screen name="Help" component={HelpScreen} options={{ title: "Help" }} />*/}
            {/*<Stack.Screen name="About" component={AboutScreen} options={{ title: "About" }} />*/}
            {/*<Stack.Screen name="Devices" component={DevicesScreen} options={{ title: "Linked Devices" }} />*/}
          </>
        )}
      </Stack.Navigator>
    // </NavigationContainer>
  )
}

export default AppNavigator
