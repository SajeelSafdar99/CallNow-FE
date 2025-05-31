"use client"

import { useState, useEffect, useContext } from "react"
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AuthContext } from "../../context/AuthContext"
import Ionicons from "react-native-vector-icons/Ionicons"
import { ThemeContext } from "../../context/ThemeContext" // Added
import { getTheme } from "../../utils/theme" // Added

const UserManagementScreen = ({ navigation, route }) => {
  const { getUsers } = useContext(AuthContext)
  const { theme } = useContext(ThemeContext) // Added
  const currentTheme = getTheme(theme) // Added

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState(route.params?.filter || "all")
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [totalUsers, setTotalUsers] = useState(0)

  useEffect(() => {
    loadUsers()
  }, [filter])

  const loadUsers = async (refresh = false) => {
    try {
      if (refresh) {
        setPage(1)
        setUsers([])
      }

      setLoading(true)
      const currentPage = refresh ? 1 : page
      const response = await getUsers(currentPage, 20, searchQuery, filter)

      if (response.success) {
        if (refresh || currentPage === 1) {
          setUsers(response.users)
        } else {
          setUsers((prevUsers) => [...prevUsers, ...response.users])
        }

        setHasMore(response.pagination.hasMore)
        setTotalUsers(response.pagination.totalUsers)

        if (!refresh) {
          setPage(currentPage + 1)
        }
      } else {
        Alert.alert("Error", response.message || "Failed to load users")
      }
    } catch (error) {
      console.error("Error loading users:", error)
      Alert.alert("Error", "An unexpected error occurred while loading users")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    loadUsers(true)
  }

  const handleSearch = () => {
    loadUsers(true)
  }

  const handleFilterChange = (newFilter) => {
    if (newFilter !== filter) {
      setFilter(newFilter)
    }
  }

  const styles = themedStyles(currentTheme) // Added: Generate styles with current theme

  const renderUserItem = ({ item }) => {
    const isOnline = item.isOnline
    const isSuspended = item.isSuspended

    return (
      <TouchableOpacity style={styles.userItem} onPress={() => navigation.navigate("UserDetail", { userId: item._id })}>
        <View style={styles.userInfo}>
          <View style={styles.userNameContainer}>
            <Text style={styles.userName}>{item.name || "Unnamed User"}</Text>
            {isOnline && <View style={styles.onlineIndicator} />}
          </View>
          <Text style={styles.userPhone}>{item.phoneNumber}</Text>
          {isSuspended && (
            <View style={styles.suspendedBadge}>
              <Text style={styles.suspendedText}>Suspended</Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={currentTheme.placeholder} />
      </TouchableOpacity>
    )
  }

  const renderFooter = () => {
    if (!loading || refreshing) return null

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={currentTheme.primary} />
      </View>
    )
  }

  const renderEmpty = () => {
    if (loading && !refreshing) return null

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="people-outline" size={48} color={currentTheme.placeholder} />
        <Text style={styles.emptyText}>No users found</Text>
        {searchQuery ? (
          <Text style={styles.emptySubtext}>Try a different search term</Text>
        ) : (
          <Text style={styles.emptySubtext}>Users will appear here</Text>
        )}
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or phone"
          placeholderTextColor={currentTheme.placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Ionicons name="search" size={20} color={currentTheme.card} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === "all" && styles.activeFilter]}
          onPress={() => handleFilterChange("all")}
        >
          <Text style={[styles.filterText, filter === "all" && styles.activeFilterText]}>All</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterButton, filter === "active" && styles.activeFilter]}
          onPress={() => handleFilterChange("active")}
        >
          <Text style={[styles.filterText, filter === "active" && styles.activeFilterText]}>Active</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterButton, filter === "suspended" && styles.activeFilter]}
          onPress={() => handleFilterChange("suspended")}
        >
          <Text style={[styles.filterText, filter === "suspended" && styles.activeFilterText]}>Suspended</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterButton, filter === "unverified" && styles.activeFilter]}
          onPress={() => handleFilterChange("unverified")}
        >
          <Text style={[styles.filterText, filter === "unverified" && styles.activeFilterText]}>Unverified</Text>
        </TouchableOpacity>
      </View>

      {totalUsers > 0 && (
        <Text style={styles.totalCount}>
          {totalUsers} {totalUsers === 1 ? "user" : "users"} found
        </Text>
      )}

      <FlatList
        data={users}
        renderItem={renderUserItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[currentTheme.primary]}
            tintColor={currentTheme.primary} // For iOS
          />
        }
        onEndReached={() => {
          if (hasMore && !loading) {
            loadUsers()
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
      />
    </SafeAreaView>
  )
}

// Styles are now a function that accepts the theme
const themedStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    searchContainer: {
      flexDirection: "row",
      padding: 16,
      backgroundColor: theme.card, // Or theme.background if no distinct header bg
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    searchInput: {
      flex: 1,
      backgroundColor: theme.inputBackground,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === "ios" ? 10 : 8,
      marginRight: 8,
      color: theme.text,
      fontSize: 16,
    },
    searchButton: {
      backgroundColor: theme.primary,
      borderRadius: 8,
      padding: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    filterContainer: {
      flexDirection: "row",
      backgroundColor: theme.card, // Or theme.background
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    filterButton: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 20, // More rounded
      marginRight: 10,
      backgroundColor: theme.inputBackground, // Or theme.disabled for less emphasis
    },
    activeFilter: {
      backgroundColor: theme.primary,
    },
    filterText: {
      fontSize: 14,
      color: theme.text, // Or theme.placeholder
    },
    activeFilterText: {
      color: theme.card, // Assuming primary button text is contrast (e.g., white)
      fontWeight: "bold",
    },
    totalCount: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
      fontSize: 14,
      color: theme.placeholder, // Subdued text
      backgroundColor: theme.background,
    },
    listContent: {
      flexGrow: 1,
      paddingBottom: 16, // Ensure space for last item
    },
    userItem: {
      backgroundColor: theme.card,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 10, // Increased spacing
      borderRadius: 12, // Softer corners
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      // Shadow properties based on theme.shadow (assuming it's rgba(r,g,b,a))
      // For simplicity, using fixed shadow color and theming opacity if available
      // Or define shadowColor, shadowOpacity in theme.js
      shadowColor: "#000", // A generic dark color for shadow
      shadowOffset: { width: 0, height: 2 }, // Adjusted offset
      shadowOpacity: theme.mode === "dark" ? 0.15 : 0.08, // Example: different opacity
      shadowRadius: 4, // Softer shadow
      elevation: 3, // Android shadow
    },
    userInfo: {
      flex: 1,
    },
    userNameContainer: {
      flexDirection: "row",
      alignItems: "center",
    },
    userName: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.text,
      marginRight: 8,
    },
    onlineIndicator: {
      width: 10, // Slightly larger
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.success, // Use success color from theme
      borderWidth: 1, // Optional: add a small border
      borderColor: theme.card, // Border color matching card background for contrast
    },
    userPhone: {
      fontSize: 14,
      color: theme.placeholder, // More subdued for secondary info
      marginTop: 4,
    },
    suspendedBadge: {
      backgroundColor: theme.error, // Use error color from theme
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginTop: 6,
      alignSelf: "flex-start",
    },
    suspendedText: {
      color: theme.card, // Assuming error button text is contrast
      fontSize: 12,
      fontWeight: "bold",
    },
    footerLoader: {
      padding: 20, // More padding
      alignItems: "center",
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
      backgroundColor: theme.background,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.placeholder, // Subdued
      marginTop: 16,
      textAlign: "center",
    },
    emptySubtext: {
      fontSize: 14,
      color: theme.disabled, // Even more subdued
      marginTop: 8,
      textAlign: "center",
    },
  })

export default UserManagementScreen
