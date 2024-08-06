import { Module } from '@nestjs/common';
import { ChatGateway } from './chat-gateway';
import { CassandraService } from 'src/cassandra/cassandra.service';
import { CassandraConfigService } from 'src/core/config/cassandra.config';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  controllers: [ChatController],
  providers: [
    ChatGateway,
    CassandraService,
    CassandraConfigService,
    ChatService,
  ],
})
export class ChatModule {}
