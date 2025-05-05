import AsyncStorage from "@react-native-async-storage/async-storage"
import { Platform } from "react-native"
import "react-native-get-random-values"
import { v4 as uuidv4 } from "uuid"

// Get a unique device ID
export const getUniqueId = async () => {
  try {
    // Try to get existing device ID from storage
    let deviceId = await AsyncStorage.getItem("deviceId")

    // If no device ID exists, create a new one
    if (!deviceId) {
      deviceId = `${Platform.OS}-${uuidv4()}`
      await AsyncStorage.setItem("deviceId", deviceId)
    }

    return deviceId
  } catch (error) {
    console.error("Error getting device ID:", error)
    // Fallback to a random ID if storage fails
    return `${Platform.OS}-${uuidv4()}`
  }
}

// Get device info
export const getDeviceInfo = async () => {
  try {
    const deviceName = Platform.OS === "ios" ? "iOS Device" : "Android Device"
    return {
      deviceId: await getUniqueId(),
      deviceName,
      platform: Platform.OS,
      version: Platform.Version,
    }
  } catch (error) {
    console.error("Error getting device info:", error)
    return {
      deviceId: `${Platform.OS}-${uuidv4()}`,
      deviceName: "Unknown Device",
      platform: Platform.OS,
      version: "Unknown",
    }
  }
}
