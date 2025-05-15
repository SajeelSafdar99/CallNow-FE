import React, {useContext} from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// Import all settings screens
import SettingsScreen from '../screens/settings/SettingsScreen';
import AboutScreen from '../screens/settings/AboutScreen';
import AppearanceScreen from '../screens/settings/AppearanceScreen';
import DevicesScreen from '../screens/settings/DevicesScreen';
import HelpScreen from '../screens/settings/HelpScreen';
import ProfileScreen from '../screens/settings/ProfileScreen';
import {ThemeContext} from '../context/ThemeContext';
import {getTheme} from '../utils/theme';
import SubscriptionScreen from '../screens/settings/SubscriptionScreen';

const Stack = createStackNavigator();

const SettingsNavigator = () => {
  const { theme } = useContext(ThemeContext);
  const currentTheme = getTheme(theme);

  return (
    <Stack.Navigator
      initialRouteName="SettingsMain"
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
        name="SettingsMain"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
      <Stack.Screen
        name="About"
        component={AboutScreen}
        options={{ title: 'About' }}
      />
      <Stack.Screen
        name="Appearance"
        component={AppearanceScreen}
        options={{ title: 'Appearance' }}
      />
      <Stack.Screen
        name="Devices"
        component={DevicesScreen}
        options={{ title: 'Devices Management' }}
      />
      <Stack.Screen
        name="Help"
        component={HelpScreen}
        options={{ title: 'Help' }}
      />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} options={{ title: "Subscription Management" }} />

    </Stack.Navigator>
  );
};

export default SettingsNavigator;
