import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { PushModule } from '../push/push.module.js';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';

/** Private 1:1 messaging with live delivery and read receipts. */
@Module({
  imports: [RealtimeModule, PushModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
