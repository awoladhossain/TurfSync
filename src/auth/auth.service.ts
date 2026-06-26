import { PrismaService } from '@/prisma/prisma.service';
import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as argon2 from 'argon2';
import { createHash, randomUUID } from 'crypto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // 1. register method
  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { phone: dto.phone }],
      },
    });

    if (existingUser) {
      throw new ConflictException(
        existingUser.email === dto.email
          ? 'Email is already registered'
          : 'Phone number is already registered',
      );
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    return { user, ...tokens };
  }

  // 2. login method
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Email or password is incorrect');
    }

    const isPasswordValid = await argon2.verify(
      user.passwordHash,
      dto.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Email or password is incorrect');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, ...tokens };
  }

  // 3. refresh token (this requires hashing for security)
  async refreshTokens(userId: string, oldRefreshToken: string) {
    // hash the incoming refresh token before checking the database
    const hashedOldToken = this.hashToken(oldRefreshToken);

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: { token: hashedOldToken, userId },
    });

    if (!storedToken) throw new UnauthorizedException('Invalid Refresh Token');

    // delete the old refresh token
    await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    return this.generateTokens(user.id, user.email, user.role);
  }

  // 4. logout (this also requires hashing for security)
  async logout(userId: string, refreshToken: string) {
    const hashedToken = this.hashToken(refreshToken);
    await this.prisma.refreshToken.deleteMany({
      where: { userId, token: hashedToken },
    });
    return { message: 'Logout successful' };
  }

  async logoutAll(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    return { message: 'Logged out from all devices' };
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        createdAt: true,
      },
    });
  }

  // 5. token hashing private method
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  // 6. tokens generate private method
  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const accessToken = this.jwtService.sign(
      { ...payload, jti: randomUUID() },
      {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRES_IN'),
      },
    );

    const refreshToken = this.jwtService.sign(
      { ...payload, jti: randomUUID() },
      {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN'),
      },
    );

    // before storing the refresh token, hash it
    const hashedToken = this.hashToken(refreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        token: hashedToken,
        userId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken }; // give the original refresh token to the client, not the hashed one
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredTokens() {
    const now = new Date();
    const { count } = await this.prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    });
    this.logger.log(`🗑️ Cleaned up ${count} expired refresh tokens`);
  }
}
