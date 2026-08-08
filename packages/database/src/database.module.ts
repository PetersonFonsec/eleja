import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Global, Module } from '@nestjs/common';
import { createMikroOrmOptions } from './database.config.js';

@Global()
@Module({
  imports: [MikroOrmModule.forRoot(createMikroOrmOptions())],
})
export class DatabaseModule {}
