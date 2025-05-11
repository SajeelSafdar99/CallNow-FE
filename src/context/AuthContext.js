"use client"

import { createContext, useReducer, useEffect } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as AuthAPI from "../api/auth"
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
  }

  return <AuthContext.Provider value={{ state, ...authActions }}>{children}</AuthContext.Provider>
}
