import { format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

export const winstonConfig = {
  format: format.combine(
    format.timestamp(),
    format.json(), // ফাইলে সেভ করার জন্য JSON ফরম্যাট ভালো
  ),
  transports: [
    // ১. কনসোলে আউটপুট দেখার জন্য এটি যোগ করুন (অবশ্যই প্রয়োজন)
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf((info) => {
          // এখানে টাইপ কাস্টিং করে দেওয়া হয়েছে jate unknown error না আসে
          const { timestamp, level, message, context } = info as {
            timestamp: string;
            level: string;
            message: string;
            context?: string;
          };

          return `${timestamp} [${context || 'Nest'}] ${level}: ${message}`;
        }),
      ),
    }),

    // ২. শুধু এরর লগ সেভ করার জন্য
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      level: 'error',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
    }),

    // ৩. সব লগ (Combined) সেভ করার জন্য
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
    }),
  ],
};
