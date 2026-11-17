import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthService } from './../src/auth/auth.service.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.config.js';
import type { Trip } from './../src/generated/prisma/client.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

const testSecret = 'test-only-access-secret-that-is-at-least-32-characters';
const testUserId = randomUUID();
const trips: Array<Trip & { ownerId: string | null }> = [];
const participants: Array<{ id: string; tripId: string; name: string }> = [];
const testUser = {
  id: testUserId,
  email: 'alex@example.com',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};
const authServiceMock = {
  register: vi.fn(async () => ({
    user: testUser,
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
  })),
  login: vi.fn(async () => ({
    user: testUser,
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
  })),
  refresh: vi.fn(async () => ({
    user: testUser,
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
  })),
  logout: vi.fn(async () => {}),
};
const prismaServiceMock = {
  trip: {
    create: vi.fn(({ data }: { data: { name: string; ownerId: string } }) => {
      const trip = {
        id: randomUUID(),
        name: data.name,
        currency: 'RON',
        createdAt: new Date(),
        ownerId: data.ownerId,
      };
      trips.push(trip);
      const { ownerId: _ownerId, ...publicTrip } = trip;
      return Promise.resolve(publicTrip);
    }),
    findMany: vi.fn(({ where }: { where: { ownerId: string } }) =>
      Promise.resolve(
        trips
          .filter((trip) => trip.ownerId === where.ownerId)
          .map(({ ownerId: _ownerId, ...trip }) => trip),
      ),
    ),
    findFirst: vi.fn(
      ({ where }: { where: { id: string; ownerId: string } }) => {
        const trip = trips.find(
          (item) =>
            item.id === where.id && item.ownerId === where.ownerId,
        );
        return Promise.resolve(trip ? { id: trip.id } : null);
      },
    ),
  },
  participant: {
    create: vi.fn(
      ({ data }: { data: { tripId: string; name: string } }) => {
        const participant = { id: randomUUID(), ...data };
        participants.push(participant);
        return Promise.resolve({
          id: participant.id,
          name: participant.name,
        });
      },
    ),
    findMany: vi.fn(({ where }: { where: { tripId: string } }) =>
      Promise.resolve(
        participants
          .filter((participant) => participant.tripId === where.tripId)
          .sort((left, right) => left.name.localeCompare(right.name))
          .map(({ id, name }) => ({ id, name })),
      ),
    ),
  },
};

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;

  beforeEach(async () => {
    trips.length = 0;
    participants.length = 0;
    process.env['JWT_ACCESS_SECRET'] = testSecret;
    vi.clearAllMocks();
    accessToken = await new JwtService({ secret: testSecret }).signAsync({
      sub: testUserId,
      email: testUser.email,
    });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaServiceMock)
      .overrideProvider(AuthService)
      .useValue(authServiceMock)
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

  it('/auth/register should set an HttpOnly refresh cookie without returning it', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'alex@example.com', password: 'a-secure-passphrase-123' })
      .expect(201);

    expect(response.body).toMatchObject({
      user: { id: testUserId, email: testUser.email },
      accessToken: 'test-access-token',
    });
    expect(response.body.refreshToken).toBeUndefined();
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.headers['set-cookie'][0]).toContain('splittrip_refresh=');
  });

  it('/auth/register should reject an invalid email and short password', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'short' })
      .expect(400);
  });

  it('/auth/register should reject an untrusted browser origin', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .set('Origin', 'https://untrusted.example')
      .send({ email: 'alex@example.com', password: 'a-secure-passphrase-123' })
      .expect(403);
  });

  it('/auth/refresh should require the HttpOnly refresh cookie', () => {
    return request(app.getHttpServer()).post('/auth/refresh').expect(401);
  });

  it('/trips (GET) should require authentication', () => {
    return request(app.getHttpServer()).get('/trips').expect(401);
  });

  it('/trips (GET) should only return the authenticated user trips', async () => {
    trips.push(
      {
        id: randomUUID(),
        name: 'My trip',
        currency: 'RON',
        createdAt: new Date(),
        ownerId: testUserId,
      },
      {
        id: randomUUID(),
        name: 'Someone else trip',
        currency: 'RON',
        createdAt: new Date(),
        ownerId: randomUUID(),
      },
    );

    const response = await request(app.getHttpServer())
      .get('/trips')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe('My trip');
  });

  it('/trips (POST) should create a trip that can be listed', async () => {
    const response = await request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Via Ferrata' })
      .expect(201);

    expect(response.body).toMatchObject({ name: 'Via Ferrata' });
    expect(response.body.id).toEqual(expect.any(String));
    expect(response.body.createdAt).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .get('/trips')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect([response.body]);
  });

  it('/trips (POST) should reject an empty name', () => {
    return request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '   ' })
      .expect(400);
  });

  it('should add and list participants for an owned trip', async () => {
    const tripId = randomUUID();
    trips.push({
      id: tripId,
      name: 'Via Ferrata',
      currency: 'RON',
      createdAt: new Date(),
      ownerId: testUserId,
    });

    const createResponse = await request(app.getHttpServer())
      .post(`/trips/${tripId}/participants`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '  Alex  ' })
      .expect(201);

    expect(createResponse.body).toMatchObject({
      id: expect.any(String),
      name: 'Alex',
    });

    await request(app.getHttpServer())
      .get(`/trips/${tripId}/participants`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect([createResponse.body]);
  });

  it('should not allow access to another user trip participants', async () => {
    const tripId = randomUUID();
    trips.push({
      id: tripId,
      name: 'Private trip',
      currency: 'RON',
      createdAt: new Date(),
      ownerId: randomUUID(),
    });

    await request(app.getHttpServer())
      .get(`/trips/${tripId}/participants`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('should reject a malformed trip id before querying the database', () => {
    return request(app.getHttpServer())
      .get('/trips/not-a-uuid/participants')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
  });

  afterEach(async () => {
    await app.close();
  });
});
