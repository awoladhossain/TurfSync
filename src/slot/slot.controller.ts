import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { ParseUUIDPipe } from '@/common/pipes/parse-uuid.pipe';
import { Controller, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { SlotService } from './slot.service';

@ApiTags('Admin')
@Controller('admin/slots')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth('JWT')
export class SlotController {
  constructor(private readonly slotService: SlotService) {}
  @Post('generate')
  @ApiOperation({ summary: 'Generate slots for all active turfs' })
  generateAll() {
    return this.slotService.generateSlotsForNextDays(7);
  }

  @Post('generate/turf/:turfId')
  @ApiOperation({ summary: 'Generate slots for specific turf' })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of days to generate slots for',
    default: 7,
  })
  generateForTurf(
    @Param('turfId', ParseUUIDPipe) turfId: string,
    @Query('days') days = '7',
  ) {
    return this.slotService.generateForTurf(turfId, +days);
  }
  @Post('cleanup')
  @ApiOperation({ summary: 'Cleanup old slots' })
  cleanupOldSlots() {
    return this.slotService.cleanupOldSlots();
  }
}
