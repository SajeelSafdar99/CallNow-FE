"use client"

import AsyncStorage from "@react-native-async-storage/async-storage"
import { useEffect, useState, useContext } from "react"
import { StatusBar, LogBox, View, Text, ActivityIndicator, DeviceEventEmitter, AppState } from "react-native" // Added AppState
import { SafeAreaProvider } from "react-native-safe-area-context"
import { getTheme } from "./src/utils/theme"

// Initialize Firebase first
import "./src/config/firebase"

import { messaging } from "./src/config/firebase"
import { __DEV__ } from "react-native"

// Navigation
import AppNavigator from "./src/navigation/AppNavigator"
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native"

// Contexts
import { AuthProvider, AuthContext } from "./src/context/AuthContext"
import { SocketProvider, SocketContext } from "./src/context/SocketContext" // Imported SocketContext
import { ThemeProvider, ThemeContext } from "./src/context/ThemeContext"
import { CallNotificationProvider, useCallNotification } from "./src/context/CallNotificationContext"

// Components
import GlobalCallManager from "./src/components/calls/GlobalCallManager"

import PushNotificationService from "./src/utils/push-notification-service"

if (__DEV__) {
    global.AsyncStorage = AsyncStorage
}

LogBox.ignoreLogs([
    "ViewPropTypes will be removed",
    "ColorPropType will be removed",
    "Animated: `useNativeDriver`",
    "AsyncStorage has been extracted from react-native",
    "Setting a timer for a long period of time",
])
const navigationRef = createNavigationContainerRef()
global.navigationRef = navigationRef

// --- UserStatusManager Component Definition ---
const UserStatusManager = () => {
    const socketContext = useContext(SocketContext)
    const authContext = useContext(AuthContext)

    const setOnlineStatus = socketContext?.setOnlineStatus
    const isSocketConnected = socketContext?.isConnected
    const isAuthenticated = authContext?.state?.isAuthenticated

    useEffect(() => {
        const performSetOnline = () => {
            if (isAuthenticated && isSocketConnected && typeof setOnlineStatus === "function") {
                console.log("[UserStatusManager] App active and conditions met, calling setOnlineStatus(true).")
                setOnlineStatus(true)
            } else {
                console.log(
                    "[UserStatusManager] Conditions NOT met for setOnlineStatus(true). Auth:",
                    isAuthenticated,
                    "SocketConnected:",
                    isSocketConnected,
                    "setOnlineStatus available:",
                    typeof setOnlineStatus === "function",
                )
            }
        }

        // Initial set online when component mounts or dependencies change satisfying conditions
        performSetOnline()

        const handleAppStateChange = (nextAppState) => {
            console.log("[UserStatusManager] AppState changed to:", nextAppState)
            if (nextAppState === "active") {
                performSetOnline()
            }
            // Optional: Handle background/inactive states to set offline
            // else if (nextAppState === 'background' || nextAppState === 'inactive') {
            //   if (isAuthenticated && isSocketConnected && typeof setOnlineStatus === 'function') {
            //     console.log('[UserStatusManager] App inactive/background, calling setOnlineStatus(false).');
            //     setOnlineStatus(false); // Or a different event for 'last_seen'
            //   }
            // }
        }

        const subscription = AppState.addEventListener("change", handleAppStateChange)
        console.log("[UserStatusManager] Subscribed to AppState changes.")

        return () => {
            console.log("[UserStatusManager] Unsubscribing from AppState changes.")
            subscription.remove()
            // Optional: When app is fully closed or component unmounts,
            // if socket is still connected, try to set offline.
            // However, server-side disconnect handling is generally more reliable for offline status.
            // if (isAuthenticated && isSocketConnected && typeof setOnlineStatus === 'function') {
            //   console.log('[UserStatusManager] Cleanup, calling setOnlineStatus(false).');
            //   setOnlineStatus(false);
            // }
        }
    }, [isAuthenticated, isSocketConnected, setOnlineStatus])

    return null // This is a side-effect component, does not render anything
}
// --- End of UserStatusManager Component Definition ---

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
    }, [acceptCall, rejectCall])

    return null
}

const AppContent = () => {
    const { state: authState } = useContext(AuthContext) // Renamed 'state' to 'authState' to avoid conflict
    const { theme } = useContext(ThemeContext)
    const currentTheme = getTheme(theme)
    const [pushNotificationsInitialized, setPushNotificationsInitialized] = useState(false)

    console.log(
        "AppContent rendering. AuthContext state: isLoading=",
        authState.isLoading,
        ", isAuthenticated=",
        authState.isAuthenticated,
    )

    useEffect(() => {
        console.log(
            "AppContent useEffect triggered. isAuthenticated:",
            authState.isAuthenticated,
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
                setPushNotificationsInitialized(true)

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
        let unsubscribeTokenRefresh = () => {}

        if (messaging) {
            messaging.setBackgroundMessageHandler(handleBackgroundMessage)
            unsubscribeForeground = messaging.onMessage(async (remoteMessage) => {
                console.log("Foreground message received:", remoteMessage.data?.type)
                try {
                    if (remoteMessage.data?.type === "incoming_call") {
                        console.log("Incoming call message received in foreground. CallNotificationContext should handle.")
                    } else if (remoteMessage.data?.type === "message") {
                        const conversationId = remoteMessage.data.conversationId
                        const currentRoute = navigationRef.getCurrentRoute()
                        const isInConversation =
                            currentRoute?.name === "Chat" && currentRoute?.params?.conversationId === conversationId

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
                console.log("Notification opened app from background:", remoteMessage.data?.type)
            })

            messaging
                .getInitialNotification()
                .then((remoteMessage) => {
                    if (remoteMessage) {
                        console.log("App opened from notification (getInitialNotification):", remoteMessage.data?.type)
                    }
                })
                .catch((error) => {
                    console.error("Error getting initial notification:", error)
                })

            unsubscribeTokenRefresh = messaging.onTokenRefresh((fcmToken) => {
                console.log("App.js: FCM token refreshed by onTokenRefresh")
                PushNotificationService.saveFCMToken(fcmToken)
            })
        }

        if (authState.isAuthenticated && !pushNotificationsInitialized) {
            initializePushNotifications()
        } else if (!authState.isAuthenticated) {
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
    }, [authState.isAuthenticated, pushNotificationsInitialized])

    if (authState.isLoading) {
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
                    if (global.pendingNavigation) {
                        const { screen, params } = global.pendingNavigation
                        navigationRef.navigate(screen, params)
                        global.pendingNavigation = null
                    }
                }}
            >
                {authState.isAuthenticated ? (
                    <SocketProvider>
                        <CallNotificationProvider>
                            <UserStatusManager /> {/* Placed UserStatusManager here */}
                            <View style={{ flex: 1 }}>
                                <AppNavigator />
                                <CallActionHandler />
                                <GlobalCallManager />
                            </View>
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
