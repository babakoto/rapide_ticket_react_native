// src/types/index.ts

export interface RapideTicketConfig {
  projectId: string;
  flavor: string;
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
