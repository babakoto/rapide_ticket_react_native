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
import { useTicketSubmit } from '../hooks/useTicketSubmit';
import { useGifRecorder } from '../hooks/useGifRecorder';
import { useScreenCapture } from '../hooks/useScreenCapture';
import { useRapideTicket } from './RapideTicketProvider';
import { AnnotationEditor } from './AnnotationEditor';
import { getIssueSummary } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  previewUri?: string | null;
}

type Screen = 'form' | 'annotate';

export const RapideTicketModal: React.FC<Props> = ({ visible, onClose, previewUri }) => {
  const { config } = useRapideTicket();
  const { setImageUri } = useScreenCapture();
  const { submit, loading, error } = useTicketSubmit(config);
  const recorder = useGifRecorder(config.gif?.enabled ?? true, config.gif?.fps);

  const [screen, setScreen] = useState<Screen>('form');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [annotatedUri, setAnnotatedUri] = useState<string | null>(null);

  const effectiveUri = annotatedUri || previewUri;

  useEffect(() => {
    if (visible) {
      setTitle('');
      setDescription('');
      setAnnotatedUri(null);
      setScreen('form');
    } else {
      if (recorder.isRecording) recorder.stopRecording();
      recorder.clearFrames();
    }
  }, [visible]);

  const handleAnnotationDone = (uri: string) => {
    setAnnotatedUri(uri);
    setScreen('form');
  };

  const handleToggleRecording = async () => {
    if (recorder.isRecording) {
      await recorder.stopRecording();
    } else {
      recorder.startRecording();
    }
  };

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();
    if (!trimmedTitle || !trimmedDesc) {
      Alert.alert('Champs requis', 'Veuillez remplir le titre et la description.');
      return;
    }

    // Stop recording and collect frames if any
    let frames: string[] = [];
    if (recorder.isRecording) {
      frames = await recorder.stopRecording();
    }

    const result = await submit({
      title: trimmedTitle,
      description: trimmedDesc,
      screenshotUri: effectiveUri,
      recordingFrames: frames,
    });

    if (result) {
      Alert.alert('✅ Ticket envoyé', getIssueSummary(result), [
        { text: 'OK', onPress: onClose },
      ]);
    } else {
      Alert.alert(
        '📡 Hors ligne',
        "Ticket mis en file d'attente, il sera envoyé à la reconnexion.",
        [{ text: 'OK', onPress: onClose }],
      );
    }
  };

  // ─── Annotation screen ───────────────────────────────────────────────────
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

  // ─── Main form screen ─────────────────────────────────────────────────────
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
            {/* Screenshot preview + annotation button */}
            {effectiveUri ? (
              <View style={styles.screenshotRow}>
                <View style={styles.screenshotBox}>
                  <Image
                    source={{ uri: effectiveUri }}
                    style={styles.screenshot}
                    resizeMode="contain"
                  />
                  {annotatedUri ? (
                    <View style={styles.annotatedBadge}>
                      <Text style={styles.annotatedBadgeText}>✏️ Annoté</Text>
                    </View>
                  ) : null}
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

            {/* Screen recorder toggle */}
            <View style={styles.recorderRow}>
              <View style={styles.recorderInfo}>
                <Text style={styles.recorderLabel}>Enregistrement écran</Text>
                {recorder.isRecording ? (
                  <Text style={styles.recorderFrames}>
                    {recorder.frameCount} frame{recorder.frameCount > 1 ? 's' : ''} capturée{recorder.frameCount > 1 ? 's' : ''}
                  </Text>
                ) : recorder.frameCount > 0 ? (
                  <Text style={styles.recorderFrames}>
                    ✅ {recorder.frameCount} frame{recorder.frameCount > 1 ? 's' : ''} enregistrée{recorder.frameCount > 1 ? 's' : ''}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={[
                  styles.recorderBtn,
                  recorder.isRecording && styles.recorderBtnActive,
                ]}
                onPress={handleToggleRecording}
                disabled={loading}
              >
                <Text style={styles.recorderBtnText}>
                  {recorder.isRecording ? '⏹ Stop' : '⏺ REC'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Title */}
            <Text style={styles.label}>Titre *</Text>
            <TextInput
              style={styles.input}
              placeholder="Résumé du problème"
              placeholderTextColor="#aaa"
              value={title}
              onChangeText={setTitle}
              maxLength={255}
              editable={!loading}
              returnKeyType="next"
            />

            {/* Description */}
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Décrivez le problème en détail..."
              placeholderTextColor="#aaa"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              editable={!loading}
              textAlignVertical="top"
            />

            {/* Error */}
            {error ? <Text style={styles.errorText}>⚠️ {error}</Text> : null}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.submitBtn, loading && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Envoyer</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  header: {
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  grip: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)', marginBottom: 10,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
  closeBtn: { position: 'absolute', right: 20, top: 20, padding: 4 },
  closeBtnText: { fontSize: 18, color: 'rgba(255,255,255,0.5)' },
  body: { padding: 20, paddingBottom: 4 },

  // Screenshot + annotation
  screenshotRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  screenshotBox: { flex: 1, position: 'relative' },
  screenshot: {
    width: '100%', height: 140, borderRadius: 10,
    backgroundColor: '#0d0d1a',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  annotatedBadge: {
    position: 'absolute', top: 6, left: 6,
    backgroundColor: 'rgba(108,99,255,0.85)',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  annotatedBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  annotateBtn: {
    backgroundColor: 'rgba(108,99,255,0.2)',
    borderWidth: 1, borderColor: '#6c63ff',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  annotateBtnIcon: { fontSize: 20 },
  annotateBtnText: { color: '#6c63ff', fontSize: 12, fontWeight: '600' },

  // Recorder
  recorderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  recorderInfo: { flex: 1 },
  recorderLabel: { color: 'rgba(255,255,255,0.8)', fontWeight: '600', fontSize: 14 },
  recorderFrames: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  recorderBtn: {
    backgroundColor: 'rgba(255,59,48,0.15)',
    borderWidth: 1.5, borderColor: '#FF3B30',
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7,
  },
  recorderBtnActive: {
    backgroundColor: 'rgba(255,59,48,0.3)',
  },
  recorderBtnText: { color: '#FF3B30', fontWeight: '700', fontSize: 13 },

  // Form fields
  label: {
    fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)',
    marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10, padding: 12, marginBottom: 16,
    fontSize: 15, color: '#fff', backgroundColor: 'rgba(255,255,255,0.05)',
  },
  textArea: { minHeight: 100 },
  errorText: { color: '#ff6b6b', fontSize: 13, marginBottom: 8 },

  // Footer
  footer: {
    flexDirection: 'row', paddingHorizontal: 20, paddingTop: 12, gap: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  btn: {
    flex: 1, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtn: { backgroundColor: 'rgba(255,255,255,0.08)' },
  cancelBtnText: { color: 'rgba(255,255,255,0.7)', fontWeight: '600', fontSize: 15 },
  submitBtn: {
    backgroundColor: '#6c63ff',
    shadowColor: '#6c63ff', shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 6,
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.6 },
});
