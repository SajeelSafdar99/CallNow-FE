'use client';

import {createContext, useContext, useEffect, useState, useRef} from 'react';
import {AuthContext} from './AuthContext';
import {SOCKET_URL} from '../config/api'; // Import SOCKET_URL instead of API_BASE_URL
import {io} from 'socket.io-client';

export const SocketContext = createContext();

export const SocketProvider = ({children}) => {
  const {state: authState} = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [call, setCall] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [name, setName] = useState('');
  const [stream, setStream] = useState(null);
  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();

  useEffect(() => {
    let socketInstance = null;

    // Initialize socket when user is authenticated
    if (authState.isAuthenticated && authState.token && authState.user?.id) {
      console.log('Initializing socket connection...');

      try {
        // Create socket instance with proper configuration
        console.log('Attempting to connect to socket server at:', SOCKET_URL);
        socketInstance = io(SOCKET_URL, {
          auth: {
            token: authState.token,
            deviceId:
              authState.deviceId ||
              authState.user.deviceId ||
              authState.user.id,
          },
          transports: ['websocket'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          forceNew: true,
          path: '/socket.io/', // Add this back to ensure proper connection
        });

        // Connect socket
        socketInstance.connect();

        socketInstance.on('connect', () => {
          console.log('Socket connected:', socketInstance.id);
          setIsConnected(true);
        });

        socketInstance.on('connect_error', error => {
          console.error('Socket connection error:', error.message);
          setIsConnected(false);
        });

        socketInstance.on('disconnect', reason => {
          console.log('Socket disconnected:', reason);
          setIsConnected(false);
        });

        // Add additional socket event listeners for call functionality
        socketInstance.on('incoming-call', callData => {
          console.log('Incoming call:', callData);
          // This event will be handled in the CallScreen component
        });

        socketInstance.on('call-answered', callData => {
          console.log('Call accepted:', callData);
          // This event will be handled in the CallScreen component
        });

        socketInstance.on('call-rejected', callData => {
          console.log('Call rejected:', callData);
          // This event will be handled in the CallScreen component
        });

        socketInstance.on('call-ended', callData => {
          console.log('Call ended:', callData);
          // This event will be handled in the CallScreen component
        });

        socketInstance.on('ice-candidate', data => {
          console.log('Received ICE candidate');
          // This event will be handled in the CallScreen component
        });

        // Message related events
        socketInstance.on('receive-message', message => {
          console.log('Received new message:', message.contentType);
          setMessages(prevMessages => [...prevMessages, message]);
        });

        socketInstance.on('message-read', data => {
          console.log('Message read:', data.messageId);
          // This event will be handled in the ChatScreen component
        });

        socketInstance.on('message-delivered', data => {
          console.log('Message delivered:', data.messageId);
          // This event will be handled in the ChatScreen component
        });

        socketInstance.on('user-typing', data => {
          console.log('User typing:', data.userId);
          // This event will be handled in the ChatScreen component
        });

        socketInstance.on('user-stop-typing', data => {
          console.log('User stopped typing:', data.userId);
          // This event will be handled in the ChatScreen component
        });

        socketInstance.on('user-status-change', data => {
          console.log('User status changed:', data.userId, data.status);
          // This event will be handled in the ChatScreen component
        });

        // Group call events
        socketInstance.on('group-call-offer', data => {
          console.log('Group call offer received');
          // This event will be handled in the GroupCallScreen component
        });

        socketInstance.on('group-call-answer', data => {
          console.log('Group call answer received');
          // This event will be handled in the GroupCallScreen component
        });

        socketInstance.on('group-call-ice-candidate', data => {
          console.log('Group call ICE candidate received');
          // This event will be handled in the GroupCallScreen component
        });

        socketInstance.on('group-call-user-joined', data => {
          console.log('User joined group call:', data.user);
          // This event will be handled in the GroupCallScreen component
        });

        socketInstance.on('group-call-user-left', data => {
          console.log('User left group call:', data.userId);
          // This event will be handled in the GroupCallScreen component
        });

        socketInstance.on('group-call-screen-sharing', data => {
          console.log(
            'Screen sharing status changed:',
            data.userId,
            data.isSharing,
          );
          // This event will be handled in the GroupCallScreen component
        });

        socketInstance.on('call-quality-issue', data => {
          console.log('Call quality issue:', data.issueType);
          // This event will be handled in the CallScreen component
        });

        socketInstance.on('network-fallback', data => {
          console.log('Network fallback:', data.fallbackType);
          // This event will be handled in the CallScreen component
        });

        socketInstance.on('ice-restart-needed', data => {
          console.log('ICE restart needed for call:', data.callId);
          // This event will be handled in the CallScreen component
        });

        // Enhanced call notification events
        socketInstance.on('incoming-call-notification', callData => {
          console.log('Incoming call notification:', callData);
          // This should trigger navigation to CallScreen for incoming calls
          // You'll need to implement this based on your navigation structure
        });

        socketInstance.on('user-status-response', data => {
          console.log('User status response:', data);
          // This will be handled by the CallScreen component
        });

        socketInstance.on('receiver-came-online', data => {
          console.log('Receiver came online:', data);
          // This will be handled by the CallScreen component
        });

        socketInstance.on('call-push-notification', data => {
          console.log('Call push notification data:', data);
          // Handle push notification for calls when app is in background
        });

        setSocket(socketInstance);
      } catch (error) {
        console.error('Error initializing socket:', error);
      }
    }

    // Cleanup on unmount or when auth state changes
    return () => {
      if (socketInstance) {
        console.log('Cleaning up socket connection');
        socketInstance.disconnect();

        // Remove all listeners
        socketInstance.off('connect');
        socketInstance.off('connect_error');
        socketInstance.off('disconnect');
        socketInstance.off('incoming-call');
        socketInstance.off('call-answered');
        socketInstance.off('call-rejected');
        socketInstance.off('call-ended');
        socketInstance.off('ice-candidate');
        socketInstance.off('receive-message');
        socketInstance.off('message-read');
        socketInstance.off('message-delivered');
        socketInstance.off('user-typing');
        socketInstance.off('user-stop-typing');
        socketInstance.off('user-status-change');
        socketInstance.off('group-call-offer');
        socketInstance.off('group-call-answer');
        socketInstance.off('group-call-ice-candidate');
        socketInstance.off('group-call-user-joined');
        socketInstance.off('group-call-user-left');
        socketInstance.off('group-call-screen-sharing');
        socketInstance.off('call-quality-issue');
        socketInstance.off('network-fallback');
        socketInstance.off('ice-restart-needed');
        socketInstance.off('incoming-call-notification');
        socketInstance.off('user-status-response');
        socketInstance.off('receiver-came-online');
        setSocket(null);
        setIsConnected(false);
      }
    };
  }, [
    authState.isAuthenticated,
    authState.token,
    authState.user?.id,
    authState.deviceId,
  ]);

  // Socket event handlers
  const joinConversation = conversationId => {
    if (socket && isConnected) {
      socket.emit('join-conversation', conversationId);
    }
  };

  const leaveConversation = conversationId => {
    if (socket && isConnected) {
      socket.emit('leave-conversation', conversationId);
    }
  };

  const sendMessage = message => {
    if (socket && isConnected) {
      socket.emit('send-message', message);
    }
  };

  const markAsRead = (messageId, conversationId, userId) => {
    if (socket && isConnected) {
      socket.emit('read-message', {messageId, conversationId, userId});
    }
  };

  const markAsDelivered = (messageId, conversationId, userId) => {
    if (socket && isConnected) {
      socket.emit('deliver-message', {messageId, conversationId, userId});
    }
  };

  const setTyping = (conversationId, userId) => {
    if (socket && isConnected) {
      // Send typing event to server
      socket.emit('typing', {conversationId, userId});

      // Log for debugging
      console.log(
        `Emitting typing event for user ${userId} in conversation ${conversationId}`,
      );
    }
  };

  const setStopTyping = (conversationId, userId) => {
    if (socket && isConnected) {
      // Send stop typing event to server
      socket.emit('stop-typing', {conversationId, userId});

      // Log for debugging
      console.log(
        `Emitting stop-typing event for user ${userId} in conversation ${conversationId}`,
      );
    }
  };

  const setOnlineStatus = status => {
    if (socket && isConnected) {
      socket.emit('set-online-status', {status});
    }
  };

  // Call-related socket events
  const initiateCall = callData => {
    if (socket && isConnected) {
      socket.emit('call-offer', callData);
    }
  };

  const acceptCall = (callId, callerId, answer) => {
    if (socket && isConnected) {
      socket.emit('call-answer', {callId, callerId, answer});
    }
  };

  const rejectCall = (callId, callerId) => {
    if (socket && isConnected) {
      socket.emit('reject-call', {callId, callerId});
    }
  };

  const endCall = (callId, recipientId) => {
    if (socket && isConnected) {
      socket.emit('end-call', {callId, recipientId});
    }
  };

  // ICE candidate exchange for WebRTC
  const sendIceCandidate = (callId, candidate, recipientId) => {
    if (socket && isConnected) {
      socket.emit('ice-candidate', {callId, candidate, recipientId});
    }
  };

  // Group call methods
  const joinGroupCall = groupCallId => {
    if (socket && isConnected) {
      socket.emit('join-group-call', groupCallId);
    }
  };

  const leaveGroupCall = groupCallId => {
    if (socket && isConnected) {
      socket.emit('leave-group-call', groupCallId);
    }
  };

  const sendGroupCallOffer = (groupCallId, receiverId, offer, connectionId) => {
    if (socket && isConnected) {
      socket.emit('group-call-offer', {
        groupCallId,
        receiverId,
        offer,
        connectionId,
      });
    }
  };

  const sendGroupCallAnswer = (
    groupCallId,
    receiverId,
    answer,
    connectionId,
  ) => {
    if (socket && isConnected) {
      socket.emit('group-call-answer', {
        groupCallId,
        receiverId,
        answer,
        connectionId,
      });
    }
  };

  const sendGroupCallIceCandidate = (
    groupCallId,
    receiverId,
    candidate,
    connectionId,
  ) => {
    if (socket && isConnected) {
      socket.emit('group-call-ice-candidate', {
        groupCallId,
        receiverId,
        candidate,
        connectionId,
      });
    }
  };

  const notifyGroupCallUserJoined = (groupCallId, user) => {
    if (socket && isConnected) {
      socket.emit('group-call-user-joined', {groupCallId, user});
    }
  };

  const notifyGroupCallUserLeft = (groupCallId, userId) => {
    if (socket && isConnected) {
      socket.emit('group-call-user-left', {groupCallId, userId});
    }
  };

  const setGroupCallScreenSharing = (groupCallId, isSharing) => {
    if (socket && isConnected) {
      socket.emit('group-call-screen-sharing', {groupCallId, isSharing});
    }
  };

  // Call quality metrics
  const sendCallQualityMetrics = (callId, callType, metrics) => {
    if (socket && isConnected) {
      socket.emit('call-quality-metrics', {callId, callType, metrics});
    }
  };

  // Network fallback
  const sendNetworkFallback = (callId, callType, fallbackType, recipientId) => {
    if (socket && isConnected) {
      socket.emit('network-fallback', {
        callId,
        callType,
        fallbackType,
        recipientId,
      });
    }
  };

  // ICE restart request
  const requestIceRestart = (callId, callType, recipientId) => {
    if (socket && isConnected) {
      socket.emit('ice-restart-request', {callId, callType, recipientId});
    }
  };
  // Enhanced call management functions
  const checkUserStatus = userId => {
    if (socket && isConnected) {
      socket.emit('check-user-status', {userId});
    }
  };

  const notifyUserCameOnline = (callId, activeDevice) => {
    if (socket && isConnected) {
      socket.emit('user-came-online', {callId, activeDevice});
    }
  };

  const sendCallPushNotification = (receiverId, callData) => {
    if (socket && isConnected) {
      socket.emit('send-call-push-notification', {receiverId, callData});
    }
  };
  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        onlineUsers,
        messages,
        sendMessage,
        markAsRead,
        markAsDelivered,
        setTyping,
        setStopTyping,
        setOnlineStatus,
        initiateCall,
        acceptCall,
        rejectCall,
        endCall,
        sendIceCandidate,
        joinGroupCall,
        leaveGroupCall,
        sendGroupCallOffer,
        sendGroupCallAnswer,
        sendGroupCallIceCandidate,
        notifyGroupCallUserJoined,
        notifyGroupCallUserLeft,
        setGroupCallScreenSharing,
        sendCallQualityMetrics,
        sendNetworkFallback,
        requestIceRestart,
        checkUserStatus,
        notifyUserCameOnline,
        sendCallPushNotification,
        call,
        setCall,
        callAccepted,
        setCallAccepted,
        callEnded,
        setCallEnded,
        name,
        setName,
        stream,
        setStream,
        myVideo,
        userVideo,
        connectionRef,
        joinConversation,
        leaveConversation,
      }}>
      {children}
    </SocketContext.Provider>
  );
};
