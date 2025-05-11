import { createContext, useState, useEffect } from "react"
import { useColorScheme } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"

export const ThemeContext = createContext()

const THEME_STORAGE_KEY = "CallNow"

export const ThemeProvider = ({ children }) => {
  const deviceTheme = useColorScheme()
  const [theme, setTheme] = useState("light") // Default to light theme
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY)

        if (savedTheme) {
          setTheme(savedTheme)
        } else if (deviceTheme) {
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

  const setThemePreference = async (newTheme) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme)
      setTheme(newTheme)
    } catch (error) {
      console.error("Error saving theme preference:", error)
    }
  }

  const toggleTheme = async () => {
    const newTheme = theme === "light" ? "dark" : "light"
    setThemePreference(newTheme)
  }

  const setSystemTheme = async () => {
    await AsyncStorage.removeItem(THEME_STORAGE_KEY)
    setTheme(deviceTheme || "light")
  }

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
