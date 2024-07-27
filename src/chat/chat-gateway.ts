import {
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { MessageStructure } from './dto/chat.dto';

const users = [];
let user = 0;
@WebSocketGateway(3200, { cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor() {}
  @WebSocketServer() server: Server;

  handleConnection(client: Socket) {
    user++;
    users.push({ id: user, clientId: client.id });
    console.log('New client connected', client.id);
    console.log(users);
  }
  handleDisconnect(client: any) {
    console.log('Client disconnected', client.id);
    console.log(users);
  }
  @SubscribeMessage('one-one-message')
  handleNewMessage(client: Socket, message: any) {
    const parsedmessage = JSON.parse(message);
    console.log('New message received: ', parsedmessage);
    if (parsedmessage.recieverId) {
      const recieverSocketId = users.find(
        (usr) => usr.id === parsedmessage.recieverId,
      );
      console.log('Asasdadasdada', recieverSocketId);
      if (recieverSocketId) {
        client
          .to(recieverSocketId.clientId)
          .emit('reply', parsedmessage.message);
      }
    }
    // client.emit('reply', 'this is a reply message');
  }

  @SubscribeMessage('group-message')
  handleNewGroupMessage(client: Socket, message: any) {
    const parsedmessage = JSON.parse(message);
    console.log('New group message received: ', parsedmessage);
    client.broadcast.emit('reply', parsedmessage.message);
  }
}
