import PushNotification from "react-native-push-notification"
import { messaging } from "../config/firebase" // Import from our config
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Platform, PermissionsAndroid, Vibration } from "react-native"
import { API_BASE_URL } from "../config/api"

class PushNotificationService {
  constructor() {
    this.isInitialized = false
    this.isVibrating = false
    this.configure()
    this.createChannels()
    this.requestVibrationPermission()
  }

  // Request vibration permission
  requestVibrationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.VIBRATE
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn("Vibration permission error:", err);
        return false;
      }
    }
    return true; // iOS doesn't need explicit permission
  }

  // Configure push notifications
  configure = () => {
    PushNotification.configure({
      // Called when Token is generated (iOS and Android)
      onRegister: (token) => {
        console.log("FCM Token:", token)
        this.saveFCMToken(token.token)
      },

      // Called when a remote is received or opened/clicked
      onNotification: (notification) => {
        console.log("Notification received:", notification)
        this.handleNotification(notification)
      },

      // Called when Registered Action is pressed and invokeApp is false, if true onNotification will be called
      onAction: (notification) => {
        console.log("Notification action:", notification.action)
        this.handleNotificationAction(notification)
      },

      // Called when the user fails to register for remote notifications
      onRegistrationError: (err) => {
        console.error("FCM registration error:", err.message, err)
      },

      // IOS ONLY (optional): default: all - Permissions to register
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      // Should the initial notification be popped automatically
      popInitialNotification: true,

      // (optional) default: true
      requestPermissions: Platform.OS === "ios",
    })

    this.isInitialized = true
  }

  // Create notification channels for Android
  createChannels = () => {
    // High priority channel for calls
    PushNotification.createChannel(
      {
        channelId: "calls",
        channelName: "Incoming Calls",
        channelDescription: "Notifications for incoming calls",
        playSound: true,
        soundName: "call_ringtone.mp3",
        importance: 4, // HIGH
        vibrate: true,
        vibration: 1000,
      },
      (created) => console.log(`Call channel created: ${created}`),
    )

    // Default channel for messages
    PushNotification.createChannel(
      {
        channelId: "messages",
        channelName: "Messages",
        channelDescription: "New message notifications",
        playSound: true,
        soundName: "message_tone.mp3",
        importance: 3, // DEFAULT
        vibrate: true,
      },
      (created) => console.log(`Message channel created: ${created}`),
    )

    // General notifications
    PushNotification.createChannel(
      {
        channelId: "general",
        channelName: "General",
        channelDescription: "General app notifications",
        playSound: true,
        importance: 2, // LOW
      },
      (created) => console.log(`General channel created: ${created}`),
    )
  }

  // Safe vibration method to prevent conflicts
  safeVibrate = (pattern = 1000, repeat = false) => {
    if (this.isVibrating) {
      return;
    }

    this.isVibrating = true;

    try {
      if (typeof pattern === 'number') {
        Vibration.vibrate(pattern);
      } else if (Array.isArray(pattern)) {
        Vibration.vibrate(pattern.map(Number), repeat);
      }
    } catch (error) {
      console.error("Vibration error:", error);
      // Fallback to simple vibration
      try {
        Vibration.vibrate(1000);
      } catch (fallbackError) {
        console.error("Fallback vibration failed:", fallbackError);
      }
    }
  }

  // Stop vibration safely
  stopVibration = () => {
    try {
      Vibration.cancel();
    } catch (error) {
      console.error("Error stopping vibration:", error);
    }
    this.isVibrating = false;
  }

  // Request notification permissions
  requestPermissions = async () => {
    try {
      if (Platform.OS === "android") {
        if (Platform.Version >= 33) {
          const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)
          return granted === PermissionsAndroid.RESULTS.GRANTED
        }
        return true
      } else {
        // iOS
        if (messaging) {
          const authStatus = await messaging.requestPermission()
          const enabled =
            authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
            authStatus === messaging.AuthorizationStatus.PROVISIONAL

          return enabled
        }
        return false
      }
    } catch (error) {
      console.error("Error requesting permissions:", error)
      return false
    }
  }

  // Get FCM token
  getFCMToken = async () => {
    try {
      if (!messaging) {
        console.error("Firebase messaging not initialized")
        return null
      }

      const token = await messaging.getToken()
      console.log("FCM Token retrieved:", token)
      await this.saveFCMToken(token)
      return token
    } catch (error) {
      console.error("Error getting FCM token:", error)
      return null
    }
  }

  // Save FCM token to storage and backend
  saveFCMToken = async (token) => {
    try {
      await AsyncStorage.setItem("fcmToken", token)

      // Send token to backend
      const authToken = await AsyncStorage.getItem("token")
      const deviceId = await AsyncStorage.getItem("deviceId")

      if (authToken && deviceId) {
        await this.updateFCMTokenOnServer(token, deviceId, authToken)
      }
    } catch (error) {
      console.error("Error saving FCM token:", error)
    }
  }

  // Update FCM token on server
  updateFCMTokenOnServer = async (fcmToken, deviceId, authToken) => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/fcm-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          deviceId,
          fcmToken,
        }),
      })

      const result = await response.json()
      if (result.success) {
        console.log("FCM token updated on server successfully")
      } else {
        console.error("Failed to update FCM token on server:", result.message)
      }
    } catch (error) {
      console.error("Error updating FCM token on server:", error)
    }
  }

  // Handle notification received
  handleNotification = (notification) => {
    const { data, userInteraction } = notification

    // If user tapped the notification
    if (userInteraction) {
      this.handleNotificationTap(data)
    }

    // Handle different notification types
    if (data?.type === "incoming_call") {
      this.handleIncomingCallNotification(data)
    } else if (data?.type === "message") {
      this.handleMessageNotification(data)
    }
  }

  // Handle notification action
  handleNotificationAction = (notification) => {
    const { action, data } = notification

    if (data?.type === "incoming_call") {
      if (action === "Accept") {
        this.acceptCallFromNotification(data)
      } else if (action === "Reject") {
        this.rejectCallFromNotification(data)
      }
    }
  }

  // Handle notification tap
  handleNotificationTap = (data) => {
    console.log("Notification tapped with data:", data)
  }

  // Handle incoming call notification
  handleIncomingCallNotification = (data) => {
    console.log("Incoming call notification:", data)
  }

  // Handle message notification
  handleMessageNotification = (data) => {
    console.log("Message notification:", data)
  }

  // Accept call from notification
  acceptCallFromNotification = (data) => {
    console.log("Accepting call from notification:", data)
    this.stopVibration()
  }

  // Reject call from notification
  rejectCallFromNotification = (data) => {
    console.log("Rejecting call from notification:", data)
    this.stopVibration()
  }

  // Show local notification for incoming call
  showIncomingCallNotification = (callData) => {
    const { caller, callType, callId } = callData

    // Use native notification vibration only, don't manually vibrate
    PushNotification.localNotification({
      channelId: "calls",
      title: `Incoming ${callType} call`,
      message: `${caller.name} is calling you`,
      playSound: true,
      soundName: "call_ringtone.mp3",
      importance: "high",
      priority: "high",
      vibrate: true,
      vibration: 1000,
      ongoing: true,
      category: "call",
      actions: ["Accept", "Reject"],
      invokeApp: false,
      userInfo: {
        type: "incoming_call",
        callId,
        callerId: caller.id,
        callerName: caller.name,
        callerProfilePic: caller.profilePicture,
        callType,
      },
    })
  }

  // Show message notification
  showMessageNotification = (messageData) => {
    const { sender, message, conversationId } = messageData

    PushNotification.localNotification({
      channelId: "messages",
      title: sender.name,
      message: message.text || "New message",
      playSound: true,
      soundName: "message_tone.mp3",
      userInfo: {
        type: "message",
        conversationId,
        senderId: sender.id,
        messageId: message.id,
      },
    })
  }

  // Clear all notifications
  clearAllNotifications = () => {
    PushNotification.cancelAllLocalNotifications()
    this.stopVibration()
  }

  // Clear specific notification
  clearNotification = (notificationId) => {
    PushNotification.cancelLocalNotifications({ id: notificationId })
  }

  // Set badge count
  setBadgeCount = (count) => {
    PushNotification.setApplicationIconBadgeNumber(count)
  }

  // Subscribe to FCM topic
  subscribeToTopic = async (topic) => {
    try {
      if (messaging) {
        await messaging.subscribeToTopic(topic)
        console.log(`Subscribed to topic: ${topic}`)
      }
    } catch (error) {
      console.error(`Error subscribing to topic ${topic}:`, error)
    }
  }

  // Unsubscribe from FCM topic
  unsubscribeFromTopic = async (topic) => {
    try {
      if (messaging) {
        await messaging.unsubscribeFromTopic(topic)
        console.log(`Unsubscribed from topic: ${topic}`)
      }
    } catch (error) {
      console.error(`Error unsubscribing from topic ${topic}:`, error)
    }
  }
}

export default new PushNotificationService()
