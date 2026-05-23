/**
 * useScreenRecorder — Full-screen native recorder hook
 *
 * Strategy (captures EVERYTHING including WebViews):
 *   1. Native video: react-native-record-screen
 *      - iOS  → ReplayKit (system screen recording, captures all layers)
 *      - Android → MediaProjection API (captures entire display)
 *      Output: .mp4 file URI
 *
 *   2. Frame fallback: react-native-view-shot (PNG frames)
 *      Used automatically when the native recorder is unavailable.
 *
 * Usage:
 *   const rec = useScreenRecorder();
 *   await rec.start();
 *   await rec.pause();
 *   await rec.resume();
 *   const result = await rec.stop();
 *   // result.videoUri  — mp4 path (native) or null
 *   // result.frames    — PNG URIs (fallback or alongside video)
 *
 * On iOS the first call triggers a system permission dialog (ReplayKit).
 * On Android add RECORD_AUDIO + foreground service permissions in the manifest.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform, NativeModules, PermissionsAndroid } from 'react-native';
import { captureScreen } from 'react-native-view-shot';
import RNFS from 'react-native-fs';
import DeviceInfo from 'react-native-device-info';


// ─── Types ────────────────────────────────────────────────────────────────────

export type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped';

export interface ScreenRecorderResult {
  /** MP4 file URI (native recorder) — null if only frames were captured */
  videoUri: string | null;
  /** PNG frame URIs (frame-capture fallback or when gif mode is mixed) */
  frames: string[];
  /** Recording duration in seconds */
  durationSeconds: number;
  /** Backend-ready: use videoUri when present, else frames */
  attachments: string[];
}

export interface ScreenRecorderState {
  state: RecorderState;
  durationSeconds: number;
  frameCount: number;
  timerLabel: string;
  canUseNative: boolean;
  /** Whether native recorder is active (vs frame fallback) */
  isNative: boolean;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<ScreenRecorderResult>;
  reset: () => void;
}

// ─── Native module detection ──────────────────────────────────────────────────

function hasNativeRecorder(): boolean {
  try {
    // react-native-record-screen exposes RecordScreen native module
    const mod = require('react-native-record-screen');
    const hasDefault = !!mod?.default;
    const hasRecordScreen = !!mod?.RecordScreen;
    console.log('[RapideTicket DEBUG] hasNativeRecorder: mod keys =', mod ? Object.keys(mod) : 'null', 'hasDefault =', hasDefault, 'hasRecordScreen =', hasRecordScreen);
    return hasDefault || hasRecordScreen;
  } catch (e) {
    console.warn('[RapideTicket DEBUG] hasNativeRecorder: require failed:', e);
    return false;
  }
}

function getNativeRecorder() {
  try {
    const mod = require('react-native-record-screen');
    const recorder = mod?.default ?? mod?.RecordScreen ?? null;
    console.log('[RapideTicket DEBUG] getNativeRecorder: got', recorder ? 'recorder object' : 'null', 'keys:', recorder ? Object.keys(recorder) : 'none');
    return recorder;
  } catch (e) {
    console.warn('[RapideTicket DEBUG] getNativeRecorder: require failed:', e);
    return null;
  }
}

// ─── Timer helpers ────────────────────────────────────────────────────────────

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ─── Frame fallback constants ─────────────────────────────────────────────────

const FALLBACK_FPS        = 2;
const FALLBACK_MAX_FRAMES = 60;  // 30s at 2fps
const FRAME_DIR           = `${RNFS.CachesDirectoryPath}/rapide_ticket_recording`;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useScreenRecorder(opts: {
  fps?: number;
  maxFrames?: number;
  preferNative?: boolean;
  bitrate?: number;
  /** Auto-stop after this many seconds (default: 30) */
  maxDurationSeconds?: number;
  onStop?: (result: ScreenRecorderResult) => void;
} = {}): ScreenRecorderState {
  const {
    fps        = FALLBACK_FPS,
    maxFrames  = FALLBACK_MAX_FRAMES,
    preferNative = true,
    bitrate    = 500_000,   // 0.5 Mbps — keeps file size manageable for upload
    maxDurationSeconds = 30,
  } = opts;

  const onStopRef = useRef(opts.onStop);
  useEffect(() => {
    onStopRef.current = opts.onStop;
  }, [opts.onStop]);

  const [state,   setState]   = useState<RecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);   // seconds
  const [frames,  setFrames]  = useState(0);   // frame count (fallback mode)

  // Ref to always have the latest state in callbacks (avoids stale closure)
  const stateRef = useRef<RecorderState>(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const isIosSimulator = Platform.OS === 'ios' && DeviceInfo.isEmulatorSync();
  const _hasNative = hasNativeRecorder();
  const canUseNative = useRef(preferNative && _hasNative && !isIosSimulator).current;
  console.log('[RapideTicket DEBUG] useScreenRecorder init: preferNative =', preferNative, 'hasNative =', _hasNative, 'isIosSimulator =', isIosSimulator, 'canUseNative =', canUseNative);
  const usingNative  = useRef(false);
  const autoStopRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs for timers / frame data
  const elapsedRef   = useRef(0);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const framesRef    = useRef<string[]>([]);
  const startTimeRef = useRef<number>(0);
  const pausedElapsedRef = useRef(0);  // elapsed before last pause

  // Tick timer every second
  const _startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);
  }, []);

  const _stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
  }, []);

  // Frame-capture fallback
  const _startFrameCapture = useCallback(() => {
    const intervalMs = Math.round(1000 / fps);
    frameTimerRef.current = setInterval(async () => {
      try {
        const uri = await captureScreen({ format: 'png', quality: 0.65 });
        framesRef.current.push(uri);
        if (framesRef.current.length > maxFrames) {
          framesRef.current = framesRef.current.slice(-maxFrames);
        }
        setFrames(framesRef.current.length);
      } catch (_) { /* ignore */ }
    }, intervalMs);
  }, [fps, maxFrames]);

  const _stopFrameCapture = useCallback(() => {
    if (frameTimerRef.current) { clearInterval(frameTimerRef.current); frameTimerRef.current = null; }
  }, []);

  // Persist frames to stable paths
  const _persistFrames = useCallback(async (): Promise<string[]> => {
    const saved: string[] = [];
    try {
      const exists = await RNFS.exists(FRAME_DIR);
      if (!exists) await RNFS.mkdir(FRAME_DIR);
      // Clear old
      const entries = await RNFS.readDir(FRAME_DIR).catch(() => []);
      await Promise.all(entries.map((e) => RNFS.unlink(e.path).catch(() => {})));
      // Copy
      for (let i = 0; i < framesRef.current.length; i++) {
        const src  = framesRef.current[i].replace('file://', '');
        const dest = `${FRAME_DIR}/frame_${i}.png`;
        await RNFS.copyFile(src, dest);
        saved.push(`file://${dest}`);
      }
    } catch {
      return framesRef.current;
    }
    return saved;
  }, []);

  // ── start ────────────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    const currentState = stateRef.current;
    if (currentState !== 'idle' && currentState !== 'stopped') return;

    framesRef.current  = [];
    elapsedRef.current = 0;
    pausedElapsedRef.current = 0;
    setElapsed(0);
    setFrames(0);

    if (canUseNative) {
      if (Platform.OS === 'android') {
        try {
          console.log('[RapideTicket DEBUG] Android runtime permissions check...');
          const hasAudioPerm = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
          if (!hasAudioPerm) {
            console.log('[RapideTicket DEBUG] RECORD_AUDIO not granted. Requesting...');
            const granted = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
              {
                title: 'Enregistrement d\'écran',
                message: 'Rapide Ticket a besoin de l\'autorisation audio pour démarrer la capture d\'écran.',
                buttonPositive: 'Autoriser',
              }
            );
            console.log('[RapideTicket DEBUG] RECORD_AUDIO request result:', granted);
          }
          // Request POST_NOTIFICATIONS for Android 13+ (API 33+)
          if (Platform.Version >= 33) {
            const hasNotifPerm = await PermissionsAndroid.check('android.permission.POST_NOTIFICATIONS' as any);
            if (!hasNotifPerm) {
              await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS' as any);
            }
          }
        } catch (permerr) {
          console.warn('[RapideTicket DEBUG] Permissions request error:', permerr);
        }
      }

      const recorder = getNativeRecorder();
      try {
        console.log('[RapideTicket DEBUG] start(): canUseNative=true, calling startRecording...');
        console.log('[RapideTicket DEBUG] recorder methods:', typeof recorder.startRecording, typeof recorder.stopRecording);
        const res = await recorder.startRecording({
          mic:     false,
          bitrate,
          ...(Platform.OS === 'ios' ? {} : {}),
        });
        console.log('[RapideTicket DEBUG] startRecording result:', JSON.stringify(res));
        if (res === 'started' || res?.status === 'recording' || res?.result === 'success' || res == null) {
          usingNative.current = true;
          stateRef.current = 'recording';
          setState('recording');
          _startTimer();
          // Auto-stop after maxDurationSeconds — uses stateRef so no stale closure
          autoStopRef.current = setTimeout(() => {
            _handleStop();
          }, maxDurationSeconds * 1000);
          return;
        }
        console.warn('[RapideTicket DEBUG] startRecording returned unexpected result, falling back:', JSON.stringify(res));
      } catch (e) {
        console.warn('[RapideTicket] Native recorder failed, using frame fallback', e);
      }
    }

    // Fallback: frame capture
    usingNative.current = false;
    stateRef.current = 'recording';
    setState('recording');
    _startTimer();
    _startFrameCapture();
    // Auto-stop fallback
    autoStopRef.current = setTimeout(() => {
      _handleStop();
    }, maxDurationSeconds * 1000);
  }, [canUseNative, bitrate, maxDurationSeconds, _startTimer, _startFrameCapture]);

  // Internal stop logic
  const _handleStop = useCallback(async (): Promise<ScreenRecorderResult> => {
    const currentState = stateRef.current;
    console.log('[RapideTicket DEBUG] _handleStop called, stateRef.current =', currentState, 'usingNative =', usingNative.current);
    if (currentState === 'idle') {
      console.warn('[RapideTicket DEBUG] _handleStop bailing: state is idle');
      return { videoUri: null, frames: [], durationSeconds: 0, attachments: [] };
    }

    _stopTimer();
    _stopFrameCapture();
    const duration = elapsedRef.current;

    let videoUri: string | null = null;
    let persistedFrames: string[] = [];

    if (usingNative.current) {
      const recorder = getNativeRecorder();
      try {
        const res = await recorder.stopRecording();
        // react-native-record-screen returns { status: 'success', result: { outputURL } }
        const rawUri = res?.result?.outputURL ?? (typeof res?.result === 'string' ? res.result : undefined) ?? res?.outputURL ?? res?.url;
        console.log('[RapideTicket DEBUG] stopRecording response:', JSON.stringify(res), 'Parsed rawUri:', rawUri);
        if (typeof rawUri === 'string' && rawUri.length > 0) {
          const rawPath = rawUri.replace(/^file:\/\//, '');
          if (Platform.OS === 'android') {
            try {
              const cacheFolder = `${RNFS.CachesDirectoryPath}/rapide_ticket_recording`;
              const exists = await RNFS.exists(cacheFolder);
              if (!exists) {
                await RNFS.mkdir(cacheFolder);
              }
              const destPath = `${cacheFolder}/recording_${Date.now()}.mp4`;
              await RNFS.copyFile(rawPath, destPath);
              videoUri = `file://${destPath}`;
              console.log('[RapideTicket DEBUG] Successfully copied Android screen recording to cache:', videoUri);
            } catch (copyErr) {
              console.warn('[RapideTicket DEBUG] Failed to copy Android screen recording to cache, using raw path:', copyErr);
              videoUri = rawUri.startsWith('file://') ? rawUri : `file://${rawUri}`;
            }
          } else {
            videoUri = rawUri.startsWith('file://') ? rawUri : `file://${rawUri}`;
          }
        } else {
          console.warn('[RapideTicket DEBUG] stopRecording returned empty/invalid rawUri. Full res:', JSON.stringify(res));
        }
      } catch (e) {
        console.warn('[RapideTicket] stopRecording error', e);
      }
    } else {
      persistedFrames = await _persistFrames();
    }

    framesRef.current  = [];
    elapsedRef.current = 0;
    stateRef.current = 'stopped';
    setState('stopped');
    setElapsed(0);
    setFrames(0);

    // attachments: video takes priority over frames
    const attachments = videoUri ? [videoUri] : persistedFrames;
    console.log('[RapideTicket DEBUG] _handleStop returning videoUri:', videoUri, 'frames:', persistedFrames.length);

    const result = { videoUri, frames: persistedFrames, durationSeconds: duration, attachments };
    onStopRef.current?.(result);

    return result;
  }, [_stopTimer, _stopFrameCapture, _persistFrames]);

  // ── pause ────────────────────────────────────────────────────────────────
  const pause = useCallback(async () => {
    if (stateRef.current !== 'recording') return;

    _stopTimer();
    pausedElapsedRef.current = elapsedRef.current;

    if (usingNative.current) {
      const recorder = getNativeRecorder();
      try { await recorder.pauseRecording?.(); } catch (_) {}
    } else {
      _stopFrameCapture();
    }
    stateRef.current = 'paused';
    setState('paused');
  }, [_stopTimer, _stopFrameCapture]);

  // ── resume ───────────────────────────────────────────────────────────────
  const resume = useCallback(async () => {
    if (stateRef.current !== 'paused') return;

    elapsedRef.current = pausedElapsedRef.current;

    if (usingNative.current) {
      const recorder = getNativeRecorder();
      try { await recorder.resumeRecording?.(); } catch (_) {}
    } else {
      _startFrameCapture();
    }
    stateRef.current = 'recording';
    setState('recording');
    _startTimer();
  }, [_startTimer, _startFrameCapture]);

  // ── stop ─────────────────────────────────────────────────────────────────
  const stop = _handleStop;

  // ── reset ────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    _stopTimer();
    _stopFrameCapture();
    framesRef.current  = [];
    elapsedRef.current = 0;
    setState('idle');
    setElapsed(0);
    setFrames(0);
  }, [_stopTimer, _stopFrameCapture]);

  // Cleanup on unmount
  useEffect(() => () => { _stopTimer(); _stopFrameCapture(); }, []);

  return {
    state,
    durationSeconds: elapsed,
    frameCount: frames,
    timerLabel: formatTimer(elapsed),
    canUseNative,
    isNative: usingNative.current,
    start,
    pause,
    resume,
    stop,
    reset,
  };
}
