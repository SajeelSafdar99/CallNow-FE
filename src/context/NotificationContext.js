// "use client"
//
// import { createContext, useContext, useEffect, useState } from "react";
// import { Platform, AppState } from "react-native";
// import PushNotification from "react-native-push-notification";
// import { AuthContext } from "./AuthContext";
// import { SocketContext } from "./SocketContext";
// import {
//   sendLocalNotification,
//   registerForPushNotifications
// } from "../utils/notification-service";
//
// export const NotificationContext = createContext();
//
// // Create a navigation ref to use instead of useNavigation hook
// let navigationRef = null;
//
// export const setNavigationRef = (ref) => {
//   navigationRef = ref;
// };
//
// // Helper function to navigate without the hook
// const navigate = (name, params) => {
//   if (navigationRef && navigationRef.isReady()) {
//     navigationRef.navigate(name, params);
//   } else {
//     console.warn("Navigation attempted before navigator was ready");
//   }
// };
//
// export const NotificationProvider = ({ children }) => {
//   const { state: authState } = useContext(AuthContext);
//   const { socket } = useContext(SocketContext);
//
//   const [pushToken, setPushToken] = useState("");
//   const [notification, setNotification] = useState(null);
//   const [appState, setAppState] = useState(AppState.currentState);
//   const [incomingCall, setIncomingCall] = useState(null);
//   const [incomingGroupCall, setIncomingGroupCall] = useState(null);
//
//   // Register for push notifications
//   useEffect(() => {
//     const setupNotifications = async () => {
//       const token = await registerForPushNotifications();
//       if (token) {
//         setPushToken(token);
//       }
//     };
//
//     setupNotifications();
//
//     // Set up notification listener
//     PushNotification.configure({
//       onNotification: function(notification) {
//         setNotification(notification);
//
//         // Handle notification navigation
//         if (notification.userInfo) {
//           handleNotificationNavigation(notification.userInfo);
//         }
//
//         // Required on iOS only
//         if (Platform.OS === 'ios') {
//           notification.finish();
//         }
//       },
//     });
//
//     // Monitor app state changes
//     const appStateListener = AppState.addEventListener("change", (nextAppState) => {
//       setAppState(nextAppState);
//     });
//
//     return () => {
//       // Clean up listeners
//       appStateListener.remove();
//     };
//   }, []);
//
//   // Set up socket listeners for call notifications
//   useEffect(() => {
//     if (socket && socket.connected) {
//       // Listen for incoming calls
//       socket.on("incoming-call", handleIncomingCall);
//
//       // Listen for incoming group calls
//       socket.on("incoming-group-call", handleIncomingGroupCall);
//
//       // Listen for call canceled
//       socket.on("call-canceled", handleCallCanceled);
//
//       // Listen for group call canceled
//       socket.on("group-call-canceled", handleGroupCallCanceled);
//     }
//
//     return () => {
//       if (socket) {
//         socket.off("incoming-call");
//         socket.off("incoming-group-call");
//         socket.off("call-canceled");
//         socket.off("group-call-canceled");
//       }
//     };
//   }, [socket]);
//
//   // Handle incoming call notification
//   const handleIncomingCall = async (data) => {
//     const { callId, caller, isVideoCall } = data;
//
//     // Set incoming call data
//     setIncomingCall({
//       callId,
//       caller,
//       isVideoCall,
//       timestamp: Date.now(),
//     });
//
//     // If app is in background, send push notification
//     if (appState !== "active") {
//       sendLocalNotification(
//         `Incoming ${isVideoCall ? "Video" : "Voice"} Call`,
//         `${caller.name} is calling you`,
//         {
//           type: "incoming_call",
//           callId,
//           callerId: caller._id,
//           isVideoCall,
//         }
//       );
//     }
//   };
//
//   // Handle incoming group call notification
//   const handleIncomingGroupCall = async (data) => {
//     const { groupCallId, caller, conversation, isVideoCall } = data;
//
//     // Set incoming group call data
//     setIncomingGroupCall({
//       groupCallId,
//       caller,
//       conversation,
//       isVideoCall,
//       timestamp: Date.now(),
//     });
//
//     // If app is in background, send push notification
//     if (appState !== "active") {
//       sendLocalNotification(
//         `Incoming Group ${isVideoCall ? "Video" : "Voice"} Call`,
//         `${caller.name} is calling ${conversation.isGroup ? conversation.groupName : "you"}`,
//         {
//           type: "incoming_group_call",
//           groupCallId,
//           callerId: caller._id,
//           conversationId: conversation._id,
//           isVideoCall,
//         }
//       );
//     }
//   };
//
//   // Handle call canceled notification
//   const handleCallCanceled = (data) => {
//     const { callId } = data;
//
//     // Clear incoming call if it matches
//     if (incomingCall && incomingCall.callId === callId) {
//       setIncomingCall(null);
//     }
//   };
//
//   // Handle group call canceled notification
//   const handleGroupCallCanceled = (data) => {
//     const { groupCallId } = data;
//
//     // Clear incoming group call if it matches
//     if (incomingGroupCall && incomingGroupCall.groupCallId === groupCallId) {
//       setIncomingGroupCall(null);
//     }
//   };
//
//   // Handle notification navigation
//   const handleNotificationNavigation = (data) => {
//     if (!data) return;
//
//     switch (data.type) {
//       case "message":
//         navigate("Chat", {
//           conversationId: data.conversationId,
//           contactUser: data.sender,
//         });
//         break;
//
//       case "incoming_call":
//         navigate("Call", {
//           contactUser: { _id: data.callerId },
//           isVideoCall: data.isVideoCall,
//           incomingCall: {
//             callId: data.callId,
//             caller: { _id: data.callerId },
//           },
//         });
//         break;
//
//       case "incoming_group_call":
//         navigate("GroupCall", {
//           conversation: { _id: data.conversationId },
//           isVideoCall: data.isVideoCall,
//           incomingCall: {
//             groupCallId: data.groupCallId,
//             caller: { _id: data.callerId },
//           },
//         });
//         break;
//
//       default:
//         break;
//     }
//   };
//
//   // Accept incoming call
//   const acceptCall = () => {
//     if (incomingCall) {
//       navigate("Call", {
//         contactUser: incomingCall.caller,
//         isVideoCall: incomingCall.isVideoCall,
//         incomingCall: incomingCall,
//       });
//       setIncomingCall(null);
//     }
//   };
//
//   // Reject incoming call
//   const rejectCall = () => {
//     if (incomingCall && socket) {
//       socket.emit("reject-call", {
//         callId: incomingCall.callId,
//         recipientId: incomingCall.caller._id,
//       });
//       setIncomingCall(null);
//     }
//   };
//
//   // Accept incoming group call
//   const acceptGroupCall = () => {
//     if (incomingGroupCall) {
//       navigate("GroupCall", {
//         conversation: incomingGroupCall.conversation,
//         isVideoCall: incomingGroupCall.isVideoCall,
//         incomingCall: incomingGroupCall,
//       });
//       setIncomingGroupCall(null);
//     }
//   };
//
//   // Reject incoming group call
//   const rejectGroupCall = () => {
//     if (incomingGroupCall && socket) {
//       socket.emit("reject-group-call", {
//         groupCallId: incomingGroupCall.groupCallId,
//         recipientId: incomingGroupCall.caller._id,
//       });
//       setIncomingGroupCall(null);
//     }
//   };
//
//   return (
//     <NotificationContext.Provider
//       value={{
//         pushToken,
//         notification,
//         incomingCall,
//         incomingGroupCall,
//         acceptCall,
//         rejectCall,
//         acceptGroupCall,
//         rejectGroupCall,
//         sendLocalNotification,
//       }}
//     >
//       {children}
//     </NotificationContext.Provider>
//   );
// };
