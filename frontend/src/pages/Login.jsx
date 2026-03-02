import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, GraduationCap, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await login(email, password);
            if (response?.requirePasswordChange) {
                navigate('/change-password', { state: { email: response.user.email } });
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            const msg = err.response?.data?.error || '';
            if (
                msg.toLowerCase().includes('invalid') ||
                msg.toLowerCase().includes('incorrect') ||
                msg.toLowerCase().includes('not found') ||
                msg.toLowerCase().includes('credentials') ||
                !msg
            ) {
                setError('Invalid username or password. Please try again.');
            } else {
                setError(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!email) {
            setError('Please enter your email first to reset password');
            return;
        }
        setError('');
        setLoading(true);
        try {
            const { authAPI } = await import('../services/api');
            const { data } = await authAPI.forgotPassword({ email });
            alert(data.message || 'If an account exists, reset instructions have been sent.');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to request password reset');
        } finally {
            setLoading(false);
        }
    };

    const demoLogin = async (role) => {
        let demoEmail = '';
        let demoPassword = 'Beautex@2026';

        if (role === 'superadmin') {
            demoEmail = 'beautexcollege01@gmail.com';
        } else if (role === 'admin') {
            demoEmail = 'admin@beautex.edu';
        } else if (role === 'teacher') {
            demoEmail = 'james.wilson@beautex.edu';
        } else if (role === 'student') {
            demoEmail = 'sarah.johnson0@beautex.edu';
        }

        setEmail(demoEmail);
        setPassword(demoPassword);

        // Auto-submit
        setError('');
        setLoading(true);
        try {
            await login(demoEmail, demoPassword);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.error || 'Auth system failure');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-maroon flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                {/* School Seal */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-24 h-24 bg-white rounded-2xl mb-6 shadow-xl overflow-hidden border-4 border-gold">
                        <img src="/logo.jpg" alt="Beautex Logo" className="w-full h-full object-cover" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-xl font-black text-white uppercase tracking-widest">Beautex</h1>
                        <p className="text-[11px] text-white/75 font-semibold uppercase tracking-[0.2em]">Technical Training College</p>
                    </div>
                </div>

                {/* Login Card */}
                <div className="bg-white rounded-[2rem] p-10 shadow-2xl">
                    <div className="text-center mb-8">
                        <h2 className="text-lg font-bold text-gray-800">Sign in to your account</h2>
                        <div className="h-1 w-12 bg-gold mx-auto mt-4 rounded-full"></div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-sm font-semibold">
                            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-red-500" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[12px] font-bold text-gray-600 uppercase tracking-widest ml-1">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-maroon/20 focus:border-maroon/30 font-medium transition-all"
                                placeholder="name@example.com"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[12px] font-bold text-gray-600 uppercase tracking-widest ml-1">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-maroon/20 focus:border-maroon/30 font-medium transition-all pr-12"
                                    placeholder="Enter password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-maroon transition-colors"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between px-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 rounded border-gray-200 text-maroon focus:ring-maroon" />
                                <span className="text-[12px] font-semibold text-gray-600 uppercase tracking-wider">Remember me</span>
                            </label>
                            <button
                                type="button"
                                onClick={handleForgotPassword}
                                className="text-[12px] font-bold text-maroon uppercase tracking-wider hover:underline"
                            >
                                Forgot?
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-maroon text-white font-black py-4 rounded-xl hover:bg-maroon-dark transition-all shadow-lg uppercase text-xs tracking-widest disabled:opacity-50"
                        >
                            {loading ? 'Processing...' : 'Sign In'}
                        </button>
                    </form>

                </div>

                <div className="mt-12 text-center">
                    <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em]">
                        © 2026 Beautex Technical Training College
                    </p>
                </div>
            </div>
        </div>
    );
}
