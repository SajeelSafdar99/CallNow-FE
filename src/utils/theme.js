// Theme colors for light and dark modes
export const lightTheme = {
  primary: "#128C7E",
  secondary: "#25D366",
  accent: "#34B7F1",
  background: "#FFFFFF",
  card: "#FFFFFF",
  text: "#000000",
  border: "#E0E0E0",
  notification: "#FF3B30",
  placeholder: "#9E9E9E",
  disabled: "#BDBDBD",
  inputBackground: "#F5F5F5",
  messageOutgoing: "#DCF8C6",
  messageIncoming: "#FFFFFF",
  chatBackground: "#E5DDD5",
  statusBar: "dark-content",
  tabBar: "#FFFFFF",
  tabBarInactive: "#9E9E9E",
  success: "#4CAF50",
  error: "#F44336",
  warning: "#FFC107",
  info: "#2196F3",
  shadow: "rgba(0, 0, 0, 0.1)",
  overlay: "rgba(0, 0, 0, 0.5)",
  callButton: "#128C7E",
  endCallButton: "#F44336", // Note: This is the same as error
  muteButton: "#FFFFFF",
  muteButtonBackground: "rgba(0, 0, 0, 0.5)",
}

export const darkTheme = {
  primary: "#128C7E",
  secondary: "#25D366",
  accent: "#34B7F1",
  background: "#121212",
  card: "#1E1E1E",
  text: "#FFFFFF",
  border: "#2C2C2C",
  notification: "#FF453A",
  placeholder: "#9E9E9E",
  disabled: "#666666",
  inputBackground: "#2C2C2C",
  messageOutgoing: "#005C4B",
  messageIncoming: "#1E1E1E",
  chatBackground: "#0E0E0E",
  statusBar: "light-content",
  tabBar: "#1E1E1E",
  tabBarInactive: "#9E9E9E",
  success: "#4CAF50",
  error: "#F44336",
  warning: "#FFC107",
  info: "#2196F3",
  shadow: "rgba(0, 0, 0, 0.3)",
  overlay: "rgba(0, 0, 0, 0.7)",
  callButton: "#128C7E",
  endCallButton: "#F44336", // Note: This is the same as error
  muteButton: "#FFFFFF",
  muteButtonBackground: "rgba(0, 0, 0, 0.7)",
}

// Get theme based on mode
export const getTheme = (mode) => {
  // Add a 'theme' property to distinguish later if needed
  if (mode === "dark") {
    return { ...darkTheme, theme: "dark" }
  }
  return { ...lightTheme, theme: "light" }
}

// Get style with theme (not used directly by GroupCallScreen/ParticipantView in this way)
export const getThemedStyles = (styles, theme) => {
  if (typeof styles === "function") {
    return styles(theme)
  }
  return styles
}
