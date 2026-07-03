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
    today.setUTCHours(0, 0, 0, 0);

    const thisMonthStart = new Date();
    thisMonthStart.setUTCDate(1);
    thisMonthStart.setUTCHours(0, 0, 0, 0);

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
        total: Number(totalRevenue._sum.amount || 0),
        today: Number(revenueToday._sum.amount || 0),
        thisMonth: Number(revenueThisMonth._sum.amount || 0),
      },
    };
  }

  // revenue analytics (optimized with bulk DB query and in-memory aggregation)
  async getRevenueAnalytics(period: 'daily' | 'weekly' | 'monthly' = 'daily') {
    const days = period === 'daily' ? 30 : period === 'weekly' ? 12 : 12;
    const result: { label: string; revenue: number; bookings: number }[] = [];

    let rangeStartDate: Date;
    let rangeEndDate: Date;

    if (period === 'daily') {
      rangeStartDate = new Date();
      rangeStartDate.setDate(rangeStartDate.getDate() - (days - 1));
      rangeStartDate.setUTCHours(0, 0, 0, 0);

      rangeEndDate = new Date();
      rangeEndDate.setDate(rangeEndDate.getDate() + 1);
      rangeEndDate.setUTCHours(0, 0, 0, 0);
    } else if (period === 'weekly') {
      rangeEndDate = new Date();
      rangeEndDate.setDate(rangeEndDate.getDate() - 0 * 7 + 1);
      rangeEndDate.setUTCHours(0, 0, 0, 0);

      rangeStartDate = new Date(rangeEndDate);
      rangeStartDate.setDate(rangeStartDate.getDate() - days * 7);
    } else {
      rangeEndDate = new Date();
      rangeEndDate.setMonth(rangeEndDate.getMonth() + 1);
      rangeEndDate.setDate(1);
      rangeEndDate.setUTCHours(0, 0, 0, 0);

      rangeStartDate = new Date(rangeEndDate);
      rangeStartDate.setMonth(rangeStartDate.getMonth() - days);
    }

    // Fetch all paid payments and bookings in this range
    const [payments, bookings] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          status: PaymentStatus.PAID,
          paidAt: { gte: rangeStartDate, lt: rangeEndDate },
        },
        select: {
          amount: true,
          paidAt: true,
        },
      }),
      this.prisma.booking.findMany({
        where: {
          createdAt: { gte: rangeStartDate, lt: rangeEndDate },
        },
        select: {
          createdAt: true,
        },
      }),
    ]);

    // Now group them in memory
    for (let i = days - 1; i >= 0; i--) {
      let startDate: Date;
      let endDate: Date;
      let label: string;

      if (period === 'daily') {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - i);
        startDate.setUTCHours(0, 0, 0, 0);

        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
        endDate.setUTCHours(0, 0, 0, 0);

        label = startDate.toISOString().split('T')[0];
      } else if (period === 'weekly') {
        endDate = new Date();
        endDate.setDate(endDate.getDate() - i * 7 + 1);
        endDate.setUTCHours(0, 0, 0, 0);

        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 7);

        label = startDate.toISOString().split('T')[0];
      } else {
        endDate = new Date();
        endDate.setMonth(endDate.getMonth() - i + 1);
        endDate.setDate(1);
        endDate.setUTCHours(0, 0, 0, 0);

        startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - 1);

        const year = startDate.getUTCFullYear();
        const month = String(startDate.getUTCMonth() + 1).padStart(2, '0');
        label = `${year}-${month}`;
      }

      // Filter in memory
      const periodPayments = payments.filter(
        (p) => p.paidAt && p.paidAt >= startDate && p.paidAt < endDate,
      );
      const periodBookings = bookings.filter(
        (b) => b.createdAt >= startDate && b.createdAt < endDate,
      );

      const totalRevenue = periodPayments.reduce(
        (sum, p) => sum + Number(p.amount),
        0,
      );

      result.push({
        label,
        revenue: totalRevenue,
        bookings: periodBookings.length,
      });
    }

    this.logger.log(
      `Fetching analytics for ${period} spanning ${days} periods (optimized in-memory)`,
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

  // toggle user status
  async toggleUserStatus(userId: string, adminId: string) {
    if (userId === adminId) {
      throw new BadRequestException(
        'You cannot toggle your own verification status',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException(`User with ID: ${userId} not found`);
    }
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { isVerified: !user.isVerified },
      select: {
        id: true,
        name: true,
        email: true,
        isVerified: true,
      },
    });

    await this.createAuditLog({
      adminId,
      action: 'USER_STATUS_TOGGLED',
      targetId: userId,
      targetType: 'USER',
      details: {
        previousStatus: user.isVerified ? 'VERIFIED' : 'UNVERIFIED',
        newStatus: updatedUser.isVerified ? 'VERIFIED' : 'UNVERIFIED',
      },
    });

    return updatedUser;
  }

  // make admin
  async makeAdmin(userId: string, adminId: string) {
    if (userId === adminId) {
      throw new BadRequestException(
        'You cannot promote yourself (you are already an admin)',
      );
    }

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
    const updatedUser = await this.prisma.user.update({
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

    await this.createAuditLog({
      adminId,
      action: 'USER_PROMOTED_TO_ADMIN',
      targetId: userId,
      targetType: 'USER',
      details: {
        previousRole: user.role,
        newRole: Role.ADMIN,
      },
    });

    return updatedUser;
  }

  // demote admin
  async demoteAdmin(userId: string, adminId: string) {
    if (userId === adminId) {
      throw new BadRequestException('You cannot demote yourself');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, name: true, email: true },
    });
    if (!user) {
      throw new NotFoundException(`User with ID: ${userId} not found`);
    }
    if (user.role !== Role.ADMIN) {
      throw new BadRequestException(`User with ID: ${userId} is not an admin`);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { role: Role.USER },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
      },
    });

    await this.createAuditLog({
      adminId,
      action: 'ADMIN_DEMOTED_TO_USER',
      targetId: userId,
      targetType: 'USER',
      details: {
        previousRole: Role.ADMIN,
        newRole: Role.USER,
      },
    });

    return updatedUser;
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
      const createdAtFilter: Prisma.DateTimeFilter = {};
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        if (isNaN(fromDate.getTime())) {
          throw new BadRequestException(
            'Invalid dateFrom format. Expected YYYY-MM-DD.',
          );
        }
        fromDate.setUTCHours(0, 0, 0, 0);
        createdAtFilter.gte = fromDate;
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        if (isNaN(toDate.getTime())) {
          throw new BadRequestException(
            'Invalid dateTo format. Expected YYYY-MM-DD.',
          );
        }
        toDate.setUTCHours(23, 59, 59, 999);
        createdAtFilter.lte = toDate;
      }
      where.createdAt = createdAtFilter;
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
      throw new NotFoundException('Booking not found');
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

    // Audit log
    await this.createAuditLog({
      adminId,
      action: 'BOOKING_COMPLETED',
      targetId: bookingId,
      targetType: 'BOOKING',
      details: { previousStatus: 'CONFIRMED' },
    });

    return updatedBooking;
  }

  // turf management
  async getTurfAnalytics(turfId: string) {
    const turfExists = await this.prisma.turf.findUnique({
      where: { id: turfId },
    });
    if (!turfExists) {
      throw new NotFoundException(`Turf with ID: ${turfId} not found`);
    }

    const [
      totalBookings,
      completedBookings,
      cancelledBookings,
      totalRevenue,
      avgRating,
      popularSlots,
    ] = await Promise.all([
      this.prisma.booking.count({ where: { turfId } }),
      this.prisma.booking.count({
        where: { turfId, status: BookingStatus.COMPLETED },
      }),
      this.prisma.booking.count({
        where: { turfId, status: BookingStatus.CANCELLED },
      }),
      this.prisma.payment.aggregate({
        where: {
          booking: { turfId },
          status: PaymentStatus.PAID,
        },
        _sum: { amount: true },
      }),
      this.prisma.review.aggregate({
        where: { turfId },
        _avg: { rating: true },
        _count: true,
      }),
      this.prisma.booking.groupBy({
        by: ['slotId'],
        where: { turfId },
        _count: { slotId: true },
        orderBy: { _count: { slotId: 'desc' } },
        take: 5,
      }),
    ]);
    return {
      bookings: {
        total: totalBookings,
        completed: completedBookings,
        cancelled: cancelledBookings,
        completionRate: totalBookings
          ? ((completedBookings / totalBookings) * 100).toFixed(1)
          : 0,
      },
      revenue: {
        total: Number(totalRevenue._sum.amount || 0),
      },
      rating: {
        average: avgRating._avg.rating?.toFixed(1) || 0,
        total: avgRating._count,
      },
      popularSlots,
    };
  }

  // payment management
  async getPaymentReport(dateFrom?: string, dateTo?: string) {
    const where: Prisma.PaymentWhereInput = {};

    if (dateFrom || dateTo) {
      const createdAtFilter: Prisma.DateTimeFilter = {};
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        if (isNaN(fromDate.getTime())) {
          throw new BadRequestException(
            'Invalid dateFrom format. Expected YYYY-MM-DD.',
          );
        }
        fromDate.setUTCHours(0, 0, 0, 0);
        createdAtFilter.gte = fromDate;
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        if (isNaN(toDate.getTime())) {
          throw new BadRequestException(
            'Invalid dateTo format. Expected YYYY-MM-DD.',
          );
        }
        toDate.setUTCHours(23, 59, 59, 999);
        createdAtFilter.lte = toDate;
      }
      where.createdAt = createdAtFilter;
    }

    const [totalPaid, totalFailed, totalRefunded, totalAmount, recentPayments] =
      await Promise.all([
        this.prisma.payment.count({
          where: { ...where, status: PaymentStatus.PAID },
        }),
        this.prisma.payment.count({
          where: { ...where, status: PaymentStatus.FAILED },
        }),
        this.prisma.payment.count({
          where: { ...where, status: PaymentStatus.REFUNDED },
        }),
        this.prisma.payment.aggregate({
          where: { ...where, status: PaymentStatus.PAID },
          _sum: { amount: true },
        }),
        this.prisma.payment.findMany({
          where,
          include: {
            booking: {
              include: {
                user: { select: { name: true, phone: true } },
                turf: { select: { name: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      ]);

    const totalTransactions = totalPaid + totalFailed + totalRefunded;

    return {
      summary: {
        totalPaid,
        totalFailed,
        totalRefunded,
        totalAmount: Number(totalAmount._sum.amount || 0),
        successRate: totalTransactions
          ? ((totalPaid / totalTransactions) * 100).toFixed(1)
          : 0,
      },
      recentPayments,
    };
  }

  // Audit log
  async createAuditLog(data: {
    adminId: string;
    action: string;
    targetId: string;
    targetType: string;
    details?: Prisma.InputJsonValue;
  }): Promise<void> {
    this.logger.log(
      `[AUDIT] Admin ${data.adminId} performed action ${data.action} on ${data.targetType} ${data.targetId}`,
    );
    await this.prisma.auditLog.create({
      data: {
        adminId: data.adminId,
        action: data.action,
        targetId: data.targetId,
        targetType: data.targetType,
        details: data.details || {},
      },
    });
  }

  async getAuditLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        include: {
          admin: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count(),
    ]);

    return {
      data: logs,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
