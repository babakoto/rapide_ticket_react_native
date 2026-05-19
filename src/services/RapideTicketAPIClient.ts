/**
 * Rapide Ticket API Client — React Native
 *
 * Implements every endpoint consumed by the Flutter SDK:
 *
 * AUTH
 *   POST /api/v1/auth/login                   — email/password → JWT + refresh token
 *   POST /api/v1/auth/refresh                  — refresh access token
 *   POST /api/v1/auth/oauth/atlassian/url      — get Atlassian OAuth URL
 *   POST /api/v1/auth/oauth/atlassian/exchange — exchange code → JWT
 *
 * ISSUES
 *   POST /api/v1/projects/:projectId/issues   — create issue (multipart, screenshot/gif)
 *
 * JIRA
 *   GET  /api/v1/projects/:projectId/jira/assignable-users — search Jira assignees
 *
 * PROJECT
 *   GET  /api/v1/projects/:projectId/members  — list project members (RapideTicket users)
 */

import { AuthService } from './AuthService';

// ─── Models ────────────────────────────────────────────────────────────────

export type IssueSyncStatus =
  | 'OPEN'
  | 'SYNCED_TO_JIRA'
  | 'SYNCED_TO_GITHUB'
  | 'JIRA_ERROR'
  | 'GITHUB_ERROR'
  | string;

export interface IssueCreateResult {
  id: string;
  projectId: string;
  title: string;
  status: IssueSyncStatus;
  jiraIssueKey?: string;
  jiraIssueUrl?: string;
  githubIssueNumber?: number;
  githubIssueUrl?: string;
  jiraAssigneeAccountId?: string;
  errorMessage?: string;
}

export interface JiraAssignableUser {
  accountId: string;
  displayName: string;
  active: boolean;
  emailAddress?: string;
  avatarUrl?: string;
}

export interface ProjectMember {
  userId: string;
  email: string;
  displayName: string;
  role: string; // 'OWNER' | 'ADMIN' | 'MEMBER'
}

export interface CreateIssueParams {
  title: string;
  description: string;
  environment?: string;
  clientPlatform?: string;
  priority?: string;
  /** UUID of a RapideTicket project member (email/password flow) */
  assigneeUserId?: string;
  /** Jira accountId (Atlassian OAuth flow) */
  jiraAssigneeAccountId?: string;
  /** Screenshot file URI (PNG / JPG / GIF) */
  screenshotUri?: string | null;
  /** Additional screen recording frames (PNG URIs) */
  recordingFrames?: string[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Human-friendly summary matching Flutter's IssueCreateResult.userFacingSummary */
export function getIssueSummary(result: IssueCreateResult): string {
  const gh = result.githubIssueUrl ?? (result.githubIssueNumber != null ? `#${result.githubIssueNumber}` : null);
  switch (result.status) {
    case 'SYNCED_TO_JIRA': {
      const parts: string[] = [];
      if (result.jiraIssueKey) parts.push(`Jira: ${result.jiraIssueKey}`);
      if (gh) parts.push(`GitHub: ${gh}`);
      return parts.length > 0 ? parts.join(' · ') : 'Synced with Jira.';
    }
    case 'SYNCED_TO_GITHUB':
      return gh ? `GitHub issue: ${gh}` : 'Synced with GitHub.';
    case 'JIRA_ERROR':
      return result.errorMessage ? `Jira: failed — ${result.errorMessage}` : 'Jira: failed.';
    case 'GITHUB_ERROR':
      return result.errorMessage ? `GitHub: failed — ${result.errorMessage}` : 'GitHub: failed.';
    case 'OPEN':
      return 'Issue saved (no external tracker configured).';
    default:
      return 'Issue saved.';
  }
}

/** Wraps a fetch Response error into a typed Error with statusCode */
async function handleResponse<T>(res: Response): Promise<T> {
  if (res.ok) return res.json() as Promise<T>;
  let message = `Server returned HTTP ${res.status}`;
  try {
    const body = await res.json();
    if (body?.message) message = body.message;
  } catch (_) { /* ignore parse errors */ }
  const err: any = new Error(message);
  err.statusCode = res.status;
  throw err;
}

const DEFAULT_BASE_URL = 'https://api.flutteradgents.com';

// ─── API Client ─────────────────────────────────────────────────────────────

export class RapideTicketAPIClient {
  private readonly baseUrl: string;
  private readonly projectId: string;

  constructor(projectId: string, baseUrl: string = DEFAULT_BASE_URL) {
    this.projectId = projectId;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  // ────────────────────────────────────────────────────────────────────────
  // AUTH
  // ────────────────────────────────────────────────────────────────────────

  /**
   * POST /api/v1/auth/login
   * Returns { accessToken, refreshToken } — stored via AuthService.
   */
  async login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string }> {
    const res = await fetch(`${this.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await handleResponse<{ accessToken: string; refreshToken: string }>(res);
    await AuthService.storeTokens(data.accessToken, data.refreshToken);
    return data;
  }

  /**
   * POST /api/v1/auth/refresh
   * Uses the stored refresh token. Updates stored access token on success.
   */
  async refreshAccessToken(): Promise<string> {
    const refreshToken = await AuthService.getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token stored');
    const res = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await handleResponse<{ accessToken: string; refreshToken?: string }>(res);
    await AuthService.storeTokens(
      data.accessToken,
      data.refreshToken ?? refreshToken,
    );
    return data.accessToken;
  }

  /**
   * POST /api/v1/auth/oauth/atlassian/url
   * Returns { authorizationUrl, configured }.
   * On mobile, open authorizationUrl in browser; handle the deep-link callback
   * via the exchange() method below.
   */
  async getAtlassianAuthorizationUrl(opts: {
    inviteToken?: string;
    oauthLoginReturnUri?: string;
    mobileOauthScheme?: string;
  }): Promise<{ authorizationUrl: string; configured: boolean }> {
    const res = await fetch(`${this.baseUrl}/api/v1/auth/oauth/atlassian/url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: this.projectId,
        inviteToken: opts.inviteToken,
        returnUri: opts.oauthLoginReturnUri,
        mobileScheme: opts.mobileOauthScheme,
      }),
    });
    return handleResponse<{ authorizationUrl: string; configured: boolean }>(res);
  }

  /**
   * POST /api/v1/auth/oauth/atlassian/exchange
   * Exchange the OAuth code received from the deep link for a JWT.
   */
  async exchangeAtlassianCode(
    code: string,
    inviteToken?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const res = await fetch(`${this.baseUrl}/api/v1/auth/oauth/atlassian/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, inviteToken, projectId: this.projectId }),
    });
    const data = await handleResponse<{ accessToken: string; refreshToken: string }>(res);
    await AuthService.storeTokens(data.accessToken, data.refreshToken);
    return data;
  }

  // ────────────────────────────────────────────────────────────────────────
  // ISSUES — POST /api/v1/projects/:projectId/issues (multipart)
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Creates an issue with optional screenshot / recording attachments.
   * Matches Flutter IssuesApi.createFromUserFeedback().
   * Automatically retries with a refreshed token on 401.
   */
  async createIssue(params: CreateIssueParams): Promise<IssueCreateResult> {
    const token = await this._requireToken();
    try {
      return await this._postIssue(params, token);
    } catch (err: any) {
      if (err?.statusCode === 401 || err?.statusCode === 403) {
        const newToken = await this.refreshAccessToken();
        return this._postIssue(params, newToken);
      }
      throw err;
    }
  }

  private async _postIssue(params: CreateIssueParams, token: string): Promise<IssueCreateResult> {
    const form = new FormData();

    form.append('title', params.title);
    form.append('description', params.description);

    if (params.environment) form.append('environment', params.environment);
    if (params.clientPlatform) form.append('clientPlatform', params.clientPlatform);
    if (params.priority) form.append('priority', params.priority);

    // Assignee: RapideTicket userId (email/password) takes priority over Jira accountId
    if (params.assigneeUserId) {
      form.append('assigneeUserId', params.assigneeUserId);
    } else if (params.jiraAssigneeAccountId) {
      form.append('jiraAssigneeAccountId', params.jiraAssigneeAccountId);
    }

    // Screenshot (PNG / JPG / GIF)
    if (params.screenshotUri) {
      const isGif = params.screenshotUri.toLowerCase().endsWith('.gif');
      const isJpg = params.screenshotUri.toLowerCase().match(/\.(jpg|jpeg)$/);
      const ext  = isGif ? 'gif' : isJpg ? 'jpg' : 'png';
      const mime = `image/${isGif ? 'gif' : isJpg ? 'jpeg' : 'png'}`;
      form.append('files', {
        uri: params.screenshotUri,
        name: `rapide_ticket_feedback.${ext}`,
        type: mime,
      } as any);
    }

    // Screen recording frames (PNG)
    if (params.recordingFrames?.length) {
      params.recordingFrames.forEach((uri, i) => {
        form.append('files', {
          uri,
          name: `rapide_ticket_screen_recording_${i}.png`,
          type: 'image/png',
        } as any);
      });
    }

    const url = `${this.baseUrl}/api/v1/projects/${this.projectId}/issues`;
    console.debug(`[RapideTicket] POST ${url}`);

    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    return handleResponse<IssueCreateResult>(res);
  }

  // ────────────────────────────────────────────────────────────────────────
  // JIRA — GET /api/v1/projects/:projectId/jira/assignable-users
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Search Jira assignable users (proxied by the backend).
   * Matches Flutter JiraAssignableUsersApi.listAssignableUsers().
   */
  async listJiraAssignableUsers(opts: {
    query?: string;
    maxResults?: number;
  } = {}): Promise<JiraAssignableUser[]> {
    const token = await this._requireToken();
    const params = new URLSearchParams({ maxResults: String(opts.maxResults ?? 50) });
    if (opts.query) params.set('query', opts.query);

    const url = `${this.baseUrl}/api/v1/projects/${this.projectId}/jira/assignable-users?${params}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const b = await res.json(); if (b?.message) msg = b.message; } catch (_) {}
      throw new Error(msg);
    }
    const data: any[] = await res.json();
    return (data ?? []).map((u) => ({
      accountId:    u.accountId as string,
      displayName:  (u.displayName ?? u.accountId) as string,
      active:       u.active ?? true,
      emailAddress: u.emailAddress as string | undefined,
      avatarUrl:    u.avatarUrl   as string | undefined,
    }));
  }

  // ────────────────────────────────────────────────────────────────────────
  // PROJECT MEMBERS — GET /api/v1/projects/:projectId/members
  // ────────────────────────────────────────────────────────────────────────

  /**
   * List RapideTicket project members (used for assignee picker in email/password flow).
   * Matches Flutter ProjectMembersApi.listMembers().
   */
  async listProjectMembers(): Promise<ProjectMember[]> {
    const token = await this._requireToken();
    const url = `${this.baseUrl}/api/v1/projects/${this.projectId}/members`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const b = await res.json(); if (b?.message) msg = b.message; } catch (_) {}
      throw new Error(msg);
    }
    const data: any[] = await res.json();
    return (data ?? []).map((m) => ({
      userId:      String(m.userId   ?? ''),
      email:       String(m.email    ?? ''),
      displayName: String(m.displayName ?? ''),
      role:        String(m.role     ?? ''),
    }));
  }

  // ────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ────────────────────────────────────────────────────────────────────────

  private async _requireToken(): Promise<string> {
    const token = await AuthService.getToken();
    if (!token) throw new Error('Not authenticated — please sign in first.');
    return token;
  }
}
