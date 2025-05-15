import { API_BASE_URL } from "../config/api"

// Initiate a call
export const initiateCall = async (token, receiverId, type) => {
  try {
    const response = await fetch(`${API_BASE_URL}/calls`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        receiverId,
        type, // 'audio' or 'video'
      }),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error initiating call:", error)
    return {
      success: false,
      message: "Failed to initiate call. Please check your connection.",
    }
  }
}

// Update call status
export const updateCallStatus = async (token, callId, status, endTime = null) => {
  try {
    const response = await fetch(`${API_BASE_URL}/calls/${callId}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        status,
        endTime,
      }),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error updating call status:", error)
    return {
      success: false,
      message: "Failed to update call status. Please check your connection.",
    }
  }
}

// Get call history
export const getCallHistory = async (token, page = 1, limit = 20) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/calls/history?page=${page}&limit=${limit}`,
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
    console.error("Error fetching call history:", error)
    return {
      success: false,
      message: "Failed to fetch call history. Please check your connection.",
    }
  }
}

// Get call details
export const getCallDetails = async (token, callId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/calls/${callId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error fetching call details:", error)
    return {
      success: false,
      message: "Failed to fetch call details. Please check your connection.",
    }
  }
}

// Delete call record
export const deleteCall = async (token, callId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/calls/${callId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error deleting call:", error)
    return {
      success: false,
      message: "Failed to delete call record. Please check your connection.",
    }
  }
}
