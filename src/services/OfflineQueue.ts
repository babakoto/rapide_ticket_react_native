import AsyncStorage from '@react-native-async-storage/async-storage';
import { TicketPayload } from '../types';

const QUEUE_KEY = 'rapide_ticket_offline_queue';

export class OfflineQueue {
  static async enqueue(ticket: TicketPayload) {
    try {
      const queueStr = await AsyncStorage.getItem(QUEUE_KEY);
      const queue = queueStr ? JSON.parse(queueStr) : [];
      queue.push(ticket);
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to enqueue ticket', error);
    }
  }

  static async getQueue(): Promise<TicketPayload[]> {
    try {
      const queueStr = await AsyncStorage.getItem(QUEUE_KEY);
      return queueStr ? JSON.parse(queueStr) : [];
    } catch (error) {
      return [];
    }
  }

  static async clearQueue() {
    await AsyncStorage.removeItem(QUEUE_KEY);
  }
}
