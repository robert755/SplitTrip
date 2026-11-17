import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { TripsModule } from './trips/trips.module.js';

@Module({
  imports: [TripsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
