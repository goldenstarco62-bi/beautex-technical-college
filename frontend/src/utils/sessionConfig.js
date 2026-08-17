/**
 * Central session timeout configuration.
 *
 * The timeout is driven by the VITE_SESSION_TIMEOUT_MINUTES env variable so it
 * can be changed per-environment without touching source code.
 *
 * Default: 2 minutes (120 000 ms)
 */

const TIMEOUT_MINUTES = Number(import.meta.env.VITE_SESSION_TIMEOUT_MINUTES) || 2;

/** Total inactivity window before forced logout (ms). */
export const SESSION_TIMEOUT_MS = TIMEOUT_MINUTES * 60 * 1000;

/** Warning shown this many ms before logout (i.e. at 90 s of inactivity when timeout = 120 s). */
export const SESSION_WARNING_BEFORE_MS = 30 * 1000;

/** Timestamp at which the warning dialog appears (ms from last activity). */
export const SESSION_WARNING_MS = SESSION_TIMEOUT_MS - SESSION_WARNING_BEFORE_MS;

/** DOM events treated as user activity. */
export const ACTIVITY_EVENTS = [
    'mousemove',
    'mousedown',
    'mouseup',
    'click',
    'dblclick',
    'keydown',
    'keypress',
    'keyup',
    'touchstart',
    'touchmove',
    'touchend',
    'scroll',
    'wheel',
    'focus',
    'input',
    'change',
    'submit',
];

/** BroadcastChannel name used for cross-tab session synchronisation. */
export const SESSION_CHANNEL_NAME = 'bttc-session-sync';
