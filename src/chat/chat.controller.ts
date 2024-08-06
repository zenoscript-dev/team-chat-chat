// src/auth/auth.controller.ts
import { Controller, DefaultValuePipe, Get, Query } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('user/conversations')
  async fetchUserConversations(
    @Query('userId', new DefaultValuePipe(null)) userId: string,
  ) {
    return await this.chatService.getUserConversations(userId);
  }
}
