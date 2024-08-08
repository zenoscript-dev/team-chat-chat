// src/auth/auth.controller.ts
import {
  Controller,
  DefaultValuePipe,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from 'src/auth/guards/jwtAuth.guard';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('user/conversations')
  @UseGuards(JwtAuthGuard)
  async fetchUserConversations(
    @Query('userId', new DefaultValuePipe(null)) userId: string,
  ) {
    return await this.chatService.getUserConversations(userId);
  }
}
