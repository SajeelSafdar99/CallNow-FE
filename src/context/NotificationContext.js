"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { Platform, AppState } from "react-native"
import * as Notifications from "expo-notifications"
import * as Device from "expo-device"
import { useNavigation } from "@react-navigation/native"
import { AuthContext } from "./AuthContext"
import { SocketContext } from "./SocketContext"

export const NotificationContext = createContext()

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export const NotificationProvider = ({ children }) => {
  const { state: authState } = useContext(AuthContext)
  const { socket } = useContext(SocketContext)
  const navigation = useNavigation()

  const [expoPushToken, setExpoPushToken] = useState("")
  const [notification, setNotification] = useState(null)
  const [appState, setAppState] = useState(AppState.currentState)
  const [incomingCall, setIncomingCall] = useState(null)
  const [incomingGroupCall, setIncomingGroupCall] = useState(null)

  // Register for push notifications
  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => setExpoPushToken(token))

    // Listen for notifications
    const notificationListener = Notifications.addNotificationReceivedListener((notification) => {
      setNotification(notification)
    })

    // Handle notification response (when user taps on notification)
    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      const { data } = response.notification.request.content
      handleNotificationNavigation(data)
    })

    // Monitor app state changes
    const appStateListener = AppState.addEventListener("change", (nextAppState) => {
      setAppState(nextAppState)
    })

    return () => {
      Notifications.removeNotificationSubscription(notificationListener)
      Notifications.removeNotificationSubscription(responseListener)
      appStateListener.remove()
    }
  }, [])

  // Set up socket listeners for call notifications
  useEffect(() => {
    if (socket && socket.connected) {
      // Listen for incoming calls
      socket.on("incoming-call", handleIncomingCall)

      // Listen for incoming group calls
      socket.on("incoming-group-call", handleIncomingGroupCall)

      // Listen for call canceled
      socket.on("call-canceled", handleCallCanceled)

      // Listen for group call canceled
      socket.on("group-call-canceled", handleGroupCallCanceled)
    }

    return () => {
      if (socket) {
        socket.off("incoming-call")
        socket.off("incoming-group-call")
        socket.off("call-canceled")
        socket.off("group-call-canceled")
      }
    }
  }, [socket])

  // Handle incoming call notification
  const handleIncomingCall = async (data) => {
    const { callId, caller, isVideoCall } = data

    // Set incoming call data
    setIncomingCall({
      callId,
      caller,
      isVideoCall,
      timestamp: Date.now(),
    })

    // If app is in background, send push notification
    if (appState !== "active") {
      await sendPushNotification({
        title: `Incoming ${isVideoCall ? "Video" : "Voice"} Call`,
        body: `${caller.name} is calling you`,
        data: {
          type: "incoming_call",
          callId,
          callerId: caller._id,
          isVideoCall,
        },
        sound: "default",
      })
    }
  }

  // Handle incoming group call notification
  const handleIncomingGroupCall = async (data) => {
    const { groupCallId, caller, conversation, isVideoCall } = data

    // Set incoming group call data
    setIncomingGroupCall({
      groupCallId,
      caller,
      conversation,
      isVideoCall,
      timestamp: Date.now(),
    })

    // If app is in background, send push notification
    if (appState !== "active") {
      await sendPushNotification({
        title: `Incoming Group ${isVideoCall ? "Video" : "Voice"} Call`,
        body: `${caller.name} is calling ${conversation.isGroup ? conversation.groupName : "you"}`,
        data: {
          type: "incoming_group_call",
          groupCallId,
          callerId: caller._id,
          conversationId: conversation._id,
          isVideoCall,
        },
        sound: "default",
      })
    }
  }

  // Handle call canceled notification
  const handleCallCanceled = (data) => {
    const { callId } = data

    // Clear incoming call if it matches
    if (incomingCall && incomingCall.callId === callId) {
      setIncomingCall(null)
    }
  }

  // Handle group call canceled notification
  const handleGroupCallCanceled = (data) => {
    const { groupCallId } = data

    // Clear incoming group call if it matches
    if (incomingGroupCall && incomingGroupCall.groupCallId === groupCallId) {
      setIncomingGroupCall(null)
    }
  }

  // Handle notification navigation
  const handleNotificationNavigation = (data) => {
    if (!data) return

    switch (data.type) {
      case "message":
        navigation.navigate("Chat", {
          conversationId: data.conversationId,
          contactUser: data.sender,
        })
        break

      case "incoming_call":
        navigation.navigate("Call", {
          contactUser: { _id: data.callerId },
          isVideoCall: data.isVideoCall,
          incomingCall: {
            callId: data.callId,
            caller: { _id: data.callerId },
          },
        })
        break

      case "incoming_group_call":
        navigation.navigate("GroupCall", {
          conversation: { _id: data.conversationId },
          isVideoCall: data.isVideoCall,
          incomingCall: {
            groupCallId: data.groupCallId,
            caller: { _id: data.callerId },
          },
        })
        break

      default:
        break
    }
  }

  // Accept incoming call
  const acceptCall = () => {
    if (incomingCall) {
      navigation.navigate("Call", {
        contactUser: incomingCall.caller,
        isVideoCall: incomingCall.isVideoCall,
        incomingCall: incomingCall,
      })
      setIncomingCall(null)
    }
  }

  // Reject incoming call
  const rejectCall = () => {
    if (incomingCall && socket) {
      socket.emit("reject-call", {
        callId: incomingCall.callId,
        recipientId: incomingCall.caller._id,
      })
      setIncomingCall(null)
    }
  }

  // Accept incoming group call
  const acceptGroupCall = () => {
    if (incomingGroupCall) {
      navigation.navigate("GroupCall", {
        conversation: incomingGroupCall.conversation,
        isVideoCall: incomingGroupCall.isVideoCall,
        incomingCall: incomingGroupCall,
      })
      setIncomingGroupCall(null)
    }
  }

  // Reject incoming group call
  const rejectGroupCall = () => {
    if (incomingGroupCall && socket) {
      socket.emit("reject-group-call", {
        groupCallId: incomingGroupCall.groupCallId,
        recipientId: incomingGroupCall.caller._id,
      })
      setIncomingGroupCall(null)
    }
  }

  // Send local notification
  const sendLocalNotification = async (title, body, data = {}) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null,
    })
  }

  // Send push notification
  const sendPushNotification = async (notification) => {
    if (!expoPushToken) return

    const message = {
      to: expoPushToken,
      sound: notification.sound || "default",
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      _displayInForeground: true,
    }

    try {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      })
    } catch (error) {
      console.error("Error sending push notification:", error)
    }
  }

  // Register for push notifications
  async function registerForPushNotificationsAsync() {
    let token

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      })
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync()
      let finalStatus = existingStatus

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
      }

      if (finalStatus !== "granted") {
        console.log("Failed to get push token for push notification!")
        return
      }

      token = (await Notifications.getExpoPushTokenAsync()).data
    } else {
      console.log("Must use physical device for Push Notifications")
    }

    return token
  }

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        notification,
        incomingCall,
        incomingGroupCall,
        acceptCall,
        rejectCall,
        acceptGroupCall,
        rejectGroupCall,
        sendLocalNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}
