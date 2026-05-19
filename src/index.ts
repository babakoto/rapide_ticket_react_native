import { RapideTicketProvider, _rapideTicketRef } from './components/RapideTicketProvider';
import {
  RapideTicketConfig,
  TicketPayload,
  IssueCreateResult,
  IssueSyncStatus,
  getIssueSummary,
} from './types';
import { AuthService } from './services/AuthService';
import { RapideTicketAPI } from './services/RapideTicketAPI';
import { OfflineQueue } from './services/OfflineQueue';

// Components
export { RapideTicketProvider };
export { AuthService, RapideTicketAPI, OfflineQueue };
export { RapideTicketAPIClient } from './services/RapideTicketAPIClient';
export type { RapideTicketConfig, TicketPayload, IssueCreateResult, IssueSyncStatus } from './types';
export type {
  JiraAssignableUser,
  ProjectMember,
  CreateIssueParams,
} from './services/RapideTicketAPIClient';
export { getIssueSummary } from './services/RapideTicketAPIClient';

// Widgets — sign-in
export { SignInScreen }  from './components/SignInScreen';
export { SignInDialog }  from './components/SignInDialog';
export { SignInModal }   from './components/SignInModal';

// Widgets — annotation + feedback overlay
export { AnnotationEditor }       from './components/AnnotationEditor';
export { SecretFeedbackOverlay }  from './components/SecretFeedbackOverlay';

// Hooks
export { useGifRecorder }   from './hooks/useGifRecorder';
export { useTicketSubmit }  from './hooks/useTicketSubmit';
export { useScreenCapture } from './hooks/useScreenCapture';

export const RapideTicket = {
  open: () => {
    if (_rapideTicketRef.isReady) {
      _rapideTicketRef.openPanel();
    } else {
      console.warn('[RapideTicket] Provider not mounted');
    }
  },
  captureAndOpen: () => {
    RapideTicket.open();
  },
  isReady: () => _rapideTicketRef.isReady,
};
