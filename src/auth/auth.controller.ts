import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { JwtRefreshGuard } from '@/common/guards/jwt-refresh.guard';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import * as express from 'express';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

interface RequestUser {
  id: string;
  refreshToken: string;
  email: string;
  role: string;
}

const COOKIE_OPTIONS_ACCESS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 15 * 60 * 1000, // 15 mins
};

const COOKIE_OPTIONS_REFRESH = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const COOKIE_OPTIONS_CLEAR = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 0,
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // * register
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: express.Response,
  ) {
    const result = await this.authService.register(dto);
    response.cookie('access_token', result.accessToken, COOKIE_OPTIONS_ACCESS);
    response.cookie(
      'refresh_token',
      result.refreshToken,
      COOKIE_OPTIONS_REFRESH,
    );
    return {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  // * login

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: express.Response,
  ) {
    const result = await this.authService.login(dto);
    response.cookie('access_token', result.accessToken, COOKIE_OPTIONS_ACCESS);
    response.cookie(
      'refresh_token',
      result.refreshToken,
      COOKIE_OPTIONS_REFRESH,
    );
    return {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  /**
   * user -> /auth/refresh -> useguard ->
   */
  @ApiBearerAuth('JWT')
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  async refresh(
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) response: express.Response,
  ) {
    const result = await this.authService.refreshTokens(
      user.id,
      user.refreshToken,
    );
    response.cookie('access_token', result.accessToken, COOKIE_OPTIONS_ACCESS);
    response.cookie(
      'refresh_token',
      result.refreshToken,
      COOKIE_OPTIONS_REFRESH,
    );
    return result;
  }

  // * logout
  @ApiBearerAuth('JWT')
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser('id') userId: string,
    @Body() dto: RefreshTokenDto,
    @Req() req: express.Request,
    @Res({ passthrough: true }) response: express.Response,
  ) {
    let token = dto.refreshToken;
    if (!token && req.cookies) {
      token = (req.cookies as Record<string, string>)['refresh_token'];
    }

    if (!token) {
      response.clearCookie('access_token', COOKIE_OPTIONS_CLEAR);
      response.clearCookie('refresh_token', COOKIE_OPTIONS_CLEAR);
      return { message: 'Logout successful' };
    }

    const result = await this.authService.logout(userId, token);
    response.clearCookie('access_token', COOKIE_OPTIONS_CLEAR);
    response.clearCookie('refresh_token', COOKIE_OPTIONS_CLEAR);
    return result;
  }

  // * logout all
  @ApiBearerAuth('JWT')
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logoutAll(
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) response: express.Response,
  ) {
    const result = await this.authService.logoutAll(userId);
    response.clearCookie('access_token', COOKIE_OPTIONS_CLEAR);
    response.clearCookie('refresh_token', COOKIE_OPTIONS_CLEAR);
    return result;
  }

  // * get profile
  @ApiBearerAuth('JWT')
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  getProfile(@CurrentUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }

  // * verify email
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  // * forgot password
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  // * reset password
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }
}
