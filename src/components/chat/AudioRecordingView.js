import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const AudioRecordingView = ({ duration, onCancel, onSend, theme }) => {
  // Animation values
  const waveformAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;

  // Start animations when component mounts
  useEffect(() => {
    // Waveform animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(waveformAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(waveformAnimation, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
          easing: Easing.inOut(Easing.ease),
        }),
      ])
    ).start();

    // Pulse animation for recording indicator
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.2,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ])
    ).start();

    return () => {
      waveformAnimation.stopAnimation();
      pulseAnimation.stopAnimation();
    };
  }, []);

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Generate waveform bars
  const renderWaveform = () => {
    const bars = [];
    const barCount = 20;

    for (let i = 0; i < barCount; i++) {
      const randomHeight = Math.random();
      const animatedHeight = waveformAnimation.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [
          0.3 + randomHeight * 0.3,
          0.5 + randomHeight * 0.5,
          0.3 + randomHeight * 0.3
        ],
      });

      bars.push(
        <Animated.View
          key={i}
          style={[
            styles.waveformBar,
            {
              height: animatedHeight.interpolate({
                inputRange: [0, 1],
                outputRange: ['30%', '100%'],
              }),
              backgroundColor: theme.primary,
              opacity: 0.7 + (randomHeight * 0.3),
            },
          ]}
        />
      );
    }

    return bars;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      {/* Recording indicator */}
      <View style={styles.recordingIndicator}>
        <Animated.View
          style={[
            styles.recordingDot,
            {
              backgroundColor: '#FF3B30',
              transform: [{ scale: pulseAnimation }]
            }
          ]}
        />
        <Text style={[styles.recordingText, { color: theme.text }]}>
          Recording... {formatDuration(duration)}
        </Text>
      </View>

      {/* Waveform visualization */}
      <View style={styles.waveformContainer}>
        {renderWaveform()}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: '#FF3B30' }]}
          onPress={onCancel}
        >
          <Ionicons name="trash" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: theme.primary }]}
          onPress={onSend}
        >
          <Ionicons name="send" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  recordingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  waveformContainer: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  waveformBar: {
    width: 3,
    borderRadius: 3,
    marginHorizontal: 2,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AudioRecordingView;
