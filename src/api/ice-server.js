import apiClient from "../config/interceptor" // Assuming interceptor.js is in the same directory
import { API_ENDPOINTS } from "../config/api" // Assuming api.js is in ../config/

// Default ICE servers as a fallback
const DEFAULT_ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }]

// Get all ICE servers (for general use, likely authenticated but not admin-only)
export const getIceServers = async () => {
  try {
    // No explicit token needed if apiClient handles it via interceptor
    const response = await apiClient.get(API_ENDPOINTS.GET_ICE_SERVERS)
    if (response.data.success && response.data.iceServers.length > 0) {
      return response.data
    }
    // Fallback to default if API returns success false or empty array
    console.warn("Using default ICE servers due to API response:", response.data.message)
    return {
      success: true, // Indicate success with fallback
      message: "Using default ICE server configuration.",
      iceServers: DEFAULT_ICE_SERVERS,
    }
  } catch (error) {
    console.error("Error fetching ICE servers:", error)
    return {
      success: false,
      message: "Failed to fetch ICE servers. Using default configuration.",
      iceServers: DEFAULT_ICE_SERVERS,
    }
  }
}

// Admin: Add a new ICE server
export const addIceServer = async (serverConfig) => {
  try {
    // Token is handled by apiClient interceptor
    const response = await apiClient.post(API_ENDPOINTS.ADD_ICE_SERVER, serverConfig)
    return response.data // Should be { success: true, message: "...", iceServer: {...} }
  } catch (error) {
    console.error("Error adding ICE server:", error)
    return {
      success: false,
      message: error.response?.data?.message || "Failed to add ICE server.",
    }
  }
}

// Admin: Update an existing ICE server
export const updateIceServer = async (id, serverConfig) => {
  try {
    const url = API_ENDPOINTS.UPDATE_ICE_SERVER.replace(":id", id)
    const response = await apiClient.put(url, serverConfig)
    return response.data // Should be { success: true, message: "...", iceServer: {...} }
  } catch (error) {
    console.error(`Error updating ICE server ${id}:`, error)
    return {
      success: false,
      message: error.response?.data?.message || `Failed to update ICE server ${id}.`,
    }
  }
}

// Admin: Delete an ICE server
export const deleteIceServer = async (id) => {
  try {
    const url = API_ENDPOINTS.DELETE_ICE_SERVER.replace(":id", id)
    const response = await apiClient.delete(url)
    return response.data // Should be { success: true, message: "..." }
  } catch (error) {
    console.error(`Error deleting ICE server ${id}:`, error)
    return {
      success: false,
      message: error.response?.data?.message || `Failed to delete ICE server ${id}.`,
    }
  }
}

// Admin: Get all ICE servers (for management)
export const adminGetAllIceServers = async () => {
  try {
    // Assumes API_ENDPOINTS.ADMIN_GET_ALL_ICE_SERVERS is defined (e.g., "/admin/ice-servers")
    // and the backend route returns all server objects with full details.
    const response = await apiClient.get(API_ENDPOINTS.GET_ICE_SERVERS)
    return response.data // Expects { success: true, iceServers: [fullServerObject, ...] }
  } catch (error) {
    console.error("Error fetching all ICE servers for admin:", error)
    return {
      success: false,
      message: error.response?.data?.message || "Failed to fetch ICE servers for admin.",
      iceServers: [],
    }
  }
}
