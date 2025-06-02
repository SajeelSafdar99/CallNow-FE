import apiClient from "../config/interceptor" // Your configured axios instance
import {API_BASE_URL} from '../config/api';
// Base URL for group call endpoints

/**
 * Creates a new group call.
 * @param {string} conversationId - The ID of the conversation.
 * @param {string} type - Call type ('audio' or 'video').
 * @param {string} [name] - Optional name for the call.
 * @param {Array<{userId: string, targetDeviceId?: string}>} initialParticipants - Participants to invite.
 * @returns {Promise<object>} The API response.
 */
export const createGroupCall = async (conversationId, type, name, initialParticipants) => {
  try {
    const response = await apiClient.post(`${API_BASE_URL}/group-calls/create`, {
      conversationId,
      type,
      name,
      initialParticipants,
    })
    return response.data
  } catch (error) {
    console.error("Error creating group call:", error.response?.data || error.message)
    return error.response?.data || { success: false, message: error.message }
  }
}

/**
 * Joins an existing group call.
 * @param {string} groupCallId - The ID of the group call to join.
 * @param {Array<string>} [connectionIds] - Optional WebRTC connection IDs.
 * @returns {Promise<object>} The API response.
 */
export const joinGroupCall = async (groupCallId, connectionIds) => {
  try {
    const response = await apiClient.post(`${API_BASE_URL}/group-calls/${groupCallId}/join`, { connectionIds })
    return response.data
  } catch (error) {
    console.error("Error joining group call:", error.response?.data || error.message)
    return error.response?.data || { success: false, message: error.message }
  }
}

/**
 * Leaves a group call.
 * @param {string} groupCallId - The ID of the group call to leave.
 * @returns {Promise<object>} The API response.
 */
export const leaveGroupCall = async (groupCallId) => {
  try {
    const response = await apiClient.put(`${API_BASE_URL}/group-calls/${groupCallId}/leave`)
    return response.data
  } catch (error) {
    console.error("Error leaving group call:", error.response?.data || error.message)
    return error.response?.data || { success: false, message: error.message }
  }
}

/**
 * Ends a group call (typically by the initiator).
 * @param {string} groupCallId - The ID of the group call to end.
 * @returns {Promise<object>} The API response.
 */
export const endGroupCall = async (groupCallId) => {
  try {
    const response = await apiClient.put(`${API_BASE_URL}/group-calls/${groupCallId}/end`)
    return response.data
  } catch (error) {
    console.error("Error ending group call:", error.response?.data || error.message)
    return error.response?.data || { success: false, message: error.message }
  }
}

/**
 * Updates the status of a group call or a participant in the call.
 * @param {string} groupCallId - The ID of the group call.
 * @param {object} payload - The status update payload.
 * @param {string} payload.status - The new status (e.g., "missed", "rejected", "active", "ended").
 * @param {string} [payload.reason] - Optional reason for the status change.
 * @param {string} [payload.endTime] - Optional end time for statuses like "ended", "completed".
 * @param {string} [payload.targetUserId] - Optional ID of the participant whose status is being updated (for "missed", "rejected").
 * @returns {Promise<object>} The API response.
 */
export const updateCallStatus = async (groupCallId, { status, reason, endTime, targetUserId }) => {
  try {
    const response = await apiClient.put(`${API_BASE_URL}/group-calls/${groupCallId}/status`, {
      status,
      reason,
      endTime,
      targetUserId,
    })
    return response.data
  } catch (error) {
    console.error("Error updating call status:", error.response?.data || error.message)
    return error.response?.data || { success: false, message: error.message }
  }
}

/**
 * Fetches the details of a specific group call.
 * (This endpoint is not in the router, but often useful)
 * @param {string} groupCallId - The ID of the group call.
 * @returns {Promise<object>} The API response.
 */
export const getGroupCallDetails = async (groupCallId) => {
  try {
    // Assuming a GET endpoint like /:groupCallId exists or you add one
    const response = await apiClient.get(`${API_BASE_URL}/group-calls/${groupCallId}`)
    return response.data
  } catch (error) {
    console.error("Error fetching group call details:", error.response?.data || error.message)
    return error.response?.data || { success: false, message: error.message }
  }
}
