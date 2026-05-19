import { useState } from 'react';
import { RapideTicketConfig, IssueCreateResult, getIssueSummary } from '../types';
import { RapideTicketAPI } from '../services/RapideTicketAPI';
import { AuthService } from '../services/AuthService';
import { OfflineQueue } from '../services/OfflineQueue';

export interface SubmitParams {
  title: string;
  description: string;
  screenshotUri?: string | null;
  gifUri?: string | null;
  /** MP4 file URI from native screen recorder — takes priority over frames */
  videoUri?: string | null;
  /** PNG frames captured by useGifRecorder / useScreenRecorder fallback */
  recordingFrames?: string[];
}

export interface UseTicketSubmitResult {
  submit: (params: SubmitParams) => Promise<IssueCreateResult | null>;
  loading: boolean;
  lastResult: IssueCreateResult | null;
  error: string | null;
}

/**
 * Submits a bug report to the rapide_ticket backend.
 * - Uses multipart/form-data via RapideTicketAPI (correct endpoint).
 * - Enriches description with device metadata automatically.
 * - Falls back to OfflineQueue on network failure.
 * - Attempts token refresh on 401.
 */
export const useTicketSubmit = (config: RapideTicketConfig): UseTicketSubmitResult => {
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<IssueCreateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (params: SubmitParams): Promise<IssueCreateResult | null> => {
    setLoading(true);
    setError(null);

    try {
      let token = await AuthService.getToken();

      if (!token) {
        throw new Error('Not authenticated — please sign in first.');
      }

      const api = new RapideTicketAPI(config);

      let result: IssueCreateResult;
      try {
        result = await api.submitIssue(
          { ...params, videoUri: params.videoUri, recordingFrames: params.recordingFrames },
          config,
          token,
        );
      } catch (err: any) {
        // Attempt token refresh on auth errors (401-like messages)
        if (
          err?.message?.includes('401') ||
          err?.message?.toLowerCase().includes('unauthorized') ||
          err?.message?.toLowerCase().includes('expired')
        ) {
          try {
            token = await AuthService.refreshAccessToken(config.apiBaseUrl);
            result = await api.submitIssue(
              { ...params, videoUri: params.videoUri, recordingFrames: params.recordingFrames },
              config,
              token,
            );
          } catch (refreshErr) {
            throw refreshErr;
          }
        } else {
          throw err;
        }
      }

      setLastResult(result);

      if (config.debug) {
        console.log('[RapideTicket] Issue submitted:', getIssueSummary(result));
      }

      setLoading(false);
      return result;
    } catch (err: any) {
      const message = err?.message || 'Submission failed';
      setError(message);
      console.warn('[RapideTicket] Submit failed, queuing offline:', message);

      // Offline fallback
      try {
        await OfflineQueue.enqueue({
          title: params.title,
          description: params.description,
          priority: 'medium',
          type: 'bug',
          metadata: { screenshotUri: params.screenshotUri },
          attachments: [
            ...(params.screenshotUri ? [params.screenshotUri] : []),
            ...(params.videoUri     ? [params.videoUri]     : []),
          ],
        });
      } catch (queueErr) {
        console.error('[RapideTicket] Offline queue failed:', queueErr);
      }

      setLoading(false);
      return null;
    }
  };

  return { submit, loading, lastResult, error };
};
