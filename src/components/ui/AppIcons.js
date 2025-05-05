"use client"

import { View } from "react-native"
import { useState, useEffect } from "react"

// This component will safely render Ionicons or a fallback
export const Ionicon = ({ name, size = 24, color = "black", style = {} }) => {
  const [IconComponent, setIconComponent] = useState(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadIconLibrary = async () => {
      try {
        // Wait a bit to ensure React Native is fully initialized
        await new Promise((resolve) => setTimeout(resolve, 100))

        // Try to import the Ionicons component
        const { Ionicons } = await import("@expo/vector-icons")

        if (isMounted) {
          setIconComponent(() => Ionicons)
          setIsLoaded(true)
        }
      } catch (error) {
        console.error("Failed to load Ionicons:", error)
        if (isMounted) {
          setHasError(true)
          setIsLoaded(true)
        }
      }
    }

    loadIconLibrary()

    return () => {
      isMounted = false
    }
  }, [])

  if (!isLoaded) {
    // Return placeholder while loading
    return (
      <View
        style={{
          width: size,
          height: size,
          ...style,
        }}
      />
    )
  }

  if (hasError || !IconComponent) {
    // Return colored box as fallback
    return (
      <View
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          borderRadius: size / 2,
          ...style,
        }}
      />
    )
  }

  // Return the actual icon if loaded successfully
  return <IconComponent name={name} size={size} color={color} style={style} />
}

// Export other icon types as needed
// export const MaterialIcon = ...
