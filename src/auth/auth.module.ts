// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { AuthController } from './controllers/auth.controller';
import { UserService } from './services/user.service';
import { JwtService } from './services/jwt.service';

@Module({
  controllers: [AuthController],
  providers: [UserService, JwtService],
})
export class AuthModule {}
