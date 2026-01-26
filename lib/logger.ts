/**
 * Structured Logging Utility
 * Provides consistent logging with context
 */

export interface LogContext {
    debugId?: string | null
    userId?: string | null
    jobId?: number
    duration?: number
    [key: string]: any
}

export function logInfo(message: string, context?: LogContext) {
    if (process.env.NODE_ENV === 'development') {
        console.log(JSON.stringify({
            level: 'info',
            timestamp: new Date().toISOString(),
            message,
            ...context
        }, null, 2))
    } else {
        console.log(JSON.stringify({
            level: 'info',
            timestamp: new Date().toISOString(),
            message,
            ...context
        }))
    }
}

export function logError(message: string, error: any, context?: LogContext) {
    console.error(JSON.stringify({
        level: 'error',
        timestamp: new Date().toISOString(),
        message,
        error: {
            message: error?.message || String(error),
            stack: error?.stack,
            name: error?.name
        },
        ...context
    }, null, process.env.NODE_ENV === 'development' ? 2 : 0))
}

export function logWarning(message: string, context?: LogContext) {
    console.warn(JSON.stringify({
        level: 'warning',
        timestamp: new Date().toISOString(),
        message,
        ...context
    }, null, process.env.NODE_ENV === 'development' ? 2 : 0))
}
