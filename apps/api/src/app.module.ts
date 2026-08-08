import { DatabaseModule } from '@eleja/database';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { CandidatesModule } from './modules/candidates/candidates.module.js';

@Module({
  imports: [DatabaseModule, CandidatesModule],
  controllers: [AppController],
})
export class AppModule {}
