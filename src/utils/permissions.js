import { Platform, Alert } from "react-native"
import { check, request, PERMISSIONS, RESULTS } from "react-native-permissions"

// Function to request a specific permission
export const requestPermission = async (permissionType) => {
  try {
    // Define the permission based on platform
    let permission

    switch (permissionType) {
      case "camera":
        permission = Platform.OS === "ios" ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA
        break
      case "photoLibrary":
        permission = Platform.OS === "ios" ? PERMISSIONS.IOS.PHOTO_LIBRARY : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE
        break
      case "microphone":
        permission = Platform.OS === "ios" ? PERMISSIONS.IOS.MICROPHONE : PERMISSIONS.ANDROID.RECORD_AUDIO
        break
      case "storage":
        permission = Platform.OS === "ios" ? PERMISSIONS.IOS.MEDIA_LIBRARY : PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE
        break
      default:
        console.error("Unknown permission type:", permissionType)
        return false
    }

    // Check current permission status
    const result = await check(permission)

    if (result === RESULTS.GRANTED) {
      return true
    }

    // If permission is denied but requestable, show rationale and request
    if (result === RESULTS.DENIED) {
      const requestResult = await request(permission)
      return requestResult === RESULTS.GRANTED
    }

    // If permission is blocked, prompt user to enable in settings
    if (result === RESULTS.BLOCKED) {
      Alert.alert(
        "Permission Required",
        `${permissionType} permission is required. Please enable it in your device settings.`,
        [{ text: "OK" }],
      )
      return false
    }

    return false
  } catch (error) {
    console.error(`Error requesting ${permissionType} permission:`, error)
    return false
  }
}

// Function to check and request all necessary permissions for the app
export const checkAndRequestPermissions = async () => {
  const cameraPermission = await requestPermission("camera")
  const photoLibraryPermission = await requestPermission("photoLibrary")
  const microphonePermission = await requestPermission("microphone")
  const storagePermission = await requestPermission("storage")

  return {
    camera: cameraPermission,
    photoLibrary: photoLibraryPermission,
    microphone: microphonePermission,
    storage: storagePermission,
  }
}
