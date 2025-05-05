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

/**
 * Update the name of a device
 * @param {string} deviceId - ID of the device to update
 * @param {string} deviceName - New name for the device
 * @param {string} token - Authentication token
 * @returns {Promise} - Response with updated device data
 */
export const updateDeviceName = async (deviceId, deviceName, token) => {
  try {
    const response = await api.put(
      API_ENDPOINTS.UPDATE_DEVICE_NAME.replace(":deviceId", deviceId),
      { deviceName },
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
 * Update the last activity timestamp for a device
 * @param {string} deviceId - ID of the device to update
 * @param {string} token - Authentication token
 * @returns {Promise} - Response with updated device data
 */
export const updateDeviceActivity = async (deviceId, token) => {
  try {
    const response = await api.put(
      API_ENDPOINTS.UPDATE_DEVICE_ACTIVITY.replace(":deviceId", deviceId),
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
 * Register a new device for the user
 * @param {Object} deviceData - Device information (deviceId, deviceName, deviceType, etc.)
 * @param {string} token - Authentication token
 * @returns {Promise} - Response with the registered device data
 */
export const registerDevice = async (deviceData, token) => {
  try {
    const response = await api.post(
      API_ENDPOINTS.GET_DEVICES, // Uses the same endpoint as getDevices but with POST method
      deviceData,
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
 * Get device information by ID
 * @param {string} deviceId - ID of the device to get
 * @param {string} token - Authentication token
 * @returns {Promise} - Response with device data
 */
export const getDeviceById = async (deviceId, token) => {
  try {
    const response = await api.get(`${API_ENDPOINTS.GET_DEVICES}/${deviceId}`, {
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
 * Log out from a specific device
 * @param {string} deviceId - ID of the device to log out from
 * @param {string} token - Authentication token
 * @returns {Promise} - Response with operation status
 */
export const logoutDevice = async (deviceId, token) => {
  try {
    const response = await api.post(
      `${API_ENDPOINTS.GET_DEVICES}/${deviceId}/logout`,
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
 * Log out from all devices except the current one
 * @param {string} currentDeviceId - ID of the current device to keep logged in
 * @param {string} token - Authentication token
 * @returns {Promise} - Response with operation status
 */
export const logoutAllOtherDevices = async (currentDeviceId, token) => {
  try {
    const response = await api.post(
      `${API_ENDPOINTS.GET_DEVICES}/logout-all`,
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

/**
 * Get device login history
 * @param {string} deviceId - ID of the device to get history for
 * @param {string} token - Authentication token
 * @returns {Promise} - Response with device login history
 */
export const getDeviceLoginHistory = async (deviceId, token) => {
  try {
    const response = await api.get(`${API_ENDPOINTS.GET_DEVICES}/${deviceId}/history`, {
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
 * Verify a device (for two-factor authentication)
 * @param {string} deviceId - ID of the device to verify
 * @param {string} verificationCode - Verification code
 * @param {string} token - Authentication token
 * @returns {Promise} - Response with operation status
 */
export const verifyDevice = async (deviceId, verificationCode, token) => {
  try {
    const response = await api.post(
      `${API_ENDPOINTS.GET_DEVICES}/${deviceId}/verify`,
      { verificationCode },
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
 * Send verification code to verify a new device
 * @param {string} deviceId - ID of the device to verify
 * @param {string} token - Authentication token
 * @returns {Promise} - Response with operation status
 */
export const sendDeviceVerificationCode = async (deviceId, token) => {
  try {
    const response = await api.post(
      `${API_ENDPOINTS.GET_DEVICES}/${deviceId}/send-verification`,
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
