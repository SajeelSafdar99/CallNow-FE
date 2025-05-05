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
    const response = await api.get(API_ENDPOINTS.CONVERSATIONS, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}

// Get or create one-to-one conversation
export const getOrCreateConversation = async (recipientId, token) => {
  try {
    const response = await api.post(
      API_ENDPOINTS.CONVERSATIONS,
      { recipientId },
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

// Get conversation details
export const getConversationDetails = async (conversationId, token) => {
  try {
    const response = await api.get(API_ENDPOINTS.GET_CONVERSATION_DETAILS.replace(":conversationId", conversationId), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    throw error
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
    throw error
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
    throw error
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
    throw error
  }
}

// Add participants to group
export const addParticipants = async (conversationId, participantIds, token) => {
  try {
    const response = await api.post(
      API_ENDPOINTS.ADD_PARTICIPANTS.replace(":conversationId", conversationId),
      { participantIds },
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

// Remove participant from group
export const removeParticipant = async (conversationId, participantData, token) => {
  try {
    const response = await api.delete(
      API_ENDPOINTS.REMOVE_PARTICIPANT.replace(":conversationId", conversationId).replace(
        ":participantId",
        participantData.participantId,
      ),
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
    throw error
  }
}

// Make user an admin
export const makeAdmin = async (conversationId, participantData, token) => {
  try {
    const response = await api.post(
      API_ENDPOINTS.MAKE_ADMIN.replace(":conversationId", conversationId),
      participantData,
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

// Remove admin status
export const removeAdmin = async (conversationId, participantData, token) => {
  try {
    const response = await api.post(
      API_ENDPOINTS.REMOVE_ADMIN.replace(":conversationId", conversationId),
      participantData,
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

// Toggle mute group
export const toggleMuteGroup = async (conversationId, muteData, token) => {
  try {
    const response = await api.put(
      API_ENDPOINTS.TOGGLE_MUTE_GROUP.replace(":conversationId", conversationId),
      muteData,
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
