import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../../context/AuthContext';
import Ionicons from 'react-native-vector-icons/Ionicons';

const UserDetailScreen = ({ route, navigation }) => {
  const { userId } = route.params;
  const { getUserDetails, suspendUser, unsuspendUser } = useContext(AuthContext);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserDetails();
  }, [userId]);

  const loadUserDetails = async () => {
    try {
      setLoading(true);
      const response = await getUserDetails(userId);

      if (response.success) {
        setUser(response.user);
      } else {
        Alert.alert('Error', response.message || 'Failed to load user details');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading user details:', error);
      Alert.alert('Error', 'An unexpected error occurred');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = () => {
    navigation.navigate('SuspendUser', { userId, userName: user.name || user.phoneNumber });
  };

  const handleUnsuspend = async () => {
    Alert.alert(
      'Confirm Unsuspend',
      `Are you sure you want to unsuspend ${user.name || user.phoneNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unsuspend',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const response = await unsuspendUser(userId);

              if (response.success) {
                Alert.alert('Success', 'User has been unsuspended');
                loadUserDetails();
              } else {
                Alert.alert('Error', response.message || 'Failed to unsuspend user');
              }
            } catch (error) {
              console.error('Error unsuspending user:', error);
              Alert.alert('Error', 'An unexpected error occurred');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#128C7E" />
        <Text style={styles.loadingText}>Loading user details...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#E74C3C" />
        <Text style={styles.errorText}>User not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileHeader}>
          {user.profilePicture ? (
            <Image source={{ uri: user.profilePicture }} style={styles.profileImage} />
          ) : (
            <View style={styles.profileImagePlaceholder}>
              <Text style={styles.profileImagePlaceholderText}>
                {(user.name || user.phoneNumber || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <Text style={styles.userName}>{user.name || 'Unnamed User'}</Text>
          <Text style={styles.userPhone}>{user.phoneNumber}</Text>

          <View style={styles.statusContainer}>
            {user.isAdmin && (
              <View style={[styles.statusBadge, styles.adminBadge]}>
                <Text style={styles.statusText}>Admin</Text>
              </View>
            )}

            {user.isOnline && (
              <View style={[styles.statusBadge, styles.onlineBadge]}>
                <Text style={styles.statusText}>Online</Text>
              </View>
            )}

            {user.isSuspended && (
              <View style={[styles.statusBadge, styles.suspendedBadge]}>
                <Text style={styles.statusText}>Suspended</Text>
              </View>
            )}

            {!user.isVerified && (
              <View style={[styles.statusBadge, styles.unverifiedBadge]}>
                <Text style={styles.statusText}>Unverified</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>User ID</Text>
            <Text style={styles.infoValue}>{user._id}</Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Created</Text>
            <Text style={styles.infoValue}>{formatDate(user.createdAt)}</Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Last Updated</Text>
            <Text style={styles.infoValue}>{formatDate(user.updatedAt)}</Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>About</Text>
            <Text style={styles.infoValue}>{user.about || 'No about information'}</Text>
          </View>
        </View>

        {user.isSuspended && user.suspensionDetails && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Suspension Details</Text>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Suspended At</Text>
              <Text style={styles.infoValue}>{formatDate(user.suspensionDetails.suspendedAt)}</Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Reason</Text>
              <Text style={styles.infoValue}>{user.suspensionDetails.reason || 'No reason provided'}</Text>
            </View>

            {user.suspensionDetails.expiresAt && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Expires At</Text>
                <Text style={styles.infoValue}>{formatDate(user.suspensionDetails.expiresAt)}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Devices</Text>

          {user.devices && user.devices.length > 0 ? (
            user.devices.map((device, index) => (
              <View key={index} style={styles.deviceItem}>
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName}>{device.deviceName || 'Unknown Device'}</Text>
                  <Text style={styles.deviceId}>{device.deviceId}</Text>
                  <Text style={styles.deviceLastActive}>
                    Last active: {formatDate(device.lastActive)}
                  </Text>
                </View>

                {device.isActive && (
                  <View style={styles.activeDeviceBadge}>
                    <Text style={styles.activeDeviceText}>Active</Text>
                  </View>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No devices registered</Text>
          )}
        </View>

        <View style={styles.actionsContainer}>
          {user.isSuspended ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.unsuspendButton]}
              onPress={handleUnsuspend}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Unsuspend User</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.suspendButton]}
              onPress={handleSuspend}
              disabled={user.isAdmin}
            >
              <Ionicons name="ban" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Suspend User</Text>
            </TouchableOpacity>
          )}
        </View>

        {user.isAdmin && !user.isSuspended && (
          <Text style={styles.adminWarning}>
            Admin users cannot be suspended
          </Text>
        )}
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  backButton: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#128C7E',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#128C7E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImagePlaceholderText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  userPhone: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 12,
  },
  statusBadge: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    margin: 4,
  },
  adminBadge: {
    backgroundColor: '#9C27B0',
  },
  onlineBadge: {
    backgroundColor: '#4CAF50',
  },
  suspendedBadge: {
    backgroundColor: '#E74C3C',
  },
  unverifiedBadge: {
    backgroundColor: '#FF9800',
  },
  statusText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
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
  infoItem: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
  },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  deviceId: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  deviceLastActive: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  activeDeviceBadge: {
    backgroundColor: '#4CAF50',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activeDeviceText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    padding: 16,
  },
  actionsContainer: {
    marginBottom: 24,
  },
  actionButton: {
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suspendButton: {
    backgroundColor: '#E74C3C',
  },
  unsuspendButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  adminWarning: {
    textAlign: 'center',
    color: '#E74C3C',
    fontStyle: 'italic',
    marginBottom: 24,
  },
});

export default UserDetailScreen;
