import { paginate } from '@/common/utils/pagination.util';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DiscountType } from '@prisma/client';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

@Injectable()
export class CouponService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Validate & Discount Calculate ──────────────────
  async validateAndCalculate(
    code: string,
    userId: string,
    bookingAmount: number,
  ) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        couponUsages: { where: { userId } },
      },
    });

    // Exist?
    if (!coupon || !coupon.isActive) {
      throw new BadRequestException('Coupon is invalid or expired');
    }

    // Time valid?
    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validUntil) {
      throw new BadRequestException('Coupon has expired');
    }

    // Usage limit?
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit has been reached');
    }

    // User usage limit?
    if (coupon.couponUsages.length >= coupon.userUsageLimit) {
      throw new BadRequestException('You have already used this coupon');
    }

    // Minimum order?
    const minOrder = Number(coupon.minOrderAmount);
    if (minOrder > 0 && bookingAmount < minOrder) {
      throw new BadRequestException(
        `A minimum booking amount of ${coupon.minOrderAmount.toString()} is required to use this coupon`,
      );
    }

    // Discount calculate
    let discount = 0;
    const discountVal = Number(coupon.discountValue);

    if (coupon.discountType === DiscountType.PERCENTAGE) {
      discount = (bookingAmount * discountVal) / 100;

      // Max discount cap
      const maxDiscount = Number(coupon.maxDiscountAmount);
      if (maxDiscount > 0) {
        discount = Math.min(discount, maxDiscount);
      }
    } else {
      // FIXED
      discount = Math.min(discountVal, bookingAmount);
    }

    const finalAmount = bookingAmount - discount;

    return {
      couponId: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      originalAmount: bookingAmount,
      discount: Math.round(discount * 100) / 100,
      finalAmount: Math.max(finalAmount, 0),
    };
  }

  async applyCoupon(
    couponId: string,
    userId: string,
    bookingId: string,
    discount: number,
  ) {
    await this.prisma.$transaction(async (tx) => {
      // 1. Lock the coupon row for update to prevent concurrent over-use
      const coupons = await tx.$queryRaw<
        {
          id: string;
          isActive: boolean;
          usageLimit: number | null;
          usedCount: number;
          userUsageLimit: number;
        }[]
      >`
        SELECT id, "isActive", "usageLimit", "usedCount", "userUsageLimit"
        FROM coupons
        WHERE id = ${couponId}
        FOR UPDATE
      `;
      const coupon = coupons[0];

      if (!coupon) {
        throw new NotFoundException('Coupon not found');
      }

      // 2. Re-verify active status and usage limits inside the lock
      if (!coupon.isActive) {
        throw new BadRequestException('Coupon is inactive');
      }

      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        throw new BadRequestException('Coupon usage limit has been reached');
      }

      // 3. Re-verify user's specific usage limit inside the lock
      const userUsageCount = await tx.couponUsage.count({
        where: { couponId, userId },
      });
      if (userUsageCount >= coupon.userUsageLimit) {
        throw new BadRequestException('You have already used this coupon');
      }

      // 4. Create usage record and increment coupon usage count
      await tx.couponUsage.create({
        data: { couponId, userId, bookingId, discount },
      });

      await tx.coupon.update({
        where: { id: couponId },
        data: { usedCount: { increment: 1 } },
      });
    });
  }

  // ─── Admin: Coupon CRUD ──────────────────────────────
  async create(dto: CreateCouponDto) {
    const exists = await this.prisma.coupon.findUnique({
      where: { code: dto.code.toUpperCase() },
    });
    if (exists) {
      throw new BadRequestException('Coupon code already exists');
    }

    return this.prisma.coupon.create({
      data: {
        ...dto,
        code: dto.code.toUpperCase(),
      },
    });
  }

  async findAll(page = 1, limit = 20) {
    return paginate(
      this.prisma.coupon,
      { page, limit },
      {
        include: { _count: { select: { couponUsages: true } } },
        orderBy: { createdAt: 'desc' },
      },
    );
  }

  async findOne(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: { _count: { select: { couponUsages: true } } },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }

  async update(id: string, dto: UpdateCouponDto) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');

    if (dto.code) {
      const codeUpper = dto.code.toUpperCase();
      const exists = await this.prisma.coupon.findFirst({
        where: { code: codeUpper, NOT: { id } },
      });
      if (exists) {
        throw new BadRequestException('Coupon code already exists');
      }
      dto.code = codeUpper;
    }

    return this.prisma.coupon.update({
      where: { id },
      data: dto,
    });
  }

  async toggleActive(id: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');

    return this.prisma.coupon.update({
      where: { id },
      data: { isActive: !coupon.isActive },
    });
  }

  async delete(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: { _count: { select: { couponUsages: true } } },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');

    if (coupon._count.couponUsages > 0) {
      throw new BadRequestException(
        'Cannot delete coupon as it has already been used in bookings. Consider toggling it to inactive instead.',
      );
    }

    return this.prisma.coupon.delete({ where: { id } });
  }
}
