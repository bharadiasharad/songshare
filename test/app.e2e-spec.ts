import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

/**
 * End-to-end smoke tests. Requires a reachable database (provided by the CI
 * MySQL service with migrations applied). Verifies that authentication is enforced
 * on protected routes and the error envelope is returned.
 */
describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('rejects unauthenticated access to GET /users/me', async () => {
    const res = await request(app.getHttpServer()).get('/users/me');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ statusCode: 401, path: '/users/me' });
  });

  it('rejects unauthenticated access to GET /songs', async () => {
    await request(app.getHttpServer()).get('/songs').expect(401);
  });

  it('returns the standard error envelope shape', async () => {
    const res = await request(app.getHttpServer()).get('/pitches');
    expect(res.body).toEqual(
      expect.objectContaining({
        statusCode: expect.any(Number),
        error: expect.any(String),
        message: expect.anything(),
        path: '/pitches',
        timestamp: expect.any(String),
      }),
    );
  });
});
