import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ParseUUIDPipe } from '@/common/pipes/parse-uuid.pipe';
import {
  Body,
  Controller,
  Get,
  Param,
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
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewService } from './review.service';

@ApiTags('Reviews')
@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Create a new review for a booking' })
  @ApiResponse({ status: 201, description: 'Review successfully created' })
  @ApiResponse({
    status: 400,
    description: 'Bad request (e.g. not completed, already reviewed)',
  })
  @ApiResponse({ status: 403, description: 'Forbidden (not authorized)' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body() dto: CreateReviewDto,
    @CurrentUser('id', ParseUUIDPipe) userId: string,
  ) {
    return this.reviewService.createReview(dto, userId);
  }

  @ApiOperation({ summary: 'Get all reviews for a specific turf' })
  @ApiResponse({ status: 200, description: 'Reviews retrieved successfully' })
  @Get('turf/:turfId')
  getTurfReviews(
    @Param('turfId', ParseUUIDPipe) turfId: string,
    @Query() query: PaginationDto,
  ) {
    return this.reviewService.getTurfReviews(turfId, query.page, query.limit);
  }
}
