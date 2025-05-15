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
 * Get user profile by ID
 * @param {string} userId - User ID
 * @param {string} token - Authentication token
 * @returns {Promise} - Response with user profile data
 */
export const getUserProfile = async (userId, token) => {
  try {
    const response = await api.get(API_ENDPOINTS.GET_USER_PROFILE.replace(":userId", userId), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    return {
      success: true,
      user: response.data.user,
    }
  } catch (error) {
    console.error("Error fetching user profile:", error)
    return {
      success: false,
      error: error.response?.data?.message || "Failed to fetch user profile",
    }
  }
}
