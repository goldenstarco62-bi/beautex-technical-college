import { describe, it, expect } from 'vitest';
import { calculateRemainingTime } from '../dateUtils.js';

const dayMs = 24 * 60 * 60 * 1000;
const offset = (days) => new Date(Date.now() + days * dayMs).toISOString();

describe('calculateRemainingTime', () => {
    it('N/A for missing input', () => {
        const r = calculateRemainingTime(null);
        expect(r.formatted).toBe('N/A');
        expect(r.isExpired).toBe(false);
    });

    it('Completed for a past date', () => {
        const r = calculateRemainingTime(offset(-5));
        expect(r.isExpired).toBe(true);
        expect(r.formatted).toBe('Completed');
        expect(r.totalDays).toBeLessThanOrEqual(0);
    });

    it('decomposes a future span into months/weeks/days', () => {
        // 40 days ahead -> 1 month (30) + 1 week (7) + 3 days
        const r = calculateRemainingTime(offset(40));
        expect(r.isExpired).toBe(false);
        expect(r.months).toBe(1);
        expect(r.weeks).toBe(1);
        expect(r.days).toBe(3);
        expect(r.formatted).toBe('1 Month, 1 Week, 3 Days');
    });

    it('is internally consistent across other offsets', () => {
        const r = calculateRemainingTime(offset(95));
        expect(r.totalDays).toBeGreaterThan(0);
        // months*30 + weeks*7 + days should reconstruct ~totalDays (remainder semantics)
        expect(r.months).toBe(Math.floor(r.totalDays / 30));
        expect(r.weeks).toBe(Math.floor((r.totalDays % 30) / 7));
        expect(r.days).toBe((r.totalDays % 30) % 7);
    });
});
