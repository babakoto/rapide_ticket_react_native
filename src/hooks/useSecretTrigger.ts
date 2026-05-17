import { useEffect, useRef } from 'react';
import { RapideTicketConfig } from '../types';

export const useSecretTrigger = (config: RapideTicketConfig, onTrigger: () => void) => {
  const triggerType = config.trigger?.type || 'shake';
  const lastShakeTime = useRef(0);

  useEffect(() => {
    if (triggerType !== 'shake') return;

    let cleanup: (() => void) | undefined;

    try {
      // Lazy require to avoid top-level module crash when native sensors are unavailable
      const {
        accelerometer,
        setUpdateIntervalForType,
        SensorTypes,
      } = require('react-native-sensors') as typeof import('react-native-sensors');

      setUpdateIntervalForType(SensorTypes.accelerometer, 100);

      const subscription = accelerometer.subscribe(({ x, y, z }) => {
        const acceleration = Math.sqrt(x * x + y * y + z * z);
        if (acceleration > 15) {
          const now = Date.now();
          if (now - lastShakeTime.current > 1000) {
            lastShakeTime.current = now;
            onTrigger();
          }
        }
      });

      cleanup = () => subscription.unsubscribe();
    } catch (e) {
      console.warn('[RapideTicket] Shake trigger unavailable (react-native-sensors):', e);
    }

    return cleanup;
  }, [triggerType, onTrigger]);
};
