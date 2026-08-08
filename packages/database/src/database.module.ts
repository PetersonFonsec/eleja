import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { Global, Module } from '@nestjs/common';
import { createMikroOrmOptions } from './database.config.js';

@Global()
@Module({
  imports: [MikroOrmModule.forRoot(createMikroOrmOptions())],
  providers: [
    {
      provide: EntityManager,
      inject: [MikroORM],
      useFactory: (orm: MikroORM) => orm.em,
    },
  ],
  exports: [EntityManager],
})
export class DatabaseModule {}
