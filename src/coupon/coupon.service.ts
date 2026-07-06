import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, Injectable } from '@nestjs/common';

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

    if (coupon.discountType === 'PERCENTAGE') {
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
}
