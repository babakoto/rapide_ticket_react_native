import { useState } from 'react';
import { TicketPayload, RapideTicketConfig } from '../types';
import { FlutteradgentsAPI } from '../services/FlutteradgentsAPI';
import { AuthService } from '../services/AuthService';
import { OfflineQueue } from '../services/OfflineQueue';

export const useTicketSubmit = (config: RapideTicketConfig) => {
  const [loading, setLoading] = useState(false);

  const submit = async (payload: TicketPayload) => {
    setLoading(true);
    try {
      const token = await AuthService.getToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const api = new FlutteradgentsAPI(config.apiBaseUrl || '', config.projectId);
      await api.submitTicket(payload, token);
      
      setLoading(false);
      return true;
    } catch (error) {
      console.warn('Submit failed, queueing offline', error);
      await OfflineQueue.enqueue(payload);
      setLoading(false);
      return false; // Return false indicating it went to offline queue
    }
  };

  return { submit, loading };
};
