const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://192.168.10.19:5001/api"
const API_BASE_URL_FOR_MEDIA = process.env.REACT_APP_API_BASE_URL_FOR_MEDIA || "http://192.168.10.19:5001"
const API_ENDPOINTS = {
  // Auth endpoints
  REGISTER: "/auth/register",
  VERIFY_OTP: "/auth/verify-otp",
  LOGIN: "/auth/login",
  FORGOT_PASSWORD: "/auth/forgot-password",
  RESET_PASSWORD: "/auth/reset-password",
  LOGOUT: "/auth/logout",
  RESEND_OTP: "/auth/resend-otp",

  // Profile endpoints
  GET_PROFILE: "/profile/me",
  UPDATE_PROFILE: "/profile/update",
  UPDATE_PROFILE_PICTURE: "/profile/picture",
  CHANGE_PASSWORD: "/profile/password",

  // Device endpoints
  REMOVE_DEVICE: "/devices/:deviceId",
  GET_DEVICES: "/devices",
  SET_ACTIVE_DEVICE: "/devices/active/:deviceId",
  LOGOUT_ALL_DEVICES: "/devices/logout-all",

  // Conversation endpoints
  GET_CONVERSATIONS: "/conversations",
  CREATE_CONVERSATION: "/conversations",
  CREATE_GROUP: "/conversations/group",
  UPDATE_GROUP: "/conversations/group",
  UPDATE_GROUP_IMAGE: "/conversations/group/image",
  ADD_PARTICIPANTS: "/conversations/group/participants",
  REMOVE_PARTICIPANT: "/conversations/group/participants",
  LEAVE_GROUP: "/conversations/group/leave",
  CHANGE_GROUP_ADMIN: "/conversations/group/admin",

  // Message endpoints
  SEND_MESSAGE: "/messages",
  GET_MESSAGES: "/messages",
  DELETE_MESSAGE: "/messages",
  MARK_AS_DELIVERED: "/messages/deliver",

  // Contact endpoints
  GET_CONTACTS: "/contact",
  ADD_CONTACT: "/contact",
  UPDATE_CONTACT: "/contact",
  DELETE_CONTACT: "/contact",
  BLOCK_CONTACT: "/contact/block",
  UNBLOCK_CONTACT: "/contact/unblock",
  GET_BLOCKED_CONTACTS: "/contact/blocked",

  // Call endpoints
  INITIATE_CALL: "/calls",
  UPDATE_CALL_STATUS: "/calls/status",
  GET_CALL_HISTORY: "/calls/history",
  GET_CALL_DETAILS: "/calls",
  DELETE_CALL: "/calls",

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

export { API_BASE_URL, API_ENDPOINTS, API_BASE_URL_FOR_MEDIA }
