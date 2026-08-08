import { DatabaseModule } from '@eleja/database';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AppController],
})
export class AppModule {}
