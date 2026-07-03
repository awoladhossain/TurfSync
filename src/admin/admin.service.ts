import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, PaymentStatus, Prisma, Role } from '@prisma/client';

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

  // revenue analytics
  async getRevenueAnalytics(period: 'daily' | 'weekly' | 'monthly' = 'daily') {
    const days = period === 'daily' ? 30 : period === 'weekly' ? 12 : 12;
    await Promise.resolve();
    const result: { label: string; revenue: number; bookings: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      let startDate: Date;
      let endDate: Date;
      let label: string;

      if (period === 'daily') {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - i);
        startDate.setHours(0, 0, 0, 0);

        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);

        label = startDate.toISOString().split('T')[0];
      } else if (period === 'weekly') {
        endDate = new Date();
        endDate.setDate(endDate.getDate() - i * 7 + 1);
        endDate.setHours(0, 0, 0, 0);

        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 7);

        label = startDate.toISOString().split('T')[0];
      } else {
        endDate = new Date();
        endDate.setMonth(endDate.getMonth() - i + 1);
        endDate.setDate(1);
        endDate.setHours(0, 0, 0, 0);

        startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - 1);

        const year = startDate.getFullYear();
        const month = String(startDate.getMonth() + 1).padStart(2, '0');
        label = `${year}-${month}`;
      }

      const [revenue, bookings] = await Promise.all([
        this.prisma.payment.aggregate({
          where: {
            status: PaymentStatus.PAID,
            paidAt: { gte: startDate, lt: endDate },
          },
          _sum: {
            amount: true,
          },
        }),
        this.prisma.booking.count({
          where: {
            createdAt: { gte: startDate, lt: endDate },
          },
        }),
      ]);

      result.push({
        label,
        revenue: Number(revenue._sum.amount || 0),
        bookings,
      });
    }

    this.logger.log(
      `Fetching analytics for ${period} spanning ${days} periods`,
    );
    return result;
  }

  // user management
  async getAllUsers(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isVerified: true,
          createdAt: true,
          _count: {
            select: {
              bookings: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({
        where,
      }),
    ]);

    return {
      data: users,
      total,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // toggole user status
  async toggleUserStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException(`User with ID: ${userId} not found`);
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { isVerified: !user.isVerified },
      select: {
        id: true,
        name: true,
        email: true,
        isVerified: true,
      },
    });
  }

  // make admin
  async makeAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isVerified: true,
      },
    });
    if (!user) {
      throw new NotFoundException(`User with ID: ${userId} not found`);
    }
    if (user.role === Role.ADMIN) {
      throw new BadRequestException(
        `User with ID: ${userId} is already an admin`,
      );
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { role: Role.ADMIN },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
      },
    });
  }
  // booking management
  async getAllBookings(
    page = 1,
    limit = 20,
    status?: BookingStatus,
    turfId?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.BookingWhereInput = {};

    if (status) where.status = status;
    if (turfId) where.turfId = turfId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, phone: true, email: true } },
          turf: { select: { id: true, name: true, address: true } },
          slot: true,
          payment: {
            select: { id: true, status: true, amount: true, paidAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      data: bookings,
      total,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // admin can manually create booking complete
  async completeBooking(bookingId: string, adminId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new BadRequestException('Booking not found');
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Only confirmed Bookings can be completed');
    }
    const updatedBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.COMPLETED },
    });
    this.logger.log(
      `Booking ${bookingId} manually set to COMPLETED by admin ${adminId}`,
    );
    return updatedBooking;
  }
}
