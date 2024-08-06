// src/auth/auth.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { UserService } from '../services/user.service';
import { UserTokenPayload } from '../types/tokenPayload';

@Controller('auth')
export class AuthController {
  constructor(private readonly userService: UserService) {}

  @Post('login')
  login(
    @Body() body: { username: string; password: string },
  ): UserTokenPayload {
    const { username, password } = body;
    return this.userService.authenticate(username, password);
  }
}
