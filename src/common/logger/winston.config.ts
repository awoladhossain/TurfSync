import { format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

export const winstonConfig = {
  format: format.combine(
    format.timestamp(),
    format.json(), 
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf((info) => {
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

    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      level: 'error',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
    }),

    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
    }),
  ],
};
