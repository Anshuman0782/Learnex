import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service.js';

/** Transactional email (codes, security notices). Global so any module can send. */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
