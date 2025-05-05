import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { Ionicon } from "../components/ui/AppIcons"

// Screens
import ChatsListScreen from "../screens/chat/ChatsListScreen"
import CallHistoryScreen from "../screens/calls/CallHistoryScreen"
import ProfileScreen from "../screens/profile/ProfileScreen"

const Tab = createBottomTabNavigator()

const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: "#128C7E",
        tabBarInactiveTintColor: "#999999",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#F0F0F0",
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
        component={ChatsListScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicon name="chatbubble" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Calls"
        component={CallHistoryScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicon name="call" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicon name="person" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  )
}

export default MainTabNavigator
