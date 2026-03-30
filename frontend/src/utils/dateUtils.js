/**
 * Calculates the time remaining between now and a target date.
 * @param {string|Date} targetDate - The target completion date.
 * @returns {object} { months, weeks, days, totalDays, isExpired, formatted }
 */
export const calculateRemainingTime = (targetDate) => {
    if (!targetDate) return { months: 0, weeks: 0, days: 0, totalDays: 0, isExpired: false, formatted: 'N/A' };

    const end = new Date(targetDate);
    const now = new Date();
    
    // Clear time for date-only comparison
    now.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const diffTime = end - now;
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (totalDays <= 0) {
        return { months: 0, weeks: 0, days: 0, totalDays, isExpired: true, formatted: 'Completed' };
    }

    const months = Math.floor(totalDays / 30);
    const remainingDaysAfterMonths = totalDays % 30;
    const weeks = Math.floor(remainingDaysAfterMonths / 7);
    const days = remainingDaysAfterMonths % 7;

    const parts = [];
    if (months > 0) parts.push(`${months} Month${months > 1 ? 's' : ''}`);
    if (weeks > 0) parts.push(`${weeks} Week${weeks > 1 ? 's' : ''}`);
    if (days > 0) parts.push(`${days} Day${days > 1 ? 's' : ''}`);

    return {
        months,
        weeks,
        days,
        totalDays,
        isExpired: false,
        formatted: parts.join(', ') || '0 Days'
    };
};
