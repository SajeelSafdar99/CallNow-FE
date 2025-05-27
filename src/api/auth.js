import axios from 'axios'
import { API_BASE_URL, API_ENDPOINTS } from "../config/api"

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
})

// Register a new user
export const register = async (phoneNumber, password, name) => {
  try {
    const response = await api.post(API_ENDPOINTS.REGISTER, {
      phoneNumber,
      password,
      name,
    })
    return response.data
  } catch (error) {
    throw error
  }
}


// Login
export const login = async (phoneNumber, password, deviceId, deviceName) => {
  try {
    const response = await api.post(API_ENDPOINTS.LOGIN, {
      phoneNumber,
      password,
      deviceId,
      deviceName,
    })
    console.log("login response", response)
    return response.data
  } catch (error) {
    throw error
  }
}

// Forgot password
export const forgotPassword = async (phoneNumber) => {
  try {
    const response = await api.post(API_ENDPOINTS.FORGET_PASSWORD, {
      phoneNumber,
    })
    return response.data
  } catch (error) {
    throw error
  }
}
