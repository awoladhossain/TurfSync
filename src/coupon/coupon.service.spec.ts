import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DiscountType } from '@prisma/client';
import { CouponService } from './coupon.service';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  coupon: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  couponUsage: {
    create: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const now = new Date();
const validFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000); // yesterday
const validUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000); // tomorrow

const makeCoupon = (overrides = {}) => ({
  id: 'coupon-1',
  code: 'SAVE10',
  isActive: true,
  validFrom,
  validUntil,
  usageLimit: null,
  usedCount: 0,
  userUsageLimit: 1,
  minOrderAmount: new (class {
    toString() {
      return '0';
    }
  })(),
  maxDiscountAmount: new (class {
    toString() {
      return '999';
    }
  })(),
  discountType: DiscountType.PERCENTAGE,
  discountValue: 10,
  couponUsages: [],
  ...overrides,
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CouponService', () => {
  let service: CouponService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CouponService>(CouponService);
    jest.clearAllMocks();
  });

  // ─── validateAndCalculate ─────────────────────────────────────────────────

  describe('validateAndCalculate', () => {
    it('should throw BadRequestException when coupon does not exist', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(null);

      await expect(
        service.validateAndCalculate('INVALID', 'user-1', 100),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when coupon is inactive', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(
        makeCoupon({ isActive: false }),
      );

      await expect(
        service.validateAndCalculate('SAVE10', 'user-1', 100),
      ).rejects.toThrow('Coupon is invalid or expired');
    });

    it('should throw BadRequestException when coupon has expired', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(
        makeCoupon({
          validUntil: new Date(now.getTime() - 60 * 1000), // 1 minute ago
        }),
      );

      await expect(
        service.validateAndCalculate('SAVE10', 'user-1', 100),
      ).rejects.toThrow('Coupon has expired');
    });

    it('should throw BadRequestException when global usage limit is reached', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(
        makeCoupon({ usageLimit: 100, usedCount: 100 }),
      );

      await expect(
        service.validateAndCalculate('SAVE10', 'user-1', 100),
      ).rejects.toThrow('Coupon usage limit has been reached');
    });

    it('should throw BadRequestException when user has already used the coupon', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(
        makeCoupon({
          userUsageLimit: 1,
          couponUsages: [{ id: 'usage-1' }], // already used once
        }),
      );

      await expect(
        service.validateAndCalculate('SAVE10', 'user-1', 100),
      ).rejects.toThrow('You have already used this coupon');
    });

    it('should throw BadRequestException when booking amount is below minimum order', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(
        makeCoupon({
          minOrderAmount: { toString: () => '200' }, // min 200
        }),
      );
      // Pass raw number 200 for comparison
      const coupon = makeCoupon({ minOrderAmount: 200 });
      mockPrisma.coupon.findUnique.mockResolvedValue({
        ...coupon,
        minOrderAmount: 200,
      });

      await expect(
        service.validateAndCalculate('SAVE10', 'user-1', 100), // only 100
      ).rejects.toThrow('minimum booking amount');
    });

    it('should calculate PERCENTAGE discount correctly', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(
        makeCoupon({
          discountType: DiscountType.PERCENTAGE,
          discountValue: 20, // 20%
          maxDiscountAmount: 999,
          minOrderAmount: 0,
        }),
      );

      const result = await service.validateAndCalculate(
        'SAVE10',
        'user-1',
        100,
      );

      expect(result.discount).toBe(20); // 20% of 100
      expect(result.finalAmount).toBe(80); // 100 - 20
      expect(result.originalAmount).toBe(100);
    });

    it('should cap PERCENTAGE discount at maxDiscountAmount', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(
        makeCoupon({
          discountType: DiscountType.PERCENTAGE,
          discountValue: 50, // 50% of 1000 = 500, but capped at 100
          maxDiscountAmount: 100,
          minOrderAmount: 0,
        }),
      );

      const result = await service.validateAndCalculate(
        'SAVE10',
        'user-1',
        1000,
      );

      expect(result.discount).toBe(100); // capped at maxDiscountAmount
      expect(result.finalAmount).toBe(900);
    });

    it('should calculate FIXED discount correctly', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(
        makeCoupon({
          discountType: DiscountType.FIXED,
          discountValue: 30,
          minOrderAmount: 0,
        }),
      );

      const result = await service.validateAndCalculate(
        'SAVE10',
        'user-1',
        100,
      );

      expect(result.discount).toBe(30);
      expect(result.finalAmount).toBe(70);
    });

    it('should not produce a negative finalAmount for FIXED discount larger than booking amount', async () => {
      mockPrisma.coupon.findUnique.mockResolvedValue(
        makeCoupon({
          discountType: DiscountType.FIXED,
          discountValue: 500, // larger than booking
          minOrderAmount: 0,
        }),
      );

      const result = await service.validateAndCalculate(
        'SAVE10',
        'user-1',
        100,
      );

      expect(result.finalAmount).toBeGreaterThanOrEqual(0);
      expect(result.discount).toBe(100); // capped at booking amount
    });
  });

  // ─── applyCoupon ─────────────────────────────────────────────────────────

  describe('applyCoupon', () => {
    it('should throw NotFoundException if coupon is missing inside the lock', async () => {
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: any) => Promise<unknown>) => {
          const txMock = {
            $queryRaw: jest.fn().mockResolvedValue([]), // coupon not found
            couponUsage: { count: jest.fn(), create: jest.fn() },
            coupon: { update: jest.fn() },
          };
          return fn(txMock);
        },
      );

      await expect(
        service.applyCoupon('coupon-1', 'user-1', 'booking-1', 10),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if coupon usage limit exceeded inside the lock', async () => {
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: any) => Promise<unknown>) => {
          const txMock = {
            $queryRaw: jest.fn().mockResolvedValue([
              {
                id: 'coupon-1',
                isActive: true,
                usageLimit: 10,
                usedCount: 10,
                userUsageLimit: 1,
              },
            ]),
            couponUsage: { count: jest.fn(), create: jest.fn() },
            coupon: { update: jest.fn() },
          };
          return fn(txMock);
        },
      );

      await expect(
        service.applyCoupon('coupon-1', 'user-1', 'booking-1', 10),
      ).rejects.toThrow('Coupon usage limit has been reached');
    });

    it('should create a CouponUsage record and increment usedCount on success', async () => {
      const txCouponCreate = jest.fn();
      const txCouponUpdate = jest.fn();

      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: any) => Promise<unknown>) => {
          const txMock = {
            $queryRaw: jest.fn().mockResolvedValue([
              {
                id: 'coupon-1',
                isActive: true,
                usageLimit: null,
                usedCount: 0,
                userUsageLimit: 1,
              },
            ]),
            couponUsage: {
              count: jest.fn().mockResolvedValue(0),
              create: txCouponCreate,
            },
            coupon: { update: txCouponUpdate },
          };
          return fn(txMock);
        },
      );

      await service.applyCoupon('coupon-1', 'user-1', 'booking-1', 10);

      expect(txCouponCreate).toHaveBeenCalledWith({
        data: {
          couponId: 'coupon-1',
          userId: 'user-1',
          bookingId: 'booking-1',
          discount: 10,
        },
      });
      expect(txCouponUpdate).toHaveBeenCalledWith({
        where: { id: 'coupon-1' },
        data: { usedCount: { increment: 1 } },
      });
    });
  });
});
