import axios from "axios"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { API_BASE_URL } from "./api"
import { Alert } from "react-native"

// Create axios instance with base URL
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
})

// Request interceptor to add token
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem("token")
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    } catch (error) {
      console.error("Error getting token from AsyncStorage:", error)
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle 401 errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // If the error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        // Clear token and user data
        await AsyncStorage.removeItem("token")
        await AsyncStorage.removeItem("user")

        // Show alert and navigate to login
        if (global.navigationRef && global.navigationRef.isReady()) {
          Alert.alert(
            "Session Expired",
            "Your session has expired. Please login again.",
            [
              {
                text: "OK",
                onPress: () => {
                  // Reset navigation to login screen
                  global.navigationRef.reset({
                    index: 0,
                    routes: [{ name: "Login" }],
                  })
                },
              },
            ]
          )
        }
      } catch (storageError) {
        console.error("Error clearing storage:", storageError)
      }
    }

    return Promise.reject(error)
  }
)

export default apiClient
