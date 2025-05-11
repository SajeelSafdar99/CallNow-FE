// import { Platform } from "react-native";
// import AsyncStorage from "@react-native-async-storage/async-storage";
// import PushNotificationIOS from "@react-native-community/push-notification-ios";
// import PushNotification from "react-native-push-notification";
//
// // Initialize notifications
// export const initializeNotifications = () => {
//   // Configure the notification system
//   PushNotification.configure({
//     // (required) Called when a remote or local notification is opened or received
//     onNotification: function (notification) {
//       console.log("NOTIFICATION:", notification);
//
//       // Process the notification
//
//       // Required on iOS only
//       if (Platform.OS === 'ios') {
//         notification.finish(PushNotificationIOS.FetchResult.NoData);
//       }
//     },
//
//     // IOS ONLY
//     permissions: {
//       alert: true,
//       badge: true,
//       sound: true,
//     },
//
//     // Should the initial notification be popped automatically
//     popInitialNotification: true,
//
//     /**
//      * (optional) default: true
//      * - Specified if permissions (ios) and token (android and ios) will requested or not,
//      * - if not, you must call PushNotificationsHandler.requestPermissions() later
//      */
//     requestPermissions: true,
//   });
//
//   // Create notification channels for Android
//   if (Platform.OS === 'android') {
//     PushNotification.createChannel(
//       {
//         channelId: "default-channel-id",
//         channelName: "Default Channel",
//         channelDescription: "A default channel for notifications",
//         soundName: "default",
//         importance: 4, // Importance level (4 is high)
//         vibrate: true,
//       },
//       (created) => console.log(`Channel created: ${created}`)
//     );
//
//     // Create a high priority channel for calls
//     PushNotification.createChannel(
//       {
//         channelId: "calls-channel-id",
//         channelName: "Calls",
//         channelDescription: "Channel for call notifications",
//         soundName: "ringtone",
//         importance: 5, // Highest importance
//         vibrate: true,
//       },
//       (created) => console.log(`Calls channel created: ${created}`)
//     );
//   }
// };
//
// // Register for push notifications - simplified version for React Native
// export const registerForPushNotifications = async () => {
//   try {
//     // Request permissions on iOS
//     if (Platform.OS === 'ios') {
//       const authStatus = await PushNotificationIOS.requestPermissions({
//         alert: true,
//         badge: true,
//         sound: true,
//       });
//
//       if (!authStatus) {
//         console.log("Permission not granted");
//         return null;
//       }
//     }
//
//     // For a real implementation, you would need to integrate with Firebase Cloud Messaging (FCM)
//     // for Android and Apple Push Notification service (APNs) for iOS
//
//     // For now, we'll just return a placeholder token
//     const token = "placeholder-token";
//     await AsyncStorage.setItem("pushToken", token);
//
//     return token;
//   } catch (error) {
//     console.error("Error registering for push notifications:", error);
//     return null;
//   }
// };
//
// // Send local notification
// export const sendLocalNotification = (title, body, data = {}) => {
//   PushNotification.localNotification({
//     channelId: data.type === "incoming_call" ? "calls-channel-id" : "default-channel-id",
//     title: title,
//     message: body,
//     userInfo: data,
//     playSound: true,
//     soundName: data.type === "incoming_call" ? "ringtone" : "default",
//   });
// };
//
// // Update badge count
// export const updateBadgeCount = (count) => {
//   PushNotification.setApplicationIconBadgeNumber(count);
// };
//
// // Clear all notifications
// export const clearAllNotifications = () => {
//   PushNotification.cancelAllLocalNotifications();
//   updateBadgeCount(0);
// };
//
// // Get notification permissions status - simplified version
// export const getNotificationPermissionsStatus = async () => {
//   if (Platform.OS === 'ios') {
//     const settings = await PushNotificationIOS.checkPermissions();
//     if (settings.alert && settings.badge && settings.sound) {
//       return "granted";
//     } else {
//       return "denied";
//     }
//   }
//
//   // On Android, permissions are requested at app install time
//   return "granted";
// };
//
// // Request notification permissions - simplified version
// export const requestNotificationPermissions = async () => {
//   if (Platform.OS === 'ios') {
//     const settings = await PushNotificationIOS.requestPermissions({
//       alert: true,
//       badge: true,
//       sound: true,
//     });
//
//     if (settings.alert && settings.badge && settings.sound) {
//       return "granted";
//     } else {
//       return "denied";
//     }
//   }
//
//   // On Android, permissions are requested at app install time
//   return "granted";
// };
