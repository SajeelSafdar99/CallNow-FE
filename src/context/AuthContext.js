"use client"

import { createContext, useReducer, useEffect } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as AuthAPI from "../api/auth"
import {getDeviceInfo, getUniqueId} from '../utils/device';

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
        user: { ...state.user, ...action.payload },
      }
    case "AUTH_ERROR":
      return {
        ...state,
        isLoading: false,
        error: action.payload,
      }
    default:
      return state
  }
}

// Provider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Check if user is already logged in
  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const token = await AsyncStorage.getItem("token")
        const userString = await AsyncStorage.getItem("user")
        const user = userString ? JSON.parse(userString) : null
        const deviceId = await getUniqueId()

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

  // Auth actions
  const authActions = {
    login: async (phoneNumber, password) => {
      try {
        const deviceId = await getUniqueId()
        const deviceName = await getDeviceInfo() // You can get actual device name if needed

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

    verifyOTP: async (phoneNumber, otp, purpose = "registration") => {
      try {
        const response = await AuthAPI.verifyOTP(phoneNumber, otp, purpose)

        if (response.success) {
          if (purpose === "registration") {
            await AsyncStorage.setItem("token", response.token)
            await AsyncStorage.setItem("user", JSON.stringify(response.user))

            const deviceId = await getUniqueId()

            dispatch({
              type: "LOGIN",
              payload: {
                token: response.token,
                user: response.user,
                deviceId,
              },
            })
          }

          return { success: true }
        } else {
          dispatch({ type: "AUTH_ERROR", payload: response.message })
          return { success: false, message: response.message }
        }
      } catch (error) {
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
        const errorMessage = error.response?.data?.message || "Password reset failed. Please try again."
        dispatch({ type: "AUTH_ERROR", payload: errorMessage })
        return { success: false, message: errorMessage }
      }
    },

    updateProfile: async (updates) => {
      try {
        const response = await AuthAPI.updateProfile(updates, state.token)

        if (response.success) {
          await AsyncStorage.setItem("user", JSON.stringify(response.user))
          dispatch({ type: "UPDATE_USER", payload: response.user })
          return { success: true }
        } else {
          return { success: false, message: response.message }
        }
      } catch (error) {
        const errorMessage = error.response?.data?.message || "Profile update failed. Please try again."
        return { success: false, message: errorMessage }
      }
    },

    logout: async () => {
      try {
        await AsyncStorage.removeItem("token")
        await AsyncStorage.removeItem("user")
        dispatch({ type: "LOGOUT" })
        return { success: true }
      } catch (error) {
        console.error("Error during logout:", error)
        return { success: false, message: "Logout failed" }
      }
    },
  }

  return <AuthContext.Provider value={{ state, ...authActions }}>{children}</AuthContext.Provider>
}
