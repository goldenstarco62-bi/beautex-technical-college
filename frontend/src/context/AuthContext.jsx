import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { authAPI } from '../services/api';
import SessionWarningModal from '../components/shared/SessionWarningModal';
import {
    SESSION_TIMEOUT_MS,
    SESSION_WARNING_MS,
    SESSION_WARNING_BEFORE_MS,
    ACTIVITY_EVENTS,
    SESSION_CHANNEL_NAME,
} from '../utils/sessionConfig';

// ─────────────────────────────────────────────────────────────────────────────
// Context default (consumed when used outside AuthProvider — gives a clear shape)
// ─────────────────────────────────────────────────────────────────────────────
const AuthContext = createContext({
    user: null,
    setUser: () => {},
    updateUser: () => {},
    login: async () => {},
    register: async () => {},
    logout: () => {},
    loading: true,
    resetSessionTimer: () => {},
});

// How often the heartbeat pings /auth/ping to keep last_seen_at current in DB.
// Completely separate from the inactivity timer.
const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

// Throttle DOM-activity events so we don't call resetTimer thousands of times/s
const THROTTLE_MS = 500;

// ─────────────────────────────────────────────────────────────────────────────
// AuthProvider
// ─────────────────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {

    // ── React state ─────────────────────────────────────────────────────────
    const [user, setUser]                       = useState(null);
    const [loading, setLoading]                 = useState(true);
    const [showWarning, setShowWarning]         = useState(false);
    const [warningSecondsLeft, setWarningSecondsLeft] = useState(
        Math.round(SESSION_WARNING_BEFORE_MS / 1000)
    );

    // ── Mutable refs (no re-render on change) ────────────────────────────────
    const heartbeatRef    = useRef(null);   // setInterval — DB last_seen_at
    const inactivityRef   = useRef(null);   // setTimeout — main logout countdown
    const warningRef      = useRef(null);   // setTimeout — show-warning trigger
    const warningCountRef = useRef(null);   // setInterval — countdown ticks
    const channelRef      = useRef(null);   // BroadcastChannel
    const lastActivityRef = useRef(0);      // timestamp of last processed activity event

    // Stable ref to the latest logout function so closures registered once
    // on mount always call the most recent version without stale capture.
    const logoutRef = useRef(null);

    // ── Heartbeat ─────────────────────────────────────────────────────────────

    const stopHeartbeat = useCallback(() => {
        if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
            heartbeatRef.current = null;
        }
    }, []);

    const startHeartbeat = useCallback(() => {
        stopHeartbeat();
        heartbeatRef.current = setInterval(() => {
            authAPI.ping().catch(() => {});
        }, HEARTBEAT_INTERVAL_MS);
    }, [stopHeartbeat]);

    // ── Timer helpers ─────────────────────────────────────────────────────────

    /** Cancel all inactivity-related timers and hide the warning modal. */
    const clearInactivityTimers = useCallback(() => {
        if (inactivityRef.current)   { clearTimeout(inactivityRef.current);   inactivityRef.current = null; }
        if (warningRef.current)      { clearTimeout(warningRef.current);       warningRef.current = null; }
        if (warningCountRef.current) { clearInterval(warningCountRef.current); warningCountRef.current = null; }
        // Use functional form to avoid unnecessary re-renders when already false
        setShowWarning(prev => (prev ? false : prev));
        setWarningSecondsLeft(Math.round(SESSION_WARNING_BEFORE_MS / 1000));
    }, []);

    // ── Logout ────────────────────────────────────────────────────────────────

    /**
     * Full logout sequence:
     *  1. Notify backend for audit trail (fire-and-forget).
     *  2. Stop all timers.
     *  3. Clear localStorage.
     *  4. Broadcast logout to other tabs.
     *  5. setUser(null) → ProtectedRoute redirects to /login.
     */
    const logout = useCallback((reason = 'manual') => {
        // Call logout API while token is still in localStorage so the
        // Authorization header is set correctly.
        authAPI.logout();

        stopHeartbeat();
        clearInactivityTimers();

        localStorage.removeItem('token');
        localStorage.removeItem('user');

        // Tell all other open tabs to log out too
        try {
            channelRef.current?.postMessage({ type: 'LOGOUT', reason });
        } catch (_) { /* BroadcastChannel unavailable — ignore */ }

        setUser(null);
    }, [stopHeartbeat, clearInactivityTimers]);

    // Keep the ref pointing at the latest logout so closures registered once
    // on mount always invoke the current function.
    logoutRef.current = logout;

    // ── Inactivity timers ────────────────────────────────────────────────────

    /**
     * Reset (or start) the inactivity countdown WITHOUT broadcasting to other
     * tabs.  Used for:
     *  • Receiving an ACTIVITY cross-tab message (broadcasting again would
     *    create an infinite Tab-A ↔ Tab-B ping-pong loop).
     *  • Page-load bootstrap.
     *  • Login startup.
     */
    const resetTimerSilent = useCallback(() => {
        clearInactivityTimers();

        // Warn at SESSION_WARNING_MS (default 90 s)
        warningRef.current = setTimeout(() => {
            setShowWarning(true);

            let secs = Math.round(SESSION_WARNING_BEFORE_MS / 1000);
            setWarningSecondsLeft(secs);

            warningCountRef.current = setInterval(() => {
                secs -= 1;
                setWarningSecondsLeft(secs);
                if (secs <= 0) {
                    clearInterval(warningCountRef.current);
                    warningCountRef.current = null;
                }
            }, 1000);
        }, SESSION_WARNING_MS);

        // Logout at SESSION_TIMEOUT_MS (default 120 s)
        inactivityRef.current = setTimeout(() => {
            logoutRef.current?.('inactivity');
        }, SESSION_TIMEOUT_MS);
    }, [clearInactivityTimers]);

    /**
     * Reset the inactivity countdown AND broadcast ACTIVITY to other open tabs.
     * Only called from real DOM-event handlers — never from BroadcastChannel
     * message handlers (that would restart the cross-tab loop).
     */
    const resetTimer = useCallback(() => {
        resetTimerSilent();
        try {
            channelRef.current?.postMessage({ type: 'ACTIVITY', timestamp: Date.now() });
        } catch (_) { /* BroadcastChannel unavailable — ignore */ }
    }, [resetTimerSilent]);

    // ── "Stay Logged In" ─────────────────────────────────────────────────────

    const handleStayLoggedIn = useCallback(() => {
        resetTimer();
    }, [resetTimer]);

    // ── BroadcastChannel ─────────────────────────────────────────────────────

    const initChannel = useCallback(() => {
        // Close previous channel to prevent leaks (e.g. re-login after inactivity logout)
        try { channelRef.current?.close(); } catch (_) {}

        try {
            const ch = new BroadcastChannel(SESSION_CHANNEL_NAME);
            ch.onmessage = (e) => {
                const { type } = e.data || {};
                if (type === 'LOGOUT') {
                    // Mirror the logout locally — don't re-broadcast
                    stopHeartbeat();
                    clearInactivityTimers();
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setUser(null);
                } else if (type === 'ACTIVITY') {
                    // Another tab had real activity — reset our own timer SILENTLY
                    // (do NOT call resetTimer or we re-broadcast → infinite loop)
                    resetTimerSilent();
                }
            };
            channelRef.current = ch;
        } catch (_) {
            // Safari private browsing / old browsers: BroadcastChannel unavailable
            channelRef.current = null;
        }
    }, [stopHeartbeat, clearInactivityTimers, resetTimerSilent]);

    // ── Activity event listeners ─────────────────────────────────────────────

    const handleActivity = useCallback(() => {
        const now = Date.now();
        if (now - lastActivityRef.current < THROTTLE_MS) return;
        lastActivityRef.current = now;
        resetTimer(); // resets timer + broadcasts to other tabs
    }, [resetTimer]);

    const attachActivityListeners = useCallback(() => {
        ACTIVITY_EVENTS.forEach(evt =>
            window.addEventListener(evt, handleActivity, { passive: true })
        );
    }, [handleActivity]);

    const detachActivityListeners = useCallback(() => {
        ACTIVITY_EVENTS.forEach(evt =>
            window.removeEventListener(evt, handleActivity)
        );
    }, [handleActivity]);

    // ── Bootstrap — runs exactly once on mount ────────────────────────────────
    useEffect(() => {
        const token     = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');

        if (token && savedUser) {
            try {
                setUser(JSON.parse(savedUser));

                // Revalidate the session with the server in the background
                (async () => {
                    try {
                        const { data } = await authAPI.getMe();
                        if (data) {
                            localStorage.setItem('user', JSON.stringify(data));
                            setUser(data);
                        }
                    } catch (err) {
                        const status = err.response?.status;
                        if (status === 401 || status === 403 || status === 404) {
                            console.warn('[session] Revalidation failed — logging out.');
                            logoutRef.current?.('invalid_token');
                        }
                        // Any other error (network, 500 …) → keep cached session
                    }
                })();

                // Start session management (silent — page-load ≠ user activity)
                initChannel();
                startHeartbeat();
                attachActivityListeners();
                resetTimerSilent();
            } catch (e) {
                // Malformed JSON in localStorage
                console.error('[session] Could not parse stored user:', e);
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        }

        setLoading(false);

        // Listen for the 401-interceptor event fired by api.js
        const onSessionExpired = () => logoutRef.current?.('token_expired');
        window.addEventListener('session:expired', onSessionExpired);

        return () => {
            stopHeartbeat();
            clearInactivityTimers();
            detachActivityListeners();
            window.removeEventListener('session:expired', onSessionExpired);
            try { channelRef.current?.close(); } catch (_) {}
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // intentionally empty — runs once on mount only

    // ── Login ─────────────────────────────────────────────────────────────────
    const login = async (email, password) => {
        const { data } = await authAPI.login(email, password);

        if (data.token) {
            localStorage.setItem('token', data.token);
        }
        if (data.user) {
            localStorage.setItem('user', JSON.stringify(data.user));
            setUser(data.user);
        }

        // Detach any stale listeners before re-attaching to prevent duplicate
        // listeners when the user logs in again after an inactivity logout.
        detachActivityListeners();
        initChannel();
        startHeartbeat();
        attachActivityListeners();
        resetTimerSilent(); // silent: login itself is not user "activity"

        return data;
    };

    // ── Register ─────────────────────────────────────────────────────────────
    const register = async (email, password, role) => {
        await authAPI.register(email, password, role);
    };

    // ── Update user helper ────────────────────────────────────────────────────
    const updateUser = (newData) => {
        const updated = { ...user, ...newData };
        try {
            localStorage.setItem('user', JSON.stringify(updated));
        } catch (e) {
            console.error('[session] localStorage write failed (quota exceeded?):', e);
        }
        setUser(updated);
    };

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <AuthContext.Provider
            value={{
                user,
                setUser,
                updateUser,
                login,
                register,
                logout,
                loading,
                /**
                 * Exposed so long-running components (file uploads, video players,
                 * auto-saving forms) can manually prevent the inactivity timer from
                 * firing while they are active.
                 */
                resetSessionTimer: resetTimer,
            }}
        >
            {children}

            {/* Rendered here so every portal automatically gets the warning
                without any per-page setup. */}
            <SessionWarningModal
                visible={showWarning}
                onStayLoggedIn={handleStayLoggedIn}
                secondsLeft={warningSecondsLeft}
            />
        </AuthContext.Provider>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// useAuth hook
// ─────────────────────────────────────────────────────────────────────────────
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
