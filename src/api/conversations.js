import axios from "axios"
import { API_BASE_URL, API_ENDPOINTS } from "../config/api"

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
})

// Get all conversations
export const getConversations = async (token) => {
  try {
    const response = await api.get(API_ENDPOINTS.GET_CONVERSATIONS, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    console.error("Error getting conversations:", error.response?.data || error.message)
    return {
      success: false,
      error: error.response?.data?.message || "Failed to get conversations"
    }
  }
}

// Get or create one-to-one conversation
export const getOrCreateConversation = async (recipientId, token) => {
  try {
    const response = await api.post(
      API_ENDPOINTS.CREATE_CONVERSATION,
      { recipientId },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    )
    return response.data
  } catch (error) {
    console.error("Error creating conversation:", error.response?.data || error.message)
    return {
      success: false,
      error: error.response?.data?.message || "Failed to create conversation"
    }
  }
}

// Create group conversation
export const createGroupConversation = async (formData, token) => {
  try {
    const response = await axios.post(`${API_BASE_URL}${API_ENDPOINTS.CREATE_GROUP}`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
    })
    return response.data
  } catch (error) {
    console.error("Error creating group:", error.response?.data || error.message)
    return {
      success: false,
      error: error.response?.data?.message || "Failed to create group"
    }
  }
}

// Update group info
export const updateGroupInfo = async (conversationId, updates, token) => {
  try {
    const response = await api.put(API_ENDPOINTS.UPDATE_GROUP.replace(":conversationId", conversationId), updates, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    console.error("Error updating group:", error.response?.data || error.message)
    return {
      success: false,
      error: error.response?.data?.message || "Failed to update group"
    }
  }
}

// Update group image
export const updateGroupImage = async (conversationId, formData, token) => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}${API_ENDPOINTS.UPDATE_GROUP_IMAGE.replace(":conversationId", conversationId)}`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      },
    )
    return response.data
  } catch (error) {
    console.error("Error updating group image:", error.response?.data || error.message)
    return {
      success: false,
      error: error.response?.data?.message || "Failed to update group image"
    }
  }
}

// Add participants to group
export const addParticipants = async (conversationId, participantIds, token) => {
  try {
    const response = await api.post(
      API_ENDPOINTS.ADD_PARTICIPANTS.replace(":conversationId", conversationId),
      { participants: participantIds },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    )
    return response.data
  } catch (error) {
    console.error("Error adding participants:", error.response?.data || error.message)
    return {
      success: false,
      error: error.response?.data?.message || "Failed to add participants"
    }
  }
}

// Remove participant from group
export const removeParticipant = async (conversationId, participantId, token) => {
  try {
    const response = await api.delete(
      API_ENDPOINTS.REMOVE_PARTICIPANT.replace(":conversationId", conversationId).replace(
        ":participantId",
        participantId,
      ),
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    )
    return response.data
  } catch (error) {
    console.error("Error removing participant:", error.response?.data || error.message)
    return {
      success: false,
      error: error.response?.data?.message || "Failed to remove participant"
    }
  }
}

// Leave group
export const leaveGroup = async (conversationId, token) => {
  try {
    const response = await api.delete(API_ENDPOINTS.LEAVE_GROUP.replace(":conversationId", conversationId), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    console.error("Error leaving group:", error.response?.data || error.message)
    return {
      success: false,
      error: error.response?.data?.message || "Failed to leave group"
    }
  }
}

// Make user an admin
export const makeAdmin = async (conversationId, newAdminId, token) => {
  try {
    const response = await api.put(
      API_ENDPOINTS.CHANGE_GROUP_ADMIN.replace(":conversationId", conversationId),
      { newAdminId },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    )
    return response.data
  } catch (error) {
    console.error("Error making admin:", error.response?.data || error.message)
    return {
      success: false,
      error: error.response?.data?.message || "Failed to make admin"
    }
  }
}
