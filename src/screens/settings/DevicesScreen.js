"use client"

import { useState, useEffect, useContext } from "react"
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useNavigation } from "@react-navigation/native"
import { AuthContext } from "../../context/AuthContext"
import { ThemeContext } from "../../context/ThemeContext"
import { getTheme } from "../../utils/theme"
import * as DevicesAPI from "../../api/devices"
import { getDeviceInfo } from "../../utils/device"
import { formatDate } from "../../utils/formatters"

const DevicesScreen = () => {
  const navigation = useNavigation()
  const { state: authState } = useContext(AuthContext)
  const { theme } = useContext(ThemeContext)
  const currentTheme = getTheme(theme)

  const [devices, setDevices] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentDeviceId, setCurrentDeviceId] = useState(null)

  // Fetch devices on component mount
  useEffect(() => {
    const getCurrentDevice = async () => {
      try {
        const deviceInfo = await getDeviceInfo()
        setCurrentDeviceId(deviceInfo.deviceId)
      } catch (error) {
        console.error("Error getting current device:", error)
      }
    }

    getCurrentDevice()
    fetchDevices()
  }, [])

  // Fetch devices from API
  const fetchDevices = async () => {
    try {
      setIsLoading(true)
      const response = await DevicesAPI.getDevices(authState.token)

      if (response.success) {
        setDevices(response.devices)
      } else {
        Alert.alert("Error", response.message || "Failed to load devices")
      }
    } catch (error) {
      console.error("Error fetching devices:", error)
      Alert.alert("Error", "Failed to load devices. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  // Handle device removal
  const handleRemoveDevice = (deviceId, deviceName) => {
    // Don't allow removing current device
    if (deviceId === currentDeviceId) {
      Alert.alert("Cannot Remove", "You cannot remove your current device. Please log out instead.")
      return
    }

    Alert.alert("Remove Device", `Are you sure you want to log out from "${deviceName}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            const response = await DevicesAPI.removeDevice(deviceId, authState.token)
            if (response.success) {
              fetchDevices() // Refresh the list
              Alert.alert("Success", "Device removed successfully")
            } else {
              Alert.alert("Error", response.message || "Failed to remove device")
            }
          } catch (error) {
            console.error("Error removing device:", error)
            Alert.alert("Error", "Failed to remove device. Please try again.")
          }
        },
      },
    ])
  }

  // Render device item
  const renderDeviceItem = ({ item }) => {
    const isCurrentDevice = item.deviceId === currentDeviceId

    return (
      <View style={[styles.deviceItem, { backgroundColor: currentTheme.card }]}>
        <View style={styles.deviceInfo}>
          <View style={[styles.deviceIconContainer, { backgroundColor: currentTheme.primary + "20" }]}>
            <Ionicons name={getDeviceIcon(item.platform)} size={24} color={currentTheme.primary} />
          </View>
          <View style={styles.deviceDetails}>
            <Text style={[styles.deviceName, { color: currentTheme.text }]}>
              {item.deviceName} {isCurrentDevice ? "(Current Device)" : ""}
            </Text>
            <Text style={[styles.deviceMeta, { color: currentTheme.placeholder }]}>
              {item.platform} • Last active: {formatDate(item.lastActive)}
            </Text>
          </View>
        </View>

        {!isCurrentDevice && (
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveDevice(item.deviceId, item.deviceName)}
          >
            <Ionicons name="log-out" size={20} color="#FF3B30" />
          </TouchableOpacity>
        )}
      </View>
    )
  }

  // Get device icon based on platform
  const getDeviceIcon = (platform) => {
    if (!platform) return "phone-portrait-outline"

    platform = platform.toLowerCase()
    if (platform.includes("ios") || platform.includes("iphone") || platform.includes("ipad")) {
      return "phone-portrait"
    } else if (platform.includes("android")) {
      return "phone-portrait-outline"
    } else if (platform.includes("web")) {
      return "desktop-outline"
    } else {
      return "phone-portrait-outline"
    }
  }

  // Handle logout from all other devices
  const handleLogoutAllOtherDevices = async () => {
    Alert.alert("Log Out All Other Devices", "Are you sure you want to log out from all other devices?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out All",
        style: "destructive",
        onPress: async () => {
          try {
            const response = await DevicesAPI.logoutAllOtherDevices(currentDeviceId, authState.token)
            if (response.success) {
              fetchDevices()
              Alert.alert("Success", "Logged out from all other devices")
            } else {
              Alert.alert("Error", response.message || "Failed to log out from devices")
            }
          } catch (error) {
            console.error("Error logging out devices:", error)
            Alert.alert("Error", "Failed to log out from devices. Please try again.")
          }
        },
      },
    ])
  }

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: currentTheme.background }]}>
        <ActivityIndicator size="large" color={currentTheme.primary} />
        <Text style={[styles.loadingText, { color: currentTheme.placeholder }]}>Loading devices...</Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <View style={[styles.infoBox, { backgroundColor: currentTheme.primary + "20" }]}>
        <Text style={[styles.infoText, { color: currentTheme.primary }]}>
          These are devices that are currently logged in to your CallNow account. You can log out from devices you're
          not using.
        </Text>
      </View>

      <FlatList
        data={devices}
        renderItem={renderDeviceItem}
        keyExtractor={(item) => item.deviceId}
        contentContainerStyle={styles.devicesList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: currentTheme.placeholder }]}>No other devices found</Text>
          </View>
        }
      />

      {devices.length > 1 && (
        <TouchableOpacity
          style={[styles.logoutAllButton, { backgroundColor: currentTheme.card }]}
          onPress={handleLogoutAllOtherDevices}
        >
          <Text style={[styles.logoutAllText, { color: "#FF3B30" }]}>Log Out All Other Devices</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  infoBox: {
    padding: 15,
    margin: 15,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
  },
  devicesList: {
    padding: 15,
  },
  deviceItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  deviceInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  deviceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  deviceDetails: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  deviceMeta: {
    fontSize: 14,
  },
  removeButton: {
    padding: 8,
  },
  emptyContainer: {
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
  },
  logoutAllButton: {
    margin: 15,
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  logoutAllText: {
    fontSize: 16,
    fontWeight: "500",
  },
})

export default DevicesScreen
