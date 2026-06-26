import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, SportType } from '@prisma/client';
import * as argon2 from 'argon2';
import 'dotenv/config';
import { Pool } from 'pg';

// 🔥 same adapter setup as PrismaService
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('❌ DATABASE_URL is missing');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminEmail = process.env.ADMIN_SEED_EMAIL || 'admin@turfbook.com';
  const adminPassword = process.env.ADMIN_SEED_PASSWORD || 'Admin1234';

  const passwordHash = await argon2.hash(adminPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: 'TurfBook Admin',
      email: adminEmail,
      phone: '01700000000',
      passwordHash,
      role: 'ADMIN',
      isVerified: true,
    },
  });

  console.log(admin);
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

  // Today এর slots তৈরি করো
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // const targetDate = new Date('2026-04-17');
  // targetDate.setHours(0, 0, 0, 0);

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
  console.log(`Admin: ${adminEmail} / ${adminPassword}`);
  console.log('DB URL:', process.env.DATABASE_URL);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end(); // 🔥 important when using adapter
  });
