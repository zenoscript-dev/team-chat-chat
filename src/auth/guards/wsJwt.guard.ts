import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { verify } from 'jsonwebtoken';
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
    const { token } = client.handshake.auth;
    if (!token) {
      throw new Error('No authorization header');
    }

    const payload = (await verify(
      token as string,
      process.env.JWT_ACCESS_SECRET,
    )) as UserTokenPayload;

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
