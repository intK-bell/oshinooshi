export function createLogger(context = {}) {
  return {
    info: (message, meta = {}) => log('INFO', message, { ...context, ...meta }),
    warn: (message, meta = {}) => log('WARN', message, { ...context, ...meta }),
    error: (message, meta = {}) => log('ERROR', message, { ...context, ...meta })
  };
}

function log(level, message, meta) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta
  };
  console.log(JSON.stringify(entry));
}
