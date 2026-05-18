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

export { RapideTicketProvider };
export { AuthService, RapideTicketAPI, OfflineQueue };
export type { RapideTicketConfig, TicketPayload, IssueCreateResult, IssueSyncStatus };
export { getIssueSummary };

export const RapideTicket = {
  open: () => {
    if (_rapideTicketRef.isReady) {
      _rapideTicketRef.openPanel();
    } else {
      console.warn('[RapideTicket] Provider not mounted');
    }
  },
  captureAndOpen: () => {
    // Capture is now handled inside Provider before opening
    RapideTicket.open();
  },
  isReady: () => _rapideTicketRef.isReady,
};
