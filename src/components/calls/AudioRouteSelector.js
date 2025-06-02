// Using the version from your attachment "AudioRouteSelector-Qo68u7ffUnPznjdIqLD7s7BYUbwSof.js"
// No changes needed for this file based on the current debugging goals.
"use client"

import { useState, useEffect } from "react"
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, Alert } from "react-native"
import Ionicons from "react-native-vector-icons/Ionicons"
import AudioManager from "../../utils/audio-manager"

const AudioRouteSelector = ({ visible, onClose, onRouteSelected }) => {
  const [availableRoutes, setAvailableRoutes] = useState([])
  const [currentRoute, setCurrentRoute] = useState("earpiece")

  useEffect(() => {
    if (visible) {
      loadAvailableRoutes()
      setCurrentRoute(AudioManager.getCurrentAudioRoute())
    }
  }, [visible])

  const loadAvailableRoutes = async () => {
    try {
      const routes = await AudioManager.getAvailableAudioRoutes()
      setAvailableRoutes(routes)
    } catch (error) {
      console.error("Error loading audio routes:", error)
      Alert.alert("Error", "Failed to load audio options")
    }
  }

  const selectRoute = async (route) => {
    try {
      const success = await AudioManager.setAudioRoute(route)
      if (success) {
        setCurrentRoute(route)
        onRouteSelected(route)
        onClose()
      } else {
        Alert.alert("Error", "Failed to switch audio route")
      }
    } catch (error) {
      console.error("Error selecting audio route:", error)
      Alert.alert("Error", "Failed to switch audio route")
    }
  }

  const getRouteIcon = (route) => {
    switch (route) {
      case "speaker":
        return "volume-high"
      case "earpiece":
        return "phone-portrait"
      case "bluetooth":
        return "bluetooth"
      case "wired":
        return "headset"
      default:
        return "volume-medium"
    }
  }

  const getRouteLabel = (route) => {
    switch (route) {
      case "speaker":
        return "Speaker"
      case "earpiece":
        return "Phone"
      case "bluetooth":
        return "Bluetooth"
      case "wired":
        return "Headphones"
      default:
        return route
    }
  }

  const renderRouteItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.routeItem, currentRoute === item && styles.selectedRoute]}
      onPress={() => selectRoute(item)}
    >
      <Ionicons name={getRouteIcon(item)} size={24} color={currentRoute === item ? "#25D366" : "#FFFFFF"} />
      <Text style={[styles.routeLabel, currentRoute === item && styles.selectedRouteLabel]}>{getRouteLabel(item)}</Text>
      {currentRoute === item && <Ionicons name="checkmark" size={20} color="#25D366" />}
    </TouchableOpacity>
  )

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Audio Output</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={availableRoutes}
            renderItem={renderRouteItem}
            keyExtractor={(item) => item}
            style={styles.routeList}
          />
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1F1F1F",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  routeList: {
    maxHeight: 300,
  },
  routeItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
  },
  selectedRoute: {
    backgroundColor: "rgba(37, 211, 102, 0.1)",
  },
  routeLabel: {
    color: "#FFFFFF",
    fontSize: 16,
    marginLeft: 15,
    flex: 1,
  },
  selectedRouteLabel: {
    color: "#25D366",
    fontWeight: "bold",
  },
})

export default AudioRouteSelector
