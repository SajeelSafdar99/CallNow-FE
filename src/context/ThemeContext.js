"use client"

import { createContext, useState, useEffect } from "react"
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
  }, [])

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
    setThemePreference(newTheme)
  }

  // Set theme to follow system preference
  const setSystemTheme = async () => {
    await AsyncStorage.removeItem(THEME_STORAGE_KEY)
    setTheme(deviceTheme || "light")
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

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === "dark",
        isLoading,
        toggleTheme,
        setTheme: setThemePreference,
        setSystemTheme,
        isSystemTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export default ThemeProvider
