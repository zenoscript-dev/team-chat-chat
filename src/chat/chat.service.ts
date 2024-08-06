import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CassandraService } from 'src/cassandra/cassandra.service';

@Injectable()
export class ChatService {
  constructor(private readonly cassandraService: CassandraService) {}

  async getUserConversations(userId: string) {
    try {
      const conversationIds = await this.getConversations(userId);
      const conversationDetails = await Promise.all(
        conversationIds.map(async (conversationId) => {
          const recentMessage = await this.getMostRecentMessage(conversationId);
          return {
            conversationId,
            recentMessage,
          };
        }),
      );
      return conversationDetails;
    } catch (error) {
      console.error('Error fetching user conversations:', error);
      throw new HttpException(
        'Failed to fetch user conversations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getConversations(userId: string): Promise<string[]> {
    try {
      const query = `
        SELECT conversation_id
        FROM participant_conversations
        WHERE participant_id = ?
      `;
      const result = await this.cassandraService.execute(query, [userId], {
        prepare: true,
      });
      return result.rows.map((row) => row.conversation_id);
    } catch (error) {
      console.error(`Error fetching conversations for user ${userId}:`, error);
      throw new HttpException(
        'Failed to fetch conversations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getMostRecentMessage(conversationId: string): Promise<any> {
    try {
      const query = `
        SELECT message_id, sender_id, message, created_at
        FROM messages
        WHERE conversation_id = ?
        ORDER BY message_id DESC
        LIMIT 1
      `;
      const result = await this.cassandraService.execute(
        query,
        [conversationId],
        { prepare: true },
      );
      return result.rowLength > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error fetching most recent message:', error);
      throw new HttpException(
        'Failed to fetch most recent message',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
