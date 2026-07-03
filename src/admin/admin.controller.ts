import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { ParseUUIDPipe } from '@/common/pipes/parse-uuid.pipe';
import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AdminService } from './admin.service';
import { GetAllBookingsDto } from './dto/get-all-bookings.dto';
import { GetAllUsersDto } from './dto/get-all-users.dto';
import { GetPaymentReportDto } from './dto/get-payment-report.dto';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth('JWT')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard overview statistics' })
  getDashboardOverview() {
    return this.adminService.getDashboardOverview();
  }

  @Get('analytics/revenue')
  @ApiOperation({ summary: 'Get revenue analytics for a period' })
  getRevenueAnalytics(
    @Query('period') period: 'daily' | 'weekly' | 'monthly' = 'daily',
  ) {
    return this.adminService.getRevenueAnalytics(period);
  }

  @Get('users')
  @ApiOperation({ summary: 'Get list of users with pagination and search' })
  getAllUsers(@Query() query: GetAllUsersDto) {
    return this.adminService.getAllUsers(query.page, query.limit, query.search);
  }

  @Patch('users/:userId/toggle-status')
  @ApiOperation({ summary: 'Toggle user verification status' })
  toggleUserStatus(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.toggleUserStatus(userId, adminId);
  }

  @Post('users/:userId/promote')
  @ApiOperation({ summary: 'Promote user to ADMIN' })
  makeAdmin(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.makeAdmin(userId, adminId);
  }

  @Post('users/:userId/demote')
  @ApiOperation({ summary: 'Demote admin to USER' })
  demoteAdmin(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.demoteAdmin(userId, adminId);
  }

  @Get('bookings')
  @ApiOperation({ summary: 'Get list of bookings with pagination and filters' })
  getAllBookings(@Query() query: GetAllBookingsDto) {
    return this.adminService.getAllBookings(
      query.page,
      query.limit,
      query.status,
      query.turfId,
      query.dateFrom,
      query.dateTo,
    );
  }

  @Patch('bookings/:bookingId/complete')
  @ApiOperation({ summary: 'Manually set booking status to COMPLETED' })
  completeBooking(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.completeBooking(bookingId, adminId);
  }

  @Get('turfs/:turfId/analytics')
  @ApiOperation({ summary: 'Get analytics for a specific turf' })
  getTurfAnalytics(@Param('turfId', ParseUUIDPipe) turfId: string) {
    return this.adminService.getTurfAnalytics(turfId);
  }

  @Get('payments/report')
  @ApiOperation({ summary: 'Get payment report with date range filters' })
  getPaymentReport(@Query() query: GetPaymentReportDto) {
    return this.adminService.getPaymentReport(query.dateFrom, query.dateTo);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get list of administrative audit logs' })
  getAuditLogs(@Query() query: PaginationDto) {
    return this.adminService.getAuditLogs(query.page, query.limit);
  }
}
