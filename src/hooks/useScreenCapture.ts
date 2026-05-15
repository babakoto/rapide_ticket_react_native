import { useRef, useState } from 'react';
import { captureScreen } from 'react-native-view-shot';

export const useScreenCapture = () => {
  const [imageUri, setImageUri] = useState<string | null>(null);

  const capture = async () => {
    try {
      const uri = await captureScreen({
        format: 'png',
        quality: 0.8,
      });
      setImageUri(uri);
      return uri;
    } catch (error) {
      console.error('Capture failed', error);
      return null;
    }
  };

  return { capture, imageUri, setImageUri };
};
