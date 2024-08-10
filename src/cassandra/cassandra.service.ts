import { Injectable, OnModuleInit } from '@nestjs/common';
import { CassandraConfigService } from '../core/config/cassandra.config';
import { Client, types } from 'cassandra-driver';

@Injectable()
export class CassandraService implements OnModuleInit {
  private client: Client;

  constructor(
    private readonly cassandraConfigService: CassandraConfigService,
  ) {}

  async onModuleInit() {
    this.client = this.cassandraConfigService.getClient();
    try {
      await this.createSchemas();
      console.log('Schemas created successfully');
    } catch (error) {
      console.error('Error creating schemas:', error);
    }
  }

  async execute(query: string, params: any[], options?: any) {
    return this.client.execute(query, params, options);
  }

  private async createSchemas() {
    const queries = [
      `CREATE TABLE IF NOT EXISTS conversations (
          conversation_id UUID PRIMARY KEY,
          participant_ids SET<TEXT>,
          created_at TIMESTAMP,
          last_message_at TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS message_status (
          message_id TIMEUUID,
          recipient_id TEXT,
          status TEXT,
         updated_at TIMESTAMP,
        PRIMARY KEY (message_id, recipient_id)
        );
        `,
      `CREATE TABLE IF NOT EXISTS participant_conversations (
          participant_id TEXT,
          conversation_id UUID,
          PRIMARY KEY (participant_id, conversation_id)
      );`,
      `CREATE TABLE IF NOT EXISTS messages (
          conversation_id UUID,
          message_id TIMEUUID,
          sender_id TEXT,
          receiver_id TEXT,
          group_id UUID,
          message TEXT,
          created_at TIMESTAMP,
          PRIMARY KEY (conversation_id, message_id)
      ) WITH CLUSTERING ORDER BY (message_id DESC);`,
      `CREATE TABLE IF NOT EXISTS groups (
          group_id UUID PRIMARY KEY,
          group_name TEXT,
          created_at TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS group_members (
          group_id UUID,
          user_id TEXT,
          PRIMARY KEY (group_id, user_id)
      );`,
    ];

    for (const query of queries) {
      try {
        await this.client.execute(query);
        console.log(`Executed query: ${query}`);
      } catch (error) {
        console.error(`Error executing query: ${query}`, error);
        throw error;
      }
    }
  }

  async createConversation(participantIds: string[]): Promise<types.Uuid> {
    try {
      const conversationId = types.Uuid.random();
      const now = new Date();

      const insertConversationQuery = `
        INSERT INTO conversations (conversation_id, participant_ids, created_at, last_message_at)
        VALUES (?, ?, ?, ?)
      `;
      await this.client.execute(
        insertConversationQuery,
        [conversationId, participantIds, now, now],
        { prepare: true },
      );

      const insertParticipantConversationQuery = `
        INSERT INTO participant_conversations (participant_id, conversation_id)
        VALUES (?, ?)
      `;
      const batchQueries = participantIds.map((participantId) => ({
        query: insertParticipantConversationQuery,
        params: [participantId, conversationId],
      }));

      await this.client.batch(batchQueries, { prepare: true });
      console.log('Conversation created successfully');
      return conversationId;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  async getConversationIdsByParticipantIds(
    participantIds: string[],
  ): Promise<types.Uuid[]> {
    try {
      const conversationIdSets: Set<types.Uuid> = new Set();

      for (const participantId of participantIds) {
        const query = `
          SELECT conversation_id FROM participant_conversations
          WHERE participant_id = ?
        `;
        const result = await this.client.execute(query, [participantId], {
          prepare: true,
        });

        for (const row of result.rows) {
          conversationIdSets.add(row.conversation_id);
        }
      }

      const conversationIds = Array.from(conversationIdSets);

      // console.log('Retrieved conversation IDs:', conversationIds);
      return conversationIds;
    } catch (error) {
      console.error(
        'Error fetching conversation IDs by participant IDs:',
        error,
      );
      throw error;
    }
  }

  async insertMessage(
    conversationId: types.Uuid,
    messageId: types.TimeUuid,
    senderId: string,
    receiverId: string,
    groupId: types.Uuid | null,
    message: string,
    createdAt: Date,
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO messages (conversation_id, message_id, sender_id, receiver_id, group_id, message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      const params = [
        conversationId,
        messageId,
        senderId,
        receiverId,
        groupId,
        message,
        createdAt,
      ];
      await this.client.execute(query, params, { prepare: true });
      console.log('Message inserted successfully');
    } catch (error) {
      console.error('Error inserting message:', error);
      throw error;
    }
  }

  async getParticipants(conversationId: string): Promise<string[]> {
    try {
      const query = `
        SELECT participant_ids FROM conversations
        WHERE conversation_id = ?
      `;
      const result = await this.client.execute(query, [conversationId], {
        prepare: true,
      });
      return result.rowLength > 0 ? result.rows[0].participant_ids : [];
    } catch (error) {
      console.error('Error fetching participants:', error);
      throw error;
    }
  }

  async getMessageStatus(
    messageId: types.TimeUuid,
    participantId: string,
  ): Promise<string | null> {
    try {
      const query = `
            SELECT status
            FROM message_status
            WHERE conversation_id = ? AND message_id = ? AND participant_id = ?
        `;
      const result = await this.client.execute(
        query,
        [messageId, participantId],
        {
          prepare: true,
        },
      );
      return result.rowLength > 0 ? result.rows[0].status : null;
    } catch (error) {
      console.error('Error fetching message status:', error);
      throw error;
    }
  }

  async updateMessageStatus(
    conversationId: types.Uuid,
    messageId: types.TimeUuid,
    participantId: string,
    status: string,
  ) {
    try {
      const query = `
            INSERT INTO message_status (message_id, participant_id, status, updated_at)
            VALUES (?, ?, ?, ?)
            IF NOT EXISTS
        `;
      const params = [messageId, participantId, status, new Date()];
      await this.client.execute(query, params, { prepare: true });
      console.log('Message status updated successfully');
    } catch (error) {
      console.error('Error updating message status:', error);
      throw error;
    }
  }

  async insertMessageStatus(
    messageId: types.Uuid,
    recipientId: string,
    status: 'sent' | 'delivered' | 'read',
  ) {
    try {
      const query = `
        INSERT INTO message_status (message_id, recipient_id, status, updated_at)
        VALUES (?, ?, ?, ?)
        IF NOT EXISTS
      `;
      await this.client.execute(
        query,
        [messageId, recipientId, status, new Date()],
        { prepare: true },
      );
      console.log('Message status inserted successfully');
    } catch (error) {
      console.error('Error inserting message status:', error);
      throw error;
    }
  }
}
