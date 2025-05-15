import { API_BASE_URL } from "../config/api"

// Log call event
export const logCallEvent = async (token, callId, callType, eventType, metadata = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}/call-logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        callId,
        callType, // 'one-to-one' or 'group'
        eventType,
        metadata,
      }),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error logging call event:", error)
    return {
      success: false,
      message: "Failed to log call event.",
    }
  }
}

// Get call logs for a specific call
export const getCallLogs = async (token, callId, callType) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/call-logs/${callType}/${callId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error fetching call logs:", error)
    return {
      success: false,
      message: "Failed to fetch call logs. Please check your connection.",
    }
  }
}

// Get unified call history
export const getUnifiedCallHistory = async (token, page = 1, limit = 20) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/call-logs/history?page=${page}&limit=${limit}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error fetching unified call history:", error)
    return {
      success: false,
      message: "Failed to fetch call history. Please check your connection.",
    }
  }
}
