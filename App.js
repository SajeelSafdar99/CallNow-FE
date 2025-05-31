"use client"

import AsyncStorage from "@react-native-async-storage/async-storage"
import { useEffect, useState, useContext } from "react"
import { StatusBar, LogBox, View, Text, ActivityIndicator, DeviceEventEmitter } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

// Initialize Firebase first
import "./src/config/firebase" // This will initialize Firebase

import { messaging } from "./src/config/firebase"
import { __DEV__ } from "react-native"

// Navigation
import AppNavigator from "./src/navigation/AppNavigator"

// Contexts
import { AuthProvider, AuthContext } from "./src/context/AuthContext"
import { SocketProvider } from "./src/context/SocketContext"
import { ThemeProvider, ThemeContext } from "./src/context/ThemeContext"
import { CallNotificationProvider, useCallNotification } from "./src/context/CallNotificationContext"

// Utils
import { getTheme } from "./src/utils/theme"
import PushNotificationService from "./src/utils/push-notification-service"
import { NavigationContainer } from "@react-navigation/native"

import { createNavigationContainerRef } from "@react-navigation/native"

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
const navigationRef = createNavigationContainerRef()
global.navigationRef = navigationRef

const CallActionHandler = () => {
    const { acceptCall, rejectCall } = useCallNotification()

    useEffect(() => {
        console.log("CallActionHandler: Setting up DeviceEventEmitter listeners for call actions.")
        const acceptSubscription = DeviceEventEmitter.addListener("acceptCallFromNotification", (callData) => {
            console.log("App.js: acceptCallFromNotification event received", callData)
            if (acceptCall && callData) {
                acceptCall(callData)
            } else {
                console.warn("App.js: acceptCall function or callData not available for notification action.")
            }
        })

        const rejectSubscription = DeviceEventEmitter.addListener("rejectCallFromNotification", (callData) => {
            console.log("App.js: rejectCallFromNotification event received", callData)
            if (rejectCall && callData) {
                rejectCall(callData)
            } else {
                console.warn("App.js: rejectCall function or callData not available for notification action.")
            }
        })

        return () => {
            console.log("CallActionHandler: Cleaning up DeviceEventEmitter listeners.")
            acceptSubscription.remove()
            rejectSubscription.remove()
        }
    }, [acceptCall, rejectCall]) // Rerun if context functions change

    return null // This component doesn't render anything itself
}

const AppContent = () => {
    const { state, authContext } = useContext(AuthContext)
    // ... other useState hooks ...

    console.log("AppContent rendering, authContext reference check:", authContext) // Add this line
    const { theme } = useContext(ThemeContext)
    const [isLoading, setIsLoading] = useState(true)
    const currentTheme = getTheme(theme)
    const [pushNotificationsInitialized, setPushNotificationsInitialized] = useState(false)

    useEffect(() => {
        console.log(
            "AppContent useEffect triggered. isAuthenticated:",
            state.isAuthenticated,
            "pushInitialized:",
            pushNotificationsInitialized,
        )
        const initializePushNotifications = async () => {
            if (pushNotificationsInitialized) {
                console.log("App.js: Push notifications already attempted initialization.")
                return
            }
            try {
                console.log("App.js: Initializing push notifications...")
                setPushNotificationsInitialized(true) // Set flag early to prevent re-runs from other effects

                if (!messaging) {
                    console.error("App.js: Firebase messaging not available")
                    return
                }

                const hasPermission = await PushNotificationService.requestPermissions()
                if (hasPermission) {
                    console.log("App.js: Notification permissions granted")
                    const fcmToken = await PushNotificationService.getFCMToken()
                    if (fcmToken) {
                        console.log("App.js: FCM token obtained successfully by App.js flow.")
                    } else {
                        console.warn("App.js: Failed to obtain FCM token in App.js flow.")
                    }
                } else {
                    console.warn("App.js: Notification permissions denied in App.js flow.")
                }
            } catch (error) {
                console.error("App.js: Error initializing push notifications:", error)
            }
        }

        const handleBackgroundMessage = async (remoteMessage) => {

            try {
                console.log("App.js - handleBackgroundMessage: Received background message:", remoteMessage)
                if (remoteMessage.data?.type === "incoming_call") {
                    const callData = {
                        caller: {
                            id: remoteMessage.data.callerId,
                            name: remoteMessage.data.callerName,
                            profilePicture: remoteMessage.data.callerProfilePic,
                        },
                        callType: remoteMessage.data.callType,
                        callId: remoteMessage.data.callId,
                        offer: remoteMessage.data.offer ? JSON.parse(remoteMessage.data.offer) : null,
                        targetDeviceId: remoteMessage.data.targetDeviceId,
                        timestamp: remoteMessage.data.timestamp ? Number.parseInt(remoteMessage.data.timestamp, 10) : Date.now(),
                    }
                    console.log("App.js - handleBackgroundMessage: Showing notification with data:", callData)
                    PushNotificationService.showIncomingCallNotification(callData)
                }
            } catch (error) {
                console.error("Error handling background message:", error)
            }
        }

        let unsubscribeForeground = () => {}
        let unsubscribeTokenRefresh = () => {} // Initialize with a no-op function

        if (messaging) {
            messaging.setBackgroundMessageHandler(handleBackgroundMessage)
            unsubscribeForeground = messaging.onMessage(async (remoteMessage) => {
                // ... (keep existing onMessage logic)
                console.log("Foreground message received:", remoteMessage.data?.type)

                try {
                    if (remoteMessage.data?.type === "incoming_call") {
                        console.log("Incoming call message received in foreground. CallNotificationContext should handle.")
                    } else if (remoteMessage.data?.type === "message") {
                        const conversationId = remoteMessage.data.conversationId
                        const currentRoute = navigationRef.getCurrentRoute()
                        const isInConversation =
                            currentRoute?.name === "Conversation" && currentRoute?.params?.conversationId === conversationId

                        if (!isInConversation) {
                            PushNotificationService.showMessageNotification({
                                ...remoteMessage.data,
                            })
                        } else {
                            console.log("Already in conversation, message will be handled by socket")
                        }
                    }
                } catch (error) {
                    console.error("Error handling foreground message:", error)
                }
            })

            messaging.onNotificationOpenedApp((remoteMessage) => {
                // ... (keep existing onNotificationOpenedApp logic)
                console.log("Notification opened app from background:", remoteMessage.data?.type)
            })

            messaging
                .getInitialNotification()
                .then((remoteMessage) => {
                    // ... (keep existing getInitialNotification logic)
                    if (remoteMessage) {
                        console.log("App opened from notification (getInitialNotification):", remoteMessage.data?.type)
                    }
                })
                .catch((error) => {
                    console.error("Error getting initial notification:", error)
                })

            // messaging.onTokenRefresh returns an unsubscribe function
            unsubscribeTokenRefresh = messaging.onTokenRefresh((fcmToken) => {
                console.log("App.js: FCM token refreshed by onTokenRefresh")
                PushNotificationService.saveFCMToken(fcmToken)
            })
        }

        const bootstrapAsync = async () => {
            try {
                const token = await AsyncStorage.getItem("token")
                const userString = await AsyncStorage.getItem("user")
                if (token && userString) {
                    const userData = JSON.parse(userString)
                    authContext.restore({ token, user: userData })
                }
            } catch (error) {
                console.error("App.js: Failed to load auth state:", error)
            } finally {
                setIsLoading(false)
            }
        }

        bootstrapAsync() // Always run bootstrap

        if (state.isAuthenticated && !pushNotificationsInitialized) {
            initializePushNotifications()
        } else if (!state.isAuthenticated) {
            // If user logs out, reset the flag so it can re-initialize on next login
            setPushNotificationsInitialized(false)
            console.log("App.js: User not authenticated, pushNotificationsInitialized flag reset if previously true.")
        }

        return () => {
            if (typeof unsubscribeForeground === "function") {
                unsubscribeForeground()
            }
            if (typeof unsubscribeTokenRefresh === "function") {
                unsubscribeTokenRefresh()
            }
        }
    }, [state.isAuthenticated, pushNotificationsInitialized]) // Temporarily removed authContext for diagnosis

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
            <NavigationContainer
                ref={navigationRef}
                onReady={() => {
                    console.log("Navigation container is ready")
                    // Check if we have a pending navigation
                    if (global.pendingNavigation) {
                        const { screen, params } = global.pendingNavigation
                        navigationRef.navigate(screen, params)
                        global.pendingNavigation = null
                    }
                }}
            >
                {state.isAuthenticated ? (
                    <SocketProvider>
                        <CallNotificationProvider>
                            <CallActionHandler />
                            <AppNavigator />
                        </CallNotificationProvider>
                    </SocketProvider>
                ) : (
                    <AppNavigator />
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
                    <AppContent />
                </AuthProvider>
            </ThemeProvider>
        </SafeAreaProvider>
    )
}

export default App
