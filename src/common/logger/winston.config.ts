import { format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

export const winstonConfig = {
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf((info) => {
          const { timestamp, level, message, context, ...meta } = info as {
            timestamp?: string;
            level?: string;
            message?: unknown;
            context?: string;
            method?: string;
            url?: string;
            statusCode?: string | number;
            duration?: string;
            requestId?: string;
          };

          let logMessage: unknown = message;

          if (message === undefined) {
            if (meta.method && meta.url) {
              logMessage = `${meta.method} ${meta.url} ${meta.statusCode || ''} - ${meta.duration || ''} [reqId: ${meta.requestId || ''}]`;
            } else {
              logMessage = JSON.stringify(meta);
            }
          } else if (typeof message === 'object' && message !== null) {
            logMessage = JSON.stringify(message);
          }

          return `${timestamp || ''} [${context || 'Nest'}] ${level || ''}: ${String(logMessage)}`;
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
