'use client';

import {useState, useEffect, useContext} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {AuthContext} from '../../context/AuthContext';
import {SocketContext} from '../../context/SocketContext';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {getTheme} from '../../utils/theme';
import {ThemeContext} from '../../context/ThemeContext';

const AdminDashboardScreen = ({navigation}) => {
  const {getDashboardStats} = useContext(AuthContext);
  const {joinAdminDashboard, leaveAdminDashboard, socket} =
    useContext(SocketContext);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentActivity, setRecentActivity] = useState([]);
  const {theme} = useContext(ThemeContext);
  const currentTheme = getTheme(theme);
  useEffect(() => {
    loadDashboardStats();

    // Join admin dashboard socket room
    joinAdminDashboard();

    // Listen for dashboard updates
    if (socket) {
      socket.on('dashboard:update', handleDashboardUpdate);
    }

    return () => {
      // Leave admin dashboard socket room
      leaveAdminDashboard();

      // Remove socket listeners
      if (socket) {
        socket.off('dashboard:update', handleDashboardUpdate);
      }
    };
  }, [socket]);

  const handleDashboardUpdate = data => {
    // Add to recent activity
    setRecentActivity(prevActivity => {
      const newActivity = [
        {
          id: Date.now().toString(),
          type: data.type,
          timestamp: new Date(),
          details: data.user || {},
        },
        ...prevActivity,
      ];

      // Keep only the 10 most recent activities
      return newActivity.slice(0, 10);
    });

    // Refresh stats
    loadDashboardStats();
  };

  const loadDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await getDashboardStats();
      if (response.success) {
        setStats(response.stats); // Updated to use response.stats
      } else {
        console.error('Failed to load dashboard stats:', response.message);
        // Optionally, set stats to a default error state or show an alert
        setStats(null);
      }
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
      setStats(null); // Set stats to null on error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardStats();
  };

  const formatTimestamp = timestamp => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  };

  const getActivityIcon = type => {
    switch (type) {
      case 'user-suspended':
        return 'ban-outline';
      case 'user-unsuspended':
        return 'checkmark-circle-outline';
      case 'user-registered':
        return 'person-add-outline';
      case 'user-login':
        return 'log-in-outline';
      case 'ice-server-added':
        return 'add-circle-outline';
      case 'ice-server-updated':
        return 'cog-outline';
      case 'ice-server-deleted':
        return 'remove-circle-outline';
      default:
        return 'information-circle-outline';
    }
  };

  const getActivityText = activity => {
    const userName =
      activity.details?.name ||
      activity.details?.phoneNumber ||
      activity.details?.userId ||
      'Unknown User';
    const serverId =
      activity.details?.serverId || activity.details?.id || 'Unknown Server';

    switch (activity.type) {
      case 'user-suspended':
        return `User ${userName} was suspended`;
      case 'user-unsuspended':
        return `User ${userName} was unsuspended`;
      case 'user-registered':
        return `New user registered: ${userName}`;
      case 'user-login':
        return `User login: ${userName}`;
      case 'ice-server-added':
        return `ICE Server added: ${activity.details?.urls?.[0] || serverId}`;
      case 'ice-server-updated':
        return `ICE Server updated: ${activity.details?.urls?.[0] || serverId}`;
      case 'ice-server-deleted':
        return `ICE Server deleted: ${serverId}`;
      default:
        return `Unknown activity: ${activity.type}`;
    }
  };

  if (loading && !refreshing) {
    return (
      <View
        style={[
          styles.loadingContainer,
          {backgroundColor: currentTheme.background},
        ]}>
        <ActivityIndicator size="large" color={currentTheme.primary} />
        <Text style={[styles.loadingText, {color: currentTheme.text}]}>
          Loading dashboard...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, {backgroundColor: currentTheme.background}]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[currentTheme.primary]}
            tintColor={currentTheme.primary}
          />
        }>
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: currentTheme.card }]}>
            <Text style={[styles.statValue, { color: currentTheme.primary }]}>{stats?.totalUsers || 0}</Text>
            <Text style={[styles.statLabel, { color: currentTheme.text }]}>Total Users</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: currentTheme.card }]}>
            <Text style={[styles.statValue, { color: currentTheme.primary }]}>{stats?.activeUsers || 0}</Text>
            <Text style={[styles.statLabel, { color: currentTheme.text }]}>Online Users</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: currentTheme.card }]}>
            <Text style={[styles.statValue, { color: currentTheme.primary }]}>{stats?.suspendedUsers || 0}</Text>
            <Text style={[styles.statLabel, { color: currentTheme.text }]}>Suspended</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: currentTheme.card }]}>
            <Text style={[styles.statValue, { color: currentTheme.primary }]}>{stats?.adminUsers || 0}</Text>
            <Text style={[styles.statLabel, { color: currentTheme.text }]}>Admins</Text>
          </View>
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('UserManagement')}>
            <Ionicons name="people" size={24} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Manage Users</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, {backgroundColor: '#E74C3C'}]}
            onPress={() =>
              navigation.navigate('UserManagement', {filter: 'suspended'})
            }>
            <Ionicons name="ban" size={24} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Suspended Users</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, {backgroundColor: '#3498DB'}]} // New button with a different color
            onPress={() => navigation.navigate('IceServerManagement')} // Ensure this route name is correct
          >
            <Ionicons name="server-outline" size={24} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>ICE Servers</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    width: '48%',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#128C7E',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between', // This will space out three items
    marginBottom: 20,
    flexWrap: 'wrap', // Allow buttons to wrap if they don't fit
  },
  actionButton: {
    backgroundColor: '#128C7E',
    borderRadius: 8,
    paddingVertical: 12, // Adjusted padding
    paddingHorizontal: 8, // Adjusted padding
    // width: "48%", // Remove fixed width or adjust to ~31-32%
    minWidth: '30%', // Use minWidth for flexibility
    flexGrow: 1, // Allow buttons to grow
    marginHorizontal: 4, // Add some horizontal margin
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10, // Add margin for wrapped items
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  activityContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    padding: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  activityIcon: {
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    color: '#333',
  },
  activityTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
});

export default AdminDashboardScreen;
