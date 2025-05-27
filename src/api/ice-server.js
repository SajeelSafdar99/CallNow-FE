import { API_BASE_URL } from "../config/api"

// Get ICE servers
export const getIceServers = async (token) => {
  try {
    const response = await fetch(`${API_BASE_URL}/ice-servers`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error fetching ICE servers:", error)
    return {
      success: false,
      message: "Failed to fetch ICE servers. Using default configuration.",
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    }
  }
}
