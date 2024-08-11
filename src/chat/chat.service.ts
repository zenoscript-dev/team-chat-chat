import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { types } from 'cassandra-driver';
import { CassandraService } from 'src/cassandra/cassandra.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly cassandraService: CassandraService,
    @Inject('USER_SERVICE') private readonly userclient: ClientProxy,
  ) {}

  async onModuleInit() {
    try {
      await this.userclient.connect();
      console.log('connected to user microservice successfully');
    } catch (error) {
      console.error('Error connecting to user microservice:', error);
    }
  }

  async getUserConversations(userId: string) {
    Logger.log(
      `fetching only conversations and recent messages for user ${userId}`,
    );
    try {
      const conversationDetails = await this.getConversations(userId);
      if (conversationDetails && conversationDetails.length > 0) {
        const finalConversationDetails = await Promise.all(
          conversationDetails.map(async (conversation) => {
            const recentMessage = await this.getMostRecentMessage(
              conversation.conversation_id,
            );
            const userDetailsResponse = await this.userclient
              .send<any>(
                'user-details',
                conversation.participant_ids.map((userid) => {
                  if (userid !== userId) {
                    return userid;
                  }
                }),
              )
              .toPromise();
            return {
              conversation,
              recentMessage,
              recieverProflePic: userDetailsResponse[0]?.profilepic,
              recieverName: userDetailsResponse[0]?.userName,
            };
          }),
        );
        return finalConversationDetails;
      } else {
        return [];
      }
    } catch (error) {
      console.error('Error fetching user conversations:', error);
      throw new HttpException(
        'Failed to fetch user conversations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getConversations(userId: string): Promise<any[]> {
    Logger.log(`Fetching conversations for user ${userId}`);
    try {
      const conversationQuery = `
            SELECT conversation_id
            FROM participant_conversations
            WHERE participant_id = ?
        `;
      const conversationResult = await this.cassandraService.execute(
        conversationQuery,
        [userId],
        {
          prepare: true,
        },
      );

      const conversationIds = conversationResult.rows.map(
        (row) => row.conversation_id,
      );

      if (conversationIds.length === 0) {
        return []; // No conversations found
      }

      const detailsQuery = `
            SELECT conversation_id, participant_ids, created_at, last_message_at
            FROM conversations
            WHERE conversation_id IN (${conversationIds.map(() => '?').join(', ')})
        `;

      const detailsResult = await this.cassandraService.execute(
        detailsQuery,
        conversationIds,
        {
          prepare: true,
        },
      );

      return detailsResult.rows;
    } catch (error) {
      console.error(`Error fetching conversations for user ${userId}:`, error);
      throw new HttpException(
        'Failed to fetch conversations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getMostRecentMessage(conversationId: string): Promise<any> {
    Logger.log(`fetching recent messages for conversations ${conversationId}`);

    try {
      const query = `
        SELECT message_id, sender_id, receiver_id, message, created_at
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

  async getMessages(
    conversationId: types.Uuid,
    pageSize: number,
    pagingState?: Buffer,
  ): Promise<{ messages: any[]; pagingState?: Buffer }> {
    try {
      // Query to fetch messages with pagination
      const messagesQuery = `
        SELECT message_id, sender_id, receiver_id, message, created_at
        FROM messages
        WHERE conversation_id = ?
        ORDER BY message_id DESC
        LIMIT ?
      `;

      // Execute the query with optional paging state
      const result = await this.cassandraService.execute(
        messagesQuery,
        [conversationId, pageSize],
        {
          prepare: true,
          fetchSize: pageSize,
          pageState: pagingState,
        },
      );

      // Retrieve messages and the next paging state
      const messages = result.rows;
      const nextPagingState = result.pageState;

      // Fetch message statuses for the retrieved messages
      const messageStatusPromises = messages.map(async (message) => {
        const statusQuery = `
          SELECT participant_id, status
          FROM message_status
          WHERE message_id = ?
        `;
        const statusResult = await this.cassandraService.execute(
          statusQuery,
          [message.message_id],
          {
            prepare: true,
          },
        );

        const statusMap = statusResult.rows.reduce((map, row) => {
          map[row.participant_id] = row.status;
          return map;
        }, {});

        return {
          ...message,
          statuses: statusMap,
        };
      });

      return {
        messages: await Promise.all(messageStatusPromises),
        pagingState: nextPagingState ? Buffer.from(nextPagingState) : undefined,
      };
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }
}
