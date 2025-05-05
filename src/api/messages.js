import axios from "axios"
import { API_BASE_URL, API_ENDPOINTS } from "../config/api"

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
})

// Get messages for a conversation
export const getMessages = async (conversationId, page = 1, limit = 50, token) => {
  try {
    const response = await api.get(`${API_ENDPOINTS.GET_MESSAGES}/${conversationId}?page=${page}&limit=${limit}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}

// Send text message
export const sendTextMessage = async (conversationId, content, replyTo = null, token) => {
  try {
    const response = await api.post(
      API_ENDPOINTS.SEND_MESSAGE,
      {
        conversationId,
        content,
        contentType: "text",
        replyTo,
      },
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

// Send media message
export const sendMediaMessage = async (conversationId, content, mediaFile, contentType, replyTo = null, token) => {
  try {
    const formData = new FormData()
    formData.append("conversationId", conversationId)
    formData.append("content", content)
    formData.append("contentType", contentType)

    if (replyTo) {
      formData.append("replyTo", replyTo)
    }

    formData.append("media", {
      uri: mediaFile.uri,
      name: mediaFile.fileName || `media_${Date.now()}.${mediaFile.type.split("/")[1]}`,
      type: mediaFile.type,
    })

    const response = await axios.post(`${API_BASE_URL}${API_ENDPOINTS.SEND_MESSAGE}`, formData, {
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

// Delete message
export const deleteMessage = async (messageId, deleteForEveryone = false, token) => {
  try {
    const response = await api.delete(`${API_ENDPOINTS.DELETE_MESSAGE}/${messageId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        deleteForEveryone,
      },
    })
    return response.data
  } catch (error) {
    throw error
  }
}

// Mark messages as delivered
export const markAsDelivered = async (conversationId, token) => {
  try {
    const response = await api.put(
      `${API_ENDPOINTS.MARK_AS_DELIVERED}/${conversationId}/deliver`,
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
