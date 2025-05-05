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

// Verify OTP
export const verifyOTP = async (phoneNumber, otp, purpose = "registration") => {
  try {
    const response = await api.post(API_ENDPOINTS.VERIFY_OTP, {
      phoneNumber,
      otp,
      purpose,
    })
    return response.data
  } catch (error) {
    throw error
  }
}

// Resend OTP
export const resendOTP = async (phoneNumber, purpose = "registration") => {
  try {
    const response = await api.post(API_ENDPOINTS.RESEND_OTP, {
      phoneNumber,
      purpose,
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

// Reset password
export const resetPassword = async (phoneNumber, otp, newPassword) => {
  try {
    const response = await api.post(API_ENDPOINTS.RESET_PASSWORD, {
      phoneNumber,
      otp,
      newPassword,
    })
    return response.data
  } catch (error) {
    throw error
  }
}

// Change password
export const changePassword = async (currentPassword, newPassword, token) => {
  try {
    const response = await api.post(
      API_ENDPOINTS.CHANGE_PASSWORD,
      {
        currentPassword,
        newPassword,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    )
    return response.data
  } catch (error) {
    throw error
  }
}

// Update profile
export const updateProfile = async (updates, token) => {
  try {
    const response = await api.put(API_ENDPOINTS.UPDATE_PROFILE, updates, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}

// Get profile
export const getProfile = async (token) => {
  try {
    const response = await api.get(API_ENDPOINTS.PROFILE, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}
