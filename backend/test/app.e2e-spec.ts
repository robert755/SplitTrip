import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.config.js';
import type { Trip } from './../src/generated/prisma/client.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

const trips: Trip[] = [];
const prismaServiceMock = {
  trip: {
    create: vi.fn(({ data }: { data: { name: string } }) => {
      const trip: Trip = {
        id: randomUUID(),
        name: data.name,
        currency: 'RON',
        createdAt: new Date(),
      };
      trips.push(trip);
      return Promise.resolve(trip);
    }),
    findMany: vi.fn(() => Promise.resolve([...trips])),
  },
};

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    trips.length = 0;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('/trips (GET) should initially return an empty list', () => {
    return request(app.getHttpServer()).get('/trips').expect(200).expect([]);
  });

  it('/trips (POST) should create a trip that can be listed', async () => {
    const response = await request(app.getHttpServer())
      .post('/trips')
      .send({ name: 'Via Ferrata' })
      .expect(201);

    expect(response.body).toMatchObject({ name: 'Via Ferrata' });
    expect(response.body.id).toEqual(expect.any(String));
    expect(response.body.createdAt).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .get('/trips')
      .expect(200)
      .expect([response.body]);
  });

  it('/trips (POST) should reject an empty name', () => {
    return request(app.getHttpServer())
      .post('/trips')
      .send({ name: '   ' })
      .expect(400);
  });

  afterEach(async () => {
    await app.close();
  });
});
