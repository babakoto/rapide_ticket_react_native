import { useState, useRef, useCallback } from 'react';
import { captureScreen } from 'react-native-view-shot';
import RNFS from 'react-native-fs';

export interface GifRecorderResult {
  isRecording: boolean;
  frameCount: number;
  startRecording: () => void;
  stopRecording: () => Promise<string[]>;  // returns URIs of saved frames
  clearFrames: () => void;
}

const DEFAULT_FPS = 2;          // 2 frames/sec → lightweight
const DEFAULT_MAX_FRAMES = 20;  // last 10 seconds at 2fps

/**
 * Records screen frames using react-native-view-shot.
 * Returns frame URIs on stop (PNG screenshots).
 * On submit, the frames are attached as image files to the multipart payload.
 *
 * Note: GIF encoding in JS/RN is not yet supported. Frames are sent as PNG
 * files named rapide_ticket_screen_recording_N.png. The backend stores them
 * as-is; GIF encoding can be added server-side or via a native module later.
 */
export const useGifRecorder = (
  enabled = true,
  fps = DEFAULT_FPS,
  maxFrames = DEFAULT_MAX_FRAMES,
): GifRecorderResult => {
  const [isRecording, setIsRecording] = useState(false);
  const [frameCount, setFrameCount] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const framesRef = useRef<string[]>([]);

  const startRecording = useCallback(() => {
    if (!enabled || isRecording) return;
    framesRef.current = [];
    setFrameCount(0);
    setIsRecording(true);

    intervalRef.current = setInterval(async () => {
      try {
        const uri = await captureScreen({ format: 'png', quality: 0.6 });
        framesRef.current.push(uri);

        // Keep only the last maxFrames
        if (framesRef.current.length > maxFrames) {
          framesRef.current = framesRef.current.slice(-maxFrames);
        }
        setFrameCount(framesRef.current.length);
      } catch (e) {
        // Silently ignore capture errors during recording
      }
    }, Math.round(1000 / fps));
  }, [enabled, isRecording, fps, maxFrames]);

  const stopRecording = useCallback(async (): Promise<string[]> => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRecording(false);

    // Copy temp frames to permanent paths so they survive modal transitions
    const savedUris: string[] = [];
    const dir = `${RNFS.CachesDirectoryPath}/rapide_ticket_recording`;

    try {
      const exists = await RNFS.exists(dir);
      if (!exists) await RNFS.mkdir(dir);

      // Clear old frames
      const entries = await RNFS.readDir(dir).catch(() => []);
      await Promise.all(entries.map((e) => RNFS.unlink(e.path).catch(() => {})));

      // Save current frames
      for (let i = 0; i < framesRef.current.length; i++) {
        const srcUri = framesRef.current[i];
        // view-shot URIs start with file:// or are plain paths
        const src = srcUri.replace('file://', '');
        const dest = `${dir}/frame_${i}.png`;
        await RNFS.copyFile(src, dest);
        savedUris.push(`file://${dest}`);
      }
    } catch (e) {
      // Fallback: return temp URIs directly
      return framesRef.current;
    }

    framesRef.current = [];
    setFrameCount(0);
    return savedUris;
  }, []);

  const clearFrames = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    framesRef.current = [];
    setIsRecording(false);
    setFrameCount(0);
  }, []);

  return { isRecording, frameCount, startRecording, stopRecording, clearFrames };
};
