"use client"

import { useState, useEffect, useContext, useRef, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  Dimensions,
  StatusBar,
  BackHandler,
  PermissionsAndroid,
} from "react-native"
import Ionicons from "react-native-vector-icons/Ionicons"
import { useNavigation, useRoute, useIsFocused } from "@react-navigation/native"
import { mediaDevices } from "react-native-webrtc"

import { AuthContext } from "../../context/AuthContext"
import { SocketContext } from "../../context/SocketContext"
import { ThemeContext } from "../../context/ThemeContext"
import { getTheme } from "../../utils/theme"
import ParticipantView from "../../components/group-call/participant-view"
import * as CallLogAPI from "../../api/call-log"
import * as GroupCallAPI from "../../api/group-calls"
import AudioManager from "../../utils/audio-manager"

const { width } = Dimensions.get("window")
const LOG_PREFIX = "[GroupCallScreen]"

const GroupCallScreen = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const isScreenFocused = useIsFocused()

  const {
    groupCallId,
    conversationId: originalConversationId,
    conversationName,
    callType = "video",
    initiatorId,
    isIncoming,
    callAcceptedFromModal,
  } = route.params

  const { state: authState } = useContext(AuthContext)
  const { theme: themeMode } = useContext(ThemeContext) || { theme: "light" }
  const currentTheme = getTheme(themeMode)
  const styles = getStyles(currentTheme)

  const { socket, isConnected, joinGroupCall, leaveGroupCall, groupParticipants, toggleGroupMute, toggleGroupVideo } =
    useContext(SocketContext)

  const [callState, setCallState] = useState("initializing")
  const [isLocalMutedByUI, setIsLocalMutedByUI] = useState(false)
  const [isLocalVideoEnabledByUI, setIsLocalVideoEnabledByUI] = useState(callType === "video")
  const [isSpeakerOn, setIsSpeakerOn] = useState(callType === "video")

  const [callDuration, setCallDuration] = useState(0)
  const [participantsForUI, setParticipantsForUI] = useState([])

  const callTimerRef = useRef(null)
  const isCallEndingRef = useRef(false)
  const hasJoinedCallRef = useRef(false)
  const localMediaStreamRef = useRef(null)
  const callDurationRef = useRef(0)
  const isPreAcceptedCallRef = useRef(callAcceptedFromModal || false)

  useEffect(() => {
    callDurationRef.current = callDuration
  }, [callDuration])

  useEffect(() => {
    const newParticipantsList = []
    const selfId = authState.user?.id

    const selfDataFromContext = groupParticipants.get(selfId)
    if (selfDataFromContext && selfDataFromContext.isLocal) {
      newParticipantsList.push({
        ...selfDataFromContext,
        isMuted: selfDataFromContext.isMuted,
        isVideoEnabled: selfDataFromContext.isVideoEnabled,
      })
      setIsLocalMutedByUI(selfDataFromContext.isMuted)
      setIsLocalVideoEnabledByUI(selfDataFromContext.isVideoEnabled)
    } else if (localMediaStreamRef.current && selfId && !newParticipantsList.some((p) => p.id === selfId)) {
      const audioTracks = localMediaStreamRef.current.getAudioTracks()
      const videoTracks = localMediaStreamRef.current.getVideoTracks()
      newParticipantsList.push({
        id: selfId,
        userId: selfId,
        name: authState.user?.name || "You",
        profilePicture: authState.user?.profilePicture,
        stream: localMediaStreamRef.current,
        isLocal: true,
        isMuted: audioTracks.length > 0 ? !audioTracks[0].enabled : isLocalMutedByUI,
        isVideoEnabled: videoTracks.length > 0 ? videoTracks[0].enabled : isLocalVideoEnabledByUI,
      })
    }

    groupParticipants.forEach((p) => {
      if (p.userId !== selfId) {
        newParticipantsList.push({ ...p, id: p.userId, isLocal: false })
      }
    })
    setParticipantsForUI(newParticipantsList)
  }, [
    groupParticipants,
    authState.user?.id,
    authState.user?.name,
    authState.user?.profilePicture,
    isLocalMutedByUI,
    isLocalVideoEnabledByUI,
  ])

  const requestMediaPermissions = useCallback(async () => {
    if (Platform.OS === "android") {
      try {
        const permissionsToRequest = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO]
        if (callType === "video") {
          permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.CAMERA)
        }
        const statuses = await PermissionsAndroid.requestMultiple(permissionsToRequest)
        const audioGranted =
          statuses[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED
        const cameraGranted =
          callType === "video"
            ? statuses[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED
            : true
        if (!(audioGranted && cameraGranted)) {
          console.warn(
            `${LOG_PREFIX} Media permissions not fully granted. Audio: ${audioGranted}, Camera: ${cameraGranted}`,
          )
        }
        return audioGranted && cameraGranted
      } catch (err) {
        console.error(`${LOG_PREFIX} Error requesting Android permissions:`, err)
        return false
      }
    }
    return true
  }, [callType])

  const setupLocalMedia = useCallback(async () => {
    try {
      const constraints = {
        audio: true,
        video: callType === "video" ? { facingMode: "user", width: 320, height: 240, frameRate: 15 } : false,
      }
      const stream = await mediaDevices.getUserMedia(constraints)
      localMediaStreamRef.current = stream
      return stream
    } catch (error) {
      console.error(`${LOG_PREFIX} Error getting user media:`, error)
      Alert.alert("Media Error", "Failed to access camera or microphone. Please check permissions and try again.")
      throw error
    }
  }, [callType])

  const endCallHandler = useCallback(
    async (reason = "user_ended") => {
      if (isCallEndingRef.current) return
      isCallEndingRef.current = true
      setCallState("ended")
      if (callTimerRef.current) clearInterval(callTimerRef.current)

      leaveGroupCall()

      if (localMediaStreamRef.current) {
        localMediaStreamRef.current.getTracks().forEach((track) => track.stop())
        localMediaStreamRef.current = null
      }

      if (groupCallId) {
        const isInitiatorManuallyEnding = reason === "user_ended_manually" && authState.user?.id === initiatorId
        if (isInitiatorManuallyEnding) {
          GroupCallAPI.endGroupCall(groupCallId).catch((apiError) =>
            console.error(`${LOG_PREFIX} API error during endGroupCall:`, apiError),
          )
        } else {
          GroupCallAPI.leaveGroupCall(groupCallId).catch((apiError) =>
            console.error(`${LOG_PREFIX} API error during leaveGroupCall:`, apiError),
          )
        }
      }

      AudioManager.cleanup()

      if (groupCallId && authState.token) {
        try {
          await CallLogAPI.logCallEvent(authState.token, groupCallId, "group", "group_call_ended", {
            duration: callDurationRef.current,
            reason,
            conversationId: originalConversationId,
          })
        } catch (apiError) {
          console.error(`${LOG_PREFIX} API error during call end logging:`, apiError)
        }
      }

      setTimeout(() => {
        if (navigation.canGoBack()) {
          navigation.goBack()
        } else {
          navigation.replace("Main", { screen: "Chats" })
        }
      }, 300)
    },
    [leaveGroupCall, navigation, groupCallId, authState.token, authState.user?.id, originalConversationId, initiatorId],
  )

  useEffect(() => {
    let isMounted = true

    const initializeCall = async () => {
      if (
        !isScreenFocused ||
        hasJoinedCallRef.current ||
        !isConnected ||
        !socket ||
        !groupCallId ||
        isCallEndingRef.current
      ) {
        if (!groupCallId) console.error(`${LOG_PREFIX} CRITICAL: groupCallId is missing in route params!`)
        return
      }

      isCallEndingRef.current = false
      hasJoinedCallRef.current = false
      setCallState("connecting")

      try {
        const permissionsGranted = await requestMediaPermissions()
        if (!isMounted || !permissionsGranted) {
          if (isMounted) endCallHandler("permissions_denied")
          return
        }

        await AudioManager.initializeAudioSession(
          callType === "video",
          isIncoming || false,
          isPreAcceptedCallRef.current,
        )
        await AudioManager.setSpeakerOn(isSpeakerOn)
        if (!isMounted) return

        const stream = await setupLocalMedia()
        if (!isMounted || !stream) {
          if (isMounted) endCallHandler("media_setup_failed")
          return
        }

        joinGroupCall(groupCallId, stream)
        hasJoinedCallRef.current = true

        if (isPreAcceptedCallRef.current || isIncoming) {
          await AudioManager.stopRingtone()
        }

        setCallState("ongoing")

        if (callTimerRef.current) clearInterval(callTimerRef.current)
        setCallDuration(0)
        callDurationRef.current = 0
        callTimerRef.current = setInterval(() => setCallDuration((prev) => prev + 1), 1000)

        if (isMounted && authState.token && groupCallId) {
          CallLogAPI.logCallEvent(authState.token, groupCallId, "group", "group_call_started", {
            callType,
            conversationId: originalConversationId,
          }).catch((e) => console.error(`${LOG_PREFIX} Log API Error for group_call_started`, e))
        }
      } catch (error) {
        console.error(`${LOG_PREFIX} Error during call initialization:`, error)
        if (isMounted) endCallHandler("setup_failed")
      }
    }

    initializeCall()

    return () => {
      isMounted = false
      if (callTimerRef.current) clearInterval(callTimerRef.current)
      if (hasJoinedCallRef.current && !isCallEndingRef.current) {
        endCallHandler("unmount_unexpected")
      } else if (!hasJoinedCallRef.current && localMediaStreamRef.current) {
        localMediaStreamRef.current.getTracks().forEach((track) => track.stop())
        localMediaStreamRef.current = null
      }
    }
  }, [
    isScreenFocused,
    isConnected,
    socket,
    groupCallId,
    callType,
    originalConversationId,
    requestMediaPermissions,
    setupLocalMedia,
    joinGroupCall,
    endCallHandler,
    authState.token,
    isIncoming,
    // isSpeakerOn, // Removed from dependencies
  ])

  useEffect(() => {
    if (callState === "ongoing" && hasJoinedCallRef.current) {
      AudioManager.setSpeakerOn(isSpeakerOn).catch((error) =>
        console.error(`${LOG_PREFIX} Error setting speaker state in useEffect:`, error),
      )
    }
  }, [isSpeakerOn, callState])

  useEffect(() => {
    const onBackPress = () => {
      if (callState === "ongoing" || callState === "connecting") {
        Alert.alert("End Call?", "Leaving this screen will end the group call.", [
          { text: "Cancel", style: "cancel", onPress: () => {} },
          { text: "End Call", style: "destructive", onPress: () => endCallHandler("user_left_via_back") },
        ])
        return true
      }
      return false
    }
    const backHandlerSubscription = BackHandler.addEventListener("hardwareBackPress", onBackPress)
    return () => backHandlerSubscription.remove()
  }, [callState, endCallHandler])

  const handleToggleMute = () => toggleGroupMute()
  const handleToggleVideo = () => toggleGroupVideo()

  const handleToggleSpeaker = async () => {
    const newSpeakerState = !isSpeakerOn
    setIsSpeakerOn(newSpeakerState)
    if (groupCallId && authState.token) {
      CallLogAPI.logCallEvent(
        authState.token,
        groupCallId,
        "group",
        newSpeakerState ? "speaker_on" : "speaker_off",
      ).catch((e) => console.error(`${LOG_PREFIX} Log API Error for speaker toggle`, e))
    }
  }

  const formatCallDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const renderContent = () => {
    if (callState === "initializing" || (callState === "connecting" && participantsForUI.length === 0)) {
      return (
        <View style={styles.centeredStatus}>
          <ActivityIndicator size="large" color={currentTheme.text} />
          <Text style={styles.statusText}>
            {callState === "initializing" ? "Initializing Call..." : "Connecting..."}
          </Text>
        </View>
      )
    }

    const numColumns = participantsForUI.length > 4 ? 3 : participantsForUI.length > 1 ? 2 : 1
    const itemDimension =
      width / numColumns -
      (numColumns > 1 ? (styles.gridSpacing * (numColumns - 1)) / numColumns : 0) -
      styles.gridSpacing

    return (
      <FlatList
        data={participantsForUI}
        renderItem={({ item }) => (
          <View style={{ width: itemDimension, height: itemDimension, margin: styles.gridSpacing / 2 }}>
            <ParticipantView
              participant={item}
              stream={item.stream}
              isLocal={item.isLocal || false}
              callType={callType}
              theme={currentTheme}
            />
          </View>
        )}
        keyExtractor={(item) => item.id + (item.socketId || "") + (item.isLocal ? "-local" : "-remote")}
        numColumns={numColumns}
        key={numColumns.toString()}
        contentContainerStyle={styles.participantsGridContent}
        style={styles.participantsGrid}
        extraData={`${participantsForUI.length}_${numColumns}_${currentTheme.theme}`}
      />
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={currentTheme.statusBar} backgroundColor={currentTheme.background} />
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {conversationName || "Group Call"}
        </Text>
        {callState === "ongoing" && <Text style={styles.durationText}>{formatCallDuration(callDuration)}</Text>}
      </View>
      <View style={styles.callContentContainer}>{renderContent()}</View>
      {(callState === "ongoing" || callState === "connecting") && (
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={[styles.controlButton, isLocalMutedByUI && styles.activeControlButton]}
            onPress={handleToggleMute}
          >
            <Ionicons name={isLocalMutedByUI ? "mic-off-outline" : "mic-outline"} size={28} color={currentTheme.text} />
          </TouchableOpacity>
          {callType === "video" && (
            <TouchableOpacity
              style={[styles.controlButton, !isLocalVideoEnabledByUI && styles.activeControlButton]}
              onPress={handleToggleVideo}
            >
              <Ionicons
                name={isLocalVideoEnabledByUI ? "videocam-outline" : "videocam-off-outline"}
                size={28}
                color={currentTheme.text}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.controlButton, isSpeakerOn && styles.activeControlButton]}
            onPress={handleToggleSpeaker}
          >
            <Ionicons
              name={isSpeakerOn ? "volume-high-outline" : "volume-medium-outline"}
              size={28}
              color={currentTheme.text}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlButton, styles.endCallButton]}
            onPress={() => endCallHandler("user_ended_manually")}
          >
            <Ionicons name="call" size={28} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  )
}

const getStyles = (theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      alignItems: "center",
      borderBottomWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.text,
    },
    durationText: {
      fontSize: 14,
      marginTop: 4,
      color: theme.text,
    },
    callContentContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.background,
    },
    centeredStatus: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    statusText: {
      marginTop: 12,
      fontSize: 16,
      color: theme.text,
    },
    participantsGrid: {
      flex: 1,
      width: "100%",
    },
    participantsGridContent: {
      flexGrow: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: width * 0.01,
    },
    gridSpacing: width * 0.02,
    controlsContainer: {
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "center",
      paddingVertical: Platform.OS === "ios" ? 20 : 15,
      paddingHorizontal: 20,
      borderTopWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    controlButton: {
      alignItems: "center",
      justifyContent: "center",
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.card,
      marginHorizontal: 8,
      elevation: 2,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 1.41,
    },
    activeControlButton: {
      backgroundColor: theme.primary,
    },
    endCallButton: {
      backgroundColor: theme.error,
    },
  })

export default GroupCallScreen
