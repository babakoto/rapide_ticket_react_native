/**
 * rapide-ticket — Public API
 *
 * Main entry point. Re-exports everything needed by consumers:
 *   - RapideTicketProvider      (React component)
 *   - RapideTicketAPIClient     (typed API client — all endpoints)
 *   - AuthService               (raw token storage + low-level auth)
 *   - All UI components         (SignInScreen, SignInDialog, AnnotationEditor, …)
 *   - All hooks                 (useGifRecorder, useTicketSubmit, useScreenCapture)
 *   - All types                 (IssueCreateResult, ProjectMember, …)
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

// ─── Types (single source of truth — types/index.ts) ─────────────────────
export type {
  // Config
  RapideTicketConfig,
  TicketPayload,
  // Issue
  IssueCreateResult,
  IssueSyncStatus,
  IssuePriority,
  CreateIssueParams,
  // Users / assignees
  JiraAssignableUser,
  ProjectMember,
  TicketAssignablePerson,
  // Auth
  SignInMethod,
  AtlassianOAuthLoginStart,
} from './types';

// Helper functions from types
export {
  getIssueSummary,
  assignablePersonFromJira,
  assignablePersonFromMember,
} from './types';

// ─── UI Components ──────────────────────────────────────────────────────────
export { SignInScreen }           from './components/SignInScreen';
export { SignInDialog }           from './components/SignInDialog';
export { SignInModal }            from './components/SignInModal';
export { AnnotationEditor }       from './components/AnnotationEditor';
export { SecretFeedbackOverlay }  from './components/SecretFeedbackOverlay';

// ─── Hooks ──────────────────────────────────────────────────────────────────
export { useGifRecorder }    from './hooks/useGifRecorder';
export { useScreenRecorder } from './hooks/useScreenRecorder';
export type { ScreenRecorderResult, ScreenRecorderState, RecorderState } from './hooks/useScreenRecorder';
export { useTicketSubmit }   from './hooks/useTicketSubmit';
export { useScreenCapture }  from './hooks/useScreenCapture';

// ─── Top-level RapideTicket singleton ───────────────────────────────────────
export const RapideTicket = {
  /** Programmatically open the feedback panel (requires Provider mounted). */
  open: () => {
    if (_rapideTicketRef.isReady) {
      _rapideTicketRef.openPanel();
    } else {
      console.warn('[RapideTicket] Provider not mounted — wrap your app with <RapideTicketProvider>.');
    }
  },
  isReady: () => _rapideTicketRef.isReady,
};
