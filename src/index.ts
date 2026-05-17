console.log("Starting RapideTicketProvider load");

import { RapideTicketProvider, _rapideTicketRef } from './components/RapideTicketProvider';
import { RapideTicketConfig, TicketPayload } from './types';

export { RapideTicketProvider };
export type { RapideTicketConfig, TicketPayload };

export const RapideTicket = {
  open: () => {
    if (_rapideTicketRef.isReady) {
      _rapideTicketRef.openPanel();
    } else {
      console.warn('RapideTicketProvider not mounted');
    }
  },
  captureAndOpen: () => {
    // Ideally inject logic to capture here then open
    RapideTicket.open();
  },
  isReady: () => _rapideTicketRef.isReady,
};
