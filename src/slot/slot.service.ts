import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking } from '../schemas/booking.schema';
import { Turf } from '../schemas/turf.schema';

@Injectable()
export class SlotService {
  constructor(
    @InjectModel(Turf.name) private readonly turfModel: Model<Turf>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<Booking>,
  ) { }

  async getAvailableSlots(turfId: string, date: string) {
    // Parse the date
    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay(); // 0-6 (Sunday-Saturday)

    // Fetch turf details
    const turf = await this.turfModel.findById(turfId).lean();
    if (!turf) {
      throw new Error('Turf not found');
    }

    // Get today's bookings for this turf
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const bookings = await this.bookingModel
      .find({
        turf: turfId,
        startTime: { $gte: startOfDay, $lt: endOfDay },
      })
      .sort({ startTime: 1 })
      .lean();

    // Determine today's working hours based on dayOfWeek
    let startHour = 8;
    let endHour = 22;

    if (turf.workingHours[dayOfWeek]) {
      startHour = turf.workingHours[dayOfWeek].startHour;
      endHour = turf.workingHours[dayOfWeek].endHour;
    }

    // Create time slots
    const slots = [];
    const interval = 30; // 30-minute slots
    let currentTime = new Date(targetDate);
    currentTime.setHours(startHour, 0, 0, 0);

    const endDateTime = new Date(targetDate);
    endDateTime.setHours(endHour, 0, 0, 0);

    while (currentTime <= endDateTime) {
      const slotStart = new Date(currentTime);
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + interval);

      // Check if this slot is booked
      const isBooked = bookings.some(
        (booking) =>
          slotStart >= booking.startTime && slotStart < booking.endTime,
      );

      slots.push({
        startTime: slotStart.toISOString(),
        endTime: slotEnd.toISOString(),
        isBooked,
        price: turf.price,
        turfId: turfId,
      });

      currentTime = new Date(slotEnd);
    }

    return slots;
  }
}
