"use client"

import { useState, useCallback, useContext } from "react"
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import Ionicons from "react-native-vector-icons/Ionicons"
import { useNavigation, useFocusEffect } from "@react-navigation/native"
import * as IceServerAPI from "../../api/ice-server"
import { ThemeContext } from "../../context/ThemeContext"
import { getTheme } from "../../utils/theme"

const IceServerManagementScreen = () => {
  const navigation = useNavigation()
  const { theme } = useContext(ThemeContext)
  const currentTheme = getTheme(theme)

  const [iceServers, setIceServers] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchServers = useCallback(async () => {
    try {
      setLoading(true)
      // IMPORTANT: This assumes you have an adminGetAllIceServers function in your API client
      // and a corresponding backend endpoint that returns ALL ICE servers with full details.
      const response = await IceServerAPI.adminGetAllIceServers()
      if (response.success) {
        setIceServers(response.iceServers)
      } else {
        Alert.alert("Error", response.message || "Failed to fetch ICE servers.")
        setIceServers([])
      }
    } catch (error) {
      console.error("Fetch ICE servers error:", error)
      Alert.alert("Error", "An unexpected error occurred while fetching ICE servers.")
      setIceServers([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      fetchServers()
    }, [fetchServers]),
  )

  const onRefresh = () => {
    setRefreshing(true)
    fetchServers()
  }

  const handleDeleteServer = (serverId) => {
    Alert.alert("Confirm Delete", "Are you sure you want to delete this ICE server?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            console.log("Deleting ICE server:", serverId)
            const response = await IceServerAPI.deleteIceServer(serverId)
            if (response.success) {
              Alert.alert("Success", "ICE server deleted successfully.")
              fetchServers() // Refresh list
            } else {
              Alert.alert("Error", response.message || "Failed to delete ICE server.")
            }
          } catch (error) {
            Alert.alert("Error", "An unexpected error occurred.")
          }
        },
      },
    ])
  }

  const handleEditServer = (server) => {
    navigation.navigate("AddEditIceServer", { server })
  }

  const handleAddServer = () => {
    navigation.navigate("AddEditIceServer")
  }

  const renderServerItem = ({ item }) => (
    console.log('item servers',item),
    <View
      style={[styles.itemContainer, { backgroundColor: currentTheme.card, borderBottomColor: currentTheme.border }]}
    >
      <View style={styles.itemInfo}>
        <Text style={[styles.itemUrls, { color: currentTheme.text }]} numberOfLines={1}>
          URLs: {item.urls.join(", ")}
        </Text>
        <Text style={[styles.itemDetail, { color: currentTheme.text }]}>Type: {item.serverType}</Text>
        <Text style={[styles.itemDetail, { color: currentTheme.text }]}>Region: {item.region}</Text>
        <Text style={[styles.itemDetail, { color: currentTheme.text }]}>Priority: {item.priority}</Text>

        {item.provider && (
          <Text style={[styles.itemDetail, { color: currentTheme.textMuted }]}>Provider: {item.provider}</Text>
        )}
        {item.expiresAt && (
          <Text style={[styles.itemDetail, { color: currentTheme.textMuted }]}>
            Expires: {new Date(item.expiresAt).toLocaleDateString()}
          </Text>
        )}
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity onPress={() => handleEditServer(item)} style={styles.actionButton}>
          <Ionicons name="pencil-outline" size={24} color={currentTheme.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDeleteServer(item._id)} style={styles.actionButton}>
          <Ionicons name="trash-outline" size={24} color={currentTheme.error} />
        </TouchableOpacity>
      </View>
    </View>
  )

  if (loading && !refreshing) {
    return (
      <View style={[styles.centered, { backgroundColor: currentTheme.background }]}>
        <ActivityIndicator size="large" color={currentTheme.primary} />
        <Text style={{ color: currentTheme.text, marginTop: 10 }}>Loading ICE Servers...</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <FlatList
        data={iceServers}
        renderItem={renderServerItem}
        keyExtractor={(item) => item._id?.toString()}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={{ color: currentTheme.text }}>No ICE servers found.</Text>
            <Text style={{ color: currentTheme.text }}>Pull down to refresh or add a new server.</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[currentTheme.primary]}
            tintColor={currentTheme.primary}
          />
        }
        contentContainerStyle={iceServers.length === 0 ? styles.centered : {}}
      />
      <TouchableOpacity style={[styles.fab, { backgroundColor: currentTheme.primary }]} onPress={handleAddServer}>
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  itemContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
  },
  itemInfo: {
    flex: 1,
  },
  itemUrls: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  itemDetail: {
    fontSize: 13,
    marginBottom: 2,
  },
  itemActions: {
    flexDirection: "row",
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
})

export default IceServerManagementScreen
