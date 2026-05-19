/**
 * RapideTicketModal — Bug-report sheet
 *
 * Features:
 *  - Screenshot preview + AnnotationEditor
 *  - Native screen recorder (MP4 via react-native-record-screen)
 *    with live timer, pause/resume and dock-mode state
 *  - Frame-capture fallback when native recorder is unavailable
 *  - Multipart submission (screenshot + video or frames)
 */
import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useTicketSubmit }    from '../hooks/useTicketSubmit';
import { useScreenRecorder }  from '../hooks/useScreenRecorder';
import { useScreenCapture }   from '../hooks/useScreenCapture';
import { useRapideTicket }    from './RapideTicketProvider';
import { AnnotationEditor }   from './AnnotationEditor';
import { SecretFeedbackOverlay, DockMode } from './SecretFeedbackOverlay';
import { getIssueSummary }    from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  previewUri?: string | null;
  inviteToken?: string;
}

type Screen = 'form' | 'annotate';

export const RapideTicketModal: React.FC<Props> = ({ visible, onClose, previewUri, inviteToken }) => {
  const { config } = useRapideTicket();
  const { setImageUri } = useScreenCapture();
  const { submit, loading, error } = useTicketSubmit(config, inviteToken);

  // Screen recorder (native MP4 + fallback frames)
  const recorder = useScreenRecorder({
    fps:      config.gif?.fps ?? 2,
    maxFrames: config.gif?.maxFrames ?? 60,
    preferNative: true,
  });

  const [screen,       setScreen]       = useState<Screen>('form');
  const [title,        setTitle]        = useState('');
  const [description,  setDescription]  = useState('');
  const [annotatedUri, setAnnotatedUri] = useState<string | null>(null);
  const [dockMode,     setDockMode]     = useState<DockMode>('home');
  const [recordResult, setRecordResult] = useState<{
    videoUri: string | null;
    frames: string[];
  } | null>(null);

  const effectiveUri = annotatedUri || previewUri;

  // ── Reset on open/close ───────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setTitle('');
      setDescription('');
      setAnnotatedUri(null);
      setScreen('form');
      setDockMode('home');
      setRecordResult(null);
    } else {
      recorder.reset();
    }
  }, [visible]);

  // ── Dock action handlers ──────────────────────────────────────────────

  const handleRecordGif = () => setDockMode('gifReady');

  const handleGifBack = () => {
    recorder.reset();
    setDockMode('home');
  };

  const handleGifStart = async () => {
    await recorder.start();
    setDockMode('gifRecording');
  };

  const handleGifPauseResume = async () => {
    if (recorder.state === 'recording') {
      await recorder.pause();
    } else if (recorder.state === 'paused') {
      await recorder.resume();
    }
  };

  const handleGifStop = async () => {
    const result = await recorder.stop();
    setRecordResult({ videoUri: result.videoUri, frames: result.frames });
    setDockMode('home');
    Alert.alert(
      '🎬 Enregistrement terminé',
      result.videoUri
        ? `Vidéo MP4 (${result.durationSeconds}s) prête à joindre.`
        : `${result.frames.length} frames PNG capturées.`,
    );
  };

  // ── Submit ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    const trimmedDesc  = description.trim();
    if (!trimmedTitle || !trimmedDesc) {
      Alert.alert('Champs requis', 'Veuillez remplir le titre et la description.');
      return;
    }

    // Stop recorder if still running
    let finalRecording = recordResult;
    if (recorder.state === 'recording' || recorder.state === 'paused') {
      const r = await recorder.stop();
      finalRecording = { videoUri: r.videoUri, frames: r.frames };
    }

    const result = await submit({
      title:          trimmedTitle,
      description:    trimmedDesc,
      screenshotUri:  effectiveUri,
      videoUri:       finalRecording?.videoUri ?? null,
      recordingFrames: finalRecording?.frames ?? [],
    });

    if (result) {
      Alert.alert('✅ Ticket envoyé', getIssueSummary(result), [{ text: 'OK', onPress: onClose }]);
    } else {
      Alert.alert(
        '📡 Hors ligne',
        "Ticket mis en file d'attente, il sera envoyé à la reconnexion.",
        [{ text: 'OK', onPress: onClose }],
      );
    }
  };

  const handleAnnotationDone = (uri: string) => {
    setAnnotatedUri(uri);
    setScreen('form');
  };

  // ── Annotation full-screen ────────────────────────────────────────────
  if (screen === 'annotate' && effectiveUri) {
    return (
      <Modal visible={visible} animationType="fade" statusBarTranslucent>
        <AnnotationEditor
          screenshotUri={effectiveUri}
          onDone={handleAnnotationDone}
          onCancel={() => setScreen('form')}
        />
      </Modal>
    );
  }

  // ── Recording badge ───────────────────────────────────────────────────
  const recordingBadge = (() => {
    if (recorder.state === 'recording' || recorder.state === 'paused') {
      return (
        <View style={styles.recBadge}>
          <View style={[styles.recDot, recorder.state === 'paused' && styles.recDotPaused]} />
          <Text style={styles.recTimer}>{recorder.timerLabel}</Text>
          {recorder.isNative
            ? <Text style={styles.recMode}>📹 MP4</Text>
            : <Text style={styles.recMode}>🖼 {recorder.frameCount} frames</Text>
          }
        </View>
      );
    }
    if (recordResult) {
      return (
        <View style={[styles.recBadge, styles.recBadgeDone]}>
          <Text style={styles.recDoneText}>
            {recordResult.videoUri
              ? '✅ Vidéo MP4 prête'
              : `✅ ${recordResult.frames.length} frames capturées`
            }
          </Text>
        </View>
      );
    }
    return null;
  })();

  // ── Main form ─────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.grip} />
            <Text style={styles.headerTitle}>Signaler un problème</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Screenshot preview */}
            {effectiveUri ? (
              <View style={styles.screenshotRow}>
                <View style={styles.screenshotBox}>
                  <Image source={{ uri: effectiveUri }} style={styles.screenshot} resizeMode="contain" />
                  {annotatedUri && (
                    <View style={styles.annotatedBadge}>
                      <Text style={styles.annotatedBadgeText}>✏️ Annoté</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.annotateBtn}
                  onPress={() => setScreen('annotate')}
                  disabled={loading}
                >
                  <Text style={styles.annotateBtnIcon}>✏️</Text>
                  <Text style={styles.annotateBtnText}>Annoter</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Recording controls */}
            <View style={styles.recorderRow}>
              <View style={styles.recorderInfo}>
                <Text style={styles.recorderLabel}>
                  🎬 Enregistrement écran
                </Text>
                <Text style={styles.recorderSub}>
                  {recorder.canUseNative
                    ? 'Capture native (vidéo MP4 — WebViews inclus)'
                    : 'Capture par frames PNG'
                  }
                </Text>
                {recordingBadge}
              </View>

              <View style={styles.recButtons}>
                {(recorder.state === 'idle' || recorder.state === 'stopped') && (
                  <TouchableOpacity
                    style={[styles.recBtn, styles.recBtnStart]}
                    onPress={handleGifStart}
                    disabled={loading}
                  >
                    <Text style={styles.recBtnText}>⏺ Démarrer</Text>
                  </TouchableOpacity>
                )}
                {recorder.state === 'recording' && (
                  <>
                    <TouchableOpacity style={[styles.recBtn, styles.recBtnPause]} onPress={handleGifPauseResume}>
                      <Text style={styles.recBtnText}>⏸ Pause</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.recBtn, styles.recBtnStop]} onPress={handleGifStop}>
                      <Text style={styles.recBtnText}>⏹ Stop</Text>
                    </TouchableOpacity>
                  </>
                )}
                {recorder.state === 'paused' && (
                  <>
                    <TouchableOpacity style={[styles.recBtn, styles.recBtnStart]} onPress={handleGifPauseResume}>
                      <Text style={styles.recBtnText}>▶ Reprendre</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.recBtn, styles.recBtnStop]} onPress={handleGifStop}>
                      <Text style={styles.recBtnText}>⏹ Stop</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>

            {/* Error */}
            {error ? <Text style={styles.errorText}>⚠️ {error}</Text> : null}

            {/* Title */}
            <Text style={styles.label}>Titre <Text style={styles.req}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="Ex. : crash sur l'écran d'accueil"
              placeholderTextColor="#aaa"
              value={title}
              onChangeText={setTitle}
              editable={!loading}
              returnKeyType="next"
              maxLength={255}
            />

            {/* Description */}
            <Text style={styles.label}>Description <Text style={styles.req}>*</Text></Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Décrivez les étapes pour reproduire le problème…"
              placeholderTextColor="#aaa"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              editable={!loading}
            />

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.submitBtnText}>Envoyer le ticket</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const INDIGO = '#5E5CE6';
const RED    = '#E53935';
const GREEN  = '#22A06B';

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '92%', paddingBottom: 24,
  },
  header: {
    alignItems: 'center', paddingTop: 12, paddingHorizontal: 16,
    paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  grip: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#ddd', marginBottom: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a2e' },
  closeBtn: { position: 'absolute', right: 16, top: 12, padding: 6 },
  closeBtnText: { fontSize: 18, color: '#888' },

  body: { padding: 20, gap: 14 },

  // Screenshot
  screenshotRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 4 },
  screenshotBox: { flex: 1, position: 'relative' },
  screenshot: { width: '100%', height: 140, borderRadius: 12, backgroundColor: '#f5f5f5' },
  annotatedBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(94,92,230,0.9)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  annotatedBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  annotateBtn: {
    alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: INDIGO + '18', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
  },
  annotateBtnIcon: { fontSize: 22 },
  annotateBtnText: { fontSize: 11, fontWeight: '700', color: INDIGO },

  // Recorder
  recorderRow: { gap: 10 },
  recorderInfo: { gap: 4 },
  recorderLabel: { fontSize: 15, fontWeight: '700', color: '#1a1a2e' },
  recorderSub: { fontSize: 12, color: '#9ca3af' },

  recBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(229,57,53,0.08)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginTop: 4,
  },
  recBadgeDone: { backgroundColor: 'rgba(34,160,107,0.1)' },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: RED },
  recDotPaused: { backgroundColor: '#BDBDBD' },
  recTimer: { fontSize: 14, fontWeight: '800', color: '#1a1a2e', letterSpacing: 0.5 },
  recMode: { fontSize: 12, color: '#6b7280' },
  recDoneText: { fontSize: 13, fontWeight: '700', color: GREEN },

  recButtons: { flexDirection: 'row', gap: 8 },
  recBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center',
  },
  recBtnStart: { backgroundColor: RED },
  recBtnPause: { backgroundColor: '#2684FF' },
  recBtnStop:  { backgroundColor: '#1E2330' },
  recBtnText:  { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Form fields
  label: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: -8 },
  req:   { color: RED },
  input: {
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, color: '#1a1a2e', backgroundColor: '#fafafa',
  },
  textArea: { height: 110, textAlignVertical: 'top' },

  errorText: { fontSize: 13, color: RED, fontWeight: '600' },

  // Submit
  submitBtn: {
    backgroundColor: INDIGO, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.55 },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
