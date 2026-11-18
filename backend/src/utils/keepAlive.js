/**
 * Registers a post-response promise with the hosting platform so the process is
 * not frozen mid-send. Must be awaited BEFORE the response is written — Vercel
 * only extends the invocation for work registered while it is still running.
 * A no-op on long-lived servers.
 */
export async function keepAlive(job) {
    if (!process.env.VERCEL) return job;
    try {
        const { waitUntil } = await import('@vercel/functions');
        waitUntil(job);
    } catch (err) {
        console.error('[keepAlive] waitUntil unavailable, background job may be interrupted:', err.message);
    }
    return job;
}
