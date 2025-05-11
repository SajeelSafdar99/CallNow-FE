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
 * Get all devices associated with the user's account
 * @param {string} token - Authentication token
 * @returns {Promise} - Response with devices data
 */
export const getDevices = async (token) => {
  try {
    const response = await api.get(API_ENDPOINTS.GET_DEVICES, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}

/**
 * Set a device as the active device
 * @param {string} deviceId - ID of the device to set as active
 * @param {string} token - Authentication token
 * @returns {Promise} - Response with updated device data
 */
export const setActiveDevice = async (deviceId, token) => {
  try {
    const response = await api.put(
      API_ENDPOINTS.SET_ACTIVE_DEVICE.replace(":deviceId", deviceId),
      {},
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

/**
 * Remove a device from the user's account
 * @param {string} deviceId - ID of the device to remove
 * @param {string} token - Authentication token
 * @returns {Promise} - Response with operation status
 */
export const removeDevice = async (deviceId, token) => {
  try {
    console.log(API_ENDPOINTS.REMOVE_DEVICE, deviceId)
    const response = await api.delete(API_ENDPOINTS.REMOVE_DEVICE.replace(":deviceId", deviceId), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}
export const logoutAllOtherDevices = async (currentDeviceId, token) => {
  try {
    const response = await api.post(
      `${API_ENDPOINTS.LOGOUT_ALL_DEVICES}`,
      { currentDeviceId },
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

