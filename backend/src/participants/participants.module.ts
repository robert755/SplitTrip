import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ParticipantsController } from './participants.controller.js';
import { ParticipantsService } from './participants.service.js';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [ParticipantsController],
  providers: [ParticipantsService],
})
export class ParticipantsModule {}
