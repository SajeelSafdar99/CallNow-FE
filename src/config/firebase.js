import { initializeApp, getApps } from "@react-native-firebase/app"
import messaging from "@react-native-firebase/messaging"
import { Platform } from "react-native"

// Firebase configuration object
const firebaseConfig = {
  apiKey: "AIzaSyCEOjSZftuJAVz2kHU2LjjK-P0l-KB3ZvQ",
  authDomain: "callnow-1b53e.firebaseapp.com",
  projectId: "callnow-1b53e",
  storageBucket: "callnow-1b53e.appspot.com",
  messagingSenderId: "34513178821",
  appId: "1:34513178821:android:b5fd21c1e285ccfa0f60ac",
};
// Initialize Firebase only if it hasn't been initialized yet
let app
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig)
  console.log("Firebase initialized successfully")
} else {
  app = getApps()[0]
  console.log("Firebase already initialized")
}

// Initialize Firebase Messaging
let messagingInstance
try {
  messagingInstance = messaging()
  console.log("Firebase Messaging initialized")
} catch (error) {
  console.error("Error initializing Firebase Messaging:", error)
}

export { app, messagingInstance as messaging }
export default app
