"use client"

import { useState, useEffect, useContext, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  ToastAndroid
} from "react-native"
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useFocusEffect } from "@react-navigation/native"
import { AuthContext } from "../../context/AuthContext"
import { ThemeContext } from "../../context/ThemeContext"
import { getTheme } from "../../utils/theme"
import * as DevicesAPI from "../../api/devices"
import { formatDate, formatDistanceToNow } from "../../utils/formatters"

const DevicesScreen = () => {
  const navigation = useNavigation()
  const { state: authState } = useContext(AuthContext)
  const { theme } = useContext(ThemeContext)
  const currentTheme = getTheme(theme)

  const [devices, setDevices] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [currentDeviceId, setCurrentDeviceId] = useState(null)
  const [activeDeviceId, setActiveDeviceId] = useState(null)
  const [lastRefreshed, setLastRefreshed] = useState(null)

  // Set up navigation options
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={{ marginRight: 15 }}
          onPress={handleRefresh}
          disabled={isLoading || isRefreshing}
          accessibilityLabel="Refresh devices list"
          accessibilityHint="Double tap to refresh the list of devices"
        >
          <Ionicons name="refresh" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, isLoading, isRefreshing]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchDevices();
      return () => {};
    }, [])
  );

  // Fetch devices on component mount
  useEffect(() => {
    // Get current device ID from auth state or local storage if available
    if (authState.user && authState.user.currentDeviceId) {
      setCurrentDeviceId(authState.user.currentDeviceId);
    }

    fetchDevices();
  }, []);

  // Handle refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDevices();
  };

  // Fetch devices from API
  const fetchDevices = async () => {
    try {
      if (!isRefreshing) {
        setIsLoading(true);
      }

      const response = await DevicesAPI.getDevices(authState.token);
      console.log("Response in component:", JSON.stringify(response));

      if (response.success) {
        setDevices(response.devices);

        // Find active device - first check isActive flag
        const activeByFlag = response.devices.find(device => device.isActive);

        // Then check activeDevice field from response
        if (activeByFlag) {
          setActiveDeviceId(activeByFlag.deviceId);
          console.log("Active device found by isActive flag:", activeByFlag.deviceId);
        } else if (response.activeDevice) {
          setActiveDeviceId(response.activeDevice);
          console.log("Active device found from response.activeDevice:", response.activeDevice);
        } else {
          console.log("No active device found");
          setActiveDeviceId(null);
        }

        // Find current device if not already set
        if (!currentDeviceId) {
          const current = response.devices.find(device =>
            device.isCurrent || device.deviceName.includes('(Current)')
          );
          if (current) {
            setCurrentDeviceId(current.deviceId);
            console.log("Current device set to:", current.deviceId);
          }
        }

        // Set last refreshed time
        setLastRefreshed(new Date());

        // Show toast on refresh
        if (isRefreshing && Platform.OS === 'android') {
          ToastAndroid.show('Devices refreshed', ToastAndroid.SHORT);
        }
      } else {
        Alert.alert("Error", response.message || "Failed to load devices");
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
      Alert.alert(
        "Error",
        "Failed to load devices. Please check your connection and try again."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };
  // Handle setting a device as active
  const handleSetActiveDevice = async (deviceId, deviceName) => {
    if (deviceId === activeDeviceId) {
      // Already active
      return;
    }

    // Confirm with user
    Alert.alert(
      "Set Active Device",
      `Set "${deviceName}" as your active device? Calls and notifications will be directed to this device.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Set Active",
          onPress: async () => {
            try {
              setIsUpdating(true);
              const response = await DevicesAPI.setActiveDevice(deviceId, authState.token);

              if (response.success) {
                setActiveDeviceId(deviceId);

                // Update devices list to reflect changes
                setDevices(prevDevices =>
                  prevDevices.map(device => ({
                    ...device,
                    isActive: device.deviceId === deviceId
                  }))
                );

                // Show success message
                if (Platform.OS === 'android') {
                  ToastAndroid.show('Device set as active', ToastAndroid.SHORT);
                } else {
                  Alert.alert("Success", "Device set as active successfully");
                }
              } else {
                Alert.alert("Error", response.message || "Failed to set device as active");
              }
            } catch (error) {
              console.error("Error setting active device:", error);
              Alert.alert(
                "Error",
                "Failed to set device as active. Please try again."
              );
            } finally {
              setIsUpdating(false);
            }
          }
        }
      ]
    );
  };

  // Handle device removal
  const handleRemoveDevice = (deviceId, deviceName) => {
    if (deviceId === currentDeviceId) {
      Alert.alert("Cannot Remove", "You cannot remove your current device. Please log out instead.");
      return;
    }

    Alert.alert(
      "Remove Device",
      `Are you sure you want to log out from "${deviceName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              setIsUpdating(true);
              const response = await DevicesAPI.removeDevice(deviceId, authState.token);

              if (response.success) {
                // Update local state to remove the device
                setDevices(prevDevices =>
                  prevDevices.filter(device => device.deviceId !== deviceId)
                );

                // Show success message
                if (Platform.OS === 'android') {
                  ToastAndroid.show('Device removed successfully', ToastAndroid.SHORT);
                } else {
                  Alert.alert("Success", "Device removed successfully");
                }

                // If the active device was removed, update activeDeviceId
                if (deviceId === activeDeviceId) {
                  const newActiveDevice = devices.find(
                    device => device.deviceId !== deviceId
                  );
                  if (newActiveDevice) {
                    setActiveDeviceId(newActiveDevice.deviceId);
                  } else {
                    setActiveDeviceId(null);
                  }
                }
              } else {
                Alert.alert("Error", response.message || "Failed to remove device");
              }
            } catch (error) {
              console.error("Error removing device:", error);
              Alert.alert(
                "Error",
                "Failed to remove device. Please try again."
              );
            } finally {
              setIsUpdating(false);
            }
          },
        },
      ]
    );
  };

  // Render device item
  const renderDeviceItem = ({ item }) => {
    const isCurrentDevice = item.deviceId === currentDeviceId;
    const isActiveDevice = item.deviceId === activeDeviceId;

    return (
      <View
        style={[
          styles.deviceItem,
          { backgroundColor: currentTheme.card },
          isActiveDevice && styles.activeDeviceItem
        ]}
        accessible={true}
        accessibilityLabel={`${item.deviceName} ${isCurrentDevice ? "Current device" : ""} ${isActiveDevice ? "Active device" : ""}`}
        accessibilityHint={isActiveDevice ? "This is your active device" : "Double tap to view device options"}
      >
        <View style={styles.deviceInfo}>
          <View style={[
            styles.deviceIconContainer,
            { backgroundColor: isActiveDevice ? currentTheme.primary + "40" : currentTheme.primary + "20" }
          ]}>
            <Ionicons
              name={getDeviceIcon(item.platform)}
              size={24}
              color={isActiveDevice ? currentTheme.primary : currentTheme.text}
            />
          </View>
          <View style={styles.deviceDetails}>
            <Text style={[styles.deviceName, { color: currentTheme.text }]}>
              {item.deviceName} {isCurrentDevice ? "(Current Device)" : ""}
            </Text>
            <Text style={[styles.deviceMeta, { color: currentTheme.placeholder }]}>
              {item.platform} • Last active: {formatDistanceToNow(item.lastActive)}
            </Text>
            {isActiveDevice && (
              <View style={styles.activeLabelContainer}>
                <Ionicons name="checkmark-circle" size={12} color={currentTheme.primary} />
                <Text style={[styles.activeLabel, { color: currentTheme.primary }]}>
                  Active Device
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.actionsContainer}>
          {!isCurrentDevice && (
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemoveDevice(item.deviceId, item.deviceName)}
              disabled={isUpdating}
              accessibilityLabel={`Remove ${item.deviceName}`}
              accessibilityHint="Double tap to remove this device"
            >
              <Ionicons name="log-out" size={20} color="#FF3B30" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.activeButton, isActiveDevice && styles.activeButtonSelected]}
            onPress={() => handleSetActiveDevice(item.deviceId, item.deviceName)}
            disabled={isUpdating || isActiveDevice}
            accessibilityLabel={isActiveDevice ? "Current active device" : `Set ${item.deviceName} as active`}
            accessibilityHint={isActiveDevice ? "This is already your active device" : "Double tap to set as active device"}
          >
            <Ionicons
              name={isActiveDevice ? "checkmark-circle" : "radio-button-off"}
              size={24}
              color={isActiveDevice ? currentTheme.primary : currentTheme.placeholder}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Get device icon based on platform
  const getDeviceIcon = (platform) => {
    if (!platform) return "phone-portrait-outline";

    platform = platform.toLowerCase();
    if (platform.includes("ios") || platform.includes("iphone") || platform.includes("ipad")) {
      return "phone-portrait";
    } else if (platform.includes("android")) {
      return "phone-portrait-outline";
    } else if (platform.includes("web")) {
      return "desktop-outline";
    } else if (platform.includes("mac") || platform.includes("osx")) {
      return "laptop-outline";
    } else if (platform.includes("windows")) {
      return "desktop-outline";
    } else if (platform.includes("tablet")) {
      return "tablet-portrait-outline";
    } else {
      return "phone-portrait-outline";
    }
  };

  // Handle logout from all other devices
  const handleLogoutAllOtherDevices = async () => {
    Alert.alert(
      "Log Out All Other Devices",
      "Are you sure you want to log out from all other devices?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out All",
          style: "destructive",
          onPress: async () => {
            try {
              setIsUpdating(true);
              const response = await DevicesAPI.logoutAllOtherDevices(currentDeviceId, authState.token);

              if (response.success) {
                // Update local state to keep only current device
                setDevices(prevDevices =>
                  prevDevices.filter(device => device.deviceId === currentDeviceId)
                );

                // Set current device as active
                setActiveDeviceId(currentDeviceId);

                // Show success message
                if (Platform.OS === 'android') {
                  ToastAndroid.show('Logged out from all other devices', ToastAndroid.SHORT);
                } else {
                  Alert.alert("Success", "Logged out from all other devices");
                }
              } else {
                Alert.alert("Error", response.message || "Failed to log out from devices");
              }
            } catch (error) {
              console.error("Error logging out devices:", error);
              Alert.alert(
                "Error",
                "Failed to log out from devices. Please try again."
              );
            } finally {
              setIsUpdating(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: currentTheme.background }]}>
        <ActivityIndicator size="large" color={currentTheme.primary} />
        <Text style={[styles.loadingText, { color: currentTheme.placeholder }]}>Loading devices...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <View style={[styles.infoBox, { backgroundColor: currentTheme.primary + "20" }]}>
        <Text style={[styles.infoText, { color: currentTheme.primary }]}>
          These are devices that are currently logged in to your CallNow account. You can set an active device to receive calls and notifications, or log out from devices you're not using.
        </Text>
      </View>

      <FlatList
        data={devices}
        renderItem={renderDeviceItem}
        keyExtractor={(item) => item.deviceId}
        contentContainerStyle={styles.devicesList}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[currentTheme.primary]}
            tintColor={currentTheme.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="phone-portrait-outline" size={48} color={currentTheme.placeholder} style={styles.emptyIcon} />
            <Text style={[styles.emptyText, { color: currentTheme.placeholder }]}>No devices found</Text>
            <Text style={[styles.emptySubtext, { color: currentTheme.placeholder }]}>
              Pull down to refresh
            </Text>
          </View>
        }
        ListFooterComponent={
          lastRefreshed && devices.length > 0 ? (
            <Text style={[styles.lastRefreshed, { color: currentTheme.placeholder }]}>
              Last updated: {formatDate(lastRefreshed)}
            </Text>
          ) : null
        }
      />

      {devices.length > 1 && (
        <TouchableOpacity
          style={[styles.logoutAllButton, { backgroundColor: currentTheme.card }]}
          onPress={handleLogoutAllOtherDevices}
          disabled={isUpdating}
          accessibilityLabel="Log out all other devices"
          accessibilityHint="Double tap to log out from all devices except this one"
        >
          <Text style={[styles.logoutAllText, { color: "#FF3B30" }]}>Log Out All Other Devices</Text>
        </TouchableOpacity>
      )}

      {isUpdating && (
        <View style={styles.updatingOverlay}>
          <ActivityIndicator size="large" color={currentTheme.primary} />
          <Text style={[styles.updatingText, { color: currentTheme.text }]}>Updating...</Text>
        </View>
      )}
    </View>
  );
};

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
    lineHeight: 20,
  },
  devicesList: {
    padding: 15,
    flexGrow: 1,
  },
  deviceItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  activeDeviceItem: {
    borderLeftWidth: 3,
    borderLeftColor: "#128C7E",
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
  activeLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  activeLabel: {
    fontSize: 12,
    fontWeight: "bold",
    marginLeft: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  removeButton: {
    padding: 8,
    marginRight: 8,
  },
  activeButton: {
    padding: 8,
  },
  activeButtonSelected: {
    opacity: 0.8,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "500",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
  },
  logoutAllButton: {
    margin: 15,
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  logoutAllText: {
    fontSize: 16,
    fontWeight: "500",
  },
  lastRefreshed: {
    textAlign: "center",
    fontSize: 12,
    marginTop: 10,
    marginBottom: 20,
  },
  updatingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  updatingText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '500',
  },
});

export default DevicesScreen;
