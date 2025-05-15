import CallHistoryScreen from '../screens/calls/CallHistoryScreen';
import CallDetailsScreen from '../screens/calls/CallDetailScren';
import CallScreen from '../screens/calls/CallScreen';
import {createStackNavigator} from '@react-navigation/stack';
const Stack = createStackNavigator()

const CallsStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="CallHistory"
        component={CallHistoryScreen}
        options={{ title: "Call History" }}
      />
      <Stack.Screen
        name="CallDetails"
        component={CallDetailsScreen}
        options={{ title: "Call Details" }}
      />
      <Stack.Screen
        name="Call"
        component={CallScreen}
        options={{
          headerShown: false,
          presentation: "fullScreenModal"
        }}
      />
    </Stack.Navigator>
  )
}
export default CallsStack
