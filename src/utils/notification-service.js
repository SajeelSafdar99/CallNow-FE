import * as Notifications from "expo-notifications"
import * as Device from "expo-device"
import { Platform } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"

// Register for push notifications
export const registerForPushNotifications = async () => {
  if (!Device.isDevice) {
    console.log("Must use physical device for Push Notifications")
    return null
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== "granted") {
      console.log("Failed to get push token for push notification!")
      return null
    }

    // Get Expo push token
    const token = (await Notifications.getExpoPushTokenAsync()).data

    // Save token to AsyncStorage
    await AsyncStorage.setItem("pushToken", token)

    // Configure notification channels for Android
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      })

      // Create a high priority channel for calls
      Notifications.setNotificationChannelAsync("calls", {
        name: "Calls",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: "ringtone.wav", // Custom sound file in android/app/src/main/res/raw/
        lightColor: "#075E54",
      })

      // Create a channel for messages
      Notifications.setNotificationChannelAsync("messages", {
        name: "Messages",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: "notification.wav", // Custom sound file
        lightColor: "#128C7E",
      })
    }

    return token
  } catch (error) {
    console.error("Error registering for push notifications:", error)
    return null
  }
}

// Send local notification
export const sendLocalNotification = async (title, body, data = {}, options = {}) => {
  try {
    const notificationContent = {
      title,
      body,
      data,
      sound: true,
      ...options,
    }

    // Use specific channel for calls or messages on Android
    if (Platform.OS === "android") {
      if (data.type === "incoming_call" || data.type === "incoming_group_call") {
        notificationContent.channelId = "calls"
      } else if (data.type === "message") {
        notificationContent.channelId = "messages"
      }
    }

    await Notifications.scheduleNotificationAsync({
      content: notificationContent,
      trigger: null, // Immediate notification
    })
  } catch (error) {
    console.error("Error sending local notification:", error)
  }
}

// Update badge count
export const updateBadgeCount = async (count) => {
  try {
    await Notifications.setBadgeCountAsync(count)
  } catch (error) {
    console.error("Error updating badge count:", error)
  }
}

// Clear all notifications
export const clearAllNotifications = async () => {
  try {
    await Notifications.dismissAllNotificationsAsync()
    await updateBadgeCount(0)
  } catch (error) {
    console.error("Error clearing notifications:", error)
  }
}

// Get notification permissions status
export const getNotificationPermissionsStatus = async () => {
  try {
    const { status } = await Notifications.getPermissionsAsync()
    return status
  } catch (error) {
    console.error("Error getting notification permissions status:", error)
    return "error"
  }
}

// Request notification permissions
export const requestNotificationPermissions = async () => {
  try {
    const { status } = await Notifications.requestPermissionsAsync()
    return status
  } catch (error) {
    console.error("Error requesting notification permissions:", error)
    return "error"
  }
}
