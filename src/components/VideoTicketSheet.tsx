/**
 * VideoTicketSheet — Video/recording preview + ticket submission form
 *
 * Mirrors Flutter rapide_ticket_gif_ticket_sheet.dart
 *
 * Flow:
 *  1. Preview phase: shows video thumbnail / frame preview
 *     with "Fermer" or "Créer un ticket" actions
 *  2. Form phase: title + description + submit
 *
 * Usage:
 *   <VideoTicketSheet
 *     visible={visible}
 *     videoUri="file:///path/to/recording.mp4"   // native MP4
 *     frames={['file:///frame_0.png', ...]}       // fallback frames
 *     screenshotUri="file:///screenshot.png"      // optional static screenshot
 *     onClose={() => setVisible(false)}
 *     onIssueCreated={(result) => console.log(result)}
 *   />
 */
import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import { useTicketSubmit }    from '../hooks/useTicketSubmit';
import { useRapideTicket }    from './RapideTicketProvider';
import { AnnotationEditor }   from './AnnotationEditor';
import { getIssueSummary }    from '../types';
import type { IssueCreateResult } from '../types';

const { width: SCREEN_W } = Dimensions.get('window');

/**
 * Android fix: transparent Modals + KeyboardAvoidingView cause the form
 * to bounce up/down when focusing text fields. The system's adjustResize
 * conflicts with KAV's keyboard event listener, triggering layout oscillation.
 * On Android we use a plain View and let adjustResize handle keyboard avoidance.
 */
const FormOverlay: React.FC<{ style: any; children: React.ReactNode }> =
  Platform.OS === 'ios'
    ? ({ style, children }) => (
        <KeyboardAvoidingView style={style} behavior="padding">
          {children}
        </KeyboardAvoidingView>
      )
    : ({ style, children }) => <View style={style}>{children}</View>;

interface Props {
  visible: boolean;
  onClose: () => void;
  /** MP4 file URI (native recorder) */
  videoUri?: string | null;
  /** PNG frames (fallback capture) */
  frames?: string[];
  /** Static screenshot for preview thumbnail */
  screenshotUri?: string | null;
  /** Skip the preview phase and go directly to the form */
  skipPreview?: boolean;
  inviteToken?: string;
  onSubmissionSuccess?: () => void;
  onSubmissionError?: (err: Error) => void;
  onIssueCreated?: (result: IssueCreateResult) => void;
}

type Phase = 'preview' | 'form' | 'annotate';

const INDIGO = '#5E5CE6';
const RED    = '#E53935';

export const VideoTicketSheet: React.FC<Props> = ({
  visible,
  onClose,
  videoUri,
  frames = [],
  screenshotUri,
  skipPreview = false,
  inviteToken,
  onSubmissionSuccess,
  onSubmissionError,
  onIssueCreated,
}) => {
  const { config } = useRapideTicket();
  const { submit, loading, error } = useTicketSubmit(config);

  const [phase,        setPhase]        = useState<Phase>(skipPreview ? 'form' : 'preview');
  const [title,        setTitle]        = useState('');
  const [description,  setDescription]  = useState('');
  const [annotatedUri, setAnnotatedUri] = useState<string | null>(null);

  const hasVideo     = !!videoUri;
  const hasFrames    = frames.length > 0;
  const hasRecording = hasVideo || hasFrames;
  const previewImg   = annotatedUri ?? screenshotUri ?? (frames[0] || null);

  useEffect(() => {
    if (visible) {
      setPhase(skipPreview ? 'form' : 'preview');
      setTitle('');
      setDescription('');
      setAnnotatedUri(null);
    }
  }, [visible, skipPreview]);

  const handleSubmit = async () => {
    const t = title.trim();
    const d = description.trim();
    if (!t || !d) {
      Alert.alert('Champs requis', 'Veuillez remplir le titre et la description.');
      return;
    }
    try {
      const result = await submit({
        title: t,
        description: d,
        screenshotUri: annotatedUri ?? screenshotUri,
        videoUri,
        recordingFrames: frames,
      });
      if (result) {
        onIssueCreated?.(result);
        onSubmissionSuccess?.();
        Alert.alert('✅ Ticket envoyé', getIssueSummary(result), [{ text: 'OK', onPress: onClose }]);
      } else {
        Alert.alert('📡 Hors ligne', "Ticket en file d'attente.", [{ text: 'OK', onPress: onClose }]);
      }
    } catch (e: any) {
      onSubmissionError?.(e);
    }
  };

  // ── Annotation full-screen ──────────────────────────────────────────────
  if (phase === 'annotate' && previewImg) {
    return (
      <Modal visible={visible} animationType="fade" statusBarTranslucent>
        <AnnotationEditor
          screenshotUri={previewImg}
          onDone={(uri) => { setAnnotatedUri(uri); setPhase('form'); }}
          onCancel={() => setPhase('form')}
        />
      </Modal>
    );
  }

  // ── Preview phase ──────────────────────────────────────────────────────
  if (phase === 'preview') {
    return (
      <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.overlay}>
          <View style={[styles.sheet, styles.previewSheet]}>
            <View style={styles.grip} />
            <Text style={styles.previewTitle}>
              {hasVideo ? '🎬 Enregistrement prêt' : '🖼 Capture d\'écran prête'}
            </Text>
            <Text style={styles.previewSub}>
              {hasVideo
                ? 'Vidéo MP4 — prête à joindre au ticket'
                : 'Capture d\'écran de fin d\'enregistrement (Fallback Simulateur)'
              }
            </Text>

            {/* Thumbnail */}
            {previewImg ? (
              <View style={styles.thumbBox}>
                <Image source={{ uri: previewImg }} style={styles.thumb} resizeMode="contain" />
                {hasVideo && (
                  <View style={styles.playBadge}>
                    <Text style={styles.playIcon}>▶</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.thumbPlaceholder}>
                <Text style={styles.thumbPlaceholderText}>
                  {hasVideo ? '📹 Vidéo MP4' : `🖼 ${frames.length} frames`}
                </Text>
              </View>
            )}

            <View style={styles.previewActions}>
              <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={onClose}>
                <Text style={[styles.btnText, styles.btnOutlineText]}>Fermer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={() => setPhase('form')}
              >
                <Text style={styles.btnText}>Créer un ticket</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Form phase ─────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <FormOverlay style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.grip} />
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => setPhase(skipPreview ? 'form' : 'preview')}
              disabled={loading}
            >
              <Text style={styles.backBtnText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Créer un ticket</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {/* Recording badge */}
            <View style={styles.recordingBadge}>
              <Text style={styles.recordingBadgeIcon}>{hasVideo ? '🎬' : '🖼'}</Text>
              <Text style={styles.recordingBadgeText}>
                {hasVideo ? 'Vidéo MP4 jointe' : 'Capture d\'écran de fin d\'enregistrement jointe'}
              </Text>
            </View>

            {/* Screenshot + annotate */}
            {previewImg ? (
              <View style={styles.screenshotRow}>
                <Image source={{ uri: previewImg }} style={styles.screenshot} resizeMode="contain" />
                <TouchableOpacity
                  style={styles.annotateBtn}
                  onPress={() => setPhase('annotate')}
                  disabled={loading || !screenshotUri}
                >
                  <Text style={styles.annotateBtnText}>✏️ Annoter</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {error ? <Text style={styles.errorText}>⚠️ {error}</Text> : null}

            <Text style={styles.label}>Titre <Text style={styles.req}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="Résumé du problème"
              placeholderTextColor="#aaa"
              value={title}
              onChangeText={setTitle}
              editable={!loading}
              maxLength={255}
            />

            <Text style={styles.label}>Description <Text style={styles.req}>*</Text></Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Étapes pour reproduire…"
              placeholderTextColor="#aaa"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              editable={!loading}
            />

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
      </FormOverlay>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },

  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '92%', paddingBottom: 24,
  },
  previewSheet: { padding: 24, alignItems: 'center', borderRadius: 20 },

  grip: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#ddd', marginBottom: 12, alignSelf: 'center' },

  // Preview phase
  previewTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a2e', marginBottom: 6, textAlign: 'center' },
  previewSub:   { fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 20 },
  thumbBox:     { width: '100%', height: 200, borderRadius: 14, overflow: 'hidden', backgroundColor: '#000', marginBottom: 24, alignItems: 'center', justifyContent: 'center' },
  thumb:        { width: '100%', height: '100%' },
  playBadge:    { position: 'absolute', width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  playIcon:     { fontSize: 22, color: '#1a1a2e' },
  thumbPlaceholder: { width: '100%', height: 140, borderRadius: 14, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  thumbPlaceholderText: { fontSize: 20, color: '#9ca3af' },

  previewActions: { flexDirection: 'row', gap: 12, width: '100%' },
  btn:         { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnPrimary:  { backgroundColor: INDIGO },
  btnOutline:  { borderWidth: 1.5, borderColor: INDIGO },
  btnText:     { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnOutlineText: { color: INDIGO },

  // Form phase
  header: { alignItems: 'center', paddingTop: 12, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  backBtn:  { position: 'absolute', left: 16, top: 12, padding: 6 },
  backBtnText: { fontSize: 22, color: INDIGO },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a2e' },
  closeBtn: { position: 'absolute', right: 16, top: 12, padding: 6 },
  closeBtnText: { fontSize: 18, color: '#888' },

  body: { padding: 20, gap: 12 },

  recordingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(94,92,230,0.08)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  recordingBadgeIcon: { fontSize: 18 },
  recordingBadgeText: { fontSize: 13, fontWeight: '700', color: INDIGO },

  screenshotRow: { gap: 8 },
  screenshot: { width: '100%', height: 130, borderRadius: 12, backgroundColor: '#f5f5f5' },
  annotateBtn: { alignSelf: 'flex-end', backgroundColor: INDIGO + '18', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  annotateBtnText: { fontSize: 13, fontWeight: '700', color: INDIGO },

  label: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  req:   { color: RED },
  input: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: '#1a1a2e', backgroundColor: '#fafafa' },
  textArea: { height: 110, textAlignVertical: 'top' },

  errorText: { fontSize: 13, color: RED, fontWeight: '600' },

  submitBtn: { backgroundColor: INDIGO, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  submitBtnDisabled: { opacity: 0.55 },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
