import { DatabaseModule } from '@eleja/database';
import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { CandidatesModule } from '../src/modules/candidates/candidates.module.js';
import { AnalyticsModule } from '../src/modules/analytics/analytics.module.js';

@Module({})
class TestDatabaseModule {}

@Module({})
class TestCandidatesModule {}

@Module({})
class TestAnalyticsModule {}

describe('GET /health', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('reports that the API is healthy', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(DatabaseModule)
      .useModule(TestDatabaseModule)
      .overrideModule(CandidatesModule)
      .useModule(TestCandidatesModule)
      .overrideModule(AnalyticsModule)
      .useModule(TestAnalyticsModule)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });
});
