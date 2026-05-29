import axios from 'axios';
import { TicketPayload } from '../types';
import { HOSTED_API_BASE_URL } from '../config/RapideTicketSettings';

export class FlutteradgentsAPI {
  private baseUrl: string;
  private projectId: string;
  
  constructor(baseUrl: string, projectId: string) {
    this.baseUrl = baseUrl || `${HOSTED_API_BASE_URL}/v1`;
    this.projectId = projectId;
  }

  async submitTicket(payload: TicketPayload, token: string): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/projects/${this.projectId}/tickets`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      throw new Error('Failed to submit ticket to Flutteradgents');
    }
  }
}
