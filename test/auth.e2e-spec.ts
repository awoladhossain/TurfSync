import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import helmet from 'helmet';
import request from 'supertest';

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    email: string;
    [key: string]: unknown;
  };
  success?: boolean;
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // main.ts এর মতো same setup
    app.use(helmet());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Test data clean করো
    await prisma.refreshToken.deleteMany({});
    await prisma.user.deleteMany({ where: { email: 'e2e@test.com' } });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.refreshToken.deleteMany({});
    await prisma.user.deleteMany({ where: { email: 'e2e@test.com' } });
    await app.close();
  });

  // ─── Register ────────────────────────────────────────

  describe('POST /api/auth/register', () => {
    it('should register successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'E2E Test User',
          email: 'e2e@test.com',
          phone: '01799999999',
          password: 'Test1234!',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');

      const body = res.body as AuthResponse;
      expect(body.user.email).toBe('e2e@test.com');
      expect(body.user).not.toHaveProperty('passwordHash');

      accessToken = body.accessToken;
      refreshToken = body.refreshToken;
    });

    it('should reject duplicate email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'Duplicate',
          email: 'e2e@test.com', // same email
          phone: '01788888888',
          password: 'Test1234!',
        });

      expect(res.status).toBe(409);
      const body = res.body as AuthResponse;
      expect(body.success).toBe(false);
    });

    it('should reject invalid phone', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'Bad Phone',
          email: 'badphone@test.com',
          phone: '123', // invalid
          password: 'Test1234!',
        });

      expect(res.status).toBe(400);
    });

    it('should reject weak password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'Weak Pass',
          email: 'weak@test.com',
          phone: '01777777777',
          password: 'weak', // too weak
        });

      expect(res.status).toBe(400);
    });
  });

  // ─── Login ───────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    it('should login successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'e2e@test.com',
          password: 'Test1234!',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
    });

    it('should reject wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'e2e@test.com',
          password: 'WrongPass123!',
        });

      expect(res.status).toBe(401);
    });
  });

  // ─── Protected Route ─────────────────────────────────

  describe('GET /api/auth/me', () => {
    it('should return profile with valid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect((res.body as AuthResponse).user.email).toBe('e2e@test.com');
    });

    it('should reject without token', async () => {
      const res = await request(app.getHttpServer()).get('/api/auth/me');

      expect(res.status).toBe(401);
    });

    it('should reject with invalid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(res.status).toBe(401);
    });
  });

  // ─── Refresh ─────────────────────────────────────────

  describe('POST /api/auth/refresh', () => {
    it('should return new token pair', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');

      // Update tokens
      accessToken = (res.body as AuthResponse).accessToken;
      refreshToken = (res.body as AuthResponse).refreshToken;
    });

    it('should reject reused refresh token', async () => {
      // পুরনো refreshToken আবার use করার চেষ্টা
      const oldToken = refreshToken;

      // নতুন token নিলাম
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: oldToken });

      // পুরনো token আবার try
      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: oldToken });

      expect(res.status).toBe(401);
    });
  });
});
