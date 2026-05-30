/**
 * SignInScreen — Full-screen sign-in page
 * Equivalent to Flutter's sign_in_page.dart (_RapideTicketSignInScaffold)
 *
 * Providers: Jira (Atlassian OAuth), GitHub (coming soon),
 *            GitLab (coming soon), Email/Password (expandable)
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
  ScrollView,
  SafeAreaView,
  Animated,
  LayoutAnimation,
  UIManager,
  Platform,
  KeyboardAvoidingView,
  Alert,
  Clipboard,
  ToastAndroid,
  Linking,
  Image,
} from 'react-native';

const LogoImg = require('../assets/logo_rapide_ticket.png');
import { AuthService } from '../services/AuthService';
import { RapideTicketConfig } from '../types';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Brand colors (matching Flutter constants)
const COLOR_JIRA_BLUE    = '#2684FF';
const COLOR_GITHUB_BLACK = '#111418';
const COLOR_GITLAB_ORANGE= '#FC6D26';
const COLOR_EMAIL_INDIGO = '#5E5CE6';

interface Props {
  visible: boolean;
  config: RapideTicketConfig;
  inviteToken?: string;
  onSuccess: () => void;
  onClose: () => void;
}

// ─── Auth Provider Button ──────────────────────────────────────────────────
interface ProviderBtnProps {
  label: string;
  brandColor: string;
  icon: React.ReactNode;
  loading?: boolean;
  enabled: boolean;
  expanded?: boolean;
  onPress: () => void;
}

const AuthProviderButton: React.FC<ProviderBtnProps> = ({
  label, brandColor, icon, loading = false, enabled, expanded = false, onPress,
}) => (
  <TouchableOpacity
    style={[styles.providerBtn, expanded && { borderColor: brandColor + '88', borderWidth: 1.5 }]}
    onPress={enabled ? onPress : undefined}
    activeOpacity={enabled ? 0.75 : 1}
  >
    <View style={{ opacity: enabled ? 1 : 0.55, flex: 1, flexDirection: 'row', alignItems: 'center' }}>
      <View style={[styles.providerIcon, { backgroundColor: brandColor }]}>
        {icon}
      </View>
      <Text style={styles.providerLabel}>{label}</Text>
      {loading
        ? <ActivityIndicator size="small" color={brandColor} />
        : <Text style={styles.providerChevron}>{expanded ? '∧' : '›'}</Text>
      }
    </View>
  </TouchableOpacity>
);

// ─── Info Callout ──────────────────────────────────────────────────────────
const InfoCallout: React.FC<{ icon: string; color: string; bg: string; text: string }> = ({
  icon, color, bg, text,
}) => (
  <View style={[styles.callout, { backgroundColor: bg }]}>
    <Text style={{ fontSize: 16, marginRight: 8 }}>{icon}</Text>
    <Text style={[styles.calloutText, { color }]}>{text}</Text>
  </View>
);

// ─── Email/Password Form ────────────────────────────────────────────────────
interface EmailFormProps {
  busy: boolean;
  loading: boolean;
  setLoading: (l: boolean) => void;
  apiBaseUrl?: string;
  onSuccess: () => void;
}

const EmailPasswordForm: React.FC<EmailFormProps> = ({ busy, loading, setLoading, apiBaseUrl, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!email.trim() || !email.includes('@')) { setErr('Invalid email'); return; }
    if (!password) { setErr('Password required'); return; }
    setLoading(true);
    try {
      await AuthService.signIn(email.trim(), password, apiBaseUrl);
      onSuccess();
    } catch (e: any) {
      setErr(e?.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.emailForm}>
      {err ? <Text style={styles.formError}>{err}</Text> : null}
      <View style={styles.inputRow}>
        <Text style={styles.inputPrefix}>@</Text>
        <TextInput
          style={styles.formInput}
          placeholder="Email"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!busy}
          returnKeyType="next"
        />
      </View>
      <View style={[styles.inputRow, { marginTop: 10 }]}>
        <Text style={styles.inputPrefix}>🔒</Text>
        <TextInput
          style={styles.formInput}
          placeholder="Password"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!busy}
          returnKeyType="done"
          onSubmitEditing={submit}
        />
      </View>
      <TouchableOpacity
        style={[styles.signInBtn, busy && styles.btnDisabled]}
        onPress={submit}
        disabled={busy}
      >
        {loading
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.signInBtnText}>Sign in</Text>
        }
      </TouchableOpacity>
    </View>
  );
};

// ─── Main Screen ────────────────────────────────────────────────────────────
export const SignInScreen: React.FC<Props> = ({
  visible, config, inviteToken, onSuccess, onClose,
}) => {
  const [atlassianBusy, setAtlassianBusy] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = atlassianBusy || emailLoading;

  const handleAtlassian = async () => {
    setAtlassianBusy(true);
    setError(null);
    try {
      const { authorizationUrl, configured } = await AuthService.getAtlassianAuthorizationUrl(
        { projectId: config.projectId, inviteToken },
        config.apiBaseUrl,
      );
      if (!configured) {
        setError('Atlassian OAuth is not configured for this project.');
        return;
      }
      if (authorizationUrl) {
        Alert.alert(
          'Atlassian OAuth',
          `Open this URL in your browser to sign in:\n\n${authorizationUrl}`,
          [
            {
              text: 'Copier le lien',
              onPress: () => {
                Clipboard.setString(authorizationUrl);
                if (Platform.OS === 'android') {
                  ToastAndroid.show('Lien copié avec succès !', ToastAndroid.SHORT);
                } else {
                  Alert.alert('Succès', 'Lien copié avec succès !');
                }
              },
            },
            {
              text: 'Ouvrir',
              onPress: () => {
                Linking.openURL(authorizationUrl).catch((err) => {
                  console.error('Failed to open URL:', err);
                  Alert.alert('Erreur', "Impossible d'ouvrir le navigateur.");
                });
              },
            },
            {
              text: 'OK',
              style: 'cancel',
            },
          ],
        );
      }
    } catch (e: any) {
      setError(e?.message || 'Atlassian auth failed');
    } finally {
      setAtlassianBusy(false);
    }
  };

  const handleEmailToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowEmail((v) => !v);
  };

  const handleEmailSuccess = () => {
    onSuccess();
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Back button */}
          <TouchableOpacity style={styles.backBtn} onPress={onClose} disabled={busy}>
            <Text style={styles.backBtnText}>‹</Text>
          </TouchableOpacity>

          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Brand header */}
            <View style={styles.brandHeader}>
              <Image source={LogoImg} style={styles.brandLogo} resizeMode="contain" />
              <Text style={styles.brandSubtitle}>
                Sign in to capture, record and ship tickets in seconds.
              </Text>
            </View>

            {/* Invite callout */}
            {inviteToken ? (
              <InfoCallout
                icon="✉️"
                color="#B45309"
                bg="#FEF3C7"
                text="If you are using an invite, sign in with the email from the message."
              />
            ) : null}

            {/* Error callout */}
            {error ? (
              <InfoCallout icon="⚠️" color="#DC2626" bg="#FEE2E2" text={error} />
            ) : null}

            {/* Jira / Atlassian */}
            <AuthProviderButton
              label="Jira Authentication"
              brandColor={COLOR_JIRA_BLUE}
              icon={<Text style={styles.glyphText}>J</Text>}
              loading={atlassianBusy}
              enabled={!busy}
              onPress={handleAtlassian}
            />

            {/* GitHub (coming soon) */}
            <AuthProviderButton
              label="Github Authentication"
              brandColor={COLOR_GITHUB_BLACK}
              icon={<Text style={styles.glyphText}>{'</>'}</Text>}
              enabled={!busy}
              onPress={() => Alert.alert('Coming soon', 'GitHub authentication is coming soon.')}
            />

            {/* GitLab (coming soon) */}
            <AuthProviderButton
              label="Gitlab Authentication"
              brandColor={COLOR_GITLAB_ORANGE}
              icon={<Text style={styles.glyphText}>GL</Text>}
              enabled={!busy}
              onPress={() => Alert.alert('Coming soon', 'GitLab authentication is coming soon.')}
            />

            {/* Email / Password */}
            <AuthProviderButton
              label="Email / Password"
              brandColor={COLOR_EMAIL_INDIGO}
              icon={<Text style={styles.glyphText}>✉</Text>}
              enabled={!busy}
              expanded={showEmail}
              onPress={handleEmailToggle}
            />

            {showEmail && (
              <EmailPasswordForm
                busy={busy}
                loading={emailLoading}
                setLoading={setEmailLoading}
                apiBaseUrl={config.apiBaseUrl}
                onSuccess={handleEmailSuccess}
              />
            )}

            <Text style={styles.footer}>
              Your session is JWT-based. Other providers are coming next.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 24, paddingTop: 56, gap: 12 },
  backBtn: {
    position: 'absolute', top: 8, left: 8, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { fontSize: 28, color: '#333', lineHeight: 36 },

  // Brand header
  brandHeader: { alignItems: 'center', marginBottom: 8 },
  brandLogo: {
    width: 140,
    height: 60,
    marginBottom: 16,
  },
  brandSubtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20 },

  // Callout
  callout: {
    flexDirection: 'row', alignItems: 'flex-start',
    borderRadius: 14, padding: 12, marginBottom: 4,
  },
  calloutText: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 20 },

  // Provider buttons
  providerBtn: {
    backgroundColor: '#fff', borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)',
    padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4, elevation: 2,
  },
  providerIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
    shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 4,
  },
  providerLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1a1a2e' },
  providerChevron: { fontSize: 20, color: '#9ca3af' },
  glyphText: { color: '#fff', fontWeight: '900', fontSize: 16 },

  // Email form
  emailForm: {
    backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
    padding: 16, marginTop: -4,
  },
  formError: { color: '#DC2626', fontSize: 13, marginBottom: 8, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)',
    paddingHorizontal: 12,
  },
  inputPrefix: { fontSize: 16, color: '#9ca3af', marginRight: 8 },
  formInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#1a1a2e' },
  signInBtn: {
    backgroundColor: COLOR_EMAIL_INDIGO, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 14,
  },
  signInBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.6 },

  footer: { fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 8, lineHeight: 18 },
});
