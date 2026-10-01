import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { SkillsController } from './skills.controller.js';
import { SkillsService } from './skills.service.js';

@Module({
  imports: [UsersModule],
  controllers: [SkillsController],
  providers: [SkillsService],
})
export class SkillsModule {}
