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

// ─── CompactAction — Colored square icon (Flutter _CompactAction) ──────────
interface CompactActionProps {
  icon: string;
  tint: string;
  onPress: () => void;
}

const CompactAction: React.FC<CompactActionProps> = ({ icon, tint, onPress }) => (
  <TouchableOpacity
    style={[styles.compactAction, { backgroundColor: tint }]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={styles.compactActionIcon}>{icon}</Text>
  </TouchableOpacity>
);

// ─── CompactGhost — Ghost bg icon (Flutter _CompactGhost) ──────────────────
interface CompactGhostProps {
  icon: string;
  onPress?: () => void;
}

const CompactGhost: React.FC<CompactGhostProps> = ({ icon, onPress }) => {
  const enabled = !!onPress;
  return (
    <TouchableOpacity
      style={[styles.compactGhost, !enabled && { opacity: 0.35 }]}
      onPress={onPress}
      disabled={!enabled}
      activeOpacity={0.7}
    >
      <Text style={[styles.compactGhostIcon, !enabled && { opacity: 0.35 }]}>{icon}</Text>
    </TouchableOpacity>
  );
};

// ─── CompactPrimary — Circle filled button (Flutter _CompactPrimary) ───────
interface CompactPrimaryProps {
  icon: string;
  color: string;
  size?: number;
  onPress?: () => void;
}

const CompactPrimary: React.FC<CompactPrimaryProps> = ({ icon, color, size = 34, onPress }) => {
  const enabled = !!onPress;
  return (
    <TouchableOpacity
      style={[
        styles.compactPrimary,
        {
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: color,
          shadowColor: color,
        },
        !enabled && { opacity: 0.45 },
      ]}
      onPress={onPress}
      disabled={!enabled}
      activeOpacity={0.7}
    >
      <Text style={{ fontSize: size * 0.44, color: '#fff' }}>{icon}</Text>
    </TouchableOpacity>
  );
};

// ─── CompactClose — Dark circle close (Flutter _CompactClose) ──────────────
interface CompactCloseProps {
  onPress: () => void;
}

const CompactClose: React.FC<CompactCloseProps> = ({ onPress }) => (
  <TouchableOpacity style={styles.compactClose} onPress={onPress} activeOpacity={0.7}>
    <Text style={styles.compactCloseIcon}>✕</Text>
  </TouchableOpacity>
);

// ─── RecordingDot (Flutter _RecordingDot) ──────────────────────────────────
const RecordingDot: React.FC<{ active: boolean; paused: boolean }> = ({ active, paused }) => {
  const color = paused ? '#BDBDBD' : COLOR_RED;
  return (
    <View style={[
      styles.recordingDot,
      { backgroundColor: color },
      active && !paused && {
        shadowColor: COLOR_RED,
        shadowOpacity: 0.5,
        shadowRadius: 5,
        elevation: 4,
      },
    ]} />
  );
};

// ─── Main Overlay ──────────────────────────────────────────────────────────
interface OverlayProps {
  isSignedIn: boolean;
  dockMode: DockMode;
  exportProgress?: number;
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
  const showDismiss = dockMode !== 'gifRecording' && dockMode !== 'gifExporting';

  const renderDockContent = () => {
    switch (dockMode) {
      case 'home':
        return (
          <View style={styles.dockRow}>
            <CompactAction icon="✅" tint={COLOR_GREEN} onPress={onCreateTicket} />
            <View style={{ width: 6 }} />
            <CompactAction
              icon={isSignedIn ? '↩' : '👤'}
              tint={COLOR_SLATE}
              onPress={onAuthRowTap}
            />
            {showDismiss && (
              <>
                <View style={{ width: 4 }} />
                <CompactClose onPress={onDismiss} />
              </>
            )}
          </View>
        );

      case 'gifReady':
        return (
          <View style={styles.dockRow}>
            <CompactGhost icon="‹" onPress={onGifBack} />
            <View style={{ width: 8 }} />
            <CompactPrimary icon="⏺" color={COLOR_RED} size={36} onPress={onGifStartRecording} />
            {showDismiss && (
              <>
                <View style={{ width: 8 }} />
                <CompactClose onPress={onDismiss} />
              </>
            )}
          </View>
        );

      case 'gifRecording':
        return (
          <View style={styles.dockRow}>
            <CompactGhost icon="‹" onPress={onGifBack} />
            <View style={{ width: 8 }} />
            <RecordingDot
              active={!gifRecordingPaused && gifRecIndicatorOn}
              paused={gifRecordingPaused}
            />
            <View style={{ width: 6 }} />
            <Text style={styles.timerLabel}>{gifTimerLabel}</Text>
            <View style={{ width: 8 }} />
            {onGifPauseOrResume && (
              <>
                <CompactPrimary
                  icon={gifRecordingPaused ? '▶' : '⏸'}
                  color={COLOR_BLUE}
                  size={32}
                  onPress={onGifPauseOrResume}
                />
                <View style={{ width: 6 }} />
              </>
            )}
            <CompactPrimary icon="⏹" color={COLOR_SLATE} size={32} onPress={onGifStopAndFinish} />
          </View>
        );

      case 'gifExporting':
        return (
          <View style={styles.exportContainer}>
            <View style={styles.exportRow}>
              <Text style={{ color: COLOR_INDIGO, fontSize: 14, marginRight: 8 }}>⏳</Text>
              <Text style={styles.exportLabel}>Saving video…</Text>
              <Text style={styles.exportPct}>
                {exportProgress <= 0.001 ? '…' : `${Math.round(exportProgress * 100)}%`}
              </Text>
            </View>
          </View>
        );
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Floating dock — bottom center */}
      <View style={styles.dockContainer} pointerEvents="box-none">
        <View style={styles.dockPill}>
          {/* Drag indicator */}
          <View style={styles.dragIndicator}>
            <Text style={styles.dragIndicatorText}>⋮⋮</Text>
          </View>
          {/* Separator */}
          <View style={styles.pillSeparator} />
          {/* Content */}
          <View style={styles.pillContent}>
            {renderDockContent()}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Dock container
  dockContainer: {
    position: 'absolute', bottom: 20, left: 0, right: 0,
    alignItems: 'center', zIndex: 20,
  },
  dockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    paddingLeft: 6,
    paddingRight: 6,
    paddingVertical: 4,
    minHeight: 46,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
  dragIndicator: {
    paddingHorizontal: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragIndicatorText: {
    fontSize: 16,
    color: '#9A9AA8',
    letterSpacing: -2,
  },
  pillSeparator: {
    width: 1,
    height: 28,
    backgroundColor: '#E4E4EA',
    marginHorizontal: 2,
  },
  pillContent: {
    paddingHorizontal: 4,
  },
  dockRow: {
    flexDirection: 'row', alignItems: 'center',
  },

  // CompactAction (Flutter _CompactAction)
  compactAction: {
    width: 34, height: 34, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  compactActionIcon: { fontSize: 15, color: '#fff' },

  // CompactGhost (Flutter _CompactGhost)
  compactGhost: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#F1F2F6',
    alignItems: 'center', justifyContent: 'center',
  },
  compactGhostIcon: { fontSize: 14, color: COLOR_ICON },

  // CompactPrimary (Flutter _CompactPrimary)
  compactPrimary: {
    alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 4,
  },

  // CompactClose (Flutter _CompactClose)
  compactClose: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#2C2C2E',
    alignItems: 'center', justifyContent: 'center',
  },
  compactCloseIcon: { fontSize: 14, color: '#fff', fontWeight: '700' },

  // RecordingDot
  recordingDot: { width: 8, height: 8, borderRadius: 4 },

  // Timer
  timerLabel: {
    fontSize: 14, fontWeight: '800', color: COLOR_SLATE,
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },

  // Export progress (inline in pill)
  exportContainer: { paddingHorizontal: 8, minWidth: 200 },
  exportRow: { flexDirection: 'row', alignItems: 'center' },
  exportLabel: { flex: 1, fontSize: 12, fontWeight: '700', color: COLOR_SLATE },
  exportPct: { fontSize: 12, fontWeight: '700', color: '#636366', fontVariant: ['tabular-nums'] },
});
