import { Module } from '@nestjs/common';
import { ChatGateway } from './chat-gateway';
import { CassandraService } from 'src/cassandra/cassandra.service';
import { CassandraConfigService } from 'src/core/config/cassandra.config';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'USER_SERVICE',
        transport: Transport.TCP,
        options: { host: 'localhost', port: 5500 }, // Add the correct host and port here
      },
    ]),
  ],
  controllers: [ChatController],
  providers: [
    ChatGateway,
    CassandraService,
    CassandraConfigService,
    ChatService,
  ],
})
export class ChatModule {}
