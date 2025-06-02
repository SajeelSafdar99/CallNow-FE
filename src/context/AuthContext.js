// Using the version from your attachment "AuthContext-kyIA5r0SwWHdZuGnO2zkKGFoK6Ymsy.js"
"use client"

import React, { createContext, useReducer, useEffect, useMemo } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as AuthAPI from "../api/auth"
import * as ProfileAPI from "../api/profile"
import DeviceInfo from "react-native-device-info"
import { Alert } from "react-native"

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
    case "TOKEN_EXPIRED":
      return {
        ...initialState,
        isLoading: false,
        error: "Your session has expired. Please login again.",
      }
    default:
      return state
  }
}

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Helper function to check if token is expired
  const isTokenExpired = (token) => {
    if (!token) return true

    try {
      // Decode JWT token (basic decoding without verification)
      const parts = token.split(".")
      if (parts.length !== 3) return true

      const payload = JSON.parse(atob(parts[1]))
      const exp = payload.exp

      if (!exp) return false // No expiration set

      // Check if token is expired (exp is in seconds, Date.now() is in milliseconds)
      return Date.now() >= exp * 1000
    } catch (error) {
      console.error("Error checking token expiration:", error)
      return true // Assume expired if we can't decode
    }
  }

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

        // Check if token is expired
        if (token && isTokenExpired(token)) {
          console.log("Token expired, clearing auth state")
          await Promise.all([AsyncStorage.removeItem("token"), AsyncStorage.removeItem("user")])
          dispatch({ type: "TOKEN_EXPIRED" })
          return
        }

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
  const authActions = useMemo(
    () => ({
      login: async (phoneNumber, password) => {
        try {
          dispatch({ type: "SET_LOADING", payload: true })
          const deviceId = await DeviceInfo.getDeviceId()
          const deviceName = await DeviceInfo.getDeviceName()
          console.log("Login attempt with device:", { deviceId, deviceName })
          const response = await AuthAPI.login(phoneNumber, password, deviceId, deviceName)
          if (response.success) {
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
          if (error.response?.status === 403 && error.response?.data?.status === "suspended") {
            const suspensionMessage = error.response.data.message || "Your account has been suspended."
            const expiresAt = error.response.data.expiresAt
            let message = suspensionMessage
            if (expiresAt) {
              const expiryDate = new Date(expiresAt)
              message += ` Your account will be unsuspended on ${expiryDate.toLocaleDateString()} at ${expiryDate.toLocaleTimeString()}.`
            }
            dispatch({ type: "AUTH_ERROR", payload: message })
            return { success: false, message, status: "suspended", expiresAt }
          }
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
            return { success: true, userId: response.userId, isAdmin: response.isAdmin }
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
          if (isTokenExpired(state.token)) {
            dispatch({ type: "TOKEN_EXPIRED" })
            return { success: false, message: "Session expired. Please login again." }
          }
          const response = await ProfileAPI.updateProfile(profileData, state.token)
          if (response.success) {
            const updatedUser = { ...state.user, ...response.user }
            await AsyncStorage.setItem("user", JSON.stringify(updatedUser))
            dispatch({ type: "UPDATE_USER", payload: { user: response.user } })
            return { success: true, message: response.message }
          } else {
            return { success: false, message: response.error }
          }
        } catch (error) {
          console.error("Update profile error:", error)
          if (error.response?.status === 401) {
            dispatch({ type: "TOKEN_EXPIRED" })
            return { success: false, message: "Session expired. Please login again." }
          }
          return { success: false, message: error.response?.data?.message || "Failed to update profile" }
        }
      },
      updateProfilePicture: async (imageData) => {
        try {
          if (!state.token) {
            return { success: false, message: "Not authenticated" }
          }
          if (isTokenExpired(state.token)) {
            dispatch({ type: "TOKEN_EXPIRED" })
            return { success: false, message: "Session expired. Please login again." }
          }
          const response = await ProfileAPI.updateProfilePicture(imageData, state.token)
          if (response.success) {
            const updatedUser = { ...state.user, profilePicture: response.user.profilePicture }
            await AsyncStorage.setItem("user", JSON.stringify(updatedUser))
            dispatch({ type: "UPDATE_USER", payload: { user: { profilePicture: response.user.profilePicture } } })
            return { success: true, message: response.message }
          } else {
            return { success: false, message: response.error }
          }
        } catch (error) {
          console.error("Update profile picture error:", error)
          if (error.response?.status === 401) {
            dispatch({ type: "TOKEN_EXPIRED" })
            return { success: false, message: "Session expired. Please login again." }
          }
          return { success: false, message: error.response?.data?.message || "Failed to update profile picture" }
        }
      },
      logout: async () => {
        try {
          console.log("Starting logout process...")
          dispatch({ type: "SET_LOADING", payload: true })
          if (state.token) {
            try {
              await AuthAPI.logout(state.token)
              console.log("Logout API call successful")
            } catch (error) {
              console.warn("Logout API call failed:", error)
            }
          }
          console.log("Clearing local storage...")
          await Promise.all([AsyncStorage.removeItem("token"), AsyncStorage.removeItem("user")])
          console.log("Dispatching logout action...")
          dispatch({ type: "LOGOUT" })
          if (global.navigationRef && global.navigationRef.isReady()) {
            console.log("Navigating to login screen...")
            global.navigationRef.reset({ index: 0, routes: [{ name: "Login" }] })
          } else {
            console.log("Navigation ref not available, relying on state change")
          }
          console.log("Logout completed successfully")
          return { success: true }
        } catch (error) {
          console.error("Logout error:", error)
          try {
            await Promise.all([AsyncStorage.removeItem("token"), AsyncStorage.removeItem("user")])
          } catch (storageError) {
            console.error("Failed to clear storage:", storageError)
          }
          dispatch({ type: "LOGOUT" })
          if (global.navigationRef && global.navigationRef.isReady()) {
            global.navigationRef.reset({ index: 0, routes: [{ name: "Login" }] })
          }
          return { success: true }
        }
      },
      clearError: () => {
        dispatch({ type: "CLEAR_ERROR" })
      },
      checkTokenExpiration: async () => {
        if (state.token && isTokenExpired(state.token)) {
          console.log("Token expired, logging out...")
          // Directly call the logout logic defined within this useMemo'd object
          await (async () => {
            try {
              console.log("Starting logout process (from checkTokenExpiration)...")
              dispatch({ type: "SET_LOADING", payload: true })
              if (state.token) {
                try {
                  await AuthAPI.logout(state.token)
                  console.log("Logout API call successful (from checkTokenExpiration)")
                } catch (error) {
                  console.warn("Logout API call failed (from checkTokenExpiration):", error)
                }
              }
              await Promise.all([AsyncStorage.removeItem("token"), AsyncStorage.removeItem("user")])
              dispatch({ type: "LOGOUT" })
              if (global.navigationRef && global.navigationRef.isReady()) {
                global.navigationRef.reset({ index: 0, routes: [{ name: "Login" }] })
              }
            } catch (error) {
              console.error("Logout error (from checkTokenExpiration):", error)
              try {
                await Promise.all([AsyncStorage.removeItem("token"), AsyncStorage.removeItem("user")])
              } catch (storageError) {
                console.error("Failed to clear storage (from checkTokenExpiration):", storageError)
              }
              dispatch({ type: "LOGOUT" })
              if (global.navigationRef && global.navigationRef.isReady()) {
                global.navigationRef.reset({ index: 0, routes: [{ name: "Login" }] })
              }
            }
          })()

          Alert.alert("Session Expired", "Your session has expired. Please login again.", [{ text: "OK" }])
          return false
        }
        return true
      },
      getUsers: async (page = 1, limit = 20, search = "", filter = "all") => {
        try {
          if (!state.token || !state.user?.isAdmin) {
            return { success: false, message: "Not authorized" }
          }
          if (isTokenExpired(state.token)) {
            dispatch({ type: "TOKEN_EXPIRED" })
            return { success: false, message: "Session expired. Please login again." }
          }
          const response = await AuthAPI.getUsers(state.token, page, limit, search, filter)
          return response
        } catch (error) {
          console.error("Get users error:", error)
          if (error.response?.status === 401) {
            dispatch({ type: "TOKEN_EXPIRED" })
            return { success: false, message: "Session expired. Please login again." }
          }
          return { success: false, message: error.response?.data?.message || "Failed to fetch users" }
        }
      },
      getSuspendedUsers: async () => {
        try {
          if (!state.token || !state.user?.isAdmin) {
            return { success: false, message: "Not authorized" }
          }
          if (isTokenExpired(state.token)) {
            dispatch({ type: "TOKEN_EXPIRED" })
            return { success: false, message: "Session expired. Please login again." }
          }
          const response = await AuthAPI.getSuspendedUsers(state.token)
          return response
        } catch (error) {
          console.error("Get suspended users error:", error)
          if (error.response?.status === 401) {
            dispatch({ type: "TOKEN_EXPIRED" })
            return { success: false, message: "Session expired. Please login again." }
          }
          return { success: false, message: error.response?.data?.message || "Failed to fetch suspended users" }
        }
      },
      getUserDetails: async (userId) => {
        try {
          if (!state.token || !state.user?.isAdmin) {
            return { success: false, message: "Not authorized" }
          }
          if (isTokenExpired(state.token)) {
            dispatch({ type: "TOKEN_EXPIRED" })
            return { success: false, message: "Session expired. Please login again." }
          }
          const response = await AuthAPI.getUserDetails(userId, state.token)
          return response
        } catch (error) {
          console.error("Get user details error:", error)
          if (error.response?.status === 401) {
            dispatch({ type: "TOKEN_EXPIRED" })
            return { success: false, message: "Session expired. Please login again." }
          }
          return { success: false, message: error.response?.data?.message || "Failed to fetch user details" }
        }
      },
      suspendUser: async (userId, reason, duration) => {
        try {
          if (!state.token || !state.user?.isAdmin) {
            return { success: false, message: "Not authorized" }
          }
          if (isTokenExpired(state.token)) {
            dispatch({ type: "TOKEN_EXPIRED" })
            return { success: false, message: "Session expired. Please login again." }
          }
          const response = await AuthAPI.suspendUser(userId, reason, duration, state.token)
          return response
        } catch (error) {
          console.error("Suspend user error:", error)
          if (error.response?.status === 401) {
            dispatch({ type: "TOKEN_EXPIRED" })
            return { success: false, message: "Session expired. Please login again." }
          }
          return { success: false, message: error.response?.data?.message || "Failed to suspend user" }
        }
      },
      unsuspendUser: async (userId) => {
        try {
          if (!state.token || !state.user?.isAdmin) {
            return { success: false, message: "Not authorized" }
          }
          if (isTokenExpired(state.token)) {
            dispatch({ type: "TOKEN_EXPIRED" })
            return { success: false, message: "Session expired. Please login again." }
          }
          const response = await AuthAPI.unsuspendUser(userId, state.token)
          return response
        } catch (error) {
          console.error("Unsuspend user error:", error)
          if (error.response?.status === 401) {
            dispatch({ type: "TOKEN_EXPIRED" })
            return { success: false, message: "Session expired. Please login again." }
          }
          return { success: false, message: error.response?.data?.message || "Failed to unsuspend user" }
        }
      },
      getDashboardStats: async () => {
        try {
          if (!state.token || !state.user?.isAdmin) {
            return { success: false, message: "Not authorized" }
          }
          if (isTokenExpired(state.token)) {
            dispatch({ type: "TOKEN_EXPIRED" })
            return { success: false, message: "Session expired. Please login again." }
          }
          const response = await AuthAPI.getDashboardStats(state.token)
          return response
        } catch (error) {
          console.error("Get dashboard stats error:", error)
          if (error.response?.status === 401) {
            dispatch({ type: "TOKEN_EXPIRED" })
            return { success: false, message: "Session expired. Please login again." }
          }
          return { success: false, message: error.response?.data?.message || "Failed to fetch dashboard stats" }
        }
      },
      restore: (authData) => {
        dispatch({ type: "RESTORE_TOKEN", payload: authData })
      },
    }),
    [state, dispatch], // Removed isTokenExpired as it's defined in the outer scope
  )

  // Context value
  const contextValue = useMemo(
    () => ({
      state,
      dispatch,
      authContext: authActions,
      ...authActions,
    }),
    [state, authActions],
  )

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
