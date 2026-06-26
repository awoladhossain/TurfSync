import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ParseUUIDPipe } from '@/common/pipes/parse-uuid.pipe';
import type { RawBodyRequest } from '@nestjs/common';
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentService } from './payment.service';

@Controller('payment')
export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  // payment intent
  @Post('create-payment-intent')
  @UseGuards(JwtAuthGuard)
  createPaymentIntent(
    @Body() dto: CreatePaymentDto,
    @CurrentUser('id', ParseUUIDPipe) userId: string,
  ) {
    return this.paymentService.createPaymentIntent(dto, userId);
  }
  // payment status
  @Post('booking/:bookingId')
  @UseGuards(JwtAuthGuard)
  getStatus(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @CurrentUser('id', ParseUUIDPipe) userId: string,
  ) {
    return this.paymentService.getPaymentStatus(bookingId, userId);
  }

  // refund
  @Post('refund/:bookingId')
  @UseGuards(JwtAuthGuard)
  refund(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @CurrentUser('id', ParseUUIDPipe) userId: string,
  ) {
    return this.paymentService.refund(bookingId, userId);
  }

  // webhook handler - no jwt guard - verify by stripe signature
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    return this.paymentService.handleWebhook(signature, req.rawBody as Buffer);
  }
}
