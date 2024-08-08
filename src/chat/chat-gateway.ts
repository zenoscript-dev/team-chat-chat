import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { MessageStructure } from './dto/chat.dto';
import { SocketAuthMiddleWare } from '../auth/middlewares/ws.mw';
import { HttpException, HttpStatus, Inject, UseGuards } from '@nestjs/common';
import { WsJwtGuard } from '../auth/guards/wsJwt.guard';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CassandraService } from 'src/cassandra/cassandra.service';
import { types } from 'cassandra-driver';

@WebSocketGateway(3500, { cors: { origin: '*' } })
@UseGuards(WsJwtGuard)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly cassandraService: CassandraService,
  ) {}

  @WebSocketServer() server: Server;

  async afterInit(server: Server) {
    server.use(SocketAuthMiddleWare() as any);
  }

  async handleConnection(client: Socket) {
    try {
      const payload = await WsJwtGuard.validateToken(client);
      const userId = payload.id;
      await this.cacheManager.set(userId, client.id, Infinity);
    } catch (error) {
      throw new HttpException(
        'Connection failed, please try again...',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      const payload = await WsJwtGuard.validateToken(client);
      const userId = payload.id;

      // Clear the Redis cache
      await this.cacheManager.del(userId);
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  }

  @SubscribeMessage('one-one-message')
  async handleNewMessage(client: Socket, message: any) {
    try {
      const parsedMessage: MessageStructure =
        typeof message === 'string' ? JSON.parse(message) : message;
      const { senderId, recipientId, content } = parsedMessage;

      if (!senderId || !recipientId) {
        throw new Error('Invalid senderId or recipientId');
      }

      const recipientSocketId = await this.getCachedSocketId(recipientId);
      if (recipientSocketId) {
        await this.server.to(recipientSocketId).emit('reply', content);
      }

      const participantIds: string[] = [senderId, recipientId];
      const conversationIds =
        await this.cassandraService.getConversationIdsByParticipantIds(
          participantIds,
        );

      let conversationId: types.Uuid;
      if (conversationIds.length > 0) {
        conversationId = conversationIds[0]; // Use the first found conversation ID
      } else {
        conversationId =
          await this.cassandraService.createConversation(participantIds);
      }

      await this.cassandraService.insertMessage(
        conversationId,
        senderId,
        recipientId,
        null,
        content,
        new Date(),
      );
    } catch (error) {
      console.error('Error handling message:', error);
      throw new HttpException(
        'Error sending message to recipient...',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @SubscribeMessage('group-message')
  async handleNewGroupMessage(client: Socket, message: any) {
    try {
      const parsedMessage = JSON.parse(message);
      client.broadcast.emit('reply', parsedMessage.message);
    } catch (error) {
      console.error('Error handling group message:', error);
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(client: Socket, payload: any) {
    try {
      const parsedPayload: { conversationId: string; userId: string } =
        JSON.parse(payload);
      const participants = await this.cassandraService.getParticipants(
        parsedPayload.conversationId,
      );

      for (const participantId of participants) {
        if (participantId !== parsedPayload.userId) {
          const recipientSocketId =
            await this.getConnectedSocketId(participantId);
          if (recipientSocketId) {
            this.server
              .to(recipientSocketId)
              .emit('userTyping', { userId: parsedPayload.userId });
          }
        }
      }
    } catch (error) {
      console.error('Error handling typing event:', error);
    }
  }

  @SubscribeMessage('stopTyping')
  async handleStopTyping(client: Socket, payload: any) {
    try {
      const parsedPayload: { conversationId: string; userId: string } =
        JSON.parse(payload);
      const participants = await this.cassandraService.getParticipants(
        parsedPayload.conversationId,
      );

      for (const participantId of participants) {
        if (participantId !== parsedPayload.userId) {
          const recipientSocketId =
            await this.getConnectedSocketId(participantId);
          if (recipientSocketId) {
            this.server
              .to(recipientSocketId)
              .emit('userStoppedTyping', { userId: parsedPayload.userId });
          }
        }
      }
    } catch (error) {
      console.error('Error handling stop typing event:', error);
    }
  }

  private async getCachedSocketId(userId: string): Promise<string | null> {
    return (await this.cacheManager.get(userId)) as string | null;
  }

  private async getConnectedSocketId(userId: string): Promise<string | null> {
    const socketId = await this.getCachedSocketId(userId);
    if (socketId) {
      const sockets = await this.server.in(socketId).fetchSockets();
      if (sockets.length > 0) {
        return socketId;
      }
    }
    return null;
  }
}
