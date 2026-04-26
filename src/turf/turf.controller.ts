import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
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
import { Role } from '@prisma/client';
import { CreateTurfDto } from './dto/create-turf.dto';
import { QueryTurfDto } from './dto/query-turf.dto';
import { TurfService } from './turf.service';

@Controller('turf')
export class TurfController {
  constructor(private turfService: TurfService) {}

  @Get()
  findAll(@Query() query: QueryTurfDto) {
    return this.turfService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.turfService.findOne(id);
  }

  @Get(':id/slots')
  getSlots(@Param('id') id: string, @Query('date') date: string) {
    return this.turfService.getAvailableSlots(id, date);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateTurfDto) {
    return this.turfService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: Partial<CreateTurfDto>) {
    return this.turfService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.turfService.remove(id);
  }
}
