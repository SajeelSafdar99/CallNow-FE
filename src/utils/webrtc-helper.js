// WebRTC helper functions for call handling

// Initialize a new RTCPeerConnection with ICE servers
export const createPeerConnection = (iceServers) => {
  try {
    const configuration = {
      iceServers: iceServers || [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
      iceCandidatePoolSize: 10,
    }

    return new RTCPeerConnection(configuration)
  } catch (error) {
    console.error("Error creating peer connection:", error)
    return null
  }
}

// Create an offer
export const createOffer = async (peerConnection) => {
  try {
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    })
    await peerConnection.setLocalDescription(offer)
    return offer
  } catch (error) {
    console.error("Error creating offer:", error)
    throw error
  }
}

// Create an answer
export const createAnswer = async (peerConnection, offer) => {
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)
    return answer
  } catch (error) {
    console.error("Error creating answer:", error)
    throw error
  }
}

// Add ICE candidate
export const addIceCandidate = async (peerConnection, candidate) => {
  try {
    if (candidate) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
    }
  } catch (error) {
    console.error("Error adding ICE candidate:", error)
  }
}

// Get user media (audio/video)
export const getUserMedia = async (constraints) => {
  try {
    return await navigator.mediaDevices.getUserMedia(constraints)
  } catch (error) {
    console.error("Error getting user media:", error)
    throw error
  }
}

// Add tracks to peer connection
export const addTracksToConnection = (peerConnection, stream) => {
  try {
    stream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, stream)
    })
  } catch (error) {
    console.error("Error adding tracks to connection:", error)
  }
}

// Get display media (screen sharing)
export const getDisplayMedia = async () => {
  try {
    return await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: "always",
        displaySurface: "monitor",
      },
      audio: false,
    })
  } catch (error) {
    console.error("Error getting display media:", error)
    throw error
  }
}

// Replace video track (for toggling camera or screen sharing)
export const replaceTrack = (peerConnection, oldTrack, newTrack) => {
  try {
    const senders = peerConnection.getSenders()
    const sender = senders.find((s) => s.track && s.track.kind === newTrack.kind)
    if (sender) {
      sender.replaceTrack(newTrack)
    }
  } catch (error) {
    console.error("Error replacing track:", error)
  }
}

// Collect and monitor call quality metrics
export const collectCallMetrics = async (peerConnection) => {
  try {
    const stats = await peerConnection.getStats()
    const metrics = {
      timestamp: Date.now(),
      rtt: null,
      jitter: null,
      packetLoss: null,
      frameRate: null,
      bitrate: {
        audio: null,
        video: null,
      },
      qualityScore: {
        audio: null,
        video: null,
      },
      connectionType: null,
      iceConnectionState: peerConnection.iceConnectionState,
    }

    const bytesReceivedPrev = {
      audio: 0,
      video: 0,
    }

    const lastTimestamp = {
      audio: 0,
      video: 0,
    }

    stats.forEach((report) => {
      if (report.type === "inbound-rtp" && report.kind === "audio") {
        metrics.jitter = report.jitter ? Math.round(report.jitter * 1000) : null // Convert to ms

        if (report.packetsLost !== undefined && report.packetsReceived !== undefined) {
          const totalPackets = report.packetsLost + report.packetsReceived
          metrics.packetLoss = totalPackets > 0 ? Math.round((report.packetsLost / totalPackets) * 100) : 0
        }

        // Calculate audio bitrate
        if (report.bytesReceived && report.timestamp) {
          const bytesReceived = report.bytesReceived
          const timeDiff = report.timestamp - lastTimestamp.audio

          if (lastTimestamp.audio > 0 && timeDiff > 0) {
            const bytesReceivedDiff = bytesReceived - bytesReceivedPrev.audio
            metrics.bitrate.audio = Math.round((bytesReceivedDiff * 8) / (timeDiff / 1000)) // bps
          }

          bytesReceivedPrev.audio = bytesReceived
          lastTimestamp.audio = report.timestamp
        }

        // Estimate audio quality (simplified)
        if (metrics.jitter !== null && metrics.packetLoss !== null) {
          // Higher score is better (0-100)
          const jitterScore = Math.max(0, 100 - metrics.jitter)
          const packetLossScore = Math.max(0, 100 - metrics.packetLoss * 10)
          metrics.qualityScore.audio = Math.round((jitterScore + packetLossScore) / 2)
        }
      }

      if (report.type === "inbound-rtp" && report.kind === "video") {
        metrics.frameRate = report.framesPerSecond

        if (report.packetsLost !== undefined && report.packetsReceived !== undefined) {
          const totalPackets = report.packetsLost + report.packetsReceived
          metrics.packetLoss = totalPackets > 0 ? Math.round((report.packetsLost / totalPackets) * 100) : 0
        }

        // Calculate video bitrate
        if (report.bytesReceived && report.timestamp) {
          const bytesReceived = report.bytesReceived
          const timeDiff = report.timestamp - lastTimestamp.video

          if (lastTimestamp.video > 0 && timeDiff > 0) {
            const bytesReceivedDiff = bytesReceived - bytesReceivedPrev.video
            metrics.bitrate.video = Math.round((bytesReceivedDiff * 8) / (timeDiff / 1000)) // bps
          }

          bytesReceivedPrev.video = bytesReceived
          lastTimestamp.video = report.timestamp
        }

        // Estimate video quality (simplified)
        if (metrics.frameRate !== null && metrics.packetLoss !== null) {
          // Higher score is better (0-100)
          const frameRateScore = Math.min(100, metrics.frameRate * 3) // Assuming 30fps is excellent
          const packetLossScore = Math.max(0, 100 - metrics.packetLoss * 10)
          metrics.qualityScore.video = Math.round((frameRateScore + packetLossScore) / 2)
        }
      }

      if (report.type === "candidate-pair" && report.state === "succeeded") {
        metrics.rtt = report.currentRoundTripTime ? Math.round(report.currentRoundTripTime * 1000) : null // Convert to ms
      }

      if (report.type === "local-candidate") {
        metrics.connectionType = report.networkType || null
      }
    })

    return metrics
  } catch (error) {
    console.error("Error collecting call metrics:", error)
    return {
      timestamp: Date.now(),
      error: error.message,
    }
  }
}

// Start periodic call quality monitoring
export const startCallQualityMonitoring = (peerConnection, callId, callType, token, interval = 10000) => {
  const monitoringInterval = setInterval(async () => {
    try {
      const metrics = await collectCallMetrics(peerConnection)

      // Log metrics to backend
      const metricsData = {
        callId,
        callType,
        metrics,
      }

      // Import dynamically to avoid circular dependencies
      const CallsAPI = require("../api/calls")
      await CallsAPI.logCallMetrics(metricsData, token)

      // Log locally for debugging
      console.log("Call quality metrics:", metrics)
    } catch (error) {
      console.error("Error monitoring call quality:", error)
    }
  }, interval)

  return monitoringInterval
}

// Stop call quality monitoring
export const stopCallQualityMonitoring = (monitoringInterval) => {
  if (monitoringInterval) {
    clearInterval(monitoringInterval)
  }
}

// Clean up WebRTC resources
export const cleanupWebRTC = (peerConnection, localStream, remoteStream) => {
  try {
    if (peerConnection) {
      peerConnection.close()
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.stop()
      })
    }

    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => {
        track.stop()
      })
    }
  } catch (error) {
    console.error("Error cleaning up WebRTC resources:", error)
  }
}

// Detect network region (simplified)
export const detectNetworkRegion = async () => {
  try {
    // This is a simplified approach. In production, you would use a geolocation API
    const response = await fetch("https://ipinfo.io/json")
    const data = await response.json()
    return data.country || "global"
  } catch (error) {
    console.error("Error detecting network region:", error)
    return "global"
  }
}

// Get optimal ICE servers based on region
export const getOptimalIceServers = async (token) => {
  try {
    const region = await detectNetworkRegion()

    // Import dynamically to avoid circular dependencies
    const CallsAPI = require("../api/calls")
    const response = await CallsAPI.getIceServers(token, { region })

    if (response.success && response.iceServers && response.iceServers.length > 0) {
      return response.iceServers
    }

    // Fallback to default STUN servers
    return [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
    ]
  } catch (error) {
    console.error("Error getting optimal ICE servers:", error)
    // Fallback to default STUN servers
    return [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
    ]
  }
}
