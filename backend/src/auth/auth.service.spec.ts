import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  const secret = 'unit-test-access-secret-that-is-at-least-32-characters';

  beforeEach(() => {
    process.env['JWT_ACCESS_SECRET'] = secret;
  });

  it('normalizes email and stores only an Argon2id password hash', async () => {
    const userId = 'c3f6b6b8-e238-4ac8-b970-6e507fa42942';
    const password = 'a-long-passphrase-for-this-test';
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    let savedPasswordHash = '';
    let savedTokenHash = '';

    const transaction = {
      user: {
        create: vi.fn(
          async ({
            data,
          }: {
            data: { email: string; passwordHash: string };
          }) => {
            savedPasswordHash = data.passwordHash;
            return { id: userId, email: data.email, createdAt };
          },
        ),
      },
      refreshSession: {
        create: vi.fn(
          async ({ data }: { data: { tokenHash: string } }) => {
            savedTokenHash = data.tokenHash;
          },
        ),
      },
    };
    const prismaMock = {
      $transaction: vi.fn(
        async (
          callback: (transaction: Prisma.TransactionClient) => Promise<unknown>,
        ) => callback(transaction as unknown as Prisma.TransactionClient),
      ),
    };
    const authService = new AuthService(
      prismaMock as unknown as PrismaService,
      new JwtService({ secret }),
    );

    const result = await authService.register({
      email: '  Alex@Example.com ',
      password,
    });

    expect(result.user.email).toBe('alex@example.com');
    expect(savedPasswordHash).not.toBe(password);
    expect(await argon2.verify(savedPasswordHash, password)).toBe(true);
    expect(savedTokenHash).not.toBe(result.refreshToken);
    expect(savedTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toContain(password);
  });

  it('rotates refresh tokens and stores only the replacement hash', async () => {
    const oldToken = 'old-refresh-token-for-rotation-test';
    const user = {
      id: 'c3f6b6b8-e238-4ac8-b970-6e507fa42942',
      email: 'alex@example.com',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const session = {
      id: 'ed8c3129-609f-40f3-aa94-1b32ea27f1db',
      familyId: '4a8f728e-bf6d-44db-a544-7c35d3ef9bf6',
      userId: user.id,
      tokenHash: createHash('sha256').update(oldToken).digest('hex'),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      createdAt: new Date(),
      user,
    };
    let replacementHash = '';
    const transaction = {
      refreshSession: {
        updateMany: vi.fn(async () => ({ count: 1 })),
        create: vi.fn(async ({ data }: { data: { tokenHash: string } }) => {
          replacementHash = data.tokenHash;
        }),
      },
    };
    const prismaMock = {
      refreshSession: {
        findUnique: vi.fn(async () => session),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn(
        async (
          callback: (transaction: Prisma.TransactionClient) => Promise<unknown>,
        ) => callback(transaction as unknown as Prisma.TransactionClient),
      ),
    };
    const authService = new AuthService(
      prismaMock as unknown as PrismaService,
      new JwtService({ secret }),
    );

    const result = await authService.refresh(oldToken);

    expect(result.refreshToken).not.toBe(oldToken);
    expect(replacementHash).toBe(
      createHash('sha256').update(result.refreshToken).digest('hex'),
    );
    expect(replacementHash).not.toBe(result.refreshToken);
  });

  it('revokes the token family when a rotated refresh token is reused', async () => {
    const familyId = '4a8f728e-bf6d-44db-a544-7c35d3ef9bf6';
    const session = {
      id: 'ed8c3129-609f-40f3-aa94-1b32ea27f1db',
      familyId,
      userId: 'c3f6b6b8-e238-4ac8-b970-6e507fa42942',
      tokenHash: 'stored-hash',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      createdAt: new Date(),
      user: {
        id: 'c3f6b6b8-e238-4ac8-b970-6e507fa42942',
        email: 'alex@example.com',
        createdAt: new Date(),
      },
    };
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const prismaMock = {
      refreshSession: {
        findUnique: vi.fn(async () => session),
        updateMany,
      },
    };
    const authService = new AuthService(
      prismaMock as unknown as PrismaService,
      new JwtService({ secret }),
    );

    await expect(authService.refresh('replayed-refresh-token')).rejects.toThrow(
      'Invalid or expired refresh token.',
    );
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { familyId, revokedAt: null } }),
    );
  });
});
