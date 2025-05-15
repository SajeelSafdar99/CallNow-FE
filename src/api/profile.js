import axios from "axios"
import { API_BASE_URL, API_ENDPOINTS } from "../config/api"

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
})

/**
 * Get current user profile
 * @param {string} token - Authentication token
 * @returns {Promise} - Response with user profile data
 */
export const getProfile = async (token) => {
  try {
    const response = await api.get(API_ENDPOINTS.GET_PROFILE, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    return {
      success: true,
      user: response.data.user,
    }
  } catch (error) {
    console.error("Error fetching profile:", error)
    return {
      success: false,
      error: error.response?.data?.message || "Failed to fetch profile",
    }
  }
}

/**
 * Update user profile
 * @param {Object} profileData - Profile data to update (name, about)
 * @param {string} token - Authentication token
 * @returns {Promise} - Response with updated user data
 */
export const updateProfile = async (profileData, token) => {
  try {
    const response = await api.put(API_ENDPOINTS.UPDATE_PROFILE, profileData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    return {
      success: true,
      user: response.data.user,
      message: response.data.message,
    }
  } catch (error) {
    console.error("Error updating profile:", error)
    return {
      success: false,
      error: error.response?.data?.message || "Failed to update profile",
    }
  }
}

/**
 * Update profile picture
 * @param {Object} imageData - Form data with profile picture
 * @param {string} token - Authentication token
 * @returns {Promise} - Response with updated user data
 */
export const updateProfilePicture = async (imageData, token) => {
  try {
    const response = await api.put(API_ENDPOINTS.UPDATE_PROFILE_PICTURE, imageData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
    })

    return {
      success: true,
      user: response.data.user,
      message: response.data.message,
    }
  } catch (error) {
    console.error("Error updating profile picture:", error)
    return {
      success: false,
      error: error.response?.data?.message || "Failed to update profile picture",
    }
  }
}
