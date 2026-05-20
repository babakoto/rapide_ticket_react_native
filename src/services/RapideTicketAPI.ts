import { Platform } from 'react-native';
import { IssueCreateResult, RapideTicketConfig } from '../types';
import { enrichDescriptionWithMetadata } from '../utils/deviceInfo';

const DEFAULT_API_BASE_URL = 'https://api.flutteradgents.com';

/**
 * Submits an issue to the rapide_ticket backend.
 * Uses multipart/form-data — same as the Flutter SDK.
 *
 * Endpoint: POST /api/v1/projects/{projectId}/issues
 */
export class RapideTicketAPI {
  private baseUrl: string;
  private projectId: string;

  constructor(config: RapideTicketConfig) {
    this.baseUrl = (config.apiBaseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
    this.projectId = config.projectId;
  }

  async submitIssue(
    params: {
      title: string;
      description: string;
      screenshotUri?: string | null;
      gifUri?: string | null;
      /** MP4 from native screen recorder — takes priority over frames */
      videoUri?: string | null;
      recordingFrames?: string[];
      inviteToken?: string;
      /** RapideTicket project-member UUID (password flow) */
      assigneeUserId?: string | null;
      /** Jira accountId (atlassianOAuth flow) */
      jiraAssigneeAccountId?: string | null;
    },
    config: RapideTicketConfig,
    token: string,
  ): Promise<IssueCreateResult> {
    const enrichedDescription = await enrichDescriptionWithMetadata(
      params.description,
      config,
    );

    const platform = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
    const environment = config.flavor?.trim() || 'production';

    // Build multipart form — matching Flutter SDK format
    const form = new FormData();
    form.append('title', params.title.slice(0, 255)); // max 255 chars
    form.append('description', enrichedDescription);
    form.append('environment', environment);
    form.append('clientPlatform', platform);
    if (params.inviteToken) {
      form.append('inviteToken', params.inviteToken);
    }
    // Assignee — mirrors Flutter issue_feedback_fields.dart
    if (params.assigneeUserId) {
      form.append('assigneeUserId', params.assigneeUserId);
    } else if (params.jiraAssigneeAccountId) {
      form.append('jiraAssigneeAccountId', params.jiraAssigneeAccountId);
    }

    if (params.screenshotUri) {
      form.append('files', {
        uri: params.screenshotUri,
        name: 'rapide_ticket_feedback.png',
        type: 'image/png',
      } as any);
    }

    if (params.gifUri) {
      form.append('files', {
        uri: params.gifUri,
        name: 'rapide_ticket_screen_recording_0.gif',
        type: 'image/gif',
      } as any);
    }

    // Screen recording — MP4 (native) takes priority over PNG frames
    if (params.videoUri) {
      form.append('files', {
        uri: params.videoUri,
        name: 'rapide_ticket_screen_recording.mp4',
        type: 'video/mp4',
      } as any);
    } else if (params.recordingFrames && params.recordingFrames.length > 0) {
      // Do NOT append all frames as separate files to prevent JIRA/Github attachment spam.
      // Instead, send the last captured frame as a fallback screenshot representing the recording.
      const lastFrame = params.recordingFrames[params.recordingFrames.length - 1];
      form.append('files', {
        uri: lastFrame,
        name: 'rapide_ticket_screen_recording_fallback.png',
        type: 'image/png',
      } as any);
    }

    const url = `${this.baseUrl}/api/v1/projects/${this.projectId}/issues`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        // Do NOT set Content-Type manually — fetch sets it with boundary for multipart
      },
      body: form,
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const body = await response.json();
        if (body?.message) message = body.message;
      } catch {
        // ignore parse error
      }
      throw new Error(message);
    }

    const json = await response.json();
    return this._parseResult(json);
  }

  private _parseResult(json: any): IssueCreateResult {
    return {
      id: json.id ?? '',
      projectId: json.projectId ?? this.projectId,
      title: json.title ?? '',
      status: json.status ?? 'UNKNOWN',
      jiraIssueKey: json.jiraIssueKey,
      jiraIssueUrl: json.jiraIssueUrl,
      githubIssueNumber: json.githubIssueNumber,
      githubIssueUrl: json.githubIssueUrl,
      jiraAssigneeAccountId: json.jiraAssigneeAccountId,
      errorMessage: json.errorMessage,
    };
  }
}
