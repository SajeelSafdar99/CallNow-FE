"use client"

import { createContext, useReducer, useEffect } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as AuthAPI from "../api/auth"
import * as ProfileAPI from "../api/profile"
import DeviceInfo from 'react-native-device-info';

// Initial state
const initialState = {
  isLoading: true,
  isAuthenticated: false,
  user: null,
  token: null,
  deviceId: null,
  error: null,
}

// Create context
export const AuthContext = createContext(initialState)

// Reducer function
const authReducer = (state, action) => {
  switch (action.type) {
    case "RESTORE_TOKEN":
      return {
        ...state,
        isLoading: false,
        isAuthenticated: action.payload.token ? true : false,
        token: action.payload.token,
        user: action.payload.user,
        deviceId: action.payload.deviceId,
      }
    case "LOGIN":
      return {
        ...state,
        isLoading: false,
        isAuthenticated: true,
        token: action.payload.token,
        user: action.payload.user,
        deviceId: action.payload.deviceId,
        deviceName: action.payload.deviceName,
        error: null,
      }
    case "LOGOUT":
      return {
        ...state,
        isLoading: false,
        isAuthenticated: false,
        token: null,
        user: null,
        error: null,
      }
    case "REGISTER":
      return {
        ...state,
        isLoading: false,
        error: null,
      }
    case "UPDATE_USER":
      return {
        ...state,
        user: {
          ...state.user,
          ...action.payload.user
        }
      }
    case "AUTH_ERROR":
      return {
        ...state,
        error: action.payload,
      }
    case "CLEAR_ERROR":
      return {
        ...state,
        error: null,
      }
    default:
      return state
  }
}

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState)

  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const token = await AsyncStorage.getItem("token")
        const userString = await AsyncStorage.getItem("user")
        const user = userString ? JSON.parse(userString) : null
        const deviceId = await DeviceInfo.getDeviceId();
        dispatch({
          type: "RESTORE_TOKEN",
          payload: { token, user, deviceId },
        })
      } catch (error) {
        console.error("Error restoring token:", error)
        dispatch({
          type: "AUTH_ERROR",
          payload: "Failed to restore authentication state",
        })
      }
    }

    bootstrapAsync()
  }, [])

  const authActions = {
    login: async (phoneNumber, password) => {
      try {
        const deviceId = await DeviceInfo.getDeviceId();
        const deviceName = await DeviceInfo.getDeviceName();

        console.log('Device ID:', deviceId);
        console.log('Device Name:', deviceName);

        const response = await AuthAPI.login(phoneNumber, password, deviceId, deviceName)

        if (response.success) {
          await AsyncStorage.setItem("token", response.token)
          await AsyncStorage.setItem("user", JSON.stringify(response.user))

          dispatch({
            type: "LOGIN",
            payload: {
              token: response.token,
              user: response.user,
              deviceId,
              deviceName,
            },
          })

          return { success: true }
        } else {
          dispatch({ type: "AUTH_ERROR", payload: response.message })
          return { success: false, message: response.message }
        }
      } catch (error) {
        const errorMessage = error.response?.data?.message || "Login failed. Please try again."
        dispatch({ type: "AUTH_ERROR", payload: errorMessage })
        return { success: false, message: errorMessage }
      }
    },

    register: async (phoneNumber, password, name) => {
      try {
        const response = await AuthAPI.register(phoneNumber, password, name)

        if (response.success) {
          return { success: true, userId: response.userId }
        } else {
          dispatch({ type: "AUTH_ERROR", payload: response.message })
          return { success: false, message: response.message }
        }
      } catch (error) {
        const errorMessage = error.response?.data?.message || "Registration failed. Please try again."
        dispatch({ type: "AUTH_ERROR", payload: errorMessage })
        return { success: false, message: errorMessage }
      }
    },

    forgotPassword: async (phoneNumber) => {
      try {
        const response = await AuthAPI.forgotPassword(phoneNumber)

        if (response.success) {
          return { success: true }
        } else {
          dispatch({ type: "AUTH_ERROR", payload: response.message })
          return { success: false, message: response.message }
        }
      } catch (error) {
        const errorMessage = error.response?.data?.message || "Password reset request failed. Please try again."
        dispatch({ type: "AUTH_ERROR", payload: errorMessage })
        return { success: false, message: errorMessage }
      }
    },

    // Add logout function
    logout: async () => {
      try {
        // Call logout API if you have one
        if (state.token) {
          await AuthAPI.logout(state.token)
        }

        // Clear storage
        await AsyncStorage.removeItem("token")
        await AsyncStorage.removeItem("user")

        // Update state
        dispatch({ type: "LOGOUT" })
        return { success: true }
      } catch (error) {
        console.error("Logout error:", error)
        // Still clear local storage and state even if API call fails
        await AsyncStorage.removeItem("token")
        await AsyncStorage.removeItem("user")
        dispatch({ type: "LOGOUT" })
        return { success: true }
      }
    },

    // Add updateProfile function
    updateProfile: async (profileData) => {
      try {
        if (!state.token) {
          return { success: false, message: "Not authenticated" }
        }

        const response = await ProfileAPI.updateProfile(profileData, state.token)

        if (response.success) {
          // Update local storage
          const updatedUser = {
            ...state.user,
            ...profileData
          }
          await AsyncStorage.setItem("user", JSON.stringify(updatedUser))

          // Update state
          dispatch({
            type: "UPDATE_USER",
            payload: { user: profileData }
          })

          return { success: true, message: response.message }
        } else {
          return { success: false, message: response.error }
        }
      } catch (error) {
        console.error("Update profile error:", error)
        return {
          success: false,
          message: error.response?.data?.message || "Failed to update profile"
        }
      }
    },

    // Add updateProfilePicture function
    updateProfilePicture: async (imageData) => {
      try {
        if (!state.token) {
          return { success: false, message: "Not authenticated" }
        }

        const response = await ProfileAPI.updateProfilePicture(imageData, state.token)

        if (response.success) {
          // Update local storage with new profile picture
          const updatedUser = {
            ...state.user,
            profilePicture: response.user.profilePicture
          }
          await AsyncStorage.setItem("user", JSON.stringify(updatedUser))

          // Update state
          dispatch({
            type: "UPDATE_USER",
            payload: {
              user: { profilePicture: response.user.profilePicture }
            }
          })

          return { success: true, message: response.message }
        } else {
          return { success: false, message: response.error }
        }
      } catch (error) {
        console.error("Update profile picture error:", error)
        return {
          success: false,
          message: error.response?.data?.message || "Failed to update profile picture"
        }
      }
    },

    // Add clearError function
    clearError: () => {
      dispatch({ type: "CLEAR_ERROR" })
    }
  }

  return <AuthContext.Provider value={{ state, dispatch, ...authActions }}>{children}</AuthContext.Provider>
}
