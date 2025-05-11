import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { getTheme } from '../utils/theme';
import ChatsListScreen from '../screens/chat/ChatsListScreen';
import ChatScreen from '../screens/chat/ChatScreen';
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

      {/*<Stack.Screen*/}
      {/*  name="Contacts"*/}
      {/*  component={ContactsScreen}*/}
      {/*  options={{ title: 'Contacts' }}*/}
      {/*/>*/}
      {/*<Stack.Screen*/}
      {/*  name="UserProfile"*/}
      {/*  component={UserProfileScreen}*/}
      {/*  options={({ route }) => ({*/}
      {/*    title: route.params?.userName || 'Profile',*/}
      {/*    headerBackTitle: 'Back'*/}
      {/*  })}*/}
      {/*/>*/}
      {/*<Stack.Screen*/}
      {/*  name="Call"*/}
      {/*  component={CallScreen}*/}
      {/*  options={({ route }) => ({*/}
      {/*    title: route.params?.isVideo ? 'Video Call' : 'Voice Call',*/}
      {/*    headerBackTitle: 'End',*/}
      {/*    headerLeft: null // Hide back button during calls*/}
      {/*  })}*/}
      {/*/>*/}
    </Stack.Navigator>
  );
};
export default ChatNavigator;
