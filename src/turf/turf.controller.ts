import { Roles } from '@/common/decorators/roles.decorator';
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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CreateTurfDto } from './dto/create-turf.dto';
import { QueryTurfDto } from './dto/query-turf.dto';
import { TurfService } from './turf.service';

@ApiTags('Turfs')
@Controller('turfs')
export class TurfController {
  constructor(private turfService: TurfService) {}

  @Get()
  findAll(@Query() query: QueryTurfDto) {
    return this.turfService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.turfService.findOne(id);
  }

  @Get(':id/slots')
  getSlots(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('date') date?: string,
  ) {
    return this.turfService.getAvailableSlots(id, date);
  }

  @ApiBearerAuth('JWT')
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateTurfDto) {
    return this.turfService.create(dto);
  }

  @ApiBearerAuth('JWT')
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateTurfDto>,
  ) {
    return this.turfService.update(id, dto);
  }

  @ApiBearerAuth('JWT')
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.turfService.remove(id);
  }
}
