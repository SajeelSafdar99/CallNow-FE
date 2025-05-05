import { Alert, Platform } from "react-native"
import { requestPermission } from "./permissions"
import ImagePicker from "react-native-image-picker"
import DocumentPicker from "@react-native-documents/picker"
import AudioRecorderPlayer from "react-native-audio-recorder-player"
import RNFS from "react-native-fs"

// Create a singleton instance of AudioRecorderPlayer
const audioRecorderPlayer = new AudioRecorderPlayer()

// Helper for picking images from gallery
export const pickImage = async () => {
  try {
    // Check permission first
    const hasPermission = await requestPermission("photoLibrary")
    if (!hasPermission) {
      Alert.alert("Permission Denied", "Photo library access is required to select photos.")
      return null
    }

    return new Promise((resolve, reject) => {
      ImagePicker.launchImageLibrary(
        {
          mediaType: "photo",
          quality: 0.8,
          includeBase64: false,
          maxWidth: 1200,
          maxHeight: 1200,
        },
        (response) => {
          if (response.didCancel) {
            resolve(null)
          } else if (response.errorCode) {
            reject(new Error(response.errorMessage))
          } else {
            const asset = response.assets?.[0]
            if (asset) {
              resolve({
                uri: asset.uri,
                type: asset.type,
                fileName: asset.fileName || `image_${Date.now()}.jpg`,
              })
            } else {
              resolve(null)
            }
          }
        },
      )
    })
  } catch (error) {
    console.error("Error picking image:", error)
    return null
  }
}

// Helper for taking photos with camera
export const takePhoto = async () => {
  try {
    // Check permission first
    const hasPermission = await requestPermission("camera")
    if (!hasPermission) {
      Alert.alert("Permission Denied", "Camera access is required to take photos.")
      return null
    }

    return new Promise((resolve, reject) => {
      ImagePicker.launchCamera(
        {
          mediaType: "photo",
          quality: 0.8,
          includeBase64: false,
          maxWidth: 1200,
          maxHeight: 1200,
        },
        (response) => {
          if (response.didCancel) {
            resolve(null)
          } else if (response.errorCode) {
            reject(new Error(response.errorMessage))
          } else {
            const asset = response.assets?.[0]
            if (asset) {
              resolve({
                uri: asset.uri,
                type: asset.type,
                fileName: asset.fileName || `photo_${Date.now()}.jpg`,
              })
            } else {
              resolve(null)
            }
          }
        },
      )
    })
  } catch (error) {
    console.error("Error taking photo:", error)
    return null
  }
}

// Helper for picking documents
export const pickDocument = async () => {
  try {
    return await DocumentPicker.pick({
      type: [DocumentPicker.types.allFiles],
    }).then((result) => {
      return {
        uri: result.uri,
        type: result.type,
        fileName: result.name,
      }
    })
  } catch (error) {
    if (DocumentPicker.isCancel(error)) {
      // User cancelled the picker
      return null
    }
    console.error("Error picking document:", error)
    return null
  }
}

// Helper for recording audio
export const startAudioRecording = async () => {
  try {
    // Check permission first
    const hasPermission = await requestPermission("microphone")
    if (!hasPermission) {
      Alert.alert("Permission Denied", "Microphone access is required to record audio.")
      return null
    }

    // Create directory if it doesn't exist
    const audioDir = `${RNFS.DocumentDirectoryPath}/audio`
    const dirExists = await RNFS.exists(audioDir)
    if (!dirExists) {
      await RNFS.mkdir(audioDir)
    }

    // Set up file path
    const fileName = `audio_${Date.now()}.m4a`
    const audioPath = Platform.OS === "ios" ? `${audioDir}/${fileName}` : `${audioDir}/${fileName}`

    // Start recording
    await audioRecorderPlayer.startRecorder(audioPath)

    return audioPath
  } catch (error) {
    console.error("Error starting audio recording:", error)
    return null
  }
}

export const stopAudioRecording = async () => {
  try {
    const filePath = await audioRecorderPlayer.stopRecorder()

    return {
      uri: filePath,
      type: "audio/m4a",
      fileName: filePath.split("/").pop(),
    }
  } catch (error) {
    console.error("Error stopping audio recording:", error)
    return null
  }
}

// Helper for playing audio
export const playAudio = async (uri) => {
  try {
    await audioRecorderPlayer.startPlayer(uri)
    return true
  } catch (error) {
    console.error("Error playing audio:", error)
    return false
  }
}

export const stopAudio = async () => {
  try {
    await audioRecorderPlayer.stopPlayer()
    return true
  } catch (error) {
    console.error("Error stopping audio:", error)
    return false
  }
}

// Safe vector icons
export const safeGetIonicons = async () => {
  try {
    // Dynamically import the library only when needed
    const { Ionicons } = await import("@expo/vector-icons").catch(() => ({ Ionicons: null }))
    console.log("Ionicons", Ionicons)
    return Ionicons
  } catch (error) {
    console.error("Error loading @expo/vector-icons:", error)
    return null
  }
}
