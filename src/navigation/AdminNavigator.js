import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { getTheme } from '../utils/theme';

// Admin Screens
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import UserManagementScreen from '../screens/admin/UserManagementScreen';
import UserDetailScreen from '../screens/admin/UserDetailScreen';
import SuspendUserScreen from '../screens/admin/SuspendUserScreen';
import IceServerManagementScreen from '../screens/admin/IceServerManagementScreen';
import AddEditIceServerScreen from '../screens/admin/AddEditIceServerScreen';

const Stack = createStackNavigator();

const AdminNavigator = () => {
  const { theme } = useContext(ThemeContext);
  const currentTheme = getTheme(theme);

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: currentTheme.primary,
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{ title: 'Admin Dashboard' }}
      />
      <Stack.Screen
        name="UserManagement"
        component={UserManagementScreen}
        options={{ title: 'User Management' }}
      />
      <Stack.Screen
        name="UserDetail"
        component={UserDetailScreen}
        options={{ title: 'User Details' }}
      />
      <Stack.Screen
        name="SuspendUser"
        component={SuspendUserScreen}
        options={{ title: 'Suspend User' }}
      />
      <Stack.Screen // Added screen
        name="IceServerManagement"
        component={IceServerManagementScreen}
        options={{ title: "ICE Server Management" }}
      />
      <Stack.Screen // Added screen
        name="AddEditIceServer"
        component={AddEditIceServerScreen}
        options={{ title: "Manage ICE Server" }}
      />
    </Stack.Navigator>
  );
};

export default AdminNavigator;
