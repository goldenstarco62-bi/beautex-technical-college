/**
 * Shared structured logger using Pino.
 * - In production: outputs compact JSON (ideal for Vercel/Papertrail/Logtail).
 * - In development: outputs pretty human-readable coloured logs via pino-pretty.
 */
import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

const logger = pino(
    {
        level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
        base: { pid: false }, // Remove pid field from every log line
        timestamp: pino.stdTimeFunctions.isoTime,
        formatters: {
            level(label) {
                return { level: label.toUpperCase() };
            },
        },
    },
    isDev
        ? pino.transport({
              target: 'pino-pretty',
              options: {
                  colorize: true,
                  translateTime: 'HH:MM:ss',
                  ignore: 'pid,hostname',
                  singleLine: false,
              },
          })
        : undefined // In production, write to stdout as plain JSON
);

export default logger;
