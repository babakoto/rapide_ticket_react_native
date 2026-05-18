// src/types/index.ts

export interface RapideTicketConfig {
  projectId: string;
  flavor?: string;
  apiBaseUrl?: string;
  jira?: {
    host: string;
    projectKey: string;
    defaultIssueType?: string;
  };
  trigger?: {
    type: 'shake' | 'tap' | 'longpress';
    tapCount?: number;
    tapZone?: 'anywhere' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  };
  gif?: {
    enabled: boolean;
    bufferSeconds?: number;
    fps?: number;
  };
  theme?: 'light' | 'dark' | 'auto';
  debug?: boolean;
}

export interface TicketPayload {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  type: 'bug' | 'improvement' | 'task';
  metadata: Record<string, any>;
  attachments?: string[];
}

// Status returned by POST /api/v1/projects/{id}/issues
export type IssueSyncStatus =
  | 'OPEN'
  | 'SYNCED_TO_JIRA'
  | 'SYNCED_TO_GITHUB'
  | 'JIRA_ERROR'
  | 'GITHUB_ERROR'
  | 'UNKNOWN';

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

export const getIssueSummary = (result: IssueCreateResult): string => {
  switch (result.status) {
    case 'SYNCED_TO_JIRA':
      return result.jiraIssueKey ? `Jira: ${result.jiraIssueKey}` : 'Synced with Jira.';
    case 'SYNCED_TO_GITHUB':
      return result.githubIssueNumber
        ? `GitHub: #${result.githubIssueNumber}`
        : 'Synced with GitHub.';
    case 'JIRA_ERROR':
      return result.errorMessage
        ? `Jira error: ${result.errorMessage}`
        : 'Jira sync failed — check server logs.';
    case 'GITHUB_ERROR':
      return result.errorMessage
        ? `GitHub error: ${result.errorMessage}`
        : 'GitHub sync failed.';
    case 'OPEN':
      return 'Issue saved (no external tracker configured).';
    default:
      return 'Issue submitted.';
  }
};
