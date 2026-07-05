import { PrismaService } from '@/prisma/prisma.service';
import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';

const mockPrismaService = {
  $queryRaw: jest.fn(),
};

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);

    jest.clearAllMocks();
  });

  describe('getRevenueAnalytics', () => {
    it('should aggregate revenue and bookings count correctly using database grouping', async () => {
      // Mock data from database-level group by query
      const mockPaymentGroups = [
        { period: new Date('2026-07-04T00:00:00Z'), revenue: 100 },
        { period: new Date('2026-07-05T00:00:00Z'), revenue: 250.5 },
      ];
      const mockBookingGroups = [
        { period: new Date('2026-07-04T00:00:00Z'), count: 2 },
        { period: new Date('2026-07-05T00:00:00Z'), count: 5 },
      ];

      mockPrismaService.$queryRaw
        .mockResolvedValueOnce(mockPaymentGroups)
        .mockResolvedValueOnce(mockBookingGroups);

      // We fix the current date to 2026-07-05 for predictable test calculations
      jest.useFakeTimers().setSystemTime(new Date('2026-07-05T12:00:00Z'));

      const result = await service.getRevenueAnalytics('daily');

      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(2);

      // Verify the results list
      // Total 30 daily items (since period = 'daily')
      expect(result).toHaveLength(30);

      // Last item should be today (2026-07-05)
      const todayResult = result.find((r) => r.label === '2026-07-05');
      expect(todayResult).toBeDefined();
      expect(todayResult?.revenue).toBe(250.5);
      expect(todayResult?.bookings).toBe(5);

      // Yesterday item (2026-07-04)
      const yesterdayResult = result.find((r) => r.label === '2026-07-04');
      expect(yesterdayResult).toBeDefined();
      expect(yesterdayResult?.revenue).toBe(100);
      expect(yesterdayResult?.bookings).toBe(2);

      // Other days should default to 0
      const otherResult = result.find((r) => r.label === '2026-07-03');
      expect(otherResult).toBeDefined();
      expect(otherResult?.revenue).toBe(0);
      expect(otherResult?.bookings).toBe(0);

      jest.useRealTimers();
    });
  });
});
