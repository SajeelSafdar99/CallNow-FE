'use client';

import {useContext, useEffect} from 'react';
import {createStackNavigator} from '@react-navigation/stack';

// Context
import {AuthContext} from '../context/AuthContext';

// Auth Screens
import SplashScreen from '../screens/auth/SplashScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import OtpVerificationScreen from '../screens/auth/OtpVerificationScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

// Main Navigation
import MainTabNavigator from './MainTabNavigator';

// Call Screen - MOVED HERE
import CallScreen from '../screens/calls/CallScreen';

// Admin Screens
import UserDetailScreen from '../screens/admin/UserDetailScreen';
import SuspendUserScreen from '../screens/admin/SuspendUserScreen';

import {ThemeContext} from '../context/ThemeContext';
import {getTheme} from '../utils/theme';
import GroupCallScreen from '../screens/calls/GroupCallScreen';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const {state, checkTokenExpiration} = useContext(AuthContext);
  const {theme} = useContext(ThemeContext);
  const currentTheme = getTheme(theme);

  useEffect(() => {
    if (state.token) {
      checkTokenExpiration();
    }
  }, [state.token, checkTokenExpiration]);

  if (state.isLoading) {
    return <SplashScreen />;
  }

  console.log('[AppNavigator] Auth state.token:', state.token);
  console.log(
    '[AppNavigator] Rendering navigator. Authenticated:',
    state.token !== null,
  );

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
      }}>
      {state.token === null ? (
        // Auth screens
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{headerShown: false}}
          />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{title: 'Create Account'}}
          />
          <Stack.Screen
            name="OtpVerification"
            component={OtpVerificationScreen}
            options={{title: 'Verify Phone Number'}}
          />
          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
            options={{title: 'Reset Password'}}
          />
        </>
      ) : (
        // Authenticated screens
        <>
          <Stack.Screen
            name="Main"
            component={MainTabNavigator}
            options={{headerShown: false}}
          />
          <Stack.Screen
            name="Call" // CallScreen is now a root modal for authenticated users
            component={CallScreen}
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
            }}
          />
          <Stack.Screen
            name="GroupCallScreen"
            component={GroupCallScreen}
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
            }}
          />
          {/* Admin screens */}
          <Stack.Screen
            name="UserDetail"
            component={UserDetailScreen}
            options={{title: 'User Details'}}
          />
          <Stack.Screen
            name="SuspendUser"
            component={SuspendUserScreen}
            options={{title: 'Suspend User'}}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
