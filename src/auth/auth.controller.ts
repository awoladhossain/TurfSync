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
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import * as express from 'express';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

interface RequestUser {
  id: string;
  refreshToken: string;
  email: string;
  role: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  /**
   * Returns cookie options computed at call time via ConfigService.
   * Avoids the pitfall of module-level constants that read process.env
   * before the config is fully initialized.
   */
  private cookieOptions(maxAge: number) {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      path: '/',
      maxAge,
    };
  }

  private get accessTokenOptions() {
    return this.cookieOptions(15 * 60 * 1000); // 15 minutes
  }

  private get refreshTokenOptions() {
    return this.cookieOptions(7 * 24 * 60 * 60 * 1000); // 7 days
  }

  private get clearCookieOptions() {
    return this.cookieOptions(0);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ short: { ttl: 60000, limit: 3 } })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: express.Response,
  ) {
    const result = await this.authService.register(dto);
    response.cookie(
      'access_token',
      result.accessToken,
      this.accessTokenOptions,
    );
    response.cookie(
      'refresh_token',
      result.refreshToken,
      this.refreshTokenOptions,
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
    response.cookie(
      'access_token',
      result.accessToken,
      this.accessTokenOptions,
    );
    response.cookie(
      'refresh_token',
      result.refreshToken,
      this.refreshTokenOptions,
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
    response.cookie(
      'access_token',
      result.accessToken,
      this.accessTokenOptions,
    );
    response.cookie(
      'refresh_token',
      result.refreshToken,
      this.refreshTokenOptions,
    );
    return result;
  }

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
      response.clearCookie('access_token', this.clearCookieOptions);
      response.clearCookie('refresh_token', this.clearCookieOptions);
      return { message: 'Logout successful' };
    }

    const result = await this.authService.logout(userId, token);
    response.clearCookie('access_token', this.clearCookieOptions);
    response.clearCookie('refresh_token', this.clearCookieOptions);
    return result;
  }

  @ApiBearerAuth('JWT')
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logoutAll(
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) response: express.Response,
  ) {
    const result = await this.authService.logoutAll(userId);
    response.clearCookie('access_token', this.clearCookieOptions);
    response.clearCookie('refresh_token', this.clearCookieOptions);
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

  // * update profile
  @ApiBearerAuth('JWT')
  @Put('update-profile')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(userId, dto);
  }

  // * verify email
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  // * forgot password
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 3 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  // * reset password
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }
}
