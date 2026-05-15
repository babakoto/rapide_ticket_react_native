import axios from 'axios';
import { TicketPayload } from '../types';

export class JiraAPI {
  private host: string;
  private projectKey: string;

  constructor(host: string, projectKey: string) {
    this.host = host;
    this.projectKey = projectKey;
  }

  async submitIssue(payload: TicketPayload, token: string): Promise<any> {
    const url = `https://${this.host}/rest/api/3/issue`;
    const issueData = {
      fields: {
        project: {
          key: this.projectKey
        },
        summary: payload.title,
        description: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: payload.description
                }
              ]
            }
          ]
        },
        issuetype: {
          name: payload.type === 'bug' ? 'Bug' : 'Task'
        }
      }
    };

    try {
      const response = await axios.post(url, issueData, {
        headers: {
          Authorization: `Basic ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      throw new Error('Failed to submit issue to Jira');
    }
  }
}
