"use client"

import AsyncStorage from "@react-native-async-storage/async-storage"
import { useEffect, useState, useContext } from "react"
import { StatusBar, LogBox, View, Text, ActivityIndicator } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

// Initialize Firebase first
import "./src/config/firebase" // This will initialize Firebase

import { messaging } from "./src/config/firebase"
import { __DEV__ } from "react-native"

// Navigation
import AppNavigator from "./src/navigation/AppNavigator"
import MainTabNavigator from "./src/navigation/MainTabNavigator"

// Contexts
import { AuthProvider, AuthContext } from "./src/context/AuthContext"
import { SocketProvider } from "./src/context/SocketContext"
import { ThemeProvider, ThemeContext } from "./src/context/ThemeContext"
// import { NotificationProvider } from "./src/context/NotificationContext"
import { CallNotificationProvider } from "./src/context/CallNotificationContext"

// Utils
import { getTheme } from "./src/utils/theme"
import PushNotificationService from "./src/utils/push-notification-service"
import { NavigationContainer } from '@react-navigation/native';

// Set up AsyncStorage for debugging in development
if (__DEV__) {
    global.AsyncStorage = AsyncStorage
}

// Ignore specific warnings
LogBox.ignoreLogs([
    "ViewPropTypes will be removed",
    "ColorPropType will be removed",
    "Animated: `useNativeDriver`",
    "AsyncStorage has been extracted from react-native",
    "Setting a timer for a long period of time",
])

const AppContent = () => {
    const { state, authContext } = useContext(AuthContext)
    const { theme } = useContext(ThemeContext)
    const [isLoading, setIsLoading] = useState(true)
    const [fcmInitialized, setFcmInitialized] = useState(false)
    const currentTheme = getTheme(theme)

    useEffect(() => {
        // Initialize push notifications
        const initializePushNotifications = async () => {
            try {
                console.log("Initializing push notifications...")

                // Check if Firebase messaging is available
                if (!messaging) {
                    console.error("Firebase messaging not available")
                    return
                }

                // Request notification permissions
                const hasPermission = await PushNotificationService.requestPermissions()
                if (hasPermission) {
                    console.log("Notification permissions granted")

                    // Get FCM token
                    const fcmToken = await PushNotificationService.getFCMToken()
                    if (fcmToken) {
                        console.log("FCM token obtained successfully")
                        setFcmInitialized(true)
                    } else {
                        console.warn("Failed to obtain FCM token")
                    }
                } else {
                    console.warn("Notification permissions denied")
                }
            } catch (error) {
                console.error("Error initializing push notifications:", error)
            }
        }

        // Handle background messages
        const handleBackgroundMessage = async (remoteMessage) => {
            console.log("Background message received:", remoteMessage.data?.type)

            try {
                if (remoteMessage.data?.type === "incoming_call") {
                    // Show local notification for incoming call
                    PushNotificationService.showIncomingCallNotification({
                        caller: {
                            id: remoteMessage.data.callerId,
                            name: remoteMessage.data.callerName,
                            profilePicture: remoteMessage.data.callerProfilePic,
                        },
                        callType: remoteMessage.data.callType,
                        callId: remoteMessage.data.callId,
                    })
                }
            } catch (error) {
                console.error("Error handling background message:", error)
            }
        }

        // Set background message handler
        if (messaging) {
            messaging.setBackgroundMessageHandler(handleBackgroundMessage)

            // Handle foreground messages
            const unsubscribeForeground = messaging.onMessage(async (remoteMessage) => {
                console.log("Foreground message received:", remoteMessage.data?.type)

                try {
                    if (remoteMessage.data?.type === "incoming_call") {
                        // The CallNotificationContext will handle this via socket
                        console.log("Incoming call message received in foreground")
                    } else if (remoteMessage.data?.type === "message") {
                        // Show message notification
                        PushNotificationService.showMessageNotification({
                            sender: {
                                id: remoteMessage.data.senderId,
                                name: remoteMessage.data.senderName,
                            },
                            message: {
                                id: remoteMessage.data.messageId,
                                text: remoteMessage.notification?.body || "New message",
                            },
                            conversationId: remoteMessage.data.conversationId,
                        })
                    }
                } catch (error) {
                    console.error("Error handling foreground message:", error)
                }
            })

            // Handle notification opened app
            const unsubscribeNotificationOpen = messaging.onNotificationOpenedApp((remoteMessage) => {
                console.log("Notification opened app from background:", remoteMessage.data?.type)
                // Navigation will be handled by the notification service
            })

            // Check whether an initial notification is available
            messaging
                .getInitialNotification()
                .then((remoteMessage) => {
                    if (remoteMessage) {
                        console.log("App opened from notification:", remoteMessage.data?.type)
                        // Handle initial notification navigation
                    }
                })
                .catch((error) => {
                    console.error("Error getting initial notification:", error)
                })

            // Handle FCM token refresh
            const unsubscribeTokenRefresh = messaging.onTokenRefresh((fcmToken) => {
                console.log("FCM token refreshed")
                PushNotificationService.saveFCMToken(fcmToken)
            })

            // Load auth state from storage
            const bootstrapAsync = async () => {
                try {
                    const token = await AsyncStorage.getItem("token")
                    const userString = await AsyncStorage.getItem("user")

                    if (token && userString) {
                        const userData = JSON.parse(userString)
                        authContext.restore({ token, user: userData })
                    }
                } catch (error) {
                    console.error("Failed to load auth state:", error)
                } finally {
                    setIsLoading(false)
                }
            }

            // Initialize everything
            const initialize = async () => {
                await Promise.all([initializePushNotifications(), bootstrapAsync()])
            }

            initialize()

            // Cleanup function
            return () => {
                unsubscribeForeground()
                unsubscribeNotificationOpen()
                unsubscribeTokenRefresh()
            }
        } else {
            // If Firebase messaging is not available, just load auth state
            const bootstrapAsync = async () => {
                try {
                    const token = await AsyncStorage.getItem("token")
                    const userString = await AsyncStorage.getItem("user")

                    if (token && userString) {
                        const userData = JSON.parse(userString)
                        authContext.restore({ token, user: userData })
                    }
                } catch (error) {
                    console.error("Failed to load auth state:", error)
                } finally {
                    setIsLoading(false)
                }
            }

            bootstrapAsync()
        }
    }, [authContext])

    if (isLoading) {
        return (
            <View
                style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: currentTheme.background,
                }}
            >
                <ActivityIndicator size="large" color={currentTheme.primary} />
                <Text
                    style={{
                        marginTop: 10,
                        color: currentTheme.text,
                        fontSize: 16,
                    }}
                >
                    Loading...
                </Text>
            </View>
        )
    }

    return (
        <>
            <StatusBar barStyle={currentTheme.statusBar} backgroundColor={currentTheme.primary} />
            <NavigationContainer>
                {state.isAuthenticated ? (
                    <SocketProvider>
                        <CallNotificationProvider>
                            <AppNavigator />
                        </CallNotificationProvider>
                    </SocketProvider>
                ) : (
                    <MainTabNavigator />
                )}
            </NavigationContainer>
        </>
    )
}

const App = () => {
    return (
        <SafeAreaProvider>
            <ThemeProvider>
                <AuthProvider>
                    {/*<NotificationProvider>*/}
                        <AppContent />
                    {/*</NotificationProvider>*/}
                </AuthProvider>
            </ThemeProvider>
        </SafeAreaProvider>
    )
}

export default App
