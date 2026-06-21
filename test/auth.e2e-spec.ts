import { AuthModule } from '@/auth/auth.module';
import { GlobalExceptionFilter } from '@/common/filters/http-exception.filter';
import { PrismaModule } from '@/prisma/prisma.module';
import { PrismaService } from '@/prisma/prisma.service';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
  let httpServer: Parameters<typeof request>[0];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env.test', '.env'],
        }),
        PrismaModule,
        AuthModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.use(helmet());
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    httpServer = app.getHttpServer();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    await cleanupDatabase();
  });

  afterAll(async () => {
    await cleanupDatabase();
    await app.close();
  });

  async function cleanupDatabase() {
    try {
      // Use dynamic access to bypass potential missing properties during initial project setup
      const p = prisma as unknown as Record<
        string,
        | { deleteMany?: (args?: Record<string, unknown>) => Promise<unknown> }
        | undefined
      >;
      if (p.refreshToken?.deleteMany) {
        await p.refreshToken.deleteMany({});
      }
      if (p.user?.deleteMany) {
        await p.user.deleteMany({ where: { email: 'e2e@test.com' } });
      }
    } catch {
      // Silent catch for missing tables during initial setup
    }
  }

  // ─── Register ────────────────────────────────────────

  describe('POST /api/auth/register', () => {
    it('should register successfully', async () => {
      const res = await request(httpServer).post('/api/auth/register').send({
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
      const res = await request(httpServer).post('/api/auth/register').send({
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
      const res = await request(httpServer).post('/api/auth/register').send({
        name: 'Bad Phone',
        email: 'badphone@test.com',
        phone: '123', // invalid
        password: 'Test1234!',
      });

      expect(res.status).toBe(400);
    });

    it('should reject weak password', async () => {
      const res = await request(httpServer).post('/api/auth/register').send({
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
      const res = await request(httpServer).post('/api/auth/login').send({
        email: 'e2e@test.com',
        password: 'Test1234!',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
    });

    it('should reject wrong password', async () => {
      const res = await request(httpServer).post('/api/auth/login').send({
        email: 'e2e@test.com',
        password: 'WrongPass123!',
      });

      expect(res.status).toBe(401);
    });
  });

  // ─── Protected Route ─────────────────────────────────

  describe('GET /api/auth/me', () => {
    it('should return profile with valid token', async () => {
      const res = await request(httpServer)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      const body = res.body as { email: string };
      expect(body.email).toBe('e2e@test.com');
    });

    it('should reject without token', async () => {
      const res = await request(httpServer).get('/api/auth/me');

      expect(res.status).toBe(401);
    });

    it('should reject with invalid token', async () => {
      const res = await request(httpServer)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(res.status).toBe(401);
    });
  });

  // ─── Refresh ─────────────────────────────────────────

  describe('POST /api/auth/refresh', () => {
    it('should return new token pair', async () => {
      const res = await request(httpServer)
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
      const oldToken = refreshToken;

      // Get a new token pair
      await request(httpServer)
        .post('/api/auth/refresh')
        .send({ refreshToken: oldToken });

      // Try to use the old token again
      const res = await request(httpServer)
        .post('/api/auth/refresh')
        .send({ refreshToken: oldToken });

      expect(res.status).toBe(401);
    });
  });
});
