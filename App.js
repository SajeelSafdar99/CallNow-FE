"use client"

import React, { useEffect, useState } from "react"
import { StatusBar, LogBox, View, Text, ActivityIndicator } from "react-native"
import { NavigationContainer } from "@react-navigation/native"
import { SafeAreaProvider } from "react-native-safe-area-context"
import AsyncStorage from "@react-native-async-storage/async-storage"
import AppNavigator from "./src/navigation/AppNavigator"
import { AuthProvider, AuthContext } from "./src/context/AuthContext"
import { SocketProvider } from "./src/context/SocketContext"
import { ThemeProvider, ThemeContext } from "./src/context/ThemeContext"
import { NotificationProvider } from "./src/context/NotificationContext"
import { getTheme } from "./src/utils/theme"
import { initializeNotifications } from "./src/utils/notification-service"

// Ignore specific warnings
LogBox.ignoreLogs(["ViewPropTypes will be removed", "ColorPropType will be removed", "Animated: `useNativeDriver`"])

const AppContent = () => {
    const { state, authContext } = React.useContext(AuthContext)
    const { theme, isLoading: isThemeLoading } = React.useContext(ThemeContext)
    const [isLoading, setIsLoading] = useState(true)
    const currentTheme = getTheme(theme)

    useEffect(() => {
        // Initialize notifications
        initializeNotifications()

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

    if (isLoading || isThemeLoading) {
        return (
            <View
                style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: currentTheme.background }}
            >
                <ActivityIndicator size="large" color={currentTheme.primary} />
                <Text style={{ marginTop: 10, color: currentTheme.text }}>Loading...</Text>
            </View>
        )
    }

    return (
        <>
            <StatusBar barStyle={currentTheme.statusBar} backgroundColor={currentTheme.primary} />
            <NavigationContainer
                theme={{
                    dark: theme === "dark",
                    colors: {
                        primary: currentTheme.primary,
                        background: currentTheme.background,
                        card: currentTheme.card,
                        text: currentTheme.text,
                        border: currentTheme.border,
                        notification: currentTheme.notification,
                    },
                }}
            >
                {state.isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
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
                        <NotificationProvider>
                            <AppContent />
                        </NotificationProvider>
                    </SocketProvider>
                </AuthProvider>
            </ThemeProvider>
        </SafeAreaProvider>
    )
}

export default App
