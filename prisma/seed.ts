import { PrismaClient, SportType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const bcrypt = await import('bcryptjs');
  const passwordHash = await bcrypt.hash('Admin1234', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@turfbook.com' },
    update: {},
    create: {
      name: 'TurfBook Admin',
      email: 'admin@turfbook.com',
      phone: '01700000000',
      passwordHash,
      role: 'ADMIN',
      isVerified: true,
    },
  });
  console.log('test admin: ', admin);

  const turf = await prisma.turf.upsert({
    where: { id: 'turf-001' },
    update: {},
    create: {
      id: 'turf-001',
      name: 'Green Field Turf',
      description: 'Premium football turf in Dhaka',
      address: 'Mirpur, Dhaka',
      city: 'Dhaka',
      sportType: SportType.FOOTBALL,
      pricePerHour: 1500,
      openTime: '06:00',
      closeTime: '23:00',
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const timeSlots = [
    { start: '09:00', end: '10:00' },
    { start: '10:00', end: '11:00' },
    { start: '11:00', end: '12:00' },
    { start: '14:00', end: '15:00' },
    { start: '15:00', end: '16:00' },
    { start: '18:00', end: '19:00' },
    { start: '19:00', end: '20:00' },
    { start: '20:00', end: '21:00' },
  ];

  for (const slot of timeSlots) {
    await prisma.slot.upsert({
      where: {
        turfId_date_startTime: {
          turfId: turf.id,
          date: today,
          startTime: slot.start,
        },
      },
      update: {},
      create: {
        turfId: turf.id,
        date: today,
        startTime: slot.start,
        endTime: slot.end,
      },
    });
  }

  console.log('✅ Seed complete!');
  console.log(`Admin: admin@turfbook.com / Admin1234`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
