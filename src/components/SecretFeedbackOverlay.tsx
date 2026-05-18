/**
 * SecretFeedbackOverlay — Bottom dock after 5-tap trigger
 * Equivalent to Flutter's rapide_ticket_secret_feedback_overlay.dart
 *
 * Modes: home | gifReady | gifRecording | gifExporting
 * Actions: Video, Capture, Ticket, Profile/Logout
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';

// Brand colors (matching Flutter constants)
export const COLOR_INDIGO = '#5E5CE6';
export const COLOR_RED    = '#E53935';
export const COLOR_GREEN  = '#22A06B';
export const COLOR_BLUE   = '#2684FF';
export const COLOR_SLATE  = '#1E2330';
export const COLOR_ICON   = '#44485A';

export type DockMode = 'home' | 'gifReady' | 'gifRecording' | 'gifExporting';

interface DockActionProps {
  icon: string;
  label: string;
  tint: string;
  onPress: () => void;
}

/** Colored icon + label — main home dock actions */
const DockAction: React.FC<DockActionProps> = ({ icon, label, tint, onPress }) => (
  <TouchableOpacity style={styles.dockAction} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.dockActionIcon, {
      backgroundColor: tint,
      shadowColor: tint,
    }]}>
      <Text style={styles.dockActionEmoji}>{icon}</Text>
    </View>
    <Text style={styles.dockActionLabel}>{label}</Text>
  </TouchableOpacity>
);

interface GhostActionProps {
  icon: string;
  label: string;
  onPress?: () => void;
}

/** Ghost (transparent bg) icon + label — secondary dock actions */
const DockGhostAction: React.FC<GhostActionProps> = ({ icon, label, onPress }) => {
  const enabled = !!onPress;
  return (
    <TouchableOpacity
      style={[styles.ghostAction, !enabled && { opacity: 0.35 }]}
      onPress={onPress}
      disabled={!enabled}
      activeOpacity={0.7}
    >
      <View style={styles.ghostIcon}>
        <Text style={styles.ghostEmoji}>{icon}</Text>
      </View>
      <Text style={styles.ghostLabel}>{label}</Text>
    </TouchableOpacity>
  );
};

interface RoundBtnProps {
  icon: string;
  color: string;
  size?: number;
  onPress?: () => void;
}

/** Circular filled button — record / pause / stop */
const PrimaryRoundButton: React.FC<RoundBtnProps> = ({ icon, color, size = 44, onPress }) => {
  const enabled = !!onPress;
  return (
    <TouchableOpacity
      style={[
        styles.roundBtn,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        { shadowColor: color },
        !enabled && { opacity: 0.4 },
      ]}
      onPress={onPress}
      disabled={!enabled}
      activeOpacity={0.7}
    >
      <Text style={{ fontSize: size * 0.44, color: '#fff' }}>{icon}</Text>
    </TouchableOpacity>
  );
};

/** Pulsing red dot indicator */
const RecordingPulse: React.FC<{ active: boolean; paused: boolean }> = ({ active, paused }) => {
  const color = paused ? '#BDBDBD' : COLOR_RED;
  return (
    <View style={[
      styles.pulse,
      { backgroundColor: color },
      active && { shadowColor: COLOR_RED, shadowOpacity: 0.55, shadowRadius: 6, elevation: 4 },
    ]} />
  );
};

interface OverlayProps {
  isSignedIn: boolean;
  dockMode: DockMode;
  exportProgress?: number;             // 0.0 – 1.0 when dockMode === 'gifExporting'
  gifRecordingPaused?: boolean;
  gifTimerLabel?: string;
  gifRecIndicatorOn?: boolean;
  onDismiss: () => void;
  onScreenshot: () => void;
  onRecordGif: () => void;
  onCreateTicket: () => void;
  onAuthRowTap: () => void;
  onGifBack?: () => void;
  onGifStartRecording?: () => void;
  onGifPauseOrResume?: () => void;
  onGifStopAndFinish?: () => void;
}

export const SecretFeedbackOverlay: React.FC<OverlayProps> = ({
  isSignedIn,
  dockMode,
  exportProgress = 0,
  gifRecordingPaused = false,
  gifTimerLabel = '00:00',
  gifRecIndicatorOn = true,
  onDismiss,
  onScreenshot,
  onRecordGif,
  onCreateTicket,
  onAuthRowTap,
  onGifBack,
  onGifStartRecording,
  onGifPauseOrResume,
  onGifStopAndFinish,
}) => {
  const renderDock = () => {
    switch (dockMode) {
      case 'home':
        return (
          <View style={styles.dockRow}>
            <DockAction icon="🎥" label="Video"   tint={COLOR_RED}   onPress={onRecordGif} />
            <DockAction icon="📷" label="Capture" tint={COLOR_BLUE}  onPress={onScreenshot} />
            <DockAction icon="✅" label="Ticket"  tint={COLOR_GREEN} onPress={onCreateTicket} />
            <DockAction
              icon={isSignedIn ? "🚪" : "👤"}
              label={isSignedIn ? "Logout" : "Profile"}
              tint={COLOR_SLATE}
              onPress={onAuthRowTap}
            />
          </View>
        );

      case 'gifReady':
        return (
          <View style={styles.dockRow}>
            <DockGhostAction icon="‹" label="Back" onPress={onGifBack} />
            <PrimaryRoundButton icon="⏺" color={COLOR_RED} size={46} onPress={onGifStartRecording} />
            <DockGhostAction
              icon={isSignedIn ? "🚪" : "👤"}
              label={isSignedIn ? "Logout" : "Profile"}
              onPress={onAuthRowTap}
            />
          </View>
        );

      case 'gifRecording':
        return (
          <View style={styles.dockRow}>
            <DockGhostAction icon="‹" label="Back" onPress={onGifBack} />
            <RecordingPulse active={!gifRecordingPaused && gifRecIndicatorOn} paused={gifRecordingPaused} />
            <Text style={styles.timerLabel}>{gifTimerLabel}</Text>
            <PrimaryRoundButton
              icon={gifRecordingPaused ? "▶" : "⏸"}
              color={COLOR_BLUE}
              size={36}
              onPress={onGifPauseOrResume}
            />
            <PrimaryRoundButton icon="⏹" color={COLOR_SLATE} size={36} onPress={onGifStopAndFinish} />
            <DockGhostAction
              icon={isSignedIn ? "🚪" : "👤"}
              label={isSignedIn ? "Logout" : "Profile"}
              onPress={onAuthRowTap}
            />
          </View>
        );

      case 'gifExporting':
        return (
          <View style={styles.exportContainer}>
            <View style={styles.exportRow}>
              <Animated.View style={styles.exportSpinner}>
                <Text style={{ color: COLOR_INDIGO, fontSize: 16 }}>⏳</Text>
              </Animated.View>
              <Text style={styles.exportLabel}>Encoding GIF…</Text>
              <Text style={styles.exportPct}>
                {exportProgress <= 0.001 ? '…' : `${Math.round(exportProgress * 100)} %`}
              </Text>
            </View>
            <View style={styles.progressBg}>
              <View style={[
                styles.progressFill,
                { width: exportProgress <= 0.001 ? '5%' : `${exportProgress * 100}%` },
              ]} />
            </View>
          </View>
        );
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Close button — top right */}
      <TouchableOpacity style={styles.closeBtn} onPress={onDismiss}>
        <View style={styles.closeBtnInner}>
          <Text style={styles.closeBtnText}>✕</Text>
        </View>
      </TouchableOpacity>

      {/* Floating dock — bottom center */}
      <View style={styles.dockContainer} pointerEvents="box-none">
        <View style={styles.dockPill}>
          {renderDock()}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Close button
  closeBtn: {
    position: 'absolute', top: 50, right: 14, zIndex: 20,
  },
  closeBtnInner: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6, elevation: 8,
  },
  closeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Dock
  dockContainer: {
    position: 'absolute', bottom: 20, left: 0, right: 0,
    alignItems: 'center', zIndex: 20,
  },
  dockPill: {
    backgroundColor: '#fff', borderRadius: 4,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: 16, paddingVertical: 4,
    shadowColor: '#000', shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 10,
  },
  dockRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54,
  },

  // DockAction
  dockAction: { alignItems: 'center', gap: 3, paddingVertical: 4 },
  dockActionIcon: {
    width: 38, height: 38, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0.28, shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 4,
  },
  dockActionEmoji: { fontSize: 18 },
  dockActionLabel: { fontSize: 10, fontWeight: '700', color: COLOR_SLATE },

  // Ghost action
  ghostAction: { alignItems: 'center', gap: 2, paddingVertical: 4 },
  ghostIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#F1F2F6', alignItems: 'center', justifyContent: 'center',
  },
  ghostEmoji: { fontSize: 16, color: COLOR_ICON },
  ghostLabel: { fontSize: 9, fontWeight: '600', color: COLOR_ICON },

  // Round button
  roundBtn: {
    alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0.35, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 6,
  },

  // Timer
  timerLabel: { fontSize: 14, fontWeight: '800', color: COLOR_SLATE, letterSpacing: 0.2 },

  // Recording pulse
  pulse: { width: 10, height: 10, borderRadius: 5 },

  // Export progress
  exportContainer: { paddingHorizontal: 12, paddingVertical: 8, minWidth: 240 },
  exportRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  exportSpinner: { marginRight: 8 },
  exportLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: COLOR_SLATE },
  exportPct: { fontSize: 13, fontWeight: '700', color: '#636366' },
  progressBg: {
    height: 4, backgroundColor: '#E8E8ED', borderRadius: 6, overflow: 'hidden',
  },
  progressFill: {
    height: 4, backgroundColor: COLOR_INDIGO, borderRadius: 6,
  },
});
