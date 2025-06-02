import { API_BASE_URL, API_ENDPOINTS } from "../config/api"

/**
 * Records call quality metrics to the backend.
 * @param {string} token - The user's authentication token.
 * @param {string} callId - The ID of the call.
 * @param {'one-to-one' | 'group'} callType - The type of the call.
 * @param {object} detailedMetricsPayload - An object containing the detailed metrics to record,
 *                                   matching the backend model structure for the 'metrics' part.
 *                                   This payload should include its own 'timestamp' field.
 * @returns {Promise<object>} - The JSON response from the server.
 */
export const recordCallQualityMetrics = async (token, callId, callType, detailedMetricsPayload) => {
  if (!token || !callId || !callType || !detailedMetricsPayload) {
    console.error("recordCallQualityMetrics: Missing required parameters.", {
      token: !!token,
      callId,
      callType,
      detailedMetricsPayload,
    })
    return { success: false, message: "Client error: Missing required parameters for recording metrics." }
  }

  try {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.RECORD_METRICS}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        callId,
        callType,
        metrics: detailedMetricsPayload, // The backend expects the detailed payload under the 'metrics' key
      }),
    })

    if (!response.ok) {
      let errorData
      try {
        errorData = await response.json()
      } catch (e) {
        // If response is not JSON, read as text
        errorData = await response.text()
      }
      console.error("Error recording call quality metrics - Non-OK response:", response.status, errorData)
      return {
        success: false,
        message: `Failed to record metrics: ${response.status}`,
        error: errorData,
      }
    }
    return await response.json()
  } catch (error) {
    console.error("Error recording call quality metrics - Fetch error:", error)
    return { success: false, message: "Failed to record metrics due to a network or system error." }
  }
}
