"use client"

import { useState, useEffect } from "react"
import { View } from "react-native"
import { safeGetIonicons } from "../../utils/media-helpers"

const SafeIcon = ({ name, size, color }) => {
  const [Ionicons, setIonicons] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadIonicons = async () => {
      try {
        const IoniconComponent = await safeGetIonicons()
        setIonicons(IoniconComponent)
      } catch (error) {
        console.error("Error loading Ionicons:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadIonicons()
  }, [])

  if (isLoading) {
    // Return an empty placeholder while loading
    return <View style={{ width: size, height: size }} />
  }

  if (!Ionicons) {
    // Return a simple fallback if Ionicons couldn't be loaded
    return (
      <View
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          borderRadius: size / 2,
        }}
      />
    )
  }

  // Return the actual Ionicon if loaded successfully
  return <Ionicons name={name} size={size} color={color} />
}

export default SafeIcon
