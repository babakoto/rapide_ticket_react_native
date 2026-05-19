/**
 * rapide-ticket — Public API
 *
 * Full parity with Flutter rapide_ticket package.
 */

import { RapideTicketProvider, _rapideTicketRef } from './components/RapideTicketProvider';
import { AuthService }          from './services/AuthService';
import { RapideTicketAPI }      from './services/RapideTicketAPI';
import { OfflineQueue }         from './services/OfflineQueue';

// ─── Provider ──────────────────────────────────────────────────────────────
export { RapideTicketProvider };

// ─── Services ──────────────────────────────────────────────────────────────
export { AuthService, RapideTicketAPI, OfflineQueue };
export { RapideTicketAPIClient } from './services/RapideTicketAPIClient';

// ─── Config (mirrors rapide_ticket_settings.dart) ─────────────────────────
export { RapideTicketSettings, detectClientPlatform } from './config/RapideTicketSettings';
export type { RapideTicketSettingsParams, ClientPlatform } from './config/RapideTicketSettings';

// ─── Types (single source of truth) ───────────────────────────────────────
export type {
  RapideTicketConfig,
  TicketPayload,
  IssueCreateResult,
  IssueSyncStatus,
  IssuePriority,
  CreateIssueParams,
  JiraAssignableUser,
  ProjectMember,
  TicketAssignablePerson,
  SignInMethod,
  AtlassianOAuthLoginStart,
} from './types';

export {
  getIssueSummary,
  assignablePersonFromJira,
  assignablePersonFromMember,
} from './types';

// ─── Logger & helpers (mirrors rapide_ticket_logger.dart + derive_feedback_title.dart) ──
export {
  rapideTicketLog,
  configureRapideTicketLogger,
  deriveFeedbackTitle,
} from './utils/logger';

// ─── UI Components ──────────────────────────────────────────────────────────
export { SignInScreen }          from './components/SignInScreen';
export { SignInDialog }          from './components/SignInDialog';
export { SignInModal }           from './components/SignInModal';
export { AnnotationEditor }      from './components/AnnotationEditor';
export { SecretFeedbackOverlay } from './components/SecretFeedbackOverlay';
/** Mirrors Flutter rapide_ticket_gif_ticket_sheet.dart */
export { VideoTicketSheet }      from './components/VideoTicketSheet';
/** Mirrors Flutter RapideTicketConfigurationError */
export { ConfigurationError }    from './components/ConfigurationError';

// ─── Hooks ──────────────────────────────────────────────────────────────────
export { useGifRecorder }     from './hooks/useGifRecorder';
export { useScreenRecorder }  from './hooks/useScreenRecorder';
export type { ScreenRecorderResult, ScreenRecorderState, RecorderState } from './hooks/useScreenRecorder';
export { useTicketSubmit }    from './hooks/useTicketSubmit';
export { useScreenCapture }   from './hooks/useScreenCapture';
/** Mirrors Flutter RapideTicketOAuthReturnListener */
export { useOAuthDeepLink }   from './hooks/useOAuthDeepLink';
export type { OAuthDeepLinkOptions } from './hooks/useOAuthDeepLink';

// ─── Top-level singleton (mirrors Flutter RapideTicket class) ───────────────
export const RapideTicket = {
  /**
   * Programmatically open the feedback panel.
   * Mirrors Flutter: RapideTicket.showFeedback(context)
   * Requires <RapideTicketProvider> to be mounted above.
   */
  open: (opts?: { inviteToken?: string }) => {
    if (_rapideTicketRef.isReady) {
      _rapideTicketRef.openPanel(opts);
    } else {
      console.warn('[RapideTicket] Provider not mounted — wrap your app with <RapideTicketProvider>.');
    }
  },
  isReady: () => _rapideTicketRef.isReady,

  /**
   * Validate a projectId before initialising.
   * Mirrors Flutter: RapideTicketSettings.projectIdValidationMessage()
   */
  validateProjectId: (projectId?: string | null): string | null => {
    return projectId?.trim() ? null
      : 'Enter a project ID: your SDK key (fad_…) or project UUID from the dashboard.';
  },

  /**
   * Build a native OAuth deep-link URI.
   * Mirrors Flutter: RapideTicketSettings.buildOauthDeepLink()
   */
  buildOauthDeepLink: (scheme: string, path = 'oauth'): string => {
    if (!scheme.trim()) throw new Error('OAuth scheme cannot be empty.');
    return `${scheme.trim()}://${path.trim().replace(/^\/+/, '')}`;
  },
};
