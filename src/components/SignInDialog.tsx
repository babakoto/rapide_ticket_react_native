/**
 * SignInDialog — Bottom sheet dialog sign-in
 * Equivalent to Flutter's sign_in_sheet.dart (showRapideTicketSignInDialog)
 */
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { AuthService } from '../services/AuthService';
import { RapideTicketConfig } from '../types';

interface Props {
  visible: boolean;
  config: RapideTicketConfig;
  inviteToken?: string;
  onSuccess: () => void;
  onClose: () => void;
}

export const SignInDialog: React.FC<Props> = ({
  visible, config, inviteToken, onSuccess, onClose,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [atlassianBusy, setAtlassianBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = loading || atlassianBusy;

  const handleAtlassian = async () => {
    setAtlassianBusy(true);
    setError(null);
    try {
      const { authorizationUrl, configured } = await AuthService.getAtlassianAuthorizationUrl(
        { projectId: config.projectId, inviteToken },
        config.apiBaseUrl,
      );
      if (!configured) { setError('Atlassian OAuth not configured.'); return; }
      if (authorizationUrl) {
        Alert.alert('Atlassian OAuth', `Ouvrir ce lien :\n\n${authorizationUrl}`);
      }
    } catch (e: any) {
      setError(e?.message || 'Atlassian auth failed');
    } finally {
      setAtlassianBusy(false);
    }
  };

  const handleSignIn = async () => {
    setError(null);
    if (!email.trim() || !email.includes('@')) { setError('Invalid email'); return; }
    if (!password) { setError('Password required'); return; }
    setLoading(true);
    try {
      await AuthService.signIn(email.trim(), password, config.apiBaseUrl);
      setEmail(''); setPassword('');
      onSuccess();
    } catch (e: any) {
      setError(e?.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!busy) onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity activeOpacity={1}>
            <View style={styles.dialog}>
              {/* Title */}
              <Text style={styles.title}>RapideTicket sign-in</Text>
              <Text style={styles.subtitle}>
                JWT via email / password or Atlassian (OAuth).
              </Text>

              {/* Error */}
              {error ? (
                <Text style={styles.errorText}>{error}</Text>
              ) : null}

              {/* Atlassian button */}
              <TouchableOpacity
                style={[styles.atlassianBtn, busy && styles.btnDisabled]}
                onPress={handleAtlassian}
                disabled={busy}
              >
                {atlassianBusy
                  ? <ActivityIndicator size="small" color="#2684FF" />
                  : <Text style={styles.atlassianIcon}>🔗</Text>
                }
                <Text style={styles.atlassianText}>Atlassian</Text>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Email */}
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#aaa"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!busy}
                returnKeyType="next"
              />

              {/* Password */}
              <TextInput
                style={[styles.input, { marginTop: 10 }]}
                placeholder="Password"
                placeholderTextColor="#aaa"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!busy}
                returnKeyType="done"
                onSubmitEditing={handleSignIn}
              />

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.cancelBtn]}
                  onPress={handleClose}
                  disabled={busy}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.submitBtn, busy && styles.btnDisabled]}
                  onPress={handleSignIn}
                  disabled={busy}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.submitText}>Sign in</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  dialog: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 8 }, shadowRadius: 20, elevation: 16,
    minWidth: 300,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#1a1a2e', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 18 },
  errorText: { color: '#DC2626', fontSize: 13, fontWeight: '600', marginBottom: 12 },

  atlassianBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#2684FF', borderRadius: 12,
    padding: 12, gap: 8, marginBottom: 4,
  },
  atlassianIcon: { fontSize: 18 },
  atlassianText: { color: '#2684FF', fontWeight: '700', fontSize: 15 },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 14, gap: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.08)' },
  dividerText: { color: '#9ca3af', fontSize: 12, fontWeight: '600' },

  input: {
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 15, color: '#1a1a2e', backgroundColor: '#f9fafb',
  },

  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  actionBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtn: { backgroundColor: 'rgba(0,0,0,0.06)' },
  cancelText: { color: '#6b7280', fontWeight: '600', fontSize: 14 },
  submitBtn: { backgroundColor: '#5E5CE6' },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
});
