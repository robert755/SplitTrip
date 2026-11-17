import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Prisma, type User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL_MS,
  getAccessTokenSecret,
} from './auth.constants.js';
import type { AuthResult } from './auth.types.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';

const publicUserSelect = {
  id: true,
  email: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

type PublicUser = Pick<User, 'id' | 'email' | 'createdAt'>;

@Injectable()
export class AuthService {
  private readonly accessTokenSecret = getAccessTokenSecret();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const email = dto.email.trim().toLowerCase();
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    try {
      const { user, refreshToken } = await this.prisma.$transaction(
        async (transaction) => {
          const user = await transaction.user.create({
            data: { email, passwordHash },
            select: publicUserSelect,
          });
          const refreshToken = await this.createRefreshSession(
            transaction,
            user.id,
            randomUUID(),
          );
          return { user, refreshToken };
        },
      );

      return {
        user,
        accessToken: await this.createAccessToken(user),
        refreshToken,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Unable to register with these details.');
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { ...publicUserSelect, passwordHash: true },
    });

    if (!user) {
      await argon2.hash(dto.password, { type: argon2.argon2id });
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (!(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const refreshToken = await this.prisma.$transaction((transaction) =>
      this.createRefreshSession(transaction, user.id, randomUUID()),
    );
    const publicUser: PublicUser = {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    };

    return {
      user: publicUser,
      accessToken: await this.createAccessToken(publicUser),
      refreshToken,
    };
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: { user: { select: publicUserSelect } },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const now = new Date();
    if (session.revokedAt || session.expiresAt <= now) {
      await this.revokeFamily(session.familyId, now);
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const nextRefreshToken = this.generateRefreshToken();
    const nextTokenHash = this.hashRefreshToken(nextRefreshToken);
    const rotated = await this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.refreshSession.updateMany({
        where: {
          id: session.id,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now },
      });

      if (claimed.count !== 1) {
        await transaction.refreshSession.updateMany({
          where: { familyId: session.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        return false;
      }

      await transaction.refreshSession.create({
        data: {
          familyId: session.familyId,
          userId: session.userId,
          tokenHash: nextTokenHash,
          expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
        },
      });
      return true;
    });

    if (!rotated) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    return {
      user: session.user,
      accessToken: await this.createAccessToken(session.user),
      refreshToken: nextRefreshToken,
    };
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) {
      return;
    }

    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: this.hashRefreshToken(refreshToken) },
      select: { familyId: true },
    });
    if (session) {
      await this.revokeFamily(session.familyId, new Date());
    }
  }

  private async createAccessToken(user: Pick<User, 'id' | 'email'>): Promise<string> {
    return this.jwtService.signAsync(
      { sub: user.id, email: user.email },
      { secret: this.accessTokenSecret, expiresIn: ACCESS_TOKEN_TTL },
    );
  }

  private async createRefreshSession(
    transaction: Prisma.TransactionClient,
    userId: string,
    familyId: string,
  ): Promise<string> {
    const refreshToken = this.generateRefreshToken();
    await transaction.refreshSession.create({
      data: {
        familyId,
        userId,
        tokenHash: this.hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });
    return refreshToken;
  }

  private generateRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  private async revokeFamily(familyId: string, revokedAt: Date): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt },
    });
  }
}
