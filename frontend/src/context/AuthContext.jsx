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
// Context
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
// This is SEPARATE from the inactivity timer — the heartbeat only runs while
// the user is active (timer is alive).
const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // ── Warning modal state ──────────────────────────────────────────────────
    const [showWarning, setShowWarning] = useState(false);
    const [warningSecondsLeft, setWarningSecondsLeft] = useState(
        Math.round(SESSION_WARNING_BEFORE_MS / 1000)
    );

    // ── Refs (don't trigger re-renders) ─────────────────────────────────────
    const heartbeatRef     = useRef(null); // setInterval handle — DB last_seen_at
    const inactivityRef    = useRef(null); // setTimeout handle — main logout timer
    const warningRef       = useRef(null); // setTimeout handle — show-warning trigger
    const warningCountRef  = useRef(null); // setInterval handle — countdown ticks
    const channelRef       = useRef(null); // BroadcastChannel

    // Keep a stable reference to the logout function so the event listeners
    // that are registered once on mount can still call the latest version.
    const logoutRef = useRef(null);

    // ── Helpers ─────────────────────────────────────────────────────────────

    /** Stop the DB heartbeat ping. */
    const stopHeartbeat = useCallback(() => {
        if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
            heartbeatRef.current = null;
        }
    }, []);

    /** Start / restart the DB heartbeat ping. */
    const startHeartbeat = useCallback(() => {
        stopHeartbeat();
        heartbeatRef.current = setInterval(() => {
            authAPI.ping().catch(() => {});
        }, HEARTBEAT_INTERVAL_MS);
    }, [stopHeartbeat]);

    /** Clear all inactivity-related timers and hide the warning modal. */
    const clearInactivityTimers = useCallback(() => {
        if (inactivityRef.current)   { clearTimeout(inactivityRef.current);   inactivityRef.current = null; }
        if (warningRef.current)      { clearTimeout(warningRef.current);       warningRef.current = null; }
        if (warningCountRef.current) { clearInterval(warningCountRef.current); warningCountRef.current = null; }
        // Only update state when the warning is actually showing to avoid
        // unnecessary React re-renders on every activity event.
        setShowWarning(prev => prev ? false : prev);
        setWarningSecondsLeft(Math.round(SESSION_WARNING_BEFORE_MS / 1000));
    }, []);

    // ── Logout ───────────────────────────────────────────────────────────────

    /**
     * Full logout:
     *   1. Notify backend for audit trail (fire-and-forget).
     *   2. Stop all timers.
     *   3. Clear localStorage.
     *   4. Broadcast logout to other tabs.
     *   5. Set user = null  →  ProtectedRoute redirects to /login.
     */
    const logout = useCallback((reason = 'manual') => {
        // Fire-and-forget — we don't wait for the server response
        authAPI.logout();

        stopHeartbeat();
        clearInactivityTimers();

        localStorage.removeItem('token');
        localStorage.removeItem('user');

        // Tell other tabs to log out too
        try {
            channelRef.current?.postMessage({ type: 'LOGOUT', reason });
        } catch (_) { /* BroadcastChannel not supported — silently ignore */ }

        setUser(null);
    }, [stopHeartbeat, clearInactivityTimers]);

    // Keep the ref in sync so old event listener closures always call the
    // most recent logout function.
    logoutRef.current = logout;

    // ── Inactivity Timer ─────────────────────────────────────────────────────

    /**
     * Reset (or start) the inactivity timer.
     *
     * Called:
     *   • On every activity event (mousemove, keydown, touch, scroll, …)
     *   • After login
     *   • From external components via context (resetSessionTimer)
     *
     * Broadcasts ACTIVITY to other tabs so they also reset their timers, keeping
     * all open tabs alive as long as one of them is active.
     */
    /**
     * Reset the inactivity timer WITHOUT broadcasting to other tabs.
     * Used when we receive an ACTIVITY message FROM another tab — we must
     * reset our own timer but must NOT re-broadcast, otherwise we create an
     * infinite ping-pong loop: Tab A → ACTIVITY → Tab B resets → Tab B broadcasts
     * → Tab A resets → Tab A broadcasts → ... forever.
     */
    const resetTimerSilent = useCallback(() => {
        clearInactivityTimers();

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

        inactivityRef.current = setTimeout(() => {
            logoutRef.current?.('inactivity');
        }, SESSION_TIMEOUT_MS);
    }, [clearInactivityTimers]);

    /**
     * Reset the inactivity timer AND broadcast ACTIVITY to other open tabs.
     * Only called from real DOM activity events (mousemove, click, keydown …).
     * Never call this from a BroadcastChannel message handler — use
     * resetTimerSilent() there to prevent the cross-tab feedback loop.
     */
    const resetTimer = useCallback(() => {
        resetTimerSilent();

        // Tell other tabs a real user activity occurred so they also reset.
        try {
            channelRef.current?.postMessage({ type: 'ACTIVITY', timestamp: Date.now() });
        } catch (_) { /* BroadcastChannel unavailable — ignore */ }
    }, [resetTimerSilent]);

    // ── "Stay Logged In" handler ─────────────────────────────────────────────
    const handleStayLoggedIn = useCallback(() => {
        resetTimer();
    }, [resetTimer]);

    // ── BroadcastChannel setup ───────────────────────────────────────────────
    const initChannel = useCallback(() => {
        // Close any existing channel before creating a new one to avoid leaks
        // when initChannel is called more than once (e.g. login after inactivity logout).
        try { channelRef.current?.close(); } catch (_) {}

        try {
            const ch = new BroadcastChannel(SESSION_CHANNEL_NAME);
            ch.onmessage = (e) => {
                if (e.data?.type === 'LOGOUT') {
                    // Another tab logged out — mirror the logout locally WITHOUT
                    // re-broadcasting (the original tab already broadcast LOGOUT).
                    stopHeartbeat();
                    clearInactivityTimers();
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setUser(null);
                } else if (e.data?.type === 'ACTIVITY') {
                    // Another tab had real user activity — reset our timer SILENTLY.
                    // Do NOT call resetTimer() here because that would re-broadcast
                    // ACTIVITY, creating an infinite cross-tab loop.
                    resetTimerSilent();
                }
            };
            channelRef.current = ch;
        } catch (_) {
            // Safari private mode / old browsers may not support BroadcastChannel
            channelRef.current = null;
        }
    }, [stopHeartbeat, clearInactivityTimers, resetTimerSilent]);

    // ── Activity event listeners ─────────────────────────────────────────────

    /**
     * Throttled activity handler.
     * We use a simple ref-based throttle to avoid calling resetTimer()
     * thousands of times per second (e.g. on mousemove).
     */
    const lastActivityRef = useRef(0);
    const THROTTLE_MS = 500; // only react once per 500 ms

    const handleActivity = useCallback(() => {
        const now = Date.now();
        if (now - lastActivityRef.current < THROTTLE_MS) return;
        lastActivityRef.current = now;
        // resetTimer() resets the local timer AND broadcasts ACTIVITY to other tabs.
        // It is safe to call here because this handler is only attached to real DOM events.
        resetTimer();
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

    // ── Bootstrap (runs once on mount) ──────────────────────────────────────
    useEffect(() => {
        const token     = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');

        if (token && savedUser) {
            try {
                const parsedUser = JSON.parse(savedUser);
                setUser(parsedUser);

                // Always revalidate with the server on load
                const fetchUpdatedUser = async () => {
                    try {
                        const { data } = await authAPI.getMe();
                        if (data) {
                            localStorage.setItem('user', JSON.stringify(data));
                            setUser(data);
                        }
                    } catch (err) {
                        const status = err.response?.status;
                        if (status === 401 || status === 403 || status === 404) {
                            console.warn('[session] Session invalid or user not found — logging out.');
                            logoutRef.current?.('invalid_token');
                        }
                    }
                };
                fetchUpdatedUser();

                // Start everything (use silent reset on bootstrap — no other
                // tabs need to know we just loaded, only real activity should broadcast).
                initChannel();
                startHeartbeat();
                attachActivityListeners();
                resetTimerSilent();
            } catch (e) {
                console.error('[session] Failed to parse saved user:', e);
                localStorage.removeItem('user');
                localStorage.removeItem('token');
            }
        }

        setLoading(false);

        // Listen for the event fired by the Axios 401 interceptor (api.js)
        const onSessionExpired = () => {
            logoutRef.current?.('token_expired');
        };
        window.addEventListener('session:expired', onSessionExpired);

        // Cleanup on unmount
        return () => {
            stopHeartbeat();
            clearInactivityTimers();
            detachActivityListeners();
            window.removeEventListener('session:expired', onSessionExpired);
            try { channelRef.current?.close(); } catch (_) {}
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // intentionally empty — run once on mount

    // ── Login ────────────────────────────────────────────────────────────────
    const login = async (email, password) => {
        const { data } = await authAPI.login(email, password);
        if (data.token) {
            localStorage.setItem('token', data.token);
        }
        if (data.user) {
            localStorage.setItem('user', JSON.stringify(data.user));
            setUser(data.user);
        }

        // Start session management on fresh login.
        // Detach any stale listeners first (guards against login-after-inactivity-logout
        // where logout() did not detach listeners, to prevent duplicate listeners).
        detachActivityListeners();
        initChannel();
        startHeartbeat();
        attachActivityListeners();
        resetTimerSilent(); // silent: login is not user interaction that other tabs need to know about

        return data;
    };

    // ── Register ─────────────────────────────────────────────────────────────
    const register = async (email, password, role) => {
        await authAPI.register(email, password, role);
    };

    // ── updateUser helper ─────────────────────────────────────────────────────
    const updateUser = (newData) => {
        const updated = { ...user, ...newData };
        try {
            localStorage.setItem('user', JSON.stringify(updated));
        } catch (e) {
            console.error('[session] Failed to save user to localStorage (quota exceeded?):', e);
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
                /** Exposed so individual components can manually reset the timer
                 *  (e.g. auto-saving forms, long file uploads, video playback). */
                resetSessionTimer: resetTimer,
            }}
        >
            {children}

            {/* Global session warning modal — rendered here so it appears on
                every page without any per-page setup. */}
            <SessionWarningModal
                visible={showWarning}
                onStayLoggedIn={handleStayLoggedIn}
                secondsLeft={warningSecondsLeft}
            />
        </AuthContext.Provider>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
