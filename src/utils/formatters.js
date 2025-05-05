// Format date to readable string
export const formatDate = (date) => {
  const now = new Date()
  const messageDate = new Date(date)

  // Check if the message is from today
  if (
    messageDate.getDate() === now.getDate() &&
    messageDate.getMonth() === now.getMonth() &&
    messageDate.getFullYear() === now.getFullYear()
  ) {
    // Format as time only for today's messages
    return messageDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  // Check if the message is from yesterday
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (
    messageDate.getDate() === yesterday.getDate() &&
    messageDate.getMonth() === yesterday.getMonth() &&
    messageDate.getFullYear() === yesterday.getFullYear()
  ) {
    return "Yesterday"
  }

  // Check if the message is from this week
  const oneWeekAgo = new Date(now)
  oneWeekAgo.setDate(now.getDate() - 7)
  if (messageDate >= oneWeekAgo) {
    // Return day name
    return messageDate.toLocaleDateString([], { weekday: "long" })
  }

  // For older messages, return the date
  return messageDate.toLocaleDateString()
}

// Format time for messages
export const formatMessageTime = (date) => {
  const messageDate = new Date(date)
  return messageDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

// Format call duration
export const formatCallDuration = (seconds) => {
  if (!seconds) return "00:00"

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
}

// Format file size
export const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

// Format phone number
export const formatPhoneNumber = (phoneNumber) => {
  // This is a simple formatter, you might want to use a library for more complex formatting
  if (!phoneNumber) return ""

  // Remove any non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, "")

  // Format based on length and country code
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  } else if (cleaned.length > 10) {
    // Assume international number
    return `+${cleaned.slice(0, cleaned.length - 10)} (${cleaned.slice(-10, -7)}) ${cleaned.slice(-7, -4)}-${cleaned.slice(-4)}`
  }

  // Return as is if we can't format it
  return phoneNumber
}
