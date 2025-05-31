import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../../context/AuthContext';
import Ionicons from 'react-native-vector-icons/Ionicons';

const SuspendUserScreen = ({ route, navigation }) => {
  const { userId, userName } = route.params;
  const { suspendUser } = useContext(AuthContext);

  const [reason, setReason] = useState('');
  const [isTemporary, setIsTemporary] = useState(false);
  const [duration, setDuration] = useState('24');
  const [isLoading, setIsLoading] = useState(false);

  const handleSuspend = async () => {
    if (!reason.trim()) {
      Alert.alert('Error', 'Please provide a reason for suspension');
      return;
    }

    if (isTemporary && (!duration || isNaN(parseInt(duration)) || parseInt(duration) <= 0)) {
      Alert.alert('Error', 'Please provide a valid duration in hours');
      return;
    }

    const suspensionDuration = isTemporary ? parseInt(duration) : null;

    Alert.alert(
      'Confirm Suspension',
      `Are you sure you want to suspend ${userName}?${isTemporary ? `\nThe account will be automatically unsuspended after ${duration} hours.` : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Suspend',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              const response = await suspendUser(userId, reason, suspensionDuration);

              if (response.success) {
                Alert.alert('Success', 'User has been suspended', [
                  { text: 'OK', onPress: () => navigation.goBack() }
                ]);
              } else {
                Alert.alert('Error', response.message || 'Failed to suspend user');
              }
            } catch (error) {
              console.error('Error suspending user:', error);
              Alert.alert('Error', 'An unexpected error occurred');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.warningBox}>
            <Ionicons name="warning" size={24} color="#FF9800" style={styles.warningIcon} />
            <Text style={styles.warningText}>
              You are about to suspend {userName}. This will prevent them from logging in or using the app.
            </Text>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>Reason for Suspension</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Enter reason for suspension"
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.switchContainer}>
              <Text style={styles.label}>Temporary Suspension</Text>
              <Switch
                value={isTemporary}
                onValueChange={setIsTemporary}
                trackColor={{ false: '#D1D1D1', true: '#128C7E' }}
                thumbColor={isTemporary ? '#FFFFFF' : '#F4F3F4'}
              />
            </View>

            {isTemporary && (
              <View style={styles.durationContainer}>
                <Text style={styles.label}>Duration (hours)</Text>
                <TextInput
                  style={styles.durationInput}
                  placeholder="Enter duration in hours"
                  value={duration}
                  onChangeText={setDuration}
                  keyboardType="number-pad"
                />
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.suspendButton}
            onPress={handleSuspend}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="ban" size={20} color="#FFFFFF" />
                <Text style={styles.suspendButtonText}>Suspend User</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={isLoading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  warningBox: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  warningIcon: {
    marginRight: 12,
  },
  warningText: {
    flex: 1,
    color: '#E65100',
    fontSize: 14,
  },
  formSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  reasonInput: {
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    minHeight: 100,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  durationContainer: {
    marginBottom: 16,
  },
  durationInput: {
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  suspendButton: {
    backgroundColor: '#E74C3C',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  suspendButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  cancelButton: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#128C7E',
  },
  cancelButtonText: {
    color: '#128C7E',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default SuspendUserScreen;
