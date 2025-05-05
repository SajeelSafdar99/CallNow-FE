import axios from "axios"
import { API_BASE_URL, API_ENDPOINTS } from "../config/api"

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
})

// Get current user profile
export const getMyProfile = async (token) => {
  try {
    const response = await api.get(API_ENDPOINTS.GET_PROFILE, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}

// Get user profile by ID
export const getUserProfile = async (userId, token) => {
  try {
    const response = await api.get(API_ENDPOINTS.GET_USER_PROFILE.replace(":userId", userId), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}

// Update user profile
export const updateProfile = async (profileData, token) => {
  try {
    const response = await api.put(API_ENDPOINTS.UPDATE_PROFILE, profileData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}

// Update profile picture
export const updateProfilePicture = async (imageFile, token) => {
  try {
    const response = await api.put(API_ENDPOINTS.UPDATE_PROFILE_PICTURE, imageFile, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}

// Change password
export const changePassword = async (passwordData, token) => {
  try {
    const response = await api.put(API_ENDPOINTS.CHANGE_PASSWORD, passwordData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}

// Delete account
export const deleteAccount = async (token) => {
  try {
    const response = await api.delete(API_ENDPOINTS.DELETE_ACCOUNT, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}

// Search users by name or phone
export const searchUsers = async (query, token) => {
  try {
    const response = await api.get(`${API_ENDPOINTS.SEARCH_USERS}?q=${query}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}

// Get user by phone number
export const getUserByPhone = async (phoneNumber, token) => {
  try {
    const response = await api.get(API_ENDPOINTS.GET_USER_BY_PHONE.replace(":phoneNumber", phoneNumber), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}
