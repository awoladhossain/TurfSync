import { MailService } from '@/mail/mail.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
  ) {}

  // register method
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

    try {
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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = (error.meta?.target as string[]) || [];
        if (target.includes('email')) {
          throw new ConflictException('Email is already registered');
        }
        if (target.includes('phone')) {
          throw new ConflictException('Phone number is already registered');
        }
        throw new ConflictException(
          'Email or phone number is already registered',
        );
      }
      throw error;
    }
  }

  // 2. login method
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Email or password is incorrect');
    }

    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const remainingMinutes = Math.ceil(
        (user.lockoutUntil.getTime() - Date.now()) / (60 * 1000),
      );
      throw new UnauthorizedException(
        `This account is temporarily locked. Please try again in ${remainingMinutes} minute(s).`,
      );
    }

    const isPasswordValid = await argon2.verify(
      user.passwordHash,
      dto.password,
    );

    if (!isPasswordValid) {
      const newAttempts = user.failedLoginAttempts + 1;
      const dataToUpdate: { failedLoginAttempts: number; lockoutUntil?: Date } =
        {
          failedLoginAttempts: newAttempts,
        };

      if (newAttempts >= 5) {
        dataToUpdate.lockoutUntil = new Date(Date.now() + 15 * 60 * 1000);
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: dataToUpdate,
      });

      if (newAttempts >= 5) {
        throw new UnauthorizedException(
          'Too many failed attempts. This account has been locked for 15 minutes.',
        );
      }

      throw new UnauthorizedException('Email or password is incorrect');
    }

    // P2-1: Enforce email verification before granting access (Temporarily disabled for dev phase)
    /*
    if (!user.isVerified) {
      throw new UnauthorizedException(
        'Your email address has not been verified. Please check your inbox for a verification link.',
      );
    }
    */

    if (user.failedLoginAttempts > 0 || user.lockoutUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockoutUntil: null,
        },
      });
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

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const existingPhone = await this.prisma.user.findFirst({
      where: {
        phone: dto.phone,
        NOT: { id: userId },
      },
    });

    if (existingPhone) {
      throw new ConflictException('Phone number is already registered');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name,
        phone: dto.phone,
      },
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

  /**
   * Parses a duration string (e.g. "7d", "24h", "3600s") into milliseconds.
   * Keeps the DB refresh token expiry in sync with JWT_REFRESH_EXPIRES_IN config.
   */
  private parseDurationMs(duration: string): number {
    const match = /^(\d+)(s|m|h|d)$/.exec(duration);
    if (!match) {
      this.logger.warn(
        `Could not parse JWT_REFRESH_EXPIRES_IN value "${duration}". Defaulting to 7 days.`,
      );
      return 7 * 24 * 60 * 60 * 1000;
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1_000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return value * multipliers[unit];
  }

  // 6. tokens generate private method
  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const accessToken = this.jwtService.sign(
      { ...payload, jti: randomUUID() },
      {
        secret: this.configService.get('JWT_SECRET'),
        // ConfigService returns string; cast satisfies JWT library's StringValue branded type
        expiresIn: this.configService.get('JWT_EXPIRES_IN') as number,
      },
    );

    const refreshExpiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );

    const refreshToken = this.jwtService.sign(
      { ...payload, jti: randomUUID() },
      {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        // refreshExpiresIn is a string like '7d'; cast satisfies JWT library's StringValue branded type
        expiresIn: refreshExpiresIn as unknown as number,
      },
    );

    // before storing the refresh token, hash it
    const hashedToken = this.hashToken(refreshToken);

    // Derive DB expiry from the same config value — keeps them always in sync
    const expiresAt = new Date(
      Date.now() + this.parseDurationMs(refreshExpiresIn),
    );

    await this.prisma.refreshToken.create({
      data: {
        token: hashedToken,
        userId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken }; // give the original refresh token to the client, not the hashed one
  }

  // 7. verify email

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerifyToken: token,
        emailVerifyExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        emailVerifyToken: null,
        emailVerifyExpires: null,
      },
    });

    return { message: 'Email verified successfully' };
  }

  // 8. forgot password
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      return { message: 'Reset email has been sent' };
    }

    const token = randomBytes(32).toString('hex');
    const expires = new Date();
    expires.setHours(expires.getHours() + 1);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpires: expires,
      },
    });

    await this.mailService.sendPasswordResetEmail(user.email, user.name, token);
    return { message: 'Reset email has been sent' };
  }

  // 9. reset password
  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        failedLoginAttempts: 0,
        lockoutUntil: null,
      },
    });

    await this.prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    });
    return { message: 'Password reset successfully' };
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
