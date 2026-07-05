import { PrismaService } from '@/prisma/prisma.service';
import {
  getPaginationParams,
  createPaginatedResponse,
} from '@/common/utils/pagination.util';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(private prisma: PrismaService) {}

  // create review
  async createReview(dto: CreateReviewDto, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: {
        id: dto.bookingId,
      },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.userId !== userId) {
      throw new ForbiddenException(
        'You are not authorized to review this booking',
      );
    }
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException('Only completed bookings can be reviewed');
    }

    // already  review check
    const existingReview = await this.prisma.review.findUnique({
      where: {
        bookingId: dto.bookingId,
      },
    });

    if (existingReview) {
      throw new BadRequestException('You have already reviewed this booking');
    }

    // create review
    const review = await this.prisma.review.create({
      data: {
        userId,
        turfId: booking.turfId,
        bookingId: booking.id,
        rating: dto.rating,
        comment: dto.comment,
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });
    await this.updateTurfRating(booking.turfId);
    return review;
  }

  // get turf Review
  async getTurfReviews(turfId: string, page: number = 1, limit: number = 10) {
    const {
      skip,
      take,
      page: p,
      limit: l,
    } = getPaginationParams({ page, limit });

    const [reviews, total, avgRating] = await Promise.all([
      this.prisma.review.findMany({
        where: { turfId },
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take,
      }),
      this.prisma.review.count({
        where: { turfId },
      }),
      this.prisma.review.aggregate({
        where: { turfId },
        _avg: {
          rating: true,
        },
      }),
    ]);

    // format the review
    const formattedReview = reviews.map((review) => ({
      id: review.id,
      userName: review.user.name,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
    }));

    return {
      ...createPaginatedResponse(formattedReview, total, p, l),
      avgRating: avgRating._avg.rating ?? 0,
    };
  }

  private async updateTurfRating(turfId: string) {
    const avg = await this.prisma.review.aggregate({
      where: { turfId },
      _avg: {
        rating: true,
      },
    });
    await this.prisma.turf.update({
      where: {
        id: turfId,
      },
      data: {
        rating: avg._avg.rating ?? 0,
      },
    });
  }
}
