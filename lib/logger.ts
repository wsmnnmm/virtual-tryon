type LogLevel = 'info' | 'error' | 'warn'

interface LogPayload {
  event: string
  [key: string]: unknown
}

function write(level: LogLevel, payload: LogPayload) {
  const record = {
    level,
    timestamp: new Date().toISOString(),
    ...payload,
  }

  if (level === 'error') {
    console.error(record)
    return
  }

  if (level === 'warn') {
    console.warn(record)
    return
  }

  console.log(record)
}

export const logger = {
  info: (payload: LogPayload) => write('info', payload),
  warn: (payload: LogPayload) => write('warn', payload),
  error: (payload: LogPayload) => write('error', payload),
}
