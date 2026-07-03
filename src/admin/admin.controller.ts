import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { BookingStatus, Role } from '@prisma/client';
import { AdminService } from './admin.service';

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
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['daily', 'weekly', 'monthly'],
    default: 'daily',
  })
  getRevenueAnalytics(
    @Query('period') period: 'daily' | 'weekly' | 'monthly' = 'daily',
  ) {
    return this.adminService.getRevenueAnalytics(period);
  }

  @Get('users')
  @ApiOperation({ summary: 'Get list of users with pagination and search' })
  @ApiQuery({ name: 'page', required: false, type: Number, default: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, default: 20 })
  @ApiQuery({ name: 'search', required: false, type: String })
  getAllUsers(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    return this.adminService.getAllUsers(+page, +limit, search);
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
  @ApiQuery({ name: 'page', required: false, type: Number, default: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, default: 20 })
  @ApiQuery({ name: 'status', required: false, enum: BookingStatus })
  @ApiQuery({ name: 'turfId', required: false, type: String })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    type: String,
    description: 'Format: YYYY-MM-DD',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    type: String,
    description: 'Format: YYYY-MM-DD',
  })
  getAllBookings(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: BookingStatus,
    @Query('turfId') turfId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.adminService.getAllBookings(
      +page,
      +limit,
      status,
      turfId,
      dateFrom,
      dateTo,
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
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    type: String,
    description: 'Format: YYYY-MM-DD',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    type: String,
    description: 'Format: YYYY-MM-DD',
  })
  getPaymentReport(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.adminService.getPaymentReport(dateFrom, dateTo);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get list of administrative audit logs' })
  @ApiQuery({ name: 'page', required: false, type: Number, default: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, default: 50 })
  getAuditLogs(@Query('page') page = '1', @Query('limit') limit = '50') {
    return this.adminService.getAuditLogs(+page, +limit);
  }
}
