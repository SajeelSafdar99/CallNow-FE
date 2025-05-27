"use client"

import React, { createContext, useReducer, useEffect } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as AuthAPI from "../api/auth"
import * as ProfileAPI from "../api/profile"
import DeviceInfo from "react-native-device-info"

// Initial state
const initialState = {
  isLoading: true,
  isAuthenticated: false,
  user: null,
  token: null,
  deviceId: null,
  deviceName: null,
  error: null,
}

// Create context
export const AuthContext = createContext(initialState)

// Reducer function
const authReducer = (state, action) => {
  switch (action.type) {
    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
      }
    case "RESTORE_TOKEN":
      return {
        ...state,
        isLoading: false,
        isAuthenticated: action.payload.token ? true : false,
        token: action.payload.token,
        user: action.payload.user,
        deviceId: action.payload.deviceId,
        deviceName: action.payload.deviceName,
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
        deviceId: null,
        deviceName: null,
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
          ...action.payload.user,
        },
      }
    case "AUTH_ERROR":
      return {
        ...state,
        isLoading: false,
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

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Bootstrap authentication state on app start
  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        dispatch({ type: "SET_LOADING", payload: true })

        const [token, userString, deviceId, deviceName] = await Promise.all([
          AsyncStorage.getItem("token"),
          AsyncStorage.getItem("user"),
          DeviceInfo.getDeviceId(),
          DeviceInfo.getDeviceName(),
        ])

        const user = userString ? JSON.parse(userString) : null

        dispatch({
          type: "RESTORE_TOKEN",
          payload: { token, user, deviceId, deviceName },
        })
      } catch (error) {
        console.error("Error restoring authentication state:", error)
        dispatch({
          type: "AUTH_ERROR",
          payload: "Failed to restore authentication state",
        })
      }
    }

    bootstrapAsync()
  }, [])

  // Authentication actions
  const authActions = {
    login: async (phoneNumber, password) => {
      try {
        dispatch({ type: "SET_LOADING", payload: true })

        const deviceId = await DeviceInfo.getDeviceId()
        const deviceName = await DeviceInfo.getDeviceName()

        console.log("Login attempt with device:", { deviceId, deviceName })

        const response = await AuthAPI.login(phoneNumber, password, deviceId, deviceName)

        if (response.success) {
          // Store authentication data
          await Promise.all([
            AsyncStorage.setItem("token", response.token),
            AsyncStorage.setItem("user", JSON.stringify(response.user)),
          ])

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
        console.error("Login error:", error)
        const errorMessage = error.response?.data?.message || "Login failed. Please try again."
        dispatch({ type: "AUTH_ERROR", payload: errorMessage })
        return { success: false, message: errorMessage }
      }
    },

    register: async (phoneNumber, password, name) => {
      try {
        dispatch({ type: "SET_LOADING", payload: true })

        const response = await AuthAPI.register(phoneNumber, password, name)

        if (response.success) {
          dispatch({ type: "REGISTER" })
          return { success: true, userId: response.userId }
        } else {
          dispatch({ type: "AUTH_ERROR", payload: response.message })
          return { success: false, message: response.message }
        }
      } catch (error) {
        console.error("Registration error:", error)
        const errorMessage = error.response?.data?.message || "Registration failed. Please try again."
        dispatch({ type: "AUTH_ERROR", payload: errorMessage })
        return { success: false, message: errorMessage }
      }
    },

    verifyOTP: async (phoneNumber, otp, purpose = "registration") => {
      try {
        dispatch({ type: "SET_LOADING", payload: true })

        const response = await AuthAPI.verifyOTP(phoneNumber, otp, purpose)

        if (response.success) {
          if (purpose === "registration") {
            const deviceId = await DeviceInfo.getDeviceId()
            const deviceName = await DeviceInfo.getDeviceName()

            // Store authentication data
            await Promise.all([
              AsyncStorage.setItem("token", response.token),
              AsyncStorage.setItem("user", JSON.stringify(response.user)),
            ])

            dispatch({
              type: "LOGIN",
              payload: {
                token: response.token,
                user: response.user,
                deviceId,
                deviceName,
              },
            })
          }

          return { success: true }
        } else {
          dispatch({ type: "AUTH_ERROR", payload: response.message })
          return { success: false, message: response.message }
        }
      } catch (error) {
        console.error("OTP verification error:", error)
        const errorMessage = error.response?.data?.message || "OTP verification failed. Please try again."
        dispatch({ type: "AUTH_ERROR", payload: errorMessage })
        return { success: false, message: errorMessage }
      }
    },

    resendOTP: async (phoneNumber, purpose = "registration") => {
      try {
        const response = await AuthAPI.resendOTP(phoneNumber, purpose)

        if (response.success) {
          return { success: true }
        } else {
          dispatch({ type: "AUTH_ERROR", payload: response.message })
          return { success: false, message: response.message }
        }
      } catch (error) {
        console.error("Resend OTP error:", error)
        const errorMessage = error.response?.data?.message || "Failed to resend OTP. Please try again."
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
        console.error("Forgot password error:", error)
        const errorMessage = error.response?.data?.message || "Password reset request failed. Please try again."
        dispatch({ type: "AUTH_ERROR", payload: errorMessage })
        return { success: false, message: errorMessage }
      }
    },

    resetPassword: async (phoneNumber, otp, newPassword) => {
      try {
        const response = await AuthAPI.resetPassword(phoneNumber, otp, newPassword)

        if (response.success) {
          return { success: true }
        } else {
          dispatch({ type: "AUTH_ERROR", payload: response.message })
          return { success: false, message: response.message }
        }
      } catch (error) {
        console.error("Reset password error:", error)
        const errorMessage = error.response?.data?.message || "Password reset failed. Please try again."
        dispatch({ type: "AUTH_ERROR", payload: errorMessage })
        return { success: false, message: errorMessage }
      }
    },

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
            ...response.user,
          }
          await AsyncStorage.setItem("user", JSON.stringify(updatedUser))

          // Update state
          dispatch({
            type: "UPDATE_USER",
            payload: { user: response.user },
          })

          return { success: true, message: response.message }
        } else {
          return { success: false, message: response.error }
        }
      } catch (error) {
        console.error("Update profile error:", error)
        return {
          success: false,
          message: error.response?.data?.message || "Failed to update profile",
        }
      }
    },

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
            profilePicture: response.user.profilePicture,
          }
          await AsyncStorage.setItem("user", JSON.stringify(updatedUser))

          // Update state
          dispatch({
            type: "UPDATE_USER",
            payload: {
              user: { profilePicture: response.user.profilePicture },
            },
          })

          return { success: true, message: response.message }
        } else {
          return { success: false, message: response.error }
        }
      } catch (error) {
        console.error("Update profile picture error:", error)
        return {
          success: false,
          message: error.response?.data?.message || "Failed to update profile picture",
        }
      }
    },

    logout: async () => {
      try {
        dispatch({ type: "SET_LOADING", payload: true })

        // Call logout API if available
        if (state.token) {
          try {
            await AuthAPI.logout(state.token)
          } catch (error) {
            console.warn("Logout API call failed:", error)
            // Continue with local logout even if API fails
          }
        }

        // Clear local storage
        await Promise.all([AsyncStorage.removeItem("token"), AsyncStorage.removeItem("user")])

        // Update state
        dispatch({ type: "LOGOUT" })
        return { success: true }
      } catch (error) {
        console.error("Logout error:", error)
        // Still clear local storage and state even if there's an error
        try {
          await Promise.all([AsyncStorage.removeItem("token"), AsyncStorage.removeItem("user")])
        } catch (storageError) {
          console.error("Failed to clear storage:", storageError)
        }

        dispatch({ type: "LOGOUT" })
        return { success: true }
      }
    },

    clearError: () => {
      dispatch({ type: "CLEAR_ERROR" })
    },
  }

  // Context value
  const contextValue = {
    state,
    dispatch,
    ...authActions,
  }

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}

// Custom hook for using auth context
export const useAuth = () => {
  const context = React.useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export default AuthProvider
