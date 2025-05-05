// This file can be imported early in your app to debug icon issues

export const debugIcons = async () => {
  try {
    console.log("Checking Ionicons availability...")

    // Try to import Ionicons
    const vectorIcons = await import("@expo/vector-icons")
    console.log("Vector icons imported:", Object.keys(vectorIcons))

    if (vectorIcons.Ionicons) {
      console.log("Ionicons is available")
      console.log("Ionicons font:", vectorIcons.Ionicons.font)
    } else {
      console.warn("Ionicons is not available in @expo/vector-icons")
    }

    // Try to import Ionicons directly
    const { Ionicons } = await import("@expo/vector-icons/Ionicons")
    if (Ionicons) {
      console.log("Direct Ionicons import successful")
    }

    return true
  } catch (error) {
    console.error("Error checking Ionicons:", error)
    return false
  }
}

// You can call this function in your App.js or early in your app initialization
