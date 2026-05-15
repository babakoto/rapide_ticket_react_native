import { useEffect, useRef } from 'react';
import { accelerometer, setUpdateIntervalForType, SensorTypes } from 'react-native-sensors';
import { RapideTicketConfig } from '../types';

export const useSecretTrigger = (config: RapideTicketConfig, onTrigger: () => void) => {
  const triggerType = config.trigger?.type || 'shake';
  const lastShakeTime = useRef(0);

  useEffect(() => {
    if (triggerType === 'shake') {
      setUpdateIntervalForType(SensorTypes.accelerometer, 100);
      const subscription = accelerometer.subscribe(({ x, y, z }) => {
        const acceleration = Math.sqrt(x * x + y * y + z * z);
        if (acceleration > 15) { // Arbitrary threshold
          const now = Date.now();
          if (now - lastShakeTime.current > 1000) {
            lastShakeTime.current = now;
            onTrigger();
          }
        }
      });
      return () => subscription.unsubscribe();
    }
  }, [triggerType, onTrigger]);
};
