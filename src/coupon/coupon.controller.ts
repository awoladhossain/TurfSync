import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { ParseUUIDPipe } from '@/common/pipes/parse-uuid.pipe';
import {
  Body,
  Controller,
  Delete,
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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CouponService } from './coupon.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';

@ApiTags('Coupons')
@ApiBearerAuth('JWT')
@Controller('coupons')
@UseGuards(JwtAuthGuard)
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  @Post('validate')
  @ApiOperation({ summary: 'Validate a coupon code and calculate discount' })
  @ApiResponse({
    status: 200,
    description: 'Coupon is valid. Returns calculated discount.',
  })
  @ApiResponse({
    status: 400,
    description: 'Coupon is invalid, inactive, expired, or limits exceeded.',
  })
  validate(
    @Body() dto: ValidateCouponDto,
    @CurrentUser('id', ParseUUIDPipe) userId: string,
  ) {
    return this.couponService.validateAndCalculate(
      dto.code,
      userId,
      dto.bookingAmount,
    );
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new coupon (Admin only)' })
  @ApiResponse({ status: 201, description: 'Coupon successfully created.' })
  @ApiResponse({
    status: 400,
    description: 'Coupon code already exists or validation failed.',
  })
  create(@Body() dto: CreateCouponDto) {
    return this.couponService.create(dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all coupons with pagination (Admin only)' })
  @ApiResponse({ status: 200, description: 'List of coupons returned.' })
  findAll(@Query() query: PaginationDto) {
    return this.couponService.findAll(query.page, query.limit);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get details of a single coupon (Admin only)' })
  @ApiResponse({ status: 200, description: 'Coupon details returned.' })
  @ApiResponse({ status: 404, description: 'Coupon not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.couponService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update an existing coupon (Admin only)' })
  @ApiResponse({ status: 200, description: 'Coupon successfully updated.' })
  @ApiResponse({
    status: 400,
    description: 'Coupon code already exists or validation failed.',
  })
  @ApiResponse({ status: 404, description: 'Coupon not found.' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCouponDto) {
    return this.couponService.update(id, dto);
  }

  @Patch(':id/toggle-active')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Toggle active status of a coupon (Admin only)' })
  @ApiResponse({ status: 200, description: 'Coupon active status toggled.' })
  @ApiResponse({ status: 404, description: 'Coupon not found.' })
  toggleActive(@Param('id', ParseUUIDPipe) id: string) {
    return this.couponService.toggleActive(id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a coupon (Admin only)' })
  @ApiResponse({ status: 200, description: 'Coupon successfully deleted.' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete coupon as it has been used in bookings.',
  })
  @ApiResponse({ status: 404, description: 'Coupon not found.' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.couponService.delete(id);
  }
}
