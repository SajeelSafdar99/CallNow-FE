"use client"

import { useState, useContext, useEffect } from "react"
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, useColorScheme } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { ThemeContext } from "../../context/ThemeContext"
import { getTheme } from "../../utils/theme"

const AppearanceScreen = () => {
  const { theme, setTheme, isSystemTheme, setSystemTheme } = useContext(ThemeContext)
  const deviceTheme = useColorScheme()
  const [followSystem, setFollowSystem] = useState(false)
  const currentTheme = getTheme(theme)

  // Check if theme is set to follow system on component mount
  useEffect(() => {
    const checkSystemTheme = async () => {
      const isSystem = await isSystemTheme()
      setFollowSystem(isSystem)
    }

    checkSystemTheme()
  }, [])

  // Handle system theme toggle
  const handleSystemThemeToggle = async (value) => {
    setFollowSystem(value)

    if (value) {
      // Follow system theme
      await setSystemTheme()
    } else {
      // Set to current device theme but don't follow system changes
      await setTheme(deviceTheme || "light")
    }
  }

  // Handle theme selection
  const handleThemeSelect = async (selectedTheme) => {
    if (followSystem) {
      // If following system, turn it off first
      setFollowSystem(false)
    }

    await setTheme(selectedTheme)
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <View style={[styles.section, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
        <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>Theme</Text>

        <View style={styles.optionContainer}>
          <View style={styles.optionInfo}>
            <Ionicons name="phone-portrait-outline" size={22} color={currentTheme.primary} style={styles.optionIcon} />
            <Text style={[styles.optionText, { color: currentTheme.text }]}>Use device settings</Text>
          </View>
          <Switch
            value={followSystem}
            onValueChange={handleSystemThemeToggle}
            trackColor={{ false: "#767577", true: "#128C7E" }}
            thumbColor={followSystem ? "#f4f3f4" : "#f4f3f4"}
          />
        </View>

        <Text style={[styles.sectionDescription, { color: currentTheme.placeholder }]}>
          {followSystem
            ? `Currently using ${deviceTheme || "light"} theme based on your device settings`
            : "Choose your preferred theme"}
        </Text>
      </View>

      {!followSystem && (
        <View style={[styles.themeOptions, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
          <TouchableOpacity
            style={[
              styles.themeOption,
              theme === "light" && styles.selectedTheme,
              theme === "light" && { borderColor: currentTheme.primary },
            ]}
            onPress={() => handleThemeSelect("light")}
          >
            <View style={styles.themePreview}>
              <View style={styles.lightThemePreview}>
                <View style={styles.previewHeader} />
                <View style={styles.previewContent}>
                  <View style={styles.previewMessage} />
                  <View style={styles.previewMessage} />
                </View>
              </View>
            </View>
            <Text style={[styles.themeLabel, { color: currentTheme.text }]}>Light</Text>
            {theme === "light" && (
              <View style={[styles.checkmark, { backgroundColor: currentTheme.primary }]}>
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.themeOption,
              theme === "dark" && styles.selectedTheme,
              theme === "dark" && { borderColor: currentTheme.primary },
            ]}
            onPress={() => handleThemeSelect("dark")}
          >
            <View style={styles.themePreview}>
              <View style={styles.darkThemePreview}>
                <View style={styles.previewHeaderDark} />
                <View style={styles.previewContentDark}>
                  <View style={styles.previewMessageDark} />
                  <View style={styles.previewMessageDark} />
                </View>
              </View>
            </View>
            <Text style={[styles.themeLabel, { color: currentTheme.text }]}>Dark</Text>
            {theme === "dark" && (
              <View style={[styles.checkmark, { backgroundColor: currentTheme.primary }]}>
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.section, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
        <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>Chat Wallpaper</Text>

        <TouchableOpacity style={styles.wallpaperOption}>
          <View style={styles.optionInfo}>
            <Ionicons name="image-outline" size={22} color={currentTheme.primary} style={styles.optionIcon} />
            <Text style={[styles.optionText, { color: currentTheme.text }]}>Change chat wallpaper</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={currentTheme.placeholder} />
        </TouchableOpacity>
      </View>

      <View style={[styles.section, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
        <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>Font Size</Text>

        <TouchableOpacity style={styles.fontSizeOption}>
          <Text style={[styles.fontSizeSmall, { color: currentTheme.text }]}>A</Text>
          <View style={styles.fontSizeSlider}>
            <View style={[styles.fontSizeSliderFill, { backgroundColor: currentTheme.primary }]} />
          </View>
          <Text style={[styles.fontSizeLarge, { color: currentTheme.text }]}>A</Text>
        </TouchableOpacity>

        <Text style={[styles.fontSizeLabel, { color: currentTheme.placeholder }]}>Medium</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    padding: 16,
    marginTop: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  sectionDescription: {
    fontSize: 14,
    marginTop: 8,
  },
  optionContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  optionInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  optionIcon: {
    marginRight: 12,
  },
  optionText: {
    fontSize: 16,
  },
  themeOptions: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    marginTop: 8,
    marginHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  themeOption: {
    width: "48%",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "transparent",
    padding: 12,
    alignItems: "center",
    position: "relative",
  },
  selectedTheme: {
    borderWidth: 2,
  },
  themePreview: {
    width: "100%",
    height: 120,
    marginBottom: 12,
    borderRadius: 8,
    overflow: "hidden",
  },
  lightThemePreview: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  darkThemePreview: {
    flex: 1,
    backgroundColor: "#121212",
  },
  previewHeader: {
    height: 30,
    backgroundColor: "#128C7E",
  },
  previewHeaderDark: {
    height: 30,
    backgroundColor: "#128C7E",
  },
  previewContent: {
    flex: 1,
    padding: 8,
    backgroundColor: "#E5DDD5",
  },
  previewContentDark: {
    flex: 1,
    padding: 8,
    backgroundColor: "#0E0E0E",
  },
  previewMessage: {
    height: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    marginBottom: 8,
  },
  previewMessageDark: {
    height: 20,
    backgroundColor: "#1E1E1E",
    borderRadius: 8,
    marginBottom: 8,
  },
  themeLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
  checkmark: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  wallpaperOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fontSizeOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  fontSizeSmall: {
    fontSize: 14,
    fontWeight: "bold",
  },
  fontSizeLarge: {
    fontSize: 22,
    fontWeight: "bold",
  },
  fontSizeSlider: {
    flex: 1,
    height: 4,
    backgroundColor: "#E0E0E0",
    marginHorizontal: 12,
    borderRadius: 2,
  },
  fontSizeSliderFill: {
    width: "50%",
    height: 4,
    borderRadius: 2,
  },
  fontSizeLabel: {
    textAlign: "center",
    fontSize: 14,
  },
})

export default AppearanceScreen
