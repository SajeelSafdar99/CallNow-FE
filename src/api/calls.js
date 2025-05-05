import axios from "axios"
import { API_BASE_URL, API_ENDPOINTS } from "../config/api"

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
})

// Initiate a call
export const initiateCall = async (callData, token) => {
  try {
    const response = await api.post(API_ENDPOINTS.INITIATE_CALL, callData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}

// Answer a call
export const answerCall = async (callId, answerData, token) => {
  try {
    const response = await api.put(`${API_ENDPOINTS.ANSWER_CALL}/${callId}`, answerData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}

// End a call
export const endCall = async (callId, endData, token) => {
  try {
    const response = await api.put(`${API_ENDPOINTS.END_CALL}/${callId}`, endData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}

// Get call history
export const getCallHistory = async (params, token) => {
  try {
    const response = await api.get(API_ENDPOINTS.GET_CALL_HISTORY, {
      params,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}

// Get call details
export const getCallDetails = async (callId, token) => {
  try {
    const response = await api.get(`${API_ENDPOINTS.GET_CALL_DETAILS}/${callId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}

// Delete call from history
export const deleteCall = async (callId, token) => {
  try {
    const response = await api.delete(`${API_ENDPOINTS.DELETE_CALL}/${callId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}

// Log call quality metrics
export const logCallMetrics = async (metricsData, token) => {
  try {
    const response = await api.post(API_ENDPOINTS.RECORD_METRICS, metricsData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    console.error("Error logging call metrics:", error)
    // Don't throw error to prevent disrupting the call
    return { success: false, message: "Failed to log metrics" }
  }
}

// Get ICE servers
export const getIceServers = async (token, params = {}) => {
  try {
    const response = await api.get(API_ENDPOINTS.GET_ICE_SERVERS, {
      params,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    console.error("Error getting ICE servers:", error)
    // Return a default response to prevent disrupting the call
    return {
      success: false,
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
    }
  }
}

// Get call quality statistics
export const getCallQualityStats = async (timeframe, token) => {
  try {
    const response = await api.get(API_ENDPOINTS.GET_CALL_QUALITY_STATS, {
      params: { timeframe },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}

// Get call metrics for a specific call
export const getCallMetrics = async (callId, callType, token) => {
  try {
    const response = await api.get(`${API_ENDPOINTS.GET_CALL_METRICS}/${callType}/${callId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}
