import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
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
    @CurrentUser('id') userId: string,
  ) {
    return this.paymentService.createPaymentIntent(dto, userId);
  }
}
