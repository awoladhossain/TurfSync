import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus, PaymentStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private prisma: PrismaService) {}

  // dashboard Overview
  async getDashboardOverview() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      newUsersToday,
      totalTurfs,
      activeTurfs,
      totalBookings,
      bookingsToday,
      bookingsThisMonth,
      totalRevenue,
      revenueToday,
      revenueThisMonth,
      pendingBookings,
      cancelledBookings,
    ] = await Promise.all([
      // user
      this.prisma.user.count(),
      this.prisma.user.count({
        where: { createdAt: { gte: today } },
      }),

      // turfs
      this.prisma.turf.count(),
      this.prisma.turf.count({
        where: { isActive: true },
      }),

      // bookings
      this.prisma.booking.count(),
      this.prisma.booking.count({
        where: { createdAt: { gte: today } },
      }),
      this.prisma.booking.count({
        where: { createdAt: { gte: thisMonthStart } },
      }),

      // revenue
      this.prisma.payment.aggregate({
        where: {
          status: PaymentStatus.PAID,
        },
        _sum: {
          amount: true,
        },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: PaymentStatus.PAID,
          paidAt: { gte: today },
        },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: PaymentStatus.PAID,
          paidAt: { gte: thisMonthStart },
        },
        _sum: { amount: true },
      }),

      // booking status counts
      this.prisma.booking.count({
        where: { status: BookingStatus.PENDING },
      }),
      this.prisma.booking.count({
        where: { status: BookingStatus.CANCELLED },
      }),
    ]);
    // format the data
    return {
      users: {
        total: totalUsers,
        newToday: newUsersToday,
      },
      turfs: {
        total: totalTurfs,
        active: activeTurfs,
        inactive: totalTurfs - activeTurfs,
      },
      bookings: {
        total: totalBookings,
        today: bookingsToday,
        thisMonth: bookingsThisMonth,
        pending: pendingBookings,
        cancelled: cancelledBookings,
      },
      revenue: {
        total: totalRevenue._sum.amount || 0,
        today: revenueToday._sum.amount || 0,
        thisMonth: revenueThisMonth._sum.amount || 0,
      },
    };
  }

  // revenue analystics
  async getRevenueAnalytics(period: 'daily' | 'weekly' | 'monthly' = 'daily') {
    const days = period === 'daily' ? 30 : period === 'weekly' ? 12 : 12;
    const result = [];
  }
}
