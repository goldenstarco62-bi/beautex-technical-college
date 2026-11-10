/**
 * Retry helpers for transient PostgreSQL connection failures.
 *
 * Supabase's pooler closes idle sockets, and node-postgres can then hand out a
 * client whose connection is already gone. The failure surfaces as
 * "Connection terminated unexpectedly" or a connect timeout before the
 * statement reaches the server, so replaying it on a fresh connection is safe.
 */

const CONNECT_ERROR_CODES = new Set([
    'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE',
    'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH',
]);

const TRANSIENT_PG_CODES = new Set([
    ...CONNECT_ERROR_CODES,
    '08000', '08001', '08003', '08006', // connection exceptions
    '57P01', '57P02', '57P03',          // admin shutdown / crash / starting up
    '53300',                            // too many connections
]);

const TRANSIENT_MESSAGE_PATTERN =
    /connection terminated (?:unexpectedly|due to connection timeout)|timeout expired|server closed the connection|socket hang up|client has encountered a connection error|connection reset by peer|terminating connection due to (?:administrator command|server shutdown)/i;

export const isTransientPgError = (err) =>
    !!err && (TRANSIENT_PG_CODES.has(err.code) || TRANSIENT_MESSAGE_PATTERN.test(String(err.message || '')));

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Reads are safe to replay; writes get one extra attempt so a dropped idle
// socket does not fail a save, while the chance of executing twice stays low.
export const READ_ATTEMPTS = 3;
export const WRITE_ATTEMPTS = 2;

/**
 * Runs `execute` with a small retry budget for transient connection errors.
 * Pass `retry: false` inside a transaction — the connection (and therefore the
 * transaction) is already dead, so replaying a single statement is pointless.
 */
export async function withPgRetry(execute, { maxAttempts = READ_ATTEMPTS, retry = true, onRetry } = {}) {
    const attempts = retry ? Math.max(1, maxAttempts) : 1;

    for (let attempt = 1; ; attempt++) {
        try {
            return await execute();
        } catch (err) {
            if (attempt >= attempts || !isTransientPgError(err)) throw err;
            const backoff = 120 * attempt + Math.floor(Math.random() * 80);
            if (onRetry) onRetry(err, attempt, attempts, backoff);
            await delay(backoff);
        }
    }
}
