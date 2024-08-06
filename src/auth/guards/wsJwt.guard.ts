import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { verify, JsonWebTokenError } from 'jsonwebtoken';
import { Observable } from 'rxjs';
import { Socket } from 'socket.io';
import { UserTokenPayload } from '../types/tokenPayload';

@Injectable()
export class WsJwtGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    if (context.getType() !== 'ws') {
      return true;
    }

    const client = context.switchToWs().getClient<Socket>();
    return WsJwtGuard.validateToken(client)
      .then(() => true)
      .catch(() => false);
  }

  static async validateToken(client: Socket): Promise<UserTokenPayload> {
    const { authorization } = client.handshake.headers;
    if (!authorization) {
      throw new Error('No authorization header');
    }

    const token: string = authorization.split(' ')[1];
    const payload = (await verify(token, 'testibeasecret')) as UserTokenPayload;

    if (payload) {
      // Validate UUID format if necessary
      if (!isValidUUID(payload.id)) {
        throw new Error('Invalid UUID format');
      }
      return payload;
    } else {
      throw new Error('Invalid payload format');
    }
  }
}

function isValidUUID(uuid: string): boolean {
  // Simple regex check for UUID v4 format
  const regex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
}
