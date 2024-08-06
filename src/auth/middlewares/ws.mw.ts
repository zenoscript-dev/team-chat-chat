import { Socket } from 'socket.io';
import { WsJwtGuard } from '../guards/wsJwt.guard';

export type SocketIOMiddleware = {
  (client: Socket, next: (err?: Error) => void): void;
};

export const SocketAuthMiddleWare = (): SocketIOMiddleware => {
  return async (client, next) => {
    try {
      await WsJwtGuard.validateToken(client);
      next();
    } catch (error) {
      next(error);
    }
  };
};
