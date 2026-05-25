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
import { Platform, NativeModules, PermissionsAndroid, AppState, AppStateStatus } from 'react-native';
import { captureScreen } from 'react-native-view-shot';
import RNFS from 'react-native-fs';
import DeviceInfo from 'react-native-device-info';
import AsyncStorage from '@react-native-async-storage/async-storage';


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
  isRecovering: boolean;
  recoveredFormState: {
    title?: string;
    description?: string;
    assigneeStableKey?: string;
  } | null;
  start: (formState?: { title: string; description: string; assigneeStableKey?: string }) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<ScreenRecorderResult>;
  reset: () => void;
}

// ─── Native module detection (cached at module level) ────────────────────────

let _nativeRecorderModule: any = null;
let _nativeRecorderChecked = false;
let _nativeRecorderAvailable = false;

function _detectNativeRecorder(): void {
  if (_nativeRecorderChecked) return;
  _nativeRecorderChecked = true;
  try {
    const mod = require('react-native-record-screen');
    _nativeRecorderModule = mod?.default ?? mod?.RecordScreen ?? null;
    _nativeRecorderAvailable = !!_nativeRecorderModule;
    console.log('[RapideTicket] Native recorder available:', _nativeRecorderAvailable);
  } catch (e) {
    _nativeRecorderAvailable = false;
    console.log('[RapideTicket] Native recorder not installed, will use fallback');
  }
}

function hasNativeRecorder(): boolean {
  _detectNativeRecorder();
  return _nativeRecorderAvailable;
}

function getNativeRecorder() {
  _detectNativeRecorder();
  return _nativeRecorderModule;
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

// ─── Persistent recording state (survives component re-mounts) ────────────────
// On Android 14+, selecting "Share an app" in the MediaProjection dialog can
// trigger an Activity recreation, which re-mounts the entire React tree.
// This module-level store preserves the recording session so the hook can
// recover it on re-initialization.

const STORAGE_KEY = '@rapide_ticket_recording_state';

interface PersistentRecordingState {
  isActive: boolean;
  isNative: boolean;
  accumulatedSeconds: number; // total seconds recorded before the current run segment
  segmentStartedAt: number;   // Date.now() when the current running segment started (0 if paused or idle)
  isPaused: boolean;
  title?: string;
  description?: string;
  assigneeStableKey?: string;
}

const _persistentState: PersistentRecordingState = {
  isActive: false,
  isNative: false,
  accumulatedSeconds: 0,
  segmentStartedAt: 0,
  isPaused: false,
};

async function savePersistentState(state: Partial<PersistentRecordingState>) {
  Object.assign(_persistentState, state);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(_persistentState));
  } catch (e) {
    console.warn('[RapideTicket] Failed to save persistent recording state:', e);
  }
}

async function clearPersistentState() {
  _persistentState.isActive = false;
  _persistentState.isNative = false;
  _persistentState.accumulatedSeconds = 0;
  _persistentState.segmentStartedAt = 0;
  _persistentState.isPaused = false;
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('[RapideTicket] Failed to clear persistent recording state:', e);
  }
}

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

  // Recover initial state from persistent store if a recording was active
  // (handles Activity recreation on Android "Share an app" mode)
  const _recoveredState = _persistentState.isActive
    ? (_persistentState.isPaused ? 'paused' as RecorderState : 'recording' as RecorderState)
    : 'idle' as RecorderState;
  const _recoveredElapsed = _persistentState.isActive
    ? (_persistentState.isPaused
        ? _persistentState.accumulatedSeconds
        : _persistentState.accumulatedSeconds + Math.floor((Date.now() - _persistentState.segmentStartedAt) / 1000))
    : 0;

  const [state,   setState]   = useState<RecorderState>(_recoveredState);
  const [elapsed, setElapsed] = useState(_recoveredElapsed);
  const [frames,  setFrames]  = useState(0);   // frame count (fallback mode)
  const [isRecovering, setIsRecovering] = useState(true);
  const [recoveredFormState, setRecoveredFormState] = useState<{
    title?: string;
    description?: string;
    assigneeStableKey?: string;
  } | null>(null);

  // Ref to always have the latest state in callbacks (avoids stale closure)
  const stateRef = useRef<RecorderState>(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const isIosSimulator = Platform.OS === 'ios' && DeviceInfo.isEmulatorSync();
  const _hasNative = hasNativeRecorder();
  // Re-enable native recorder on Android. Android 14+ partial screen sharing ("Share an app") causes a white screen,
  // but full screen sharing ("Share all screens") works. We will handle this via user education in the UI instead of disabling it.
  const canUseNative = useRef(preferNative && _hasNative && !isIosSimulator).current;
  const usingNative  = useRef(_persistentState.isActive ? _persistentState.isNative : false);
  const autoStopRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs for timers / frame data
  const elapsedRef   = useRef(_recoveredElapsed);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const framesRef    = useRef<string[]>([]);
  const pausedElapsedRef = useRef(_persistentState.isActive ? _persistentState.accumulatedSeconds : 0);
  const hasRecoveredRef = useRef(false);

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

  // ── Recovery: check persistent storage and restart recording session ─────
  useEffect(() => {
    (async () => {
      try {
        const storedStr = await AsyncStorage.getItem(STORAGE_KEY);
        if (storedStr) {
          const stored: PersistentRecordingState = JSON.parse(storedStr);
          if (stored.isActive) {
            hasRecoveredRef.current = true;
            Object.assign(_persistentState, stored);

            const now = Date.now();
            const elapsedVal = stored.isPaused
              ? stored.accumulatedSeconds
              : stored.accumulatedSeconds + Math.floor((now - stored.segmentStartedAt) / 1000);

            console.log('[RapideTicket] Recovered active recording session after AsyncStorage load.',
              'native =', stored.isNative,
              'elapsed =', elapsedVal, 's');

            usingNative.current = stored.isNative;
            elapsedRef.current = elapsedVal;
            setElapsed(elapsedVal);
            pausedElapsedRef.current = stored.isPaused ? stored.accumulatedSeconds : 0;

            if (stored.title || stored.description || stored.assigneeStableKey) {
              setRecoveredFormState({
                title: stored.title,
                description: stored.description,
                assigneeStableKey: stored.assigneeStableKey,
              });
            }

            const nextState = stored.isPaused ? 'paused' as RecorderState : 'recording' as RecorderState;
            stateRef.current = nextState;
            setState(nextState);

            if (!stored.isPaused) {
              _startTimer();
            }

            const remaining = Math.max(0, maxDurationSeconds - elapsedVal);
            if (remaining > 0) {
              autoStopRef.current = setTimeout(() => {
                _handleStop();
              }, remaining * 1000);
            } else {
              _handleStop();
            }
          }
        }
      } catch (e) {
        console.warn('[RapideTicket] Error recovering from AsyncStorage:', e);
      } finally {
        setIsRecovering(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── start ────────────────────────────────────────────────────────────────
  const start = useCallback(async (formState?: { title: string; description: string; assigneeStableKey?: string }) => {
    const currentState = stateRef.current;
    if (currentState !== 'idle' && currentState !== 'stopped') return;

    framesRef.current  = [];
    elapsedRef.current = 0;
    pausedElapsedRef.current = 0;
    setElapsed(0);
    setFrames(0);
    setRecoveredFormState(null);

    // Save active state to AsyncStorage BEFORE calling startRecording to survive activity recreation!
    await savePersistentState({
      isActive: true,
      isNative: canUseNative,
      accumulatedSeconds: 0,
      segmentStartedAt: Date.now(),
      isPaused: false,
      title: formState?.title,
      description: formState?.description,
      assigneeStableKey: formState?.assigneeStableKey,
    });

    if (canUseNative) {
      if (Platform.OS === 'android') {
        try {
          const hasAudioPerm = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
          if (!hasAudioPerm) {
            const granted = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
              {
                title: 'Enregistrement d\'écran',
                message: 'Rapide Ticket a besoin de l\'autorisation audio pour démarrer la capture d\'écran.',
                buttonPositive: 'Autoriser',
              }
            );
          }
          // Request POST_NOTIFICATIONS for Android 13+ (API 33+)
          if (Platform.Version >= 33) {
            const hasNotifPerm = await PermissionsAndroid.check('android.permission.POST_NOTIFICATIONS' as any);
            if (!hasNotifPerm) {
              await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS' as any);
            }
          }
        } catch (permerr) {
          console.warn('[RapideTicket] Permissions request error:', permerr);
        }
      }

      const recorder = getNativeRecorder();
      try {
        console.log('[RapideTicket] Starting native screen recording...');
        const res = await recorder.startRecording({
          mic:     false,
          bitrate,
          ...(Platform.OS === 'ios' ? {} : {}),
        });
        console.log('[RapideTicket] startRecording result:', JSON.stringify(res));
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
        console.warn('[RapideTicket] startRecording returned unexpected result, clearing state:', JSON.stringify(res));
        await clearPersistentState();
      } catch (e) {
        console.warn('[RapideTicket] Native recorder failed, clearing state and using frame fallback', e);
        await clearPersistentState();
      }
    }

    // Fallback: frame capture
    usingNative.current = false;
    stateRef.current = 'recording';
    setState('recording');
    _startTimer();
    _startFrameCapture();
    // Persist recording state for fallback (since it was cleared or not fully written)
    await savePersistentState({
      isActive: true,
      isNative: false,
      accumulatedSeconds: 0,
      segmentStartedAt: Date.now(),
      isPaused: false,
      title: formState?.title,
      description: formState?.description,
      assigneeStableKey: formState?.assigneeStableKey,
    });
    // Auto-stop fallback
    autoStopRef.current = setTimeout(() => {
      _handleStop();
    }, maxDurationSeconds * 1000);
  }, [canUseNative, bitrate, maxDurationSeconds, _startTimer, _startFrameCapture]);

  // Internal stop logic
  const _handleStop = useCallback(async (): Promise<ScreenRecorderResult> => {
    const currentState = stateRef.current;
    console.log('[RapideTicket] Stopping recorder, state =', currentState, 'native =', usingNative.current);
    if (currentState === 'idle') {
      console.warn('[RapideTicket] Stop called while idle, ignoring');
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
        console.log('[RapideTicket] stopRecording response:', JSON.stringify(res));
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
              console.log('[RapideTicket] Android recording copied to cache:', videoUri);
            } catch (copyErr) {
              console.warn('[RapideTicket] Failed to copy recording to cache, using raw path:', copyErr);
              videoUri = rawUri.startsWith('file://') ? rawUri : `file://${rawUri}`;
            }
          } else {
            videoUri = rawUri.startsWith('file://') ? rawUri : `file://${rawUri}`;
          }
        } else {
          console.warn('[RapideTicket] stopRecording returned empty/invalid URI. Response:', JSON.stringify(res));
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
    // Clear persistent state
    await clearPersistentState();

    // attachments: video takes priority over frames
    const attachments = videoUri ? [videoUri] : persistedFrames;
    console.log('[RapideTicket] Recording result: videoUri =', videoUri ? 'present' : 'null', ', frames =', persistedFrames.length);

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
    // Update persistent state
    await savePersistentState({
      isPaused: true,
      accumulatedSeconds: elapsedRef.current,
      segmentStartedAt: 0,
    });
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
    // Update persistent state
    await savePersistentState({
      isPaused: false,
      segmentStartedAt: Date.now(),
    });
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
    setRecoveredFormState(null);
    // Clear persistent state
    clearPersistentState();
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
    isRecovering,
    recoveredFormState,
    start,
    pause,
    resume,
    stop,
    reset,
  };
}
