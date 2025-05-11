import AsyncStorage from "@react-native-async-storage/async-storage"

if (__DEV__) {
    global.AsyncStorage = AsyncStorage;
}
import React, { useEffect, useState, useContext } from "react"
import { StatusBar, LogBox, View, Text, ActivityIndicator } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"
import AppNavigator from "./src/navigation/AppNavigator"
// Import your auth navigator
import AuthNavigator from "./src/navigation/MainTabNavigator" // Make sure this exists
import { AuthProvider, AuthContext } from "./src/context/AuthContext"
import { SocketProvider } from "./src/context/SocketContext"
import { ThemeProvider, ThemeContext } from "./src/context/ThemeContext"
import { NotificationProvider } from "./src/context/NotificationContext"
import { getTheme } from "./src/utils/theme"
import { initializeNotifications } from "./src/utils/notification-service"
import {NavigationContainer}  from "@react-navigation/native" // FIXED: Correct import

// Ignore specific warnings
LogBox.ignoreLogs(["ViewPropTypes will be removed", "ColorPropType will be removed", "Animated: `useNativeDriver`"])

// Add this for debugging
console.log('App.js loaded, EventEmitter available:', !!global.EventEmitter);

const AppContent = () => {
    const { state, authContext } = useContext(AuthContext)
    const { theme, isLoading: isThemeLoading } = React.useContext(ThemeContext)
    const [isLoading, setIsLoading] = useState(true)
    const currentTheme = getTheme(theme)

    useEffect(() => {
        // Initialize notifications
        // initializeNotifications()

        // Load auth state from storage
        const bootstrapAsync = async () => {
            try {
                const token = await AsyncStorage.getItem("userToken")
                const userString = await AsyncStorage.getItem("userData")
                if (token && userString) {
                    const userData = JSON.parse(userString)
                    authContext.restore({ token, user: userData })
                }
            } catch (e) {
                console.error("Failed to load auth state", e)
            } finally {
                setIsLoading(false)
            }
        }

        bootstrapAsync()
    }, [])

    if (isLoading) {
        return (
            <View
                style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: 'white' }}
            >
                <ActivityIndicator size="large"/>
                <Text style={{ marginTop: 10 }}>Loading...</Text>
            </View>
        )
    }

    return (
        <>
            <StatusBar />
            <NavigationContainer>
                {state.isAuthenticated ? <AuthNavigator /> : <AppNavigator />}
            </NavigationContainer>
        </>
    )
}

const App = () => {
    return (
        <SafeAreaProvider>
             <ThemeProvider>

            <AuthProvider>
                <SocketProvider>
                    {/* <NotificationProvider> */}
                    <AppContent />
                    {/* </NotificationProvider> */}
                </SocketProvider>
            </AuthProvider>
             </ThemeProvider>
        </SafeAreaProvider>
    )
}

export default App
