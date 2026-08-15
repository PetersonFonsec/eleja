import { DatabaseModule } from '@eleja/database';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { CandidatesModule } from './modules/candidates/candidates.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';

@Module({
  imports: [DatabaseModule, CandidatesModule, AnalyticsModule],
  controllers: [AppController],
})
export class AppModule {}
