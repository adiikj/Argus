import { pino, type Logger } from 'pino';

export type { Logger };

export interface CreateLoggerOptions {
  name?: string;
  level?: string;
  pretty?: boolean;
}

// pretty in dev, raw JSON in prod
export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const {
    name,
    level = process.env.LOG_LEVEL ?? 'info',
    pretty = process.env.NODE_ENV !== 'production',
  } = options;

  return pino({
    name,
    level,
    ...(pretty
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
          },
        }
      : {}),
  });
}

// child logger bound to a trace id, so one event is followable end to end
export function withTrace(logger: Logger, traceId: string): Logger {
  return logger.child({ traceId });
}
