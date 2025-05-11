"use client"

import { useState, useContext, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  useColorScheme,
  Modal,
  Image,
  Alert,
  FlatList
} from "react-native"
import Slider from '@react-native-community/slider';

import Ionicons from 'react-native-vector-icons/Ionicons';
import { ThemeContext } from "../../context/ThemeContext"
import { getTheme } from "../../utils/theme"
import * as ImagePicker from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Default wallpapers
const DEFAULT_WALLPAPERS = [
  { id: 'default', uri: require('../../assets/images/wallpapers/default.jpg'), name: 'Default' },
  { id: 'dark', uri: require('../../assets/images/wallpapers/dark.jpg'), name: 'Dark' },
  { id: 'light', uri: require('../../assets/images/wallpapers/light.jpg'), name: 'Light' },
  { id: 'pattern1', uri: require('../../assets/images/wallpapers/pattern1.jpg'), name: 'Pattern 1' },
  { id: 'pattern2', uri: require('../../assets/images/wallpapers/pattern2.jpg'), name: 'Pattern 2' },
];


const AppearanceScreen = () => {
  const { theme, setTheme, isSystemTheme, setSystemTheme } = useContext(ThemeContext)
  const deviceTheme = useColorScheme()
  const [followSystem, setFollowSystem] = useState(false)
  const currentTheme = getTheme(theme)

  // Wallpaper state
  const [wallpaperModalVisible, setWallpaperModalVisible] = useState(false)
  const [selectedWallpaper, setSelectedWallpaper] = useState('default')
  const [customWallpaper, setCustomWallpaper] = useState(null)

  // Check if theme is set to follow system on component mount
  useEffect(() => {
    const checkSystemTheme = async () => {
      const isSystem = await isSystemTheme()
      setFollowSystem(isSystem)
    }

    // Load saved wallpaper and font size
    const loadSettings = async () => {
      try {
        // Load wallpaper
        const savedWallpaper = await AsyncStorage.getItem('selectedWallpaper')
        if (savedWallpaper) {
          setSelectedWallpaper(savedWallpaper)
        }

        const savedCustomWallpaper = await AsyncStorage.getItem('customWallpaper')
        if (savedCustomWallpaper) {
          setCustomWallpaper(savedCustomWallpaper)
        }

      } catch (error) {
        console.error('Error loading appearance settings:', error)
      }
    }

    checkSystemTheme()
    loadSettings()
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

  // Handle wallpaper selection
  const handleWallpaperSelect = async (wallpaperId) => {
    setSelectedWallpaper(wallpaperId)

    // If custom is selected, show image picker
    if (wallpaperId === 'custom') {
      handlePickImage()
      return
    }
    try {
      await AsyncStorage.setItem('selectedWallpaper', wallpaperId).then(() => {
        Alert.alert(
          "Success",
          "Wallpaper set successfully",
          [{ text: "OK", onPress: () => setWallpaperModalVisible(false) }]
        )
      })

      // Apply wallpaper to chat screens
      // This would typically update a context or global state that chat screens use

      setWallpaperModalVisible(false)
    } catch (error) {
      console.error('Error saving wallpaper selection:', error)
      Alert.alert('Error', 'Failed to save wallpaper selection')
    }
  }

// Handle custom image selection
  const handlePickImage = () => {
    ImagePicker.launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
    }, (response) => {
      if (response.didCancel) {
        // User cancelled image picker
        return
      } else if (response.errorCode) {
        console.error('ImagePicker Error:', response.errorMessage)
        Alert.alert('Error', 'Failed to select image')
        return
      }

      if (response.assets && response.assets[0].uri) {
        const imageUri = response.assets[0].uri
        setCustomWallpaper(imageUri)

        // Save custom wallpaper
        AsyncStorage.setItem('customWallpaper', imageUri)
          .then(() => {
            // Also save that we're using a custom wallpaper
            AsyncStorage.setItem('selectedWallpaper', 'custom')
              .then(() => {
                // Show success message
                Alert.alert(
                  "Success",
                  "Custom wallpaper set successfully",
                  [{ text: "OK", onPress: () => setWallpaperModalVisible(false) }]
                )
              })
          })
          .catch(error => {
            console.error('Error saving custom wallpaper:', error)
            Alert.alert('Error', 'Failed to save custom wallpaper')
          })
      }
    })
  }

  // Render wallpaper item
  const renderWallpaperItem = ({ item }) => {
    const isSelected = selectedWallpaper === item.id

    return (
      <TouchableOpacity
        style={[
          styles.wallpaperItem,
          isSelected && styles.selectedWallpaperItem
        ]}
        onPress={() => handleWallpaperSelect(item.id)}
      >
        <Image
          source={item.uri}
          style={styles.wallpaperImage}
          resizeMode="cover"
        />
        <Text style={[
          styles.wallpaperName,
          { color: currentTheme.text }
        ]}>
          {item.name}
        </Text>
        {isSelected && (
          <View style={[styles.wallpaperCheckmark, { backgroundColor: currentTheme.primary }]}>
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>
    )
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

        <TouchableOpacity
          style={styles.wallpaperOption}
          onPress={() => setWallpaperModalVisible(true)}
        >
          <View style={styles.optionInfo}>
            <Ionicons name="image-outline" size={22} color={currentTheme.primary} style={styles.optionIcon} />
            <Text style={[styles.optionText, { color: currentTheme.text }]}>Change chat wallpaper</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={currentTheme.placeholder} />
        </TouchableOpacity>
      </View>

      {/* Wallpaper Selection Modal */}
      <Modal
        visible={wallpaperModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setWallpaperModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: currentTheme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: currentTheme.text }]}>Select Wallpaper</Text>
              <TouchableOpacity onPress={() => setWallpaperModalVisible(false)}>
                <Ionicons name="close" size={24} color={currentTheme.text} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={[
                ...DEFAULT_WALLPAPERS,
                { id: 'custom', uri: customWallpaper || require('../../assets/images/wallpapers/default.jpg'), name: 'Custom' }
              ]}
              renderItem={renderWallpaperItem}
              keyExtractor={item => item.id}
              numColumns={2}
              contentContainerStyle={styles.wallpaperGrid}
            />
          </View>
        </View>
      </Modal>
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
    height: 4,
    borderRadius: 2,
  },
  fontSizeLabel: {
    textAlign: "center",
    fontSize: 14,
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },

  // Wallpaper styles
  wallpaperGrid: {
    paddingBottom: 20,
  },
  wallpaperItem: {
    width: '48%',
    margin: '1%',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 16,
  },
  selectedWallpaperItem: {
    borderWidth: 2,
    borderColor: '#128C7E',
  },
  wallpaperImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
  },
  wallpaperName: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
  },
  wallpaperCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Font size modal styles
  fontSizePreview: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  fontSizePreviewText: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  fontSizePreviewMessage: {
    lineHeight: 20,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sliderLabel: {
    width: 50,
    textAlign: 'center',
  },
  slider: {
    flex: 1,
    height: 40,
  },
  fontSizeValueLabel: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  saveButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
})

export default AppearanceScreen
