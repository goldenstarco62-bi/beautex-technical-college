import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if user is already logged in
        const token = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');

        if (token && savedUser) {
            try {
                const parsedUser = JSON.parse(savedUser);
                setUser(parsedUser);

                // Proactively refresh student info if it's a student
                if (parsedUser.role === 'student') {
                    const fetchUpdatedUser = async () => {
                        try {
                            const { data } = await authAPI.getMe();
                            if (data) {
                                localStorage.setItem('user', JSON.stringify(data));
                                setUser(data);
                            }
                        } catch (err) {
                            console.error('Auto-refresh user failed:', err);
                        }
                    };
                    fetchUpdatedUser();
                }
            } catch (e) {
                console.error('Failed to parse user data:', e);
                localStorage.removeItem('user');
            }
        }
        setLoading(false);
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
        return data;
    };

    const register = async (email, password, role) => {
        await authAPI.register(email, password, role);
    };

    const logout = () => {
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
            // Even if localStorage fails, we update the React state
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
    return useContext(AuthContext);
}
