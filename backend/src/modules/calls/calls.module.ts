import { Module } from '@nestjs/common';
import { CallsController } from './calls.controller.js';

@Module({
  controllers: [CallsController],
})
export class CallsModule {}
