import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, Platform } from 'react-native';
import { ScreenRecorderState } from '../hooks/useScreenRecorder';

interface Props {
  recorder: ScreenRecorderState;
  onStop: () => Promise<any>;
}

export const FloatingRecordingView: React.FC<Props> = ({ recorder, onStop }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const isRecording = recorder.state === 'recording' || recorder.state === 'paused';
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [recorder.state]);

  const isRecording = recorder.state === 'recording' || recorder.state === 'paused';
  if (!isRecording) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={styles.floatingContainer}>
        <View style={styles.floatingPill}>
          <Animated.View style={[styles.floatingDot, { opacity: pulseAnim }]} />
          <Text style={styles.floatingTimer}>
            Enregistrement {recorder.timerLabel}
          </Text>
          <TouchableOpacity
            style={styles.floatingStopBtn}
            onPress={onStop}
            activeOpacity={0.7}
          >
            <View style={styles.floatingStopIcon} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999999,
  },
  floatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(28, 28, 30, 0.95)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.44,
    shadowRadius: 10.32,
    elevation: 16,
  },
  floatingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    marginRight: 10,
  },
  floatingTimer: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  floatingStopBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingStopIcon: {
    width: 10,
    height: 10,
    borderRadius: 1,
    backgroundColor: '#FFF',
  },
});
