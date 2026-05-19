import { useEffect, useRef, useState } from 'react';
import { RapideTicketConfig, SignInMethod, TicketAssignablePerson } from '../types';
import { RapideTicketAPIClient } from '../services/RapideTicketAPIClient';

export interface UseAssigneesResult {
  assignees: TicketAssignablePerson[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Loads the list of people that can be assigned to a ticket.
 * Mirrors the Flutter feedback form's conditional: password → project members,
 * atlassianOAuth → Jira assignable users.
 */
export const useAssignees = (
  config: RapideTicketConfig,
  signInMethod: SignInMethod,
): UseAssigneesResult => {
  const [assignees, setAssignees] = useState<TicketAssignablePerson[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const reloadToken = useRef(0);

  const load = async () => {
    if (signInMethod === 'none') {
      setAssignees([]);
      return;
    }
    setLoading(true);
    setError(null);
    const current = ++reloadToken.current;
    try {
      const client = new RapideTicketAPIClient(config.projectId, config.apiBaseUrl);
      const list   = await client.listAssigneesForCurrentSession(signInMethod);
      if (reloadToken.current === current) {
        setAssignees(list);
      }
    } catch (e: any) {
      if (reloadToken.current === current) {
        setError(e?.message ?? 'Failed to load assignees');
      }
    } finally {
      if (reloadToken.current === current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.projectId, config.apiBaseUrl, signInMethod]);

  return { assignees, loading, error, reload: load };
};
