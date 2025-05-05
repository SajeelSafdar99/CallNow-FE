import axios from "axios"
import { API_BASE_URL, API_ENDPOINTS } from "../config/api"

// Create axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
})

// Create a group call
export const createGroupCall = async (groupCallData, token) => {
    try {
        const response = await api.post(API_ENDPOINTS.CREATE_GROUP_CALL, groupCallData, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
        return response.data
    } catch (error) {
        throw error
    }
}

// Join a group call
export const joinGroupCall = async (groupCallId, joinData, token) => {
    try {
        const response = await api.post(`${API_ENDPOINTS.JOIN_GROUP_CALL}/${groupCallId}`, joinData, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
        return response.data
    } catch (error) {
        throw error
    }
}

// Leave a group call
export const leaveGroupCall = async (groupCallId, leaveData, token) => {
    try {
        const response = await api.put(`${API_ENDPOINTS.LEAVE_GROUP_CALL}/${groupCallId}`, leaveData, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
        return response.data
    } catch (error) {
        throw error
    }
}

// End a group call (host only)
export const endGroupCall = async (groupCallId, token) => {
    try {
        const response = await api.put(
            `${API_ENDPOINTS.END_GROUP_CALL}/${groupCallId}`,
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

// Get active group call for a conversation
export const getActiveGroupCall = async (conversationId, token) => {
    try {
        const response = await api.get(`${API_ENDPOINTS.GET_ACTIVE_GROUP_CALL}/${conversationId}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
        return response.data
    } catch (error) {
        throw error
    }
}

// Get group call details
export const getGroupCallDetails = async (groupCallId, token) => {
    try {
        const response = await api.get(`${API_ENDPOINTS.GET_GROUP_CALL_DETAILS}/${groupCallId}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
        return response.data
    } catch (error) {
        throw error
    }
}

// Toggle screen sharing
export const toggleScreenSharing = async (groupCallId, sharingData, token) => {
    try {
        const response = await api.put(`${API_ENDPOINTS.TOGGLE_SCREEN_SHARING}/${groupCallId}`, sharingData, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
        return response.data
    } catch (error) {
        throw error
    }
}

// Update connection IDs (for WebRTC)
export const updateConnectionIds = async (groupCallId, connectionData, token) => {
    try {
        const response = await api.put(`${API_ENDPOINTS.UPDATE_CONNECTION_IDS}/${groupCallId}`, connectionData, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
        return response.data
    } catch (error) {
        throw error
    }
}
