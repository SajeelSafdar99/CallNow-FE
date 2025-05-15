import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import Ionicons from "react-native-vector-icons/Ionicons"
// Screens
import SettingsNavigator from './SettingsNavigator';
import ChatNavigator from "../navigation/ChatNavigator"
import {getTheme, lightTheme as currentTheme} from '../utils/theme';
import {useContext} from 'react';
import {ThemeContext} from '../context/ThemeContext';
import CallsStack from './CallNavigator';
const Tab = createBottomTabNavigator()



const MainTabNavigator = () => {
  const { theme } = useContext(ThemeContext);
  const currentTheme = getTheme(theme);
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: currentTheme.primary,
        tabBarInactiveTintColor: currentTheme.placeholder,
        tabBarStyle: {
          backgroundColor: currentTheme.card,
          borderTopColor: currentTheme.border,
        },
        headerStyle: {
          backgroundColor: "#128C7E",
        },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: {
          fontWeight: "bold",
        },
      }}
    >
      <Tab.Screen
        name="Chats"
        component={ChatNavigator}
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "chatbubble" : "chatbubble-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Calls"
        component={CallsStack}
        options={{
          tabBarIcon: ({ color, size,focused }) => (
            <Ionicons name={focused ? 'call' : 'call-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsNavigator}
        options={{
          headerShown: false, // Hide the header since SettingsNavigator has its own header
          tabBarIcon: ({ color, size,focused }) => <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  )
}

export default MainTabNavigator
