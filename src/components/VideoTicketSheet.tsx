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

// ─── Flutter color palette ──────────────────────────────────────────────────
const RT_BLUE      = '#2051E8';
const RT_BLUE_SOFT = '#E8F0FF';
const RT_INK       = '#172B4D';
const RT_MUTED     = '#5E6C84';
const RT_SURFACE   = '#F8FBFF';
const RT_FIELD     = '#F7F9FC';
const RT_BORDER    = '#DFE1E6';
const RT_GREEN     = '#1F9D68';
const INDIGO       = '#5E5CE6';
const RED          = '#E53935';

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

  // ── Preview phase (Flutter _VideoTicketPostEncodeSheet — preview mode) ──
  if (phase === 'preview') {
    return (
      <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.overlay}>
          <View style={[styles.sheet, styles.previewSheet]}>
            <View style={styles.grip} />
            <Text style={styles.previewTitle}>
              {hasVideo ? 'Recording ready' : 'Screenshot ready'}
            </Text>
            <Text style={styles.previewSub}>
              {hasVideo
                ? 'Close to dismiss, or create a ticket with this video attached.'
                : 'Close to dismiss, or create a ticket with this screenshot attached.'
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
                <Text style={[styles.btnText, styles.btnOutlineText]}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={() => setPhase('form')}
              >
                <Text style={styles.btnText}>Create ticket</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Form phase (Flutter _VideoTicketPostEncodeSheet — form mode) ────────
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
            <Text style={styles.headerTitle}>Create a ticket</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {/* Recording badge (Flutter _GifAttachmentSummaryCard) */}
            <View style={styles.recordingBadge}>
              <Text style={styles.recordingBadgeIcon}>{hasVideo ? '🎬' : '🖼'}</Text>
              <View style={styles.recordingBadgeInfo}>
                <View style={styles.recordingBadgeRow}>
                  {hasVideo && (
                    <View style={styles.mp4Tag}>
                      <Text style={styles.mp4TagText}>MP4</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.recordingBadgeTitle}>
                  {hasVideo ? 'Screen recording' : 'Screenshot capture'}
                </Text>
                <Text style={styles.recordingBadgeSub}>
                  Review the preview before sending; use ← to go back.
                </Text>
              </View>
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
                  <Text style={styles.annotateBtnText}>✏️ Annotate</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {error ? <Text style={styles.errorText}>⚠️ {error}</Text> : null}

            <Text style={styles.label}>Title <Text style={styles.req}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="Issue summary"
              placeholderTextColor={RT_MUTED + 'B8'}
              value={title}
              onChangeText={setTitle}
              editable={!loading}
              maxLength={255}
            />

            <Text style={styles.label}>Description <Text style={styles.req}>*</Text></Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Steps to reproduce…"
              placeholderTextColor={RT_MUTED + 'B8'}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              editable={!loading}
            />

            {/* Spacer for sticky footer */}
            <View style={{ height: 16 }} />
          </ScrollView>

          {/* Sticky submit footer */}
          <View style={styles.submitFooter}>
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : (
                  <View style={styles.submitBtnContent}>
                    <Text style={styles.submitBtnIcon}>✉</Text>
                    <Text style={styles.submitBtnText}>Send</Text>
                  </View>
                )
              }
            </TouchableOpacity>
          </View>
        </View>
      </FormOverlay>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },

  sheet: {
    backgroundColor: RT_SURFACE,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '92%', paddingBottom: 0,
  },
  previewSheet: {
    padding: 24, alignItems: 'center', borderRadius: 20,
    backgroundColor: '#fff',
  },

  grip: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#ddd', marginBottom: 12, alignSelf: 'center' },

  // Preview phase (Flutter — titleMedium w700, bodySmall onSurfaceVariant)
  previewTitle: { fontSize: 18, fontWeight: '700', color: RT_INK, marginBottom: 6, textAlign: 'center' },
  previewSub:   { fontSize: 13, color: RT_MUTED, textAlign: 'center', marginBottom: 20, lineHeight: 18 },
  thumbBox:     { width: '100%', height: 200, borderRadius: 14, overflow: 'hidden', backgroundColor: '#000', marginBottom: 24, alignItems: 'center', justifyContent: 'center' },
  thumb:        { width: '100%', height: '100%' },
  playBadge:    { position: 'absolute', width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  playIcon:     { fontSize: 22, color: RT_INK },
  thumbPlaceholder: { width: '100%', height: 140, borderRadius: 14, backgroundColor: RT_FIELD, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  thumbPlaceholderText: { fontSize: 20, color: RT_MUTED },

  // Preview buttons (Flutter OutlinedButton + FilledButton)
  previewActions: { flexDirection: 'row', gap: 12, width: '100%' },
  btn:         { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnPrimary:  { backgroundColor: RT_BLUE },
  btnOutline:  { borderWidth: 1.5, borderColor: RT_BLUE },
  btnText:     { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnOutlineText: { color: RT_BLUE },

  // Form phase header
  header: {
    alignItems: 'center', paddingTop: 12, paddingHorizontal: 16,
    paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: RT_BORDER,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  backBtn:      { position: 'absolute', left: 16, top: 12, padding: 6 },
  backBtnText:  { fontSize: 22, color: RT_BLUE },
  headerTitle:  { fontSize: 17, fontWeight: '700', color: RT_INK },
  closeBtn:     { position: 'absolute', right: 16, top: 12, padding: 6 },
  closeBtnText: { fontSize: 18, color: RT_MUTED },

  body: { padding: 20, gap: 12 },

  // Recording badge (Flutter _GifAttachmentSummaryCard)
  recordingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: RT_FIELD, borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  recordingBadgeIcon: { fontSize: 26 },
  recordingBadgeInfo: { flex: 1, gap: 3 },
  recordingBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mp4Tag: {
    backgroundColor: RT_BLUE_SOFT, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  mp4TagText: { fontSize: 11, fontWeight: '800', color: RT_BLUE, letterSpacing: 0.4 },
  recordingBadgeTitle: { fontSize: 14, fontWeight: '700', color: RT_INK },
  recordingBadgeSub: { fontSize: 12, color: RT_MUTED, lineHeight: 16 },

  // Screenshot + annotate
  screenshotRow: { gap: 8 },
  screenshot: { width: '100%', height: 130, borderRadius: 14, backgroundColor: RT_FIELD },
  annotateBtn: {
    alignSelf: 'flex-end',
    backgroundColor: RT_BLUE + '18', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  annotateBtnText: { fontSize: 13, fontWeight: '700', color: RT_BLUE },

  // Form fields (aligned with Flutter _fieldDecoration)
  label: { fontSize: 13, fontWeight: '600', color: RT_MUTED },
  req:   { color: RED },
  input: {
    borderWidth: 1, borderColor: RT_BORDER,
    borderRadius: 14, paddingHorizontal: 18, paddingVertical: 15,
    fontSize: 15, color: RT_INK, backgroundColor: '#fff',
  },
  textArea: { height: 120, textAlignVertical: 'top' },

  errorText: { fontSize: 13, color: RED, fontWeight: '600' },

  // Sticky submit footer
  submitFooter: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: RT_BORDER + '59',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 12,
    elevation: 8,
  },
  submitBtn: {
    backgroundColor: RT_BLUE, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
    minHeight: 52, justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.55 },
  submitBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  submitBtnIcon: { fontSize: 16, color: '#fff' },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
