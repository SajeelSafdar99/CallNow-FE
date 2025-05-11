import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
// import Ionicons from 'react-native-vector-icons/Ionicons';

// Import all settings screens
import SettingsScreen from '../screens/settings/SettingsScreen';
import AboutScreen from '../screens/settings/AboutScreen';
import AppearanceScreen from '../screens/settings/AppearanceScreen';
import DevicesScreen from '../screens/settings/DevicesScreen';
// // import EncryptionScreen from '../screens/settings/EncryptionScreen';
import HelpScreen from '../screens/settings/HelpScreen';
// import PrivacyScreen from '../screens/settings/PrivacyScreen';
// import ProfileScreen from '../screens/profile/ProfileScreen';

const Stack = createStackNavigator();

const SettingsNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="SettingsMain"
      screenOptions={{
        headerStyle: {
          backgroundColor: '#128C7E',
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
      {/*<Stack.Screen*/}
      {/*  name="Profile"*/}
      {/*  component={ProfileScreen}*/}
      {/*  options={{ title: 'Profile' }}*/}
      {/*/>*/}
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
        options={{ title: 'Linked Devices' }}
      />
      {/*<Stack.Screen*/}
      {/*  name="Encryption"*/}
      {/*  component={EncryptionScreen}*/}
      {/*  options={{ title: 'Encryption' }}*/}
      {/*/>*/}
      <Stack.Screen
        name="Help"
        component={HelpScreen}
        options={{ title: 'Help' }}
      />
      {/*<Stack.Screen*/}
      {/*  name="Privacy"*/}
      {/*  component={PrivacyScreen}*/}
      {/*  options={{ title: 'Privacy' }}*/}
      {/*/>*/}
    </Stack.Navigator>
  );
};

export default SettingsNavigator;
