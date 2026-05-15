import { useState } from 'react';

export const useGifRecorder = (enabled: boolean) => {
  const [gifUri, setGifUri] = useState<string | null>(null);

  const record = async () => {
    if (!enabled) return null;
    // GIF recording logic
    return null;
  };

  return { record, gifUri };
};
