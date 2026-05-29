/**
 * Rapide Ticket API Client — React Native
 *
 * Full parity with the Flutter SDK endpoints:
 *
 * AUTH
 *   POST /api/v1/auth/login                              — email/password → JWT + refresh
 *   POST /api/v1/auth/refresh                            — renew access token
 *   GET  /api/v1/auth/oauth/atlassian/authorization-url — start Atlassian OAuth
 *   POST /api/v1/auth/oauth/atlassian/exchange           — exchange code → JWT
 *
 * ISSUES
 *   POST /api/v1/projects/:id/issues                     — create issue (multipart)
 *
 * JIRA
 *   GET  /api/v1/projects/:id/jira/assignable-users      — search Jira assignees
 *
 * PROJECT
 *   GET  /api/v1/projects/:id/members                    — list RT project members
 *
 * See also: AuthService (token storage) and types/index.ts (shared models).
 */

import { AuthService } from './AuthService';
import {
  IssueCreateResult,
  JiraAssignableUser,
  ProjectMember,
  TicketAssignablePerson,
  AtlassianOAuthLoginStart,
  CreateIssueParams,
  IssueSyncStatus,
  assignablePersonFromJira,
  assignablePersonFromMember,
  getIssueSummary,
} from '../types';
import { HOSTED_API_BASE_URL } from '../config/RapideTicketSettings';

export type { IssueCreateResult, JiraAssignableUser, ProjectMember, TicketAssignablePerson,
             AtlassianOAuthLoginStart, CreateIssueParams, IssueSyncStatus };
export { assignablePersonFromJira, assignablePersonFromMember, getIssueSummary };

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Reads JSON body on success, throws typed Error on failure (mirrors DioException._wrap) */
async function _unwrap<T>(res: Response): Promise<T> {
  if (res.ok) return res.json() as Promise<T>;
  let message = `Server returned HTTP ${res.status}`;
  try {
    const body = await res.json();
    if (typeof body?.message === 'string') message = body.message;
  } catch (_) { /* ignore */ }
  const err: any = new Error(message);
  err.statusCode = res.status;
  throw err;
}

function _cleanBase(url = HOSTED_API_BASE_URL) {
  return url.replace(/\/+$/, '');
}

// ─── API Client ──────────────────────────────────────────────────────────────

export class RapideTicketAPIClient {
  private readonly base: string;
  private readonly projectId: string;

  constructor(projectId: string, baseUrl?: string) {
    this.projectId = projectId;
    this.base = _cleanBase(baseUrl);
  }

  // ════════════════════════════════════════════════════════════════════════
  // AUTH — mirrors rapide_ticket_session.dart
  // ════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/v1/auth/login
   * Stores the returned tokens via AuthService.
   * Mirrors: RapideTicketSession.signIn()
   */
  async signIn(email: string, password: string): Promise<void> {
    const res = await fetch(`${this.base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const data = await _unwrap<{ token: string; refreshToken?: string; jiraAccountId?: string }>(res);
    if (typeof data.token !== 'string') throw new Error('Invalid auth response');
    await AuthService.storeTokens(data.token, data.refreshToken);
  }

  /**
   * POST /api/v1/auth/refresh
   * Renews the JWT using the persisted refresh token.
   * Mirrors: RapideTicketSession.refreshAccessToken()
   */
  async refreshAccessToken(): Promise<string> {
    const rt = await AuthService.getRefreshToken();
    if (!rt) throw new Error('Session expired — sign in again.');

    const res = await fetch(`${this.base}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    const data = await _unwrap<{ token: string; refreshToken?: string }>(res);
    await AuthService.storeTokens(data.token, data.refreshToken ?? rt);
    return data.token;
  }

  /**
   * GET /api/v1/auth/oauth/atlassian/authorization-url
   * Returns the Atlassian OAuth URL to open in the browser.
   * Mirrors: RapideTicketSession.getAtlassianLoginAuthorizationUrl()
   */
  async getAtlassianAuthorizationUrl(opts: {
    inviteToken?: string;
    returnUri?: string;
    mobileScheme?: string;
  } = {}): Promise<AtlassianOAuthLoginStart> {
    const q = new URLSearchParams({ projectId: this.projectId });
    if (opts.inviteToken?.trim()) q.set('inviteToken', opts.inviteToken.trim());
    if (opts.returnUri?.trim())   q.set('returnUri',   opts.returnUri.trim());
    if (opts.mobileScheme?.trim()) q.set('mobileScheme', opts.mobileScheme.trim());

    const res = await fetch(`${this.base}/api/v1/auth/oauth/atlassian/authorization-url?${q}`);
    if (!res.ok) return { configured: false };

    const data: any = await res.json();
    const url = data?.authorizationUrl;
    return {
      authorizationUrl: typeof url === 'string' && url ? url : undefined,
      configured: data?.configured === true,
    };
  }

  /**
   * POST /api/v1/auth/oauth/atlassian/exchange
   * Exchange the OAuth code (from deep-link / redirect) for a JWT.
   * Mirrors: RapideTicketSession.signInWithOAuthExchangeCode()
   */
  async signInWithOAuthCode(code: string, inviteToken?: string): Promise<void> {
    const res = await fetch(`${this.base}/api/v1/auth/oauth/atlassian/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: code.trim(),
        ...(inviteToken ? { inviteToken } : {}),
        projectId: this.projectId,
      }),
    });
    const data = await _unwrap<{ token: string; refreshToken?: string }>(res);
    if (typeof data.token !== 'string') throw new Error('Empty OAuth response');
    await AuthService.storeTokens(data.token, data.refreshToken);
  }

  /** Sign out — clears stored tokens. Mirrors: RapideTicketSession.signOut() */
  async signOut(): Promise<void> {
    await AuthService.signOut();
  }

  /** True when a valid access token is stored in Keychain. */
  async isSignedIn(): Promise<boolean> {
    return AuthService.isSignedIn();
  }

  // ════════════════════════════════════════════════════════════════════════
  // ISSUES — mirrors IssuesApi (issues_api.dart)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/v1/projects/:projectId/issues  (multipart/form-data)
   *
   * Mirrors: IssuesApi.createFromUserFeedback()
   *
   * Field mapping vs Flutter:
   *   title                 ← params.title (max 255 chars)
   *   description           ← params.description (enriched with device metadata by caller)
   *   environment           ← params.environment
   *   clientPlatform        ← params.clientPlatform  (e.g. 'REACT_NATIVE')
   *   priority              ← params.priority        (URGENT/IMPORTANT/NORMAL/LESS_URGENT)
   *   assigneeUserId        ← params.assigneeUserId  (RT UUID, takes priority)
   *   jiraAssigneeAccountId ← params.jiraAssigneeAccountId
   *   files[]               ← screenshotUri + videoUri (MP4) or recordingFrames (PNG)
   *
   * Automatically retries once with a refreshed token on 401 / 403.
   */
  async createIssue(params: CreateIssueParams): Promise<IssueCreateResult> {
    const token = await this._requireToken();
    try {
      return await this._doCreateIssue(params, token);
    } catch (err: any) {
      // Mirror RapideTicketAuthInterceptor: retry once on 401/403
      if (err?.statusCode === 401 || err?.statusCode === 403) {
        const newToken = await this.refreshAccessToken();
        return this._doCreateIssue(params, newToken);
      }
      throw err;
    }
  }

  private async _doCreateIssue(params: CreateIssueParams, token: string): Promise<IssueCreateResult> {
    const form = new FormData();

    // Title — truncate to 255 chars (kIssueTitleMaxLength)
    form.append('title', params.title.trim().substring(0, 255));
    form.append('description', params.description);

    if (params.environment)  form.append('environment',  params.environment);
    if (params.clientPlatform) form.append('clientPlatform', params.clientPlatform);
    if (params.priority)     form.append('priority', params.priority);

    // Assignee priority: RapideTicket userId > Jira accountId
    if (params.assigneeUserId?.trim()) {
      form.append('assigneeUserId', params.assigneeUserId.trim());
    } else if (params.jiraAssigneeAccountId?.trim()) {
      form.append('jiraAssigneeAccountId', params.jiraAssigneeAccountId.trim());
    }

    // Screenshot — PNG / JPG / GIF
    if (params.screenshotUri) {
      const uri = params.screenshotUri;
      const lc  = uri.toLowerCase();
      const isGif = lc.endsWith('.gif');
      const isJpg = lc.match(/\.(jpg|jpeg)$/);
      const ext  = isGif ? 'gif' : isJpg ? 'jpg' : 'png';
      const mime = `image/${isGif ? 'gif' : isJpg ? 'jpeg' : 'png'}`;
      form.append('files', { uri, name: `rapide_ticket_feedback.${ext}`, type: mime } as any);
    }

    // Attachments priority (mirrors Flutter IssuesApi):
    //   1. Native video (MP4) from screen recorder
    //   2. Frame PNGs (fallback capture)

    // Native video recording — MP4
    if (params.videoUri) {
      const uri = params.videoUri;
      form.append('files', {
        uri,
        name: 'rapide_ticket_screen_recording.mp4',
        type: 'video/mp4',
      } as any);
    }

    // Screen recording frames (PNG fallback) — only when no video
    if (!params.videoUri && params.recordingFrames?.length) {
      params.recordingFrames.forEach((uri, i) => {
        form.append('files', {
          uri,
          name: `rapide_ticket_screen_recording_${i}.png`,
          type: 'image/png',
        } as any);
      });
    }

    const url = `${this.base}/api/v1/projects/${this.projectId}/issues`;
    console.debug(`[RapideTicket] POST ${url}`);

    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    return _unwrap<IssueCreateResult>(res);
  }

  // ════════════════════════════════════════════════════════════════════════
  // JIRA — mirrors JiraAssignableUsersApi (jira_assignable_users_api.dart)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/v1/projects/:projectId/jira/assignable-users
   *
   * Mirrors: JiraAssignableUsersApi.listAssignableUsers()
   * Used when signInMethod === 'atlassianOAuth' to populate the assignee picker.
   *
   * @param query      Optional Jira text filter
   * @param maxResults 1–100, default 50
   */
  async listJiraAssignableUsers(opts: {
    query?: string;
    maxResults?: number;
  } = {}): Promise<JiraAssignableUser[]> {
    const q = new URLSearchParams({ maxResults: String(opts.maxResults ?? 50) });
    if (opts.query?.trim()) q.set('query', opts.query.trim());

    const url = `${this.base}/api/v1/projects/${this.projectId}/jira/assignable-users?${q}`;
    
    console.log('[RapideTicket DEBUG] listJiraAssignableUsers fetching URL:', url);
    const data = await this._requestWithToken<any[]>((token) =>
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    );

    return (data ?? []).map((u): JiraAssignableUser => {
      const av = typeof u.avatarUrl === 'string' && u.avatarUrl.trim() ? u.avatarUrl.trim() : undefined;
      return {
        accountId:    String(u.accountId),
        displayName:  String(u.displayName ?? u.accountId),
        active:       u.active !== false,
        emailAddress: u.emailAddress ?? undefined,
        avatarUrl:    av,
      };
    });
  }

  /**
   * Convenience: listJiraAssignableUsers() → TicketAssignablePerson[]
   * Ready to feed directly into the assignee picker.
   */
  async listJiraAssignees(opts: { query?: string; maxResults?: number } = {}): Promise<TicketAssignablePerson[]> {
    const users = await this.listJiraAssignableUsers(opts);
    return users.map(assignablePersonFromJira);
  }

  // ════════════════════════════════════════════════════════════════════════
  // PROJECT MEMBERS — mirrors ProjectMembersApi (project_members_api.dart)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/v1/projects/:projectId/members
   *
   * Mirrors: ProjectMembersApi.listMembers()
   * Used when signInMethod === 'password' to populate the assignee picker.
   */
  async listProjectMembers(): Promise<ProjectMember[]> {
    const url   = `${this.base}/api/v1/projects/${this.projectId}/members`;
    console.log('[RapideTicket DEBUG] listProjectMembers fetching URL:', url);
    
    const data = await this._requestWithToken<any[]>((token) => {
      console.log('[RapideTicket DEBUG] listProjectMembers fetching with token...');
      return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    });
    console.log('[RapideTicket DEBUG] listProjectMembers raw data loaded successfully');

    return (data ?? []).map((m): ProjectMember => ({
      userId:      String(m.userId   ?? ''),
      email:       String(m.email    ?? ''),
      displayName: String(m.displayName ?? ''),
      role:        String(m.role     ?? ''),
    }));
  }

  /**
   * Convenience: listProjectMembers() → TicketAssignablePerson[]
   * Ready to feed directly into the assignee picker.
   */
  async listProjectAssignees(): Promise<TicketAssignablePerson[]> {
    const members = await this.listProjectMembers();
    return members.map(assignablePersonFromMember);
  }

  /**
   * Returns the appropriate assignee list based on the current sign-in method.
   * Mirrors the conditional in the Flutter feedback form widget.
   */
  async listAssigneesForCurrentSession(
    signInMethod: import('../types').SignInMethod,
    jiraOpts: { query?: string; maxResults?: number } = {},
  ): Promise<TicketAssignablePerson[]> {
    console.log('[RapideTicket DEBUG] listAssigneesForCurrentSession called with signInMethod =', signInMethod);
    if (signInMethod === 'atlassianOAuth') {
      return this.listJiraAssignees(jiraOpts);
    }
    if (signInMethod === 'password') {
      return this.listProjectAssignees();
    }
    return [];
  }

  // ════════════════════════════════════════════════════════════════════════
  // Internals
  // ════════════════════════════════════════════════════════════════════════

  private async _requestWithToken<T>(
    requestFn: (token: string) => Promise<Response>
  ): Promise<T> {
    const token = await this._requireToken();
    try {
      const res = await requestFn(token);
      return await _unwrap<T>(res);
    } catch (err: any) {
      if (err?.statusCode === 401 || err?.statusCode === 403) {
        console.log('[RapideTicket DEBUG] Token expired or invalid (401/403). Refreshing token...');
        const newToken = await this.refreshAccessToken();
        console.log('[RapideTicket DEBUG] Token refreshed successfully. Retrying request...');
        const res = await requestFn(newToken);
        return await _unwrap<T>(res);
      }
      throw err;
    }
  }

  private async _requireToken(): Promise<string> {
    const t = await AuthService.getToken();
    if (!t) throw new Error('Not authenticated — please sign in first.');
    return t;
  }
}
