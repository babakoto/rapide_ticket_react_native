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
import { useScreenCapture } from '../hooks/useScreenCapture';
import { useTicketSubmit } from '../hooks/useTicketSubmit';
import { useRapideTicket } from './RapideTicketProvider';
import { getIssueSummary } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Pre-captured screenshot URI (captured before the modal opened) */
  previewUri?: string | null;
}

export const RapideTicketModal: React.FC<Props> = ({ visible, onClose, previewUri }) => {
  const { config } = useRapideTicket();
  const { capture, imageUri, setImageUri } = useScreenCapture();
  const { submit, loading, error } = useTicketSubmit(config);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Use the pre-captured URI if provided; otherwise capture when modal opens
  useEffect(() => {
    if (visible) {
      setTitle('');
      setDescription('');
      if (previewUri) {
        setImageUri(previewUri);
      } else {
        // Fallback: capture now (modal overlay will be visible, but better than nothing)
        capture();
      }
    }
  }, [visible]);

  const effectiveUri = previewUri || imageUri;

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (!trimmedTitle || !trimmedDescription) {
      Alert.alert('Champs requis', 'Veuillez remplir le titre et la description.');
      return;
    }

    const result = await submit({
      title: trimmedTitle,
      description: trimmedDescription,
      screenshotUri: effectiveUri,
    });

    if (result) {
      const summary = getIssueSummary(result);
      Alert.alert('✅ Ticket envoyé', summary, [
        { text: 'OK', onPress: onClose },
      ]);
    } else {
      // Offline queued
      Alert.alert(
        '📡 Hors ligne',
        'Le ticket a été mis en file d\'attente et sera envoyé à la prochaine connexion.',
        [{ text: 'OK', onPress: onClose }],
      );
    }
  };

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
              <View style={styles.screenshotContainer}>
                <Text style={styles.label}>Capture d'écran</Text>
                <Image
                  source={{ uri: effectiveUri }}
                  style={styles.screenshot}
                  resizeMode="contain"
                />
              </View>
            ) : null}

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
            {error ? (
              <Text style={styles.errorText}>⚠️ {error}</Text>
            ) : null}
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
    maxHeight: '90%',
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
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    top: 20,
    padding: 4,
  },
  closeBtnText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.5)',
  },
  body: {
    padding: 20,
    paddingBottom: 4,
  },
  screenshotContainer: {
    marginBottom: 16,
  },
  screenshot: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    backgroundColor: '#0d0d1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 6,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    fontSize: 15,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  textArea: {
    minHeight: 110,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 13,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  btn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cancelBtnText: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    fontSize: 15,
  },
  submitBtn: {
    backgroundColor: '#6c63ff',
    shadowColor: '#6c63ff',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
