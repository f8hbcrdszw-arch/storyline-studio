type LogLevel = "error" | "warn" | "info" | "debug";

const LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

type LogContext = Record<string, unknown>;

function getConfiguredLevel(): number {
  const raw =
    (typeof process !== "undefined" ? process.env.LOG_LEVEL : undefined) ??
    "info";
  return LEVELS[raw.toLowerCase() as LogLevel] ?? LEVELS.info;
}

function isProduction(): boolean {
  return (
    typeof process !== "undefined" && process.env.NODE_ENV === "production"
  );
}

function write(level: LogLevel, message: string, context: LogContext): void {
  if (LEVELS[level] > getConfiguredLevel()) return;

  if (isProduction()) {
    // Structured JSON — Vercel parses and indexes these for filtering/search
    const entry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...context,
    };
    console[level](JSON.stringify(entry));
  } else {
    // Human-readable in local dev
    const contextStr =
      Object.keys(context).length > 0
        ? " " + JSON.stringify(context)
        : "";
    console[level](`[${level.toUpperCase()}] ${message}${contextStr}`);
  }
}

export interface Logger {
  error(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  child(context: LogContext): Logger;
}

function createLogger(baseContext: LogContext = {}): Logger {
  return {
    error: (msg, ctx = {}) => write("error", msg, { ...baseContext, ...ctx }),
    warn: (msg, ctx = {}) => write("warn", msg, { ...baseContext, ...ctx }),
    info: (msg, ctx = {}) => write("info", msg, { ...baseContext, ...ctx }),
    debug: (msg, ctx = {}) => write("debug", msg, { ...baseContext, ...ctx }),
    child: (ctx) => createLogger({ ...baseContext, ...ctx }),
  };
}

export const logger = createLogger();
