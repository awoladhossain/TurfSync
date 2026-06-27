import { format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const getContextIcon = (context?: string): string => {
  if (!context) return '🦁';
  const ctx = context.toLowerCase();
  if (
    ctx.includes('nest') ||
    ctx === 'instanceloader' ||
    ctx === 'routesresolver' ||
    ctx === 'routerexplorer'
  )
    return '🦁';
  if (ctx.includes('app')) return '🏟️';
  if (ctx.includes('slot')) return '📅';
  if (ctx.includes('redis')) return '🔴';
  if (ctx.includes('prisma') || ctx.includes('database') || ctx.includes('db'))
    return '🗄️';
  if (ctx.includes('payment') || ctx.includes('stripe')) return '💳';
  if (ctx.includes('booking')) return '🎟️';
  if (ctx.includes('turf')) return '🌱';
  if (ctx.includes('auth') || ctx.includes('jwt')) return '🔑';
  if (
    ctx.includes('exception') ||
    ctx.includes('filter') ||
    ctx.includes('error')
  )
    return '🚨';
  if (ctx.includes('log') || ctx.includes('interceptor')) return '🔍';
  if (
    ctx.includes('notification') ||
    ctx.includes('queue') ||
    ctx.includes('processor') ||
    ctx.includes('bull')
  )
    return '🔔';
  return '⚙️';
};

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

          const icon = getContextIcon(context);
          const contextStr = context ? `${icon} ${context}` : `${icon} Nest`;
          return `${timestamp || ''} [${contextStr}] ${level || ''}: ${String(logMessage)}`;
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
