"use client"

import { createContext, useState, useEffect, useContext } from "react"
import { useColorScheme } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"

export const ThemeContext = createContext()

const THEME_STORAGE_KEY = "whatsapp_theme_preference"

export const ThemeProvider = ({ children }) => {
  const deviceTheme = useColorScheme()
  const [theme, setTheme] = useState("light") // Default to light theme
  const [isLoading, setIsLoading] = useState(true)

  // Load saved theme preference on app start
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY)

        if (savedTheme) {
          // Use saved preference if available
          setTheme(savedTheme)
        } else if (deviceTheme) {
          // Otherwise use device theme if available
          setTheme(deviceTheme)
        }
      } catch (error) {
        console.error("Error loading theme preference:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadThemePreference()
  }, [deviceTheme])

  // Save theme preference when it changes
  const setThemePreference = async (newTheme) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme)
      setTheme(newTheme)
    } catch (error) {
      console.error("Error saving theme preference:", error)
    }
  }

  // Toggle between light and dark themes
  const toggleTheme = async () => {
    const newTheme = theme === "light" ? "dark" : "light"
    await setThemePreference(newTheme)
  }

  // Set theme to follow system preference
  const setSystemTheme = async () => {
    try {
      await AsyncStorage.removeItem(THEME_STORAGE_KEY)
      setTheme(deviceTheme || "light")
    } catch (error) {
      console.error("Error setting system theme:", error)
    }
  }

  // Check if current theme is system default
  const isSystemTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY)
      return savedTheme === null
    } catch (error) {
      console.error("Error checking if theme is system default:", error)
      return false
    }
  }

  // Listen to device theme changes when using system theme
  useEffect(() => {
    const checkSystemTheme = async () => {
      const isUsingSystemTheme = await isSystemTheme()
      if (isUsingSystemTheme && deviceTheme) {
        setTheme(deviceTheme)
      }
    }

    checkSystemTheme()
  }, [deviceTheme])

  const contextValue = {
    theme,
    isDark: theme === "dark",
    isLoading,
    toggleTheme,
    setTheme: setThemePreference,
    setSystemTheme,
    isSystemTheme,
  }

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>
}

// Custom hook to use theme context
export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}

export default ThemeProvider
