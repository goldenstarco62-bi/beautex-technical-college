import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext({
    user: null,
    setUser: () => {},
    updateUser: () => {},
    login: async () => {},
    register: async () => {},
    logout: () => {},
    loading: true
});

const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const heartbeatRef = useRef(null);

    // Start a repeating ping to keep last_seen_at fresh on the server
    const startHeartbeat = () => {
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(() => {
            authAPI.ping().catch(() => { });
        }, HEARTBEAT_INTERVAL_MS);
    };

    const stopHeartbeat = () => {
        if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
            heartbeatRef.current = null;
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');

        if (token && savedUser) {
            try {
                const parsedUser = JSON.parse(savedUser);
                setUser(parsedUser);

                // Always refresh user info on load (updates last_seen_at immediately)
                const fetchUpdatedUser = async () => {
                    try {
                        const { data } = await authAPI.getMe();
                        if (data) {
                            // If the server says the user must change their password,
                            // preserve that flag so the rest of the app can act on it.
                            const updatedUser = { ...data };
                            localStorage.setItem('user', JSON.stringify(updatedUser));
                            setUser(updatedUser);
                        }
                    } catch (err) {
                        console.error('Auto-refresh user failed:', err);
                        const status = err.response?.status;
                        // 401 / 403 / 404 → token is invalid or the account was removed
                        if (status === 401 || status === 403 || status === 404) {
                            console.warn('Session invalid or user not found. Logging out...');
                            logout();
                        }
                        // For any other error (network, 500, etc.) keep the cached session
                    }
                };
                fetchUpdatedUser();

                // Start heartbeat so last_seen_at stays current while portal is open
                startHeartbeat();
            } catch (e) {
                console.error('Failed to parse user data:', e);
                localStorage.removeItem('user');
                localStorage.removeItem('token');
            }
        }

        setLoading(false);

        // Clean up on unmount
        return () => stopHeartbeat();
    }, []);

    const login = async (email, password) => {
        const { data } = await authAPI.login(email, password);
        if (data.token) {
            localStorage.setItem('token', data.token);
        }
        if (data.user) {
            localStorage.setItem('user', JSON.stringify(data.user));
            setUser(data.user);
        }
        // Start heartbeat immediately on login
        startHeartbeat();
        return data;
    };

    const register = async (email, password, role) => {
        await authAPI.register(email, password, role);
    };

    const logout = () => {
        stopHeartbeat();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    const updateUser = (newData) => {
        const updated = { ...user, ...newData };
        try {
            localStorage.setItem('user', JSON.stringify(updated));
        } catch (e) {
            console.error('Failed to save user to localStorage (likely quota exceeded):', e);
        }
        setUser(updated);
    };

    return (
        <AuthContext.Provider value={{ user, setUser, updateUser, login, register, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
