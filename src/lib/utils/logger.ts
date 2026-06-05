type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  requestId?: string;
  workspaceId?: string;
  chatId?: string;
  [key: string]: unknown;
}

export function createLogger(component: string) {
  return {
    debug: (msg: string, ctx?: LogContext) => log('debug', component, msg, ctx),
    info: (msg: string, ctx?: LogContext) => log('info', component, msg, ctx),
    warn: (msg: string, ctx?: LogContext) => log('warn', component, msg, ctx),
    error: (msg: string, ctx?: LogContext) => log('error', component, msg, ctx),
  };
}

function log(level: LogLevel, component: string, message: string, context?: LogContext) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component,
    message,
    ...context,
  };
  
  // In production, send to structured log aggregator
  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify(entry)); // Vercel captures this
  } else {
    // Development fallback using console level functions
    const consoleMethod = level === 'warn' ? 'warn' : level === 'error' ? 'error' : 'log';
    console[consoleMethod](
      `[${entry.timestamp}] [${level.toUpperCase()}] [${component}] ${message}`,
      context ? '\n' + JSON.stringify(context, null, 2) : ''
    );
  }
}
