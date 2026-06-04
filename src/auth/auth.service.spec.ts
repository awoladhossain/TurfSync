import { PrismaService } from '@/prisma/prisma.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';

const mockPrismaService = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    deleteMany: jest.fn(),
    findUnique: jest.fn(),
  },
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-token'),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue('mock-secret'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    // প্রতিটা test এর আগে mock reset করো
    jest.clearAllMocks();
  });

  // ─── Register Tests ──────────────────────────────────

  describe('register', () => {
    const registerDto = {
      name: 'Rahim Uddin',
      email: 'rahim@test.com',
      phone: '01712345678',
      password: 'Test1234!',
    };

    it('should register a new user successfully', async () => {
      // Mock: user নেই
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      // Mock: user create হলো
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-1',
        name: registerDto.name,
        email: registerDto.email,
        phone: registerDto.phone,
        role: 'USER',
        createdAt: new Date(),
      });

      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(registerDto.email);
    });

    it('should throw ConflictException if email exists', async () => {
      // Mock: email already exists
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: 'existing-user',
        email: registerDto.email,
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if phone exists', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: 'existing-user',
        email: 'other@test.com', // different email
        phone: registerDto.phone, // same phone
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ─── Login Tests ─────────────────────────────────────

  describe('login', () => {
    it('should login successfully with correct credentials', async () => {
      const password = 'Test1234!';
      const passwordHash = await argon2.hash(password);

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'rahim@test.com',
        passwordHash,
        role: 'USER',
        name: 'Rahim',
        phone: '01712345678',
        isVerified: true,
        createdAt: new Date(),
      });

      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.login({
        email: 'rahim@test.com',
        password,
      });

      expect(result).toHaveProperty('accessToken');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const passwordHash = await argon2.hash('correct-password');

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'rahim@test.com',
        passwordHash,
        role: 'USER',
      });

      await expect(
        service.login({
          email: 'rahim@test.com',
          password: 'wrong-password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'notexist@test.com',
          password: 'anything',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
