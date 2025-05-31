import { API_ENDPOINTS } from "../config/api"
import apiClient from "../config/interceptor"

// Register a new user
export const register = async (phoneNumber, password, name) => {
  try {
    const response = await apiClient.post(API_ENDPOINTS.REGISTER, {
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
    const response = await apiClient.post(API_ENDPOINTS.LOGIN, {
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

// Logout
export const logout = async (token) => {
  try {
    const response = await apiClient.post(API_ENDPOINTS.LOGOUT)
    return response.data
  } catch (error) {
    throw error
  }
}

// Verify OTP
export const verifyOTP = async (phoneNumber, otp, purpose = "registration") => {
  try {
    const response = await apiClient.post(API_ENDPOINTS.VERIFY_OTP, {
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
    const response = await apiClient.post(API_ENDPOINTS.RESEND_OTP, {
      phoneNumber,
      purpose,
    })
    return response.data
  } catch (error) {
    throw error
  }
}

// Forgot password
export const forgotPassword = async (phoneNumber) => {
  try {
    const response = await apiClient.post(API_ENDPOINTS.FORGOT_PASSWORD, {
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
    const response = await apiClient.post(API_ENDPOINTS.RESET_PASSWORD, {
      phoneNumber,
      otp,
      newPassword,
    })
    return response.data
  } catch (error) {
    throw error
  }
}

// Admin: Get all users with pagination and filters
export const getUsers = async (token, page = 1, limit = 20, search = "", filter = "all") => {
  try {
    const response = await apiClient.get(API_ENDPOINTS.ADMIN_GET_USERS, {
      params: { page, limit, search, filter },
    })
    return response.data
  } catch (error) {
    throw error
  }
}

// Admin: Get suspended users
export const getSuspendedUsers = async (token) => {
  try {
    const response = await apiClient.get(API_ENDPOINTS.ADMIN_GET_SUSPENDED_USERS)
    return response.data
  } catch (error) {
    throw error
  }
}

// Admin: Get user details
export const getUserDetails = async (userId, token) => {
  try {
    const url = API_ENDPOINTS.ADMIN_GET_USER_DETAILS.replace(":userId", userId)
    const response = await apiClient.get(url)
    return response.data
  } catch (error) {
    throw error
  }
}

// Admin: Suspend a user
export const suspendUser = async (userId, reason, duration, token) => {
  try {
    const url = API_ENDPOINTS.ADMIN_SUSPEND_USER.replace(":userId", userId)
    const response = await apiClient.post(url, { reason, duration })
    return response.data
  } catch (error) {
    throw error
  }
}

// Admin: Unsuspend a user
export const unsuspendUser = async (userId, token) => {
  try {
    const url = API_ENDPOINTS.ADMIN_UNSUSPEND_USER.replace(":userId", userId)
    const response = await apiClient.post(url)
    return response.data
  } catch (error) {
    throw error
  }
}

// Admin: Get dashboard stats
export const getDashboardStats = async (token) => {
  try {
    const response = await apiClient.get(API_ENDPOINTS.ADMIN_DASHBOARD_STATS)
    return response.data
  } catch (error) {
    throw error
  }
}
