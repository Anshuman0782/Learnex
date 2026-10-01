import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { CommunitiesController } from './communities.controller.js';
import { CommunitiesService } from './communities.service.js';

@Module({
  imports: [UsersModule],
  controllers: [CommunitiesController],
  providers: [CommunitiesService],
})
export class CommunitiesModule {}
