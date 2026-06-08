/**
 * RapideTicketModal — Bug-report sheet
 *
 * Features:
 *  - Screenshot preview + AnnotationEditor
 *  - Native screen recorder (MP4 via react-native-record-screen)
 *    with live timer, pause/resume and dock-mode state
 *  - Frame-capture fallback when native recorder is unavailable
 *  - Assignee picker (mirrors Flutter TicketAssignablePerson)
 *  - Multipart submission (screenshot + video or frames + assignee)
 */
import React, { useState, useEffect, useCallback } from 'react';
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
  FlatList,
  Animated,
} from 'react-native';
import { useTicketSubmit }    from '../hooks/useTicketSubmit';
import { useScreenRecorder }  from '../hooks/useScreenRecorder';
import { useScreenCapture }   from '../hooks/useScreenCapture';
import { useAssignees }       from '../hooks/useAssignees';
import { useRapideTicket }    from './RapideTicketProvider';
import { AnnotationEditor }   from './AnnotationEditor';
import { SecretFeedbackOverlay, DockMode } from './SecretFeedbackOverlay';
import { getIssueSummary, TicketAssignablePerson, SignInMethod } from '../types';
import { AuthService }        from '../services/AuthService';

const LogoImg = require('../assets/logo_rapide_ticket.png');

// ─── Flutter color palette (_rt* from rapide_ticket_issue_feedback_builder.dart) ──
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
const GREEN        = '#22A06B';

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

import { ScreenRecorderState } from '../hooks/useScreenRecorder';

interface Props {
  visible: boolean;
  onClose: () => void;
  previewUri?: string | null;
  inviteToken?: string;
  recorder: ScreenRecorderState;
  recordResult: { videoUri: string | null; frames: string[] } | null;
  setRecordResult: React.Dispatch<React.SetStateAction<{ videoUri: string | null; frames: string[] } | null>>;
}

let _shouldKeepRecordResult = false;

type Screen = 'form' | 'annotate';

export const RapideTicketModal: React.FC<Props> = ({
  visible,
  onClose,
  previewUri,
  inviteToken,
  recorder,
  recordResult,
  setRecordResult,
}) => {
  const { config, openPanelDirectly } = useRapideTicket();
  const { setImageUri } = useScreenCapture();
  const { submit, loading, error } = useTicketSubmit(config, inviteToken);

  // Sign-in method drives the assignee list source
  const [signInMethod, setSignInMethod] = useState<SignInMethod>('none');

  // Load sign-in method when modal opens
  useEffect(() => {
    if (visible) {
      (async () => {
        let method = await AuthService.getSignInMethod();
        // Fallback for sessions created before sign-in method was persisted:
        // if a token exists, treat the session as 'password' (most common flow).
        if (method === 'none') {
          const hasToken = await AuthService.isSignedIn();
          if (hasToken) method = 'password';
        }
        setSignInMethod(method);
      })();
    }
  }, [visible]);

  const { assignees, loading: assigneesLoading } = useAssignees(config, signInMethod);

  const [screen,          setScreen]          = useState<Screen>('form');
  const [title,           setTitle]           = useState('');
  const [description,     setDescription]     = useState('');
  const [annotatedUri,    setAnnotatedUri]    = useState<string | null>(null);
  const [dockMode,        setDockMode]        = useState<DockMode>('home');
  const [selectedAssignee, setSelectedAssignee] = useState<TicketAssignablePerson | null>(null);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);

  // Recover form states on mount / recovery
  useEffect(() => {
    if (recorder.recoveredFormState) {
      if (recorder.recoveredFormState.title) {
        setTitle(recorder.recoveredFormState.title);
      }
      if (recorder.recoveredFormState.description) {
        setDescription(recorder.recoveredFormState.description);
      }
    }
  }, [recorder.recoveredFormState]);

  useEffect(() => {
    if (recorder.recoveredFormState?.assigneeStableKey && assignees.length > 0) {
      const match = assignees.find((a) => a.stableKey === recorder.recoveredFormState?.assigneeStableKey);
      if (match) {
        setSelectedAssignee(match);
      }
    }
  }, [recorder.recoveredFormState, assignees]);

  const effectiveUri = annotatedUri || previewUri;

  // ── Logout handler ──────────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            await AuthService.signOut();
            setSignInMethod('none');
            setSelectedAssignee(null);
            onClose();
          },
        },
      ],
    );
  }, [onClose]);

  // ── Reset on open/close ───────────────────────────────────────────────
  useEffect(() => {
    if (recorder.isRecovering) {
      return;
    }
    if (visible) {
      if (_shouldKeepRecordResult) {
        _shouldKeepRecordResult = false;
      } else {
        setTitle('');
        setDescription('');
        setAnnotatedUri(null);
        setScreen('form');
        // If recorder is active (recovered from Activity recreation), keep gifRecording mode
        const isActiveRecording = recorder.state === 'recording' || recorder.state === 'paused';
        setDockMode(isActiveRecording ? 'gifRecording' : 'home');
        setSelectedAssignee(null);
        setShowAssigneePicker(false);
      }
    }
  }, [visible, recorder.isRecovering]);

  // ── Dock action handlers ──────────────────────────────────────────────

  const handleRecordGif = () => setDockMode('gifReady');

  const handleGifBack = () => {
    recorder.reset();
    setDockMode('home');
  };

  const handleGifStart = async () => {
    await recorder.start({
      title,
      description,
      assigneeStableKey: selectedAssignee?.stableKey,
    });
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
    await recorder.stop();
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

    // Resolve assignee fields from selected person (mirrors Flutter issue_feedback_fields.dart)
    const assigneeUserId         = selectedAssignee?.userId        ?? null;
    const jiraAssigneeAccountId  = selectedAssignee?.accountId     ?? null;

    const result = await submit({
      title:          trimmedTitle,
      description:    trimmedDesc,
      screenshotUri:  effectiveUri,
      videoUri:       finalRecording?.videoUri ?? null,
      recordingFrames: finalRecording?.frames ?? [],
      assigneeUserId,
      jiraAssigneeAccountId,
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

  // ── Assignee picker view ─────────────────────────────────────────────
  const assigneePickerView = showAssigneePicker ? (
    <View style={styles.pickerOverlay}>
      <View style={styles.pickerSheet}>
        <View style={styles.pickerHeader}>
          <Text style={styles.pickerTitle}>Assigner à</Text>
          <TouchableOpacity onPress={() => setShowAssigneePicker(false)} style={styles.pickerCloseBtn}>
            <Text style={styles.pickerCloseText}>✕</Text>
          </TouchableOpacity>
        </View>

        {assigneesLoading ? (
          <View style={styles.pickerLoading}>
            <ActivityIndicator color={RT_BLUE} />
            <Text style={styles.pickerLoadingText}>Chargement…</Text>
          </View>
        ) : assignees.length === 0 ? (
          <View style={styles.pickerEmpty}>
            <Text style={styles.pickerEmptyText}>Aucun assignee disponible</Text>
          </View>
        ) : (
          <FlatList
            data={[{ stableKey: '__none__', displayName: 'Non assigné', accountId: undefined, userId: undefined } as TicketAssignablePerson, ...assignees]}
            keyExtractor={(item) => item.stableKey}
            contentContainerStyle={styles.pickerList}
            renderItem={({ item }) => {
              const isNone     = item.stableKey === '__none__';
              const isSelected = isNone
                ? selectedAssignee === null
                : selectedAssignee?.stableKey === item.stableKey;
              return (
                <TouchableOpacity
                  style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                  onPress={() => {
                    setSelectedAssignee(isNone ? null : item);
                    setShowAssigneePicker(false);
                  }}
                >
                  {/* Avatar / initials */}
                  <View style={[styles.avatar, isSelected && styles.avatarSelected]}>
                    {item.avatarUrl && !isNone ? (
                      <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />
                    ) : (
                      <Text style={[styles.avatarInitial, isSelected && styles.avatarInitialSelected]}>
                        {isNone ? '—' : item.displayName.charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={styles.pickerItemInfo}>
                    <Text style={[styles.pickerItemName, isSelected && styles.pickerItemNameSelected]}>
                      {item.displayName}
                    </Text>
                    {item.email ? (
                      <Text style={styles.pickerItemEmail}>{item.email}</Text>
                    ) : null}
                  </View>
                  {isSelected && <Text style={styles.pickerCheckmark}>✓</Text>}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </View>
  ) : null;

  // ── Recording badge ───────────────────────────────────────────────────
  const recordingBadge = (() => {
    if (recorder.state === 'recording' || recorder.state === 'paused') {
      return (
        <View style={styles.recBadge}>
          <View style={[styles.recDot, recorder.state === 'paused' && styles.recDotPaused]} />
          <Text style={styles.recTimer}>{recorder.timerLabel}</Text>
          {recorder.isNative
            ? <Text style={styles.recMode}>📹 MP4</Text>
            : <Text style={styles.recMode}>🖼 Capture d'écran (Fallback)</Text>
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
              : '✅ Capture d\'écran de fin prête'
            }
          </Text>
        </View>
      );
    }
    return null;
  })();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
        <FormOverlay style={styles.overlay}>
          <View style={styles.sheet}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.grip} />
              <View style={styles.headerRow}>
                {signInMethod !== 'none' ? (
                  <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} disabled={loading}>
                    <Text style={styles.logoutBtnIcon}>↩</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.headerSpacer} />
                )}
                <View style={styles.headerTitleContainer}>
                  <Image source={LogoImg} style={styles.headerLogo} resizeMode="contain" />
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={onClose} disabled={loading}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Scrollable form */}
            <ScrollView
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Title header */}
              <Text style={styles.formTitle}>Create a ticket</Text>
              <Text style={styles.formSubtitle}>Add a title, description, and attachments.</Text>

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
                      : 'Capture d\'écran de fin (Fallback Simulateur)'
                    }
                  </Text>
                  {Platform.OS === 'android' && recorder.canUseNative && (
                    <Text style={[styles.recorderSub, { color: '#e67e22', marginTop: 4, fontSize: 11, fontWeight: '500' }]}>
                      ⚠️ Sur Android 14+, veuillez choisir "Partager tout l'écran" (et non "Partager une application") pour éviter un écran blanc.
                    </Text>
                  )}
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

              {/* Title */}
              <Text style={styles.label}>Titre <Text style={styles.req}>*</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="Ex. : crash sur l'écran d'accueil"
                placeholderTextColor={RT_MUTED + 'B8'}
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
                placeholderTextColor={RT_MUTED + 'B8'}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={5}
                editable={!loading}
              />

              {/* Assignee picker */}
              {signInMethod !== 'none' && (
                <>
                  <Text style={styles.label}>Assigné à</Text>
                  <TouchableOpacity
                    style={[styles.assigneeBtn, loading && styles.assigneeBtnDisabled]}
                    onPress={() => setShowAssigneePicker(true)}
                    disabled={loading || assigneesLoading}
                    activeOpacity={0.75}
                  >
                    {selectedAssignee ? (
                      <View style={styles.assigneeBtnContent}>
                        <View style={styles.avatarSmall}>
                          {selectedAssignee.avatarUrl ? (
                            <Image source={{ uri: selectedAssignee.avatarUrl }} style={styles.avatarImageSmall} />
                          ) : (
                            <Text style={styles.avatarInitialSmall}>
                              {selectedAssignee.displayName.charAt(0).toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <Text style={styles.assigneeBtnText}>{selectedAssignee.displayName}</Text>
                        <Text style={styles.assigneeBtnChevron}>›</Text>
                      </View>
                    ) : (
                      <View style={styles.assigneeBtnContent}>
                        {assigneesLoading
                          ? <ActivityIndicator size="small" color={RT_BLUE} style={{ marginRight: 8 }} />
                          : <Text style={styles.assigneePlaceholderIcon}>👤</Text>
                        }
                        <Text style={styles.assigneePlaceholder}>
                          {assigneesLoading ? 'Chargement…' : 'Choisir un assignee (optionnel)'}
                        </Text>
                        <Text style={styles.assigneeBtnChevron}>›</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {/* Spacer for the sticky footer */}
              <View style={{ height: 24 }} />
            </ScrollView>

            {/* Sticky submit footer — matches Flutter _TicketFormBottomDock */}
            <View style={styles.submitFooter}>
              <TouchableOpacity
                style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.8}
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
        {assigneePickerView}
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
  header: {
    alignItems: 'center', paddingTop: 12, paddingHorizontal: 16,
    paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: RT_BORDER,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  grip: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#ddd', marginBottom: 8 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%',
  },
  headerTitleContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerLogo: { width: 120, height: 32 },
  headerSpacer: { width: 34 },
  logoutBtn: { padding: 6, width: 34, alignItems: 'center' },
  logoutBtnIcon: { fontSize: 18, color: RED },
  closeBtn: { padding: 6, width: 34, alignItems: 'center' },
  closeBtnText: { fontSize: 18, color: RT_MUTED },

  body: { padding: 20, gap: 14 },

  // Form header (Flutter _TicketFormLogoHeader + "Create a ticket")
  formTitle: {
    fontSize: 22, fontWeight: '800', color: RT_INK,
    textAlign: 'center', letterSpacing: -0.35,
  },
  formSubtitle: {
    fontSize: 13, color: RT_MUTED, textAlign: 'center',
    lineHeight: 18, letterSpacing: 0, marginBottom: 6,
  },

  // Screenshot
  screenshotRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 4 },
  screenshotBox: { flex: 1, position: 'relative' },
  screenshot: { width: '100%', height: 140, borderRadius: 14, backgroundColor: RT_FIELD },
  annotatedBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(32,81,232,0.9)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  annotatedBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  annotateBtn: {
    alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: RT_BLUE + '18', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
  },
  annotateBtnIcon: { fontSize: 22 },
  annotateBtnText: { fontSize: 11, fontWeight: '700', color: RT_BLUE },

  // Recorder
  recorderRow: { gap: 10 },
  recorderInfo: { gap: 4 },
  recorderLabel: { fontSize: 15, fontWeight: '700', color: RT_INK },
  recorderSub: { fontSize: 12, color: RT_MUTED },

  recBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(229,57,53,0.08)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginTop: 4,
  },
  recBadgeDone: { backgroundColor: 'rgba(31,157,104,0.1)' },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: RED },
  recDotPaused: { backgroundColor: '#BDBDBD' },
  recTimer: { fontSize: 14, fontWeight: '800', color: RT_INK, letterSpacing: 0.5 },
  recMode: { fontSize: 12, color: RT_MUTED },
  recDoneText: { fontSize: 13, fontWeight: '700', color: RT_GREEN },

  recButtons: { flexDirection: 'row', gap: 8 },
  recBtn: {
    flex: 1, borderRadius: 14, paddingVertical: 10, alignItems: 'center',
  },
  recBtnStart: { backgroundColor: RED },
  recBtnPause: { backgroundColor: '#2684FF' },
  recBtnStop:  { backgroundColor: '#1E2330' },
  recBtnText:  { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Form fields (aligned with Flutter _fieldDecoration)
  label: { fontSize: 13, fontWeight: '600', color: RT_MUTED, marginBottom: -8 },
  req:   { color: RED },
  input: {
    borderWidth: 1, borderColor: RT_BORDER,
    borderRadius: 14, paddingHorizontal: 18, paddingVertical: 15,
    fontSize: 15, color: RT_INK, backgroundColor: '#fff',
  },
  textArea: { height: 120, textAlignVertical: 'top' },

  errorText: { fontSize: 13, color: RED, fontWeight: '600' },

  // Assignee button (trigger)
  assigneeBtn: {
    borderWidth: 1, borderColor: RT_BORDER,
    borderRadius: 14, paddingHorizontal: 18, paddingVertical: 15,
    backgroundColor: '#fff',
  },
  assigneeBtnDisabled: { opacity: 0.55 },
  assigneeBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  assigneeBtnText: { flex: 1, fontSize: 15, color: RT_INK, fontWeight: '500' },
  assigneeBtnChevron: { fontSize: 20, color: RT_MUTED, marginLeft: 4 },
  assigneePlaceholderIcon: { fontSize: 16 },
  assigneePlaceholder: { flex: 1, fontSize: 15, color: RT_MUTED },

  // Avatar (small — inside button)
  avatarSmall: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: RT_BLUE + '22', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImageSmall: { width: 28, height: 28, borderRadius: 14 },
  avatarInitialSmall: { fontSize: 13, fontWeight: '700', color: RT_BLUE },

  // Sticky submit footer (Flutter pattern: DecoratedBox + SafeArea at bottom)
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
    minHeight: 52,
    justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.55 },
  submitBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  submitBtnIcon: { fontSize: 16, color: '#fff' },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  // ── Picker modal ──────────────────────────────────────────────────────
  pickerOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 1000,
  },
  pickerSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '70%', paddingBottom: 32,
  },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: RT_BORDER,
  },
  pickerTitle: { fontSize: 18, fontWeight: '700', color: RT_INK },
  pickerCloseBtn: { padding: 6 },
  pickerCloseText: { fontSize: 18, color: RT_MUTED },
  pickerLoading: { padding: 32, alignItems: 'center', gap: 12 },
  pickerLoadingText: { color: RT_MUTED, fontSize: 14 },
  pickerEmpty: { padding: 32, alignItems: 'center' },
  pickerEmptyText: { color: RT_MUTED, fontSize: 15 },
  pickerList: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },

  pickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 14, marginBottom: 4,
  },
  pickerItemSelected: { backgroundColor: RT_BLUE + '12' },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarSelected: { backgroundColor: RT_BLUE + '22' },
  avatarImage: { width: 40, height: 40, borderRadius: 20 },
  avatarInitial: { fontSize: 16, fontWeight: '700', color: RT_MUTED },
  avatarInitialSelected: { color: RT_BLUE },
  pickerItemInfo: { flex: 1 },
  pickerItemName: { fontSize: 15, fontWeight: '600', color: RT_INK },
  pickerItemNameSelected: { color: RT_BLUE },
  pickerItemEmail: { fontSize: 12, color: RT_MUTED, marginTop: 2 },
  pickerCheckmark: { fontSize: 18, color: RT_BLUE, fontWeight: '700' },
});
