/**
 * Rapide Ticket — Shared API Types
 * Mirrors exactly the Dart models in package:rapide_ticket/src/api/
 */

// ─── Issue sync status ──────────────────────────────────────────────────────
/** Mirrors Flutter IssueSyncStatus enum */
export type IssueSyncStatus =
  | 'OPEN'
  | 'SYNCED_TO_JIRA'
  | 'SYNCED_TO_GITHUB'
  | 'JIRA_ERROR'
  | 'GITHUB_ERROR'
  | string;

/** Mirrors Flutter IssueCreateResult */
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

/** Human-readable summary — mirrors IssueCreateResult.userFacingSummary */
export function getIssueSummary(r: IssueCreateResult): string {
  const gh = r.githubIssueUrl ?? (r.githubIssueNumber != null ? `#${r.githubIssueNumber}` : null);
  switch (r.status) {
    case 'SYNCED_TO_JIRA': {
      const parts: string[] = [];
      if (r.jiraIssueKey) parts.push(`Jira: ${r.jiraIssueKey}`);
      if (gh) parts.push(`GitHub: ${gh}`);
      return parts.length ? parts.join(' · ') : 'Synced with Jira.';
    }
    case 'SYNCED_TO_GITHUB': return gh ? `GitHub issue: ${gh}` : 'Synced with GitHub.';
    case 'JIRA_ERROR':       return r.errorMessage ? `Jira: failed — ${r.errorMessage}` : 'Jira: failed.';
    case 'GITHUB_ERROR':     return r.errorMessage ? `GitHub: failed — ${r.errorMessage}` : 'GitHub: failed.';
    case 'OPEN':             return 'Issue saved (no external tracker configured).';
    default:                 return 'Issue saved.';
  }
}

// ─── Jira assignable user ───────────────────────────────────────────────────
/** Mirrors Flutter JiraAssignableUser (jira_assignable_user.dart) */
export interface JiraAssignableUser {
  accountId: string;
  displayName: string;
  active: boolean;
  emailAddress?: string;
  avatarUrl?: string;
}

// ─── Project member (RapideTicket) ──────────────────────────────────────────
/** Mirrors Flutter ProjectMember (project_member.dart) */
export interface ProjectMember {
  /** UUID — sent as `assigneeUserId` in POST issues */
  userId: string;
  email: string;
  displayName: string;
  /** 'OWNER' | 'ADMIN' | 'MEMBER' */
  role: string;
}

// ─── Unified assignee model ─────────────────────────────────────────────────
/**
 * Mirrors Flutter TicketAssignablePerson (ticket_assignable_person.dart).
 * Unified model for the assignee picker in the issue form.
 * - Jira user  → accountId set, userId null
 * - RT member  → userId set,    accountId null
 */
export interface TicketAssignablePerson {
  displayName: string;
  email?: string;
  avatarUrl?: string;
  /** Jira accountId — present for Jira users only */
  accountId?: string;
  /** RapideTicket UUID — present for project members only */
  userId?: string;
  /** Stable list key: 'jira:{accountId}' or 'rt:{userId}' */
  stableKey: string;
}

export function assignablePersonFromJira(u: JiraAssignableUser): TicketAssignablePerson {
  return {
    displayName: u.displayName,
    email: u.emailAddress,
    avatarUrl: u.avatarUrl,
    accountId: u.accountId,
    stableKey: `jira:${u.accountId}`,
  };
}

export function assignablePersonFromMember(m: ProjectMember): TicketAssignablePerson {
  const name = m.displayName.trim() || m.email.trim() || m.userId;
  return {
    displayName: name,
    email: m.email.trim() || undefined,
    userId: m.userId,
    stableKey: `rt:${m.userId}`,
  };
}

// ─── Sign-in method ─────────────────────────────────────────────────────────
/**
 * Mirrors Flutter RapideTicketSignInMethod.
 * Controls which assignee list to show in the ticket form:
 * - password      → list project members (RapideTicket)
 * - atlassianOAuth → list Jira assignable users
 * - none          → no active session
 */
export type SignInMethod = 'none' | 'password' | 'atlassianOAuth';

// ─── Atlassian OAuth start ──────────────────────────────────────────────────
/** Mirrors Flutter AtlassianOAuthLoginStart */
export interface AtlassianOAuthLoginStart {
  authorizationUrl?: string;
  configured: boolean;
}

// ─── Issue creation params ──────────────────────────────────────────────────
/** Priority codes — mirrors kRapideTicketPriorityCodes */
export type IssuePriority = 'URGENT' | 'IMPORTANT' | 'NORMAL' | 'LESS_URGENT';

/** All fields for POST /api/v1/projects/:projectId/issues */
export interface CreateIssueParams {
  title: string;
  description: string;
  environment?: string;
  clientPlatform?: string;
  priority?: IssuePriority;
  /** UUID of RapideTicket project member (email/password flow) */
  assigneeUserId?: string;
  /** Jira accountId (Atlassian OAuth flow) */
  jiraAssigneeAccountId?: string;
  /** Screenshot file URI (PNG / JPG / GIF) */
  screenshotUri?: string | null;
  /** Screen recording frames (PNG URIs captured by useGifRecorder) */
  recordingFrames?: string[];
}

// ─── RapideTicket config ────────────────────────────────────────────────────
export interface RapideTicketConfig {
  projectId: string;
  apiBaseUrl?: string;
  flavor?: 'develop' | 'staging' | 'production';
  debug?: boolean;
  trigger?: {
    type: 'tap' | 'shake' | 'longpress';
    tapCount?: number;
  };
  gif?: {
    enabled?: boolean;
    fps?: number;
    maxFrames?: number;
  };
}

// ─── Offline queue payload ──────────────────────────────────────────────────
export interface TicketPayload {
  title: string;
  description: string;
  priority?: string;
  type?: string;
  metadata?: Record<string, any>;
  attachments?: string[];
}
