import React, { useRef } from 'react';
import { View, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { useSecretTrigger } from '../hooks/useSecretTrigger';
import { RapideTicketConfig } from '../types';

interface Props {
  config: RapideTicketConfig;
  onTrigger: () => void;
  children: React.ReactNode;
}

export const SecretTriggerLayer: React.FC<Props> = ({ config, onTrigger, children }) => {
  useSecretTrigger(config, onTrigger);
  const tapCount = useRef(0);
  const tapTimeout = useRef<ReturnType<typeof setTimeout>>();

  const handlePress = () => {
    if (config.trigger?.type === 'tap') {
      tapCount.current += 1;
      clearTimeout(tapTimeout.current);
      if (tapCount.current >= (config.trigger.tapCount || 5)) {
        tapCount.current = 0;
        onTrigger();
      } else {
        tapTimeout.current = setTimeout(() => {
          tapCount.current = 0;
        }, 500);
      }
    }
  };

  const handleLongPress = () => {
    if (config.trigger?.type === 'longpress') {
      onTrigger();
    }
  };

  return (
    <TouchableWithoutFeedback onPress={handlePress} onLongPress={handleLongPress}>
      <View style={styles.container}>{children}</View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
