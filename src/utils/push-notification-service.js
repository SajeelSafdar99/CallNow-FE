import PushNotification from "react-native-push-notification"
import { messaging } from "../config/firebase" // Ensure this path is correct and messaging is exported
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Platform, PermissionsAndroid, Vibration, DeviceEventEmitter } from "react-native" // Added DeviceEventEmitter
import { API_BASE_URL } from "../config/api"
import PushNotificationIOS from "@react-native-community/push-notification-ios"
import axios from "axios"
import {getDevices} from '../api/devices'; // Using direct axios as per your file

class PushNotificationService {
  constructor() {
    this.isInitialized = false
    // this.isVibrating = false; // Not actively used, Vibration.cancel() is direct
    this.configure()
    this.createChannels()
    this.setupIOSCategories() // Call iOS category setup
  }

  configure = () => {
    PushNotification.configure({
      onRegister: (tokenData) => {
        console.log("PushNotificationService (onRegister): Token data:", JSON.stringify(tokenData))
        if (tokenData.token) {
          console.log(
            "PushNotificationService (onRegister): FCM Token obtained:",
            tokenData.token ? tokenData.token.substring(0, 10) + "..." : "N/A",
          )
          this.saveFCMToken(tokenData.token)
        } else {
          console.warn("PushNotificationService (onRegister): No token found in tokenData.")
        }
      },
      onNotification: (notification) => {
        console.log(
          "PushNotificationService (onNotification): Received raw notification object:",
          JSON.stringify(notification, null, 2),
        )

        // Data payload is often in notification.data for FCM, or notification directly for local notifications.
        // For remote notifications, `data` is usually where custom payload resides.
        const dataPayload = notification.data || notification.userInfo || {} // userInfo for iOS consistency, data for FCM

        console.log(
          "PushNotificationService (onNotification): Extracted dataPayload:",
          JSON.stringify(dataPayload, null, 2),
        )
        console.log("PushNotificationService (onNotification): User Interaction:", notification.userInteraction)
        console.log("PushNotificationService (onNotification): Is Foreground:", notification.foreground)

        if (notification.userInteraction) {
          console.log("PushNotificationService (onNotification): User tapped notification.")
          this.handleNotificationTap(notification) // Pass the whole notification object
        } else if (notification.foreground) {
          console.log("PushNotificationService (onNotification): Notification received in FOREGROUND.")
          if (dataPayload.type === "incoming_call") {
            console.log(
              "PushNotificationService (onNotification): 'incoming_call' type in foreground. App.js onMessage or CallNotificationContext should handle UI (e.g., modal). Not showing local notification here by default.",
            )
            // If you want a local notification for foreground calls too:
            // const callData = this.parseCallData(dataPayload);
            // if (callData) this.showIncomingCallNotification(callData);
          } else if (dataPayload.type === "message") {
            console.log(
              "PushNotificationService (onNotification): 'message' type in foreground. App.js onMessage should handle.",
            )
            // App.js onMessage is expected to call showMessageNotification if needed.
          } else {
            console.log(
              "PushNotificationService (onNotification): Other type in foreground or generic notification. Displaying if title/message exist.",
            )
            // This might be for Firebase Console messages with a 'notification' block
            if (notification.title && notification.message && !dataPayload.type) {
              // Avoid double-display if App.js handles typed data
              this.displayLocalNotification(notification)
            }
          }
        } else {
          // Background or Killed state, not a user tap (i.e., system received it)
          console.log("PushNotificationService (onNotification): Notification received in BACKGROUND/KILLED state.")
          if (dataPayload.type === "incoming_call") {
            console.log(
              "PushNotificationService (onNotification): 'incoming_call' type in background. Showing local call notification.",
            )
            const callData = this.parseCallData(dataPayload)
            if (callData) {
              this.showIncomingCallNotification(callData)
            } else {
              console.warn(
                "PushNotificationService (onNotification): Could not parse callData for background incoming_call.",
              )
            }
          } else if (dataPayload.type === "message") {
            console.log(
              "PushNotificationService (onNotification): 'message' type in background. Showing local message notification.",
            )
            const messageData = this.parseMessageData(dataPayload)
            if (messageData) {
              this.showMessageNotification(messageData)
            } else {
              console.warn(
                "PushNotificationService (onNotification): Could not parse messageData for background message.",
              )
            }
          } else {
            console.log(
              "PushNotificationService (onNotification): Other type in background or generic notification. Displaying if title/message exist.",
            )
            // This path is less common for data-only messages from backend but could be hit by FCM console.
            if (notification.title && notification.message && !dataPayload.type) {
              this.displayLocalNotification(notification)
            } else {
              console.warn(
                "PushNotificationService (onNotification): Background notification without recognized type or displayable content in this handler:",
                JSON.stringify(notification),
              )
            }
          }
        }
      }
    })
  }
  parseCallData = (dataPayload) => {
    if (!dataPayload || dataPayload.type !== "incoming_call") return null
    try {
      return {
        callId: dataPayload.callId,
        caller: {
          id: dataPayload.callerId,
          name: dataPayload.callerName,
          profilePicture: dataPayload.callerProfilePic,
        },
        callType: dataPayload.callType,
        offer: dataPayload.offer
          ? typeof dataPayload.offer === "string"
            ? JSON.parse(dataPayload.offer)
            : dataPayload.offer
          : null,
        targetDeviceId: dataPayload.targetDeviceId,
        timestamp: dataPayload.timestamp ? Number.parseInt(dataPayload.timestamp, 10) : Date.now(),
      }
    } catch (e) {
      console.error(
        "PushNotificationService (parseCallData): Error parsing offer JSON:",
        e,
        "Offer string:",
        dataPayload.offer,
      )
      return null // Or handle partially, depending on requirements
    }
  }

  parseMessageData = (dataPayload) => {
    if (!dataPayload || dataPayload.type !== "message") return null
    return {
      sender: {
        id: dataPayload.senderId,
        name: dataPayload.senderName,
        profilePicture: dataPayload.senderProfilePic,
      },
      message: {
        id: dataPayload.messageId,
        text: dataPayload.body || "New message", // Assuming 'body' contains message text
      },
      conversationId: dataPayload.conversationId,
      isGroup: dataPayload.isGroup === "true",
      groupName: dataPayload.groupName,
    }
  }

  displayLocalNotification = (notificationDetails) => {
    console.log(
      "PushNotificationService (displayLocalNotification): Displaying generic notification:",
      JSON.stringify(notificationDetails),
    )
    PushNotification.localNotification({
      channelId: notificationDetails.data?.channelId || notificationDetails.channelId || "general",
      title: notificationDetails.title || notificationDetails.data?.title,
      message: notificationDetails.message || notificationDetails.data?.message, // message is a required field
      userInfo: notificationDetails.data || notificationDetails.userInfo || {},
      playSound: true,
      soundName: notificationDetails.data?.soundName || notificationDetails.soundName || "default",
      // ... other options from notificationDetails object if needed
    })
  }

  createChannels = () => {
    PushNotification.createChannel(
      {
        channelId: "calls",
        channelName: "Incoming Calls",
        channelDescription: "Notifications for incoming calls",
        playSound: true,
        soundName: "call_ringtone.mp3",
        importance: PushNotification.Importance.HIGH, // Correct Enum
        vibrate: true,
        vibration: 1000,
      },
      (created) => console.log(`PushNotificationService: Channel 'calls' created: ${created}`),
    )
    PushNotification.createChannel(
      {
        channelId: "messages",
        channelName: "Messages",
        channelDescription: "New message notifications",
        playSound: true,
        soundName: "message_tone.mp3",
        importance: PushNotification.Importance.DEFAULT,
        vibrate: true,
      },
      (created) => console.log(`PushNotificationService: Channel 'messages' created: ${created}`),
    )
    PushNotification.createChannel(
      {
        channelId: "general",
        channelName: "General",
        channelDescription: "General app notifications",
        playSound: true,
        soundName: "default",
        importance: PushNotification.Importance.LOW,
      },
      (created) => console.log(`PushNotificationService: Channel 'general' created: ${created}`),
    )
  }

  setupIOSCategories = () => {
    if (Platform.OS === "ios") {
      PushNotificationIOS.setNotificationCategories([
        {
          id: "CALL_INVITE", // Must match category in showIncomingCallNotification
          actions: [
            { id: "accept", title: "Accept", options: { foreground: true } }, // Brings app to foreground
            { id: "reject", title: "Reject", options: { destructive: true, foreground: false } }, // Can be handled in background
          ],
        },
        // Add other categories if needed
      ])
      console.log("PushNotificationService: iOS Notification Categories set up.")
    }
  }

  requestPermissions = async () => {
    try {
      if (Platform.OS === "android") {
        if (Platform.Version >= 33) {
          // Android 13 (TIRAMISU)
          console.log(
            "PushNotificationService (requestPermissions): Requesting Android 13+ POST_NOTIFICATIONS permission.",
          )
          const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)
          console.log("PushNotificationService (requestPermissions): Android 13+ permission status:", granted)
          return granted === PermissionsAndroid.RESULTS.GRANTED
        }
        console.log(
          "PushNotificationService (requestPermissions): Android <13, permission implicitly granted or not needed at runtime this way.",
        )
        return true
      } else if (Platform.OS === "ios") {
        if (!messaging) {
          console.error("PushNotificationService (requestPermissions): iOS - Firebase messaging not available.")
          return false
        }
        console.log("PushNotificationService (requestPermissions): Requesting iOS notification permission.")
        const authStatus = await messaging().requestPermission() // Call as a function
        console.log("PushNotificationService (requestPermissions): iOS permission status:", authStatus)
        return (
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL
        )
      }
      return false
    } catch (error) {
      console.error("PushNotificationService (requestPermissions): Error:", error)
      return false
    }
  }
  getFCMToken = async () => {
    try {
      if (!messaging) {
        console.error("PushNotificationService (getFCMToken): Firebase messaging not initialized")
        return null
      }
      const hasPermission = await this.requestPermissions()
      if (!hasPermission && Platform.OS === "ios") {
        console.warn("PushNotificationService (getFCMToken): Notification permissions not granted on iOS.")
      }

      const token = await messaging.getToken()
      console.log("PushNotificationService (getFCMToken): FCM Token retrieved:", token ? token : "N/A")
      if (token) {
        console.log("PushNotificationService (getFCMToken): Calling saveFCMToken with token:", token ? token : "N/A")
        await this.saveFCMToken(token)
      } else {
        console.warn("PushNotificationService (getFCMToken): messaging.getToken() returned no token.")
      }
      return token
    } catch (error) {
      console.error("PushNotificationService (getFCMToken): Error getting FCM token:", error)
      if (error.code === "messaging/notifications-permission-denied") {
        console.warn("PushNotificationService (getFCMToken): FCM token retrieval failed due to permission denial.")
      }
      return null
    }
  }

  saveFCMToken = async (token) => {
    try {
      console.log(
        "PushNotificationService (saveFCMToken): Attempting to save FCM token locally:",
        token ? token : "N/A",
      )
      await AsyncStorage.setItem("fcmToken", token)

      const authToken = await AsyncStorage.getItem("token")
      const response = await getDevices(authToken)
      const devices = response.devices
      const deviceId = await devices?.find(device => device.isActive)?.deviceId;
      // const activeDevice = devices.find(device => device.isActive);
      // const activeDeviceId = activeDevice?.deviceId;
      console.log("activeDeviceId: ", deviceId);
      console.log(
        `PushNotificationService (saveFCMToken): Retrieved from AsyncStorage - authToken: ${authToken ? "PRESENT" : "MISSING"}, deviceId: "${deviceId || "MISSING"}"`,
      )

      if (authToken && deviceId) {
        console.log(
          `PushNotificationService (saveFCMToken): authToken and deviceId ("${deviceId}") are present. Calling updateFCMTokenOnServer.`,
        )
        await this.updateFCMTokenOnServer(token, deviceId, authToken)
      } else {
        const missingItems = []
        if (!authToken) missingItems.push("authToken")
        if (!deviceId) missingItems.push("deviceId")
        console.warn(
          `PushNotificationService (saveFCMToken): CANNOT update FCM token on server. Missing from AsyncStorage: ${missingItems.join(", ")}.`,
        )
      }
    } catch (error) {
      console.error("PushNotificationService (saveFCMToken): Error in saveFCMToken:", error)
    }
  }

  updateFCMTokenOnServer = async (fcmToken, deviceId, authToken) => {
    const path = "/notifications/fcm-token"; // Ensure this path is EXACTLY what your backend expects
    const url = `${API_BASE_URL}${path}`;

    console.log(`PushNotificationService (updateFCMTokenOnServer): Attempting to POST to URL: ${url}`);
    console.log(
      `PushNotificationService (updateFCMTokenOnServer): Payload - deviceId: "${deviceId}", fcmToken: "${fcmToken ? fcmToken.substring(0, 20) + "..." : "N/A"}"`,
    );
    console.log(`PushNotificationService (updateFCMTokenOnServer): AuthToken: ${authToken ? "PRESENT (" + authToken.substring(0,10) + "...)" : "MISSING"}`);


    if (!authToken) {
      console.error("PushNotificationService (updateFCMTokenOnServer): Auth token is missing. Cannot update FCM token on server.");
      return;
    }
    if (!fcmToken) {
      console.error("PushNotificationService (updateFCMTokenOnServer): FCM token is missing. Cannot update.");
      return;
    }
    if (!deviceId) {
      console.error("PushNotificationService (updateFCMTokenOnServer): Device ID is missing. Cannot update.");
      return;
    }

    try {
      console.log("PushNotificationService (updateFCMTokenOnServer): PREPARING AXIOS POST...");
      const response = await axios.post(
        url,
        {
          deviceId: deviceId,
          fcmToken: fcmToken,
        },
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000, // 15 seconds timeout
        }
      );
      console.log("PushNotificationService (updateFCMTokenOnServer): AXIOS POST SUCCEEDED.");
      console.log(
        "PushNotificationService (updateFCMTokenOnServer): RAW RESPONSE RECEIVED:",
        JSON.stringify({ status: response.status, data: response.data, headers: response.headers }, null, 2),
      );

      if (response.status >= 200 && response.status < 300 && response.data?.success) {
        console.log(
          "PushNotificationService (updateFCMTokenOnServer): FCM token updated on server successfully. Response Data:",
          JSON.stringify(response.data, null, 2),
        );
      } else {
        console.error(
          "PushNotificationService (updateFCMTokenOnServer): Failed to update FCM token on server. Status:",
          response.status,
          "Response Data:",
          JSON.stringify(response.data, null, 2),
        );
      }
    } catch (error) {
      console.error("PushNotificationService (updateFCMTokenOnServer): \n!!!!!!!!!!!!!! AXIOS POST FAILED !!!!!!!!!!!!!!");

      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error("PushNotificationService (updateFCMTokenOnServer): Server Error Data:", JSON.stringify(error.response.data, null, 2));
        console.error("PushNotificationService (updateFCMTokenOnServer): Server Error Status:", error.response.status);
        console.error("PushNotificationService (updateFCMTokenOnServer): Server Error Headers:", JSON.stringify(error.response.headers, null, 2));
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.error("PushNotificationService (updateFCMTokenOnServer): Network Error (No Response):", error.request);
        if (error.message.includes('Network Error') || error.message.includes('timeout')) {
          console.error("PushNotificationService (updateFCMTokenOnServer): This might be a network reachability issue (check IP, port, firewall, cleartext HTTP permissions on Android) or request timeout.");
        }
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error("PushNotificationService (updateFCMTokenOnServer): Request Setup/Other Error Message:", error.message);
      }
      console.error("PushNotificationService (updateFCMTokenOnServer): Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      console.error("PushNotificationService (updateFCMTokenOnServer): \n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    }
  }

  handleNotificationTap = (notification) => {
    const data = notification.data || notification.userInfo // userInfo for iOS consistency
    console.log("PushNotificationService: Notification tapped with data:", data)

    // TODO: Implement navigation or action based on data.type
    // This often involves a global navigation ref or event emitters.
    // Example:
    // if (data.type === "incoming_call") {
    //   // Potentially navigate to an incoming call screen or show modal via context
    //   // The CallNotificationContext should ideally handle showing the modal if the app opens to it.
    // } else if (data.type === "message") {
    //   // global.navigationRef.navigate("Conversation", { conversationId: data.conversationId });
    // }
    if (data?.type === "incoming_call") {
      // The CallNotificationContext should already be showing the modal if the app is brought to foreground.
      // No specific action needed here unless you want to navigate directly to CallScreen (which acceptCall does).
      console.log(
        "PushNotificationService: Incoming call notification tapped. App should handle via CallNotificationContext.",
      )
    }
  }

  handleNotificationAction = (notification) => {
    const action = notification.action // e.g., "Accept", "Reject" (or "accept", "reject" for iOS if IDs are lowercase)
    const data = notification.data || notification.userInfo

    console.log(
      `PushNotificationService (handleNotificationAction): Action: "${action}", Data:`,
      JSON.stringify(data, null, 2),
    )

    if (data?.type === "incoming_call") {
      const callDataForAction = this.parseCallData(data)
      if (!callDataForAction) {
        console.error("PushNotificationService (handleNotificationAction): Could not parse callData for action.")
        return
      }

      // Normalize action IDs (iOS might use lowercase if defined that way)
      const normalizedAction = String(action).toLowerCase()

      if (normalizedAction === "accept") {
        console.log("PushNotificationService (handleNotificationAction): 'Accept' action. Emitting event.")
        DeviceEventEmitter.emit("acceptCallFromNotification", callDataForAction)
      } else if (normalizedAction === "reject") {
        console.log("PushNotificationService (handleNotificationAction): 'Reject' action. Emitting event.")
        DeviceEventEmitter.emit("rejectCallFromNotification", callDataForAction)
      } else {
        console.warn("PushNotificationService (handleNotificationAction): Unknown action:", action)
      }
    }
    // It's good practice to cancel the notification after an action is taken,
    // unless it's an ongoing notification that should persist.
    // For calls, if accepted/rejected, it should usually be dismissed.
    if (notification.id) {
      // notification.id might be the callId
      PushNotification.cancelLocalNotifications({ id: String(notification.id) })
    }
    this.stopVibration()
  }

  showIncomingCallNotification = (callData) => {
    if (!callData || !callData.callId || !callData.caller) {
      console.error("PushNotificationService (showIncomingCallNotification): Invalid callData provided.", callData)
      return
    }
    const { callId, caller, callType, offer, targetDeviceId, timestamp } = callData
    console.log("PushNotificationService (showIncomingCallNotification): Displaying for callId:", callId)

    const userInfoPayload = {
      type: "incoming_call",
      callId: callId,
      callerId: caller.id,
      callerName: caller.name || "Unknown Caller",
      callerProfilePic: caller.profilePicture || "",
      callType: callType || "audio",
      offer: offer ? JSON.stringify(offer) : null,
      targetDeviceId: targetDeviceId || "",
      timestamp: timestamp ? timestamp.toString() : Date.now().toString(),
      channelId: "calls", // Explicitly set for easier handling in onNotification if needed
    }

    PushNotification.localNotification({
      channelId: "calls",
      id: callId, // Use callId as notification ID
      title: `Incoming ${callType || "Voice"} Call`,
      message: `${caller.name || "Unknown Caller"} is calling`,
      playSound: true,
      soundName: "call_ringtone.mp3", // Ensure this file is in android/app/src/main/res/raw
      importance: "high",
      priority: "high",
      vibrate: true,
      // vibration: 1000, // Let channel define or override if specific pattern needed
      ongoing: true, // Makes the notification persistent
      actions: ["Accept", "Reject"], // Android actions (titles)
      invokeApp: false, // Let onAction handle it without auto-opening app
      userInfo: userInfoPayload,
      category: "CALL_INVITE", // For iOS actions
    })

    // For iOS, if react-native-push-notification doesn't handle categories well for remote,
    // you might need to ensure PushNotificationIOS.addNotificationRequest is used if this is for a purely local scenario.
    // However, for remote notifications, the category should be in the APNs payload.
    // This localNotification call is primarily for when app receives a data-only FCM and needs to show UI.
  }

  showMessageNotification = (messageData) => {
    if (!messageData || !messageData.message || !messageData.sender) {
      console.error("PushNotificationService (showMessageNotification): Invalid messageData provided.", messageData)
      return
    }
    const { sender, message, conversationId, isGroup, groupName } = messageData
    const title = isGroup ? `${sender.name || "Group"} in ${groupName || "Chat"}` : sender.name || "New Message"
    const notificationId = message.id || conversationId // Unique ID

    PushNotification.localNotification({
      channelId: "messages",
      id: String(notificationId), // Ensure ID is a string
      title: title,
      message: message.text || "You have a new message.",
      playSound: true,
      soundName: "message_tone.mp3", // Ensure this file is in android/app/src/main/res/raw
      vibrate: true,
      userInfo: {
        type: "message",
        conversationId,
        senderId: sender.id,
        messageId: message.id,
        isGroup: isGroup ? "true" : "false",
        groupName: groupName || "",
        channelId: "messages",
      },
    })
  }

  clearAllNotifications = () => {
    PushNotification.cancelAllLocalNotifications()
    this.stopVibration()
  }

  clearNotificationById = (notificationId) => {
    PushNotification.cancelLocalNotifications({ id: String(notificationId) })
  }

  stopVibration = () => {
    Vibration.cancel()
    // this.isVibrating = false; // Not strictly needed if just calling cancel
  }

  setBadgeCount = (count) => {
    PushNotification.setApplicationIconBadgeNumber(count)
  }

  subscribeToTopic = async (topic) => {
    try {
      if (messaging) {
        await messaging().subscribeToTopic(topic)
        console.log(`PushNotificationService: Subscribed to topic: ${topic}`)
      } else {
        console.error("PushNotificationService (subscribeToTopic): Firebase messaging not available.")
      }
    } catch (error) {
      console.error(`PushNotificationService (subscribeToTopic): Error subscribing to ${topic}:`, error)
    }
  }

  unsubscribeFromTopic = async (topic) => {
    try {
      if (messaging) {
        await messaging().unsubscribeFromTopic(topic)
        console.log(`PushNotificationService: Unsubscribed from topic: ${topic}`)
      } else {
        console.error("PushNotificationService (unsubscribeFromTopic): Firebase messaging not available.")
      }
    } catch (error) {
      console.error(`PushNotificationService (unsubscribeFromTopic): Error unsubscribing from ${topic}:`, error)
    }
  }
}


export default new PushNotificationService()

// iOS specific setup for notification categories (actions)
// This should be done once, e.g., in your app's entry point or when configuring notifications.
if (Platform.OS === "ios") {
  PushNotificationIOS.setNotificationCategories([
    {
      id: "CALL_INVITE",
      actions: [
        { id: "accept", title: "Accept", options: { foreground: true } },
        { id: "reject", title: "Reject", options: { destructive: true, foreground: false } }, // Opens app in background
      ],
    },
  ])
}
