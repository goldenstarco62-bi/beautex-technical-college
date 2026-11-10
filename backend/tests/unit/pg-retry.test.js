import { describe, it, expect, vi } from 'vitest';
import { isTransientPgError, withPgRetry, READ_ATTEMPTS, WRITE_ATTEMPTS } from '../../src/utils/pgRetry.js';

const droppedConnection = () =>
    Object.assign(new Error('Connection terminated unexpectedly'), { code: 'ECONNRESET' });

describe('isTransientPgError', () => {
    it('matches connection-level codes and messages', () => {
        expect(isTransientPgError(droppedConnection())).toBe(true);
        expect(isTransientPgError(new Error('Connection terminated due to connection timeout'))).toBe(true);
        expect(isTransientPgError(Object.assign(new Error('terminating connection'), { code: '57P01' }))).toBe(true);
        expect(isTransientPgError(Object.assign(new Error('nope'), { code: 'ETIMEDOUT' }))).toBe(true);
    });

    it('ignores application-level query errors', () => {
        expect(isTransientPgError(Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' }))).toBe(false);
        expect(isTransientPgError(Object.assign(new Error('syntax error at or near "SELECT"'), { code: '42601' }))).toBe(false);
        expect(isTransientPgError(null)).toBe(false);
    });
});

describe('withPgRetry', () => {
    it('replays a read after a dropped connection', async () => {
        const execute = vi.fn().mockRejectedValueOnce(droppedConnection()).mockResolvedValue('rows');

        await expect(withPgRetry(execute, { maxAttempts: READ_ATTEMPTS })).resolves.toBe('rows');
        expect(execute).toHaveBeenCalledTimes(2);
    });

    it('stops at the write attempt budget', async () => {
        const execute = vi.fn().mockRejectedValue(droppedConnection());

        await expect(withPgRetry(execute, { maxAttempts: WRITE_ATTEMPTS })).rejects.toThrow('Connection terminated');
        expect(execute).toHaveBeenCalledTimes(WRITE_ATTEMPTS);
    });

    it('does not retry permanent errors', async () => {
        const execute = vi.fn().mockRejectedValue(Object.assign(new Error('duplicate key'), { code: '23505' }));

        await expect(withPgRetry(execute)).rejects.toThrow('duplicate key');
        expect(execute).toHaveBeenCalledTimes(1);
    });

    it('never retries inside a transaction', async () => {
        const execute = vi.fn().mockRejectedValue(droppedConnection());

        await expect(withPgRetry(execute, { retry: false })).rejects.toThrow('Connection terminated');
        expect(execute).toHaveBeenCalledTimes(1);
    });
});
