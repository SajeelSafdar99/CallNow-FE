const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://192.168.10.9:5001/api"

const API_ENDPOINTS = {
  // Auth endpoints
  REGISTER: "/auth/register",
  VERIFY_OTP: "/auth/verify-otp",
  LOGIN: "/auth/login",
  FORGOT_PASSWORD: "/auth/forgot-password",
  RESET_PASSWORD: "/auth/reset-password",
  REFRESH_TOKEN: "/auth/refresh-token",
  LOGOUT: "/auth/logout",

  // Profile endpoints
  GET_PROFILE: "/profile/me",
  UPDATE_PROFILE: "/profile/update",
  UPDATE_PROFILE_PICTURE: "/profile/picture",
  CHANGE_PASSWORD: "/profile/password",

  // Device endpoints
  REGISTER_DEVICE: "/device/register",
  UPDATE_DEVICE: "/device/update",
  REMOVE_DEVICE: "/device/remove",

  // Conversation endpoints
  GET_CONVERSATIONS: "/conversation",
  CREATE_CONVERSATION: "/conversation",
  CREATE_GROUP: "/conversation/group",
  UPDATE_GROUP: "/conversation/group",
  UPDATE_GROUP_IMAGE: "/conversation/group/image",
  ADD_PARTICIPANTS: "/conversation/group/participants",
  REMOVE_PARTICIPANT: "/conversation/group/participants",
  LEAVE_GROUP: "/conversation/group/leave",
  CHANGE_GROUP_ADMIN: "/conversation/group/admin",

  // Message endpoints
  SEND_MESSAGE: "/message",
  GET_MESSAGES: "/message",
  DELETE_MESSAGE: "/message",
  MARK_AS_DELIVERED: "/message/deliver",

  // Contact endpoints
  GET_CONTACTS: "/contact",
  ADD_CONTACT: "/contact",
  UPDATE_CONTACT: "/contact",
  DELETE_CONTACT: "/contact",
  BLOCK_CONTACT: "/contact/block",
  UNBLOCK_CONTACT: "/contact/unblock",
  GET_BLOCKED_CONTACTS: "/contact/blocked",

  // Call endpoints
  INITIATE_CALL: "/call",
  UPDATE_CALL_STATUS: "/call/status",
  GET_CALL_HISTORY: "/call/history",
  GET_CALL_DETAILS: "/call",
  DELETE_CALL: "/call",

  // Group call endpoints
  CREATE_GROUP_CALL: "/group-call",
  JOIN_GROUP_CALL: "/group-call/join",
  LEAVE_GROUP_CALL: "/group-call/leave",
  END_GROUP_CALL: "/group-call/end",
  GET_ACTIVE_GROUP_CALL: "/group-call/conversation",
  GET_GROUP_CALL_DETAILS: "/group-call",
  GET_GROUP_CALL_HISTORY: "/group-call",
  TOGGLE_SCREEN_SHARING: "/group-call/screen",
  UPDATE_CONNECTION_IDS: "/group-call/connections",

  // Call log endpoints
  GET_CALL_LOGS: "/call-log",
  CREATE_CALL_LOG: "/call-log",
  UPDATE_CALL_LOG: "/call-log",
  DELETE_CALL_LOG: "/call-log",

  // Call quality endpoints
  RECORD_METRICS: "/call-quality/metrics",
  GET_CALL_QUALITY_STATS: "/call-quality/stats",
  GET_CALL_METRICS: "/call-quality/call",

  // ICE server endpoints
  GET_ICE_SERVERS: "/ice-server",
  ADD_ICE_SERVER: "/ice-server",
  UPDATE_ICE_SERVER: "/ice-server",
  DELETE_ICE_SERVER: "/ice-server",
  GET_REGION_ICE_SERVERS: "/ice-server/region",
}

export { API_BASE_URL, API_ENDPOINTS }
