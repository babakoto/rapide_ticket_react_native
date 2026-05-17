import React, { useRef, useState } from 'react';
import { View, StyleSheet, TouchableWithoutFeedback, Text, Animated } from 'react-native';
import { useSecretTrigger } from '../hooks/useSecretTrigger';
import { RapideTicketConfig } from '../types';

interface Props {
  config: RapideTicketConfig;
  onTrigger: () => void;
  children: React.ReactNode;
}

const TAP_TIMEOUT_MS = 1000; // 1s between taps max

export const SecretTriggerLayer: React.FC<Props> = ({ config, onTrigger, children }) => {
  useSecretTrigger(config, onTrigger);

  const tapCount = useRef(0);
  const tapTimeout = useRef<ReturnType<typeof setTimeout>>();
  const [displayCount, setDisplayCount] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const requiredTaps = config.trigger?.tapCount ?? 5;

  const showFeedback = (count: number) => {
    setDisplayCount(count);
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.delay(400),
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const resetTaps = () => {
    tapCount.current = 0;
    setDisplayCount(0);
  };

  const handlePress = () => {
    if (config.trigger?.type !== 'tap') return;

    clearTimeout(tapTimeout.current);
    tapCount.current += 1;

    if (tapCount.current >= requiredTaps) {
      showFeedback(tapCount.current);
      resetTaps();
      onTrigger();
    } else {
      showFeedback(tapCount.current);
      tapTimeout.current = setTimeout(resetTaps, TAP_TIMEOUT_MS);
    }
  };

  const handleLongPress = () => {
    if (config.trigger?.type === 'longpress') {
      onTrigger();
    }
  };

  return (
    <TouchableWithoutFeedback onPress={handlePress} onLongPress={handleLongPress}>
      <View style={styles.container}>
        {children}

        {/* Visual feedback for tap count */}
        {config.trigger?.type === 'tap' && (
          <Animated.View style={[styles.badge, { opacity: fadeAnim }]}>
            <Text style={styles.badgeText}>
              {displayCount}/{requiredTaps}
            </Text>
          </Animated.View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  badge: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  badgeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
});
