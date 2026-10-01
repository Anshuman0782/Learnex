import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PushModule } from '../push/push.module.js';
import { RealtimeGateway } from './realtime.gateway.js';

/**
 * The WebSocket layer. RealtimeGateway is exported so feature modules can push
 * live events (new comments, notifications) to connected clients.
 */
@Module({
  imports: [JwtModule.register({}), PushModule],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
