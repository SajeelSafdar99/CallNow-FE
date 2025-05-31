// Helper function to create a mediaItems array from a single media message
export const createMediaItemsArray = (message) => {
  // If the message already has mediaItems, return it as is
  if (message.mediaItems && message.mediaItems.length > 0) {
    console.log("Using existing mediaItems:", message.mediaItems.length)
    return message.mediaItems
  }

  // If the message is a media message (image or video), create a mediaItems array
  if (message.contentType === "image" || message.contentType === "video") {
    console.log("Creating mediaItems array for single media message")

    // Check if this message is part of a conversation with other media messages
    // This is a placeholder - in a real implementation, you would need to
    // get related media messages from your message store or context

    // For now, just return the single media item
    return [
      {
        contentType: message.contentType,
        mediaUrl: message.mediaUrl,
        mediaName: message.mediaName || "",
        messageId: message._id, // Store the message ID for reference
      },
    ]
  }

  // For non-media messages, return empty array
  console.log("No media items for this message type:", message.contentType)
  return []
}

// Add a new function to collect media items from multiple messages
export const collectMediaItemsFromMessages = (messages, currentMessageId) => {
  const mediaItems = []
  let initialIndex = 0
  const currentIndex = 0

  if (!messages || !Array.isArray(messages)) {
    return { mediaItems, initialIndex }
  }

  messages.forEach((message, index) => {
    if (message.contentType === "image" || message.contentType === "video") {
      // If this is the current message, store its index
      if (message._id === currentMessageId) {
        initialIndex = mediaItems.length
      }

      mediaItems.push({
        contentType: message.contentType,
        mediaUrl: message.mediaUrl,
        mediaName: message.mediaName || "",
        messageId: message._id,
      })
    } else if (message.mediaItems && message.mediaItems.length > 0) {
      // If the message already has mediaItems, add them
      if (message._id === currentMessageId) {
        initialIndex = mediaItems.length
      }

      mediaItems.push(...message.mediaItems)
    }
  })

  return { mediaItems, initialIndex }
}

