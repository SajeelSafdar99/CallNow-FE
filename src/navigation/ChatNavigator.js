import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { getTheme } from '../utils/theme';
import ChatsListScreen from '../screens/chat/ChatsListScreen';
import ChatScreen from '../screens/chat/ChatScreen';
import ContactDetailScreen from '../screens/contacts/ContactDetailsScreen';
import ContactsScreen from '../screens/contacts/ContactsScreen';
import GroupDetailsScreen from '../screens/chat/GroupDetailsScreen';
import UserDetailsScreen from '../screens/chat/UserDetailsScreen';
import CallScreen from '../screens/calls/CallScreen';

const Stack = createStackNavigator();

const ChatNavigator = () => {
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
        name="ChatsList"
        component={ChatsListScreen}
        options={{ title: 'Chats' }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={({ route }) => ({
          title: route.params?.conversation?.name || 'Chat',
          headerBackTitle: 'Back'
        })}
      />
      <Stack.Screen
        name="GroupDetails"
        component={GroupDetailsScreen}
        options={{ title: 'Group Info' }}
      />
      <Stack.Screen
        name="UserProfile"
        component={UserDetailsScreen}
        options={({ route }) => ({
          title: route.params?.userName || 'Profile',
          headerBackTitle: 'Back'
        })}
      />
      <Stack.Screen
        name="Contacts"
        component={ContactsScreen}
        options={{
          title: "Contacts",
        }}
      />
      <Stack.Screen
        name="ContactDetail"
        component={ContactDetailScreen}
        options={{
          title: "Contact Details",
        }}
      />
      <Stack.Screen
        name="Call"
        component={CallScreen}
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
        }}
      />
    </Stack.Navigator>
  );
};
export default ChatNavigator;
