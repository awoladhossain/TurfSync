import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { createHash } from 'crypto';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: (req: Request) => {
        let token: string | null = null;
        if (req && req.cookies) {
          token =
            (req.cookies as Record<string, string>)['refresh_token'] || null;
        }
        return (
          token ||
          ExtractJwt.fromBodyField('refreshToken')(req) ||
          ExtractJwt.fromAuthHeaderAsBearerToken()(req)
        );
      },
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET') as string,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    if (!payload) throw new UnauthorizedException();

    let refreshToken: string | null = null;
    if (req && req.cookies) {
      refreshToken =
        (req.cookies as Record<string, string>)['refresh_token'] || null;
    }
    if (!refreshToken) {
      refreshToken =
        (req.body as { refreshToken?: string })?.refreshToken || null;
    }
    if (!refreshToken) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        refreshToken = authHeader.substring(7);
      }
    }

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is missing');
    }

    // hash the refresh token before comparing with the database
    const hashedToken = createHash('sha256').update(refreshToken).digest('hex');

    // database lookup for the refresh token
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: hashedToken },
      include: { user: true },
    });

    if (!tokenRecord) {
      // TOKEN REUSE / REPLAY DETECTION
      // The JWT is signature-wise valid and not expired, but not in the database.
      // This indicates it has already been used and deleted (or the user logged out).
      // To be safe, we revoke all active refresh tokens for this user.
      const userId = payload.sub;
      if (userId) {
        await this.prisma.refreshToken.deleteMany({
          where: { userId },
        });
      }
      throw new UnauthorizedException(
        'Session expired or token reuse detected. Please log in again.',
      );
    }

    if (tokenRecord.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
      throw new UnauthorizedException('Refresh token has expired');
    }

    return {
      ...tokenRecord.user,
      refreshToken, // plain token will be used in controller
    };
  }
}
