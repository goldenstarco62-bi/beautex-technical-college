import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';
import { Lock, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    useEffect(() => {
        if (!token) {
            setError('Invalid or missing reset token.');
        }
    }, [token]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters long');
            return;
        }

        const hasNumber = /\d/.test(password);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        if (!hasNumber || !hasSpecial) {
            setError('Strict Policy: Must include a number and a special character.');
            return;
        }

        setLoading(true);
        try {
            await authAPI.resetPassword({ token, email, newPassword: password });
            setSuccess(true);
            setTimeout(() => navigate('/login'), 3000);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to reset password. The link may be expired.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-maroon flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl mb-6 shadow-xl border-4 border-gold">
                        <Lock className="w-10 h-10 text-maroon" />
                    </div>
                    <h1 className="text-xl font-black text-white uppercase tracking-widest">Reset Password</h1>
                    <p className="text-[11px] text-white/75 font-semibold uppercase tracking-[0.2em] mt-2">Beautex Technical Training College</p>
                </div>

                <div className="bg-white rounded-[2rem] p-10 shadow-2xl">
                    {success ? (
                        <div className="text-center space-y-6">
                            <div className="flex justify-center">
                                <CheckCircle className="w-16 h-16 text-green-500" />
                            </div>
                            <h2 className="text-lg font-bold text-gray-800">Password Reset Successful!</h2>
                            <p className="text-sm text-gray-600">You will be redirected to the login page shortly...</p>
                        </div>
                    ) : (
                        <>
                            <div className="text-center mb-8">
                                <h2 className="text-base font-bold text-gray-800">Create New Password</h2>
                                <p className="text-sm text-gray-600 mt-2">Enter your new secure password below.</p>
                                <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl text-left">
                                    <p className="text-[10px] text-blue-800 font-black uppercase tracking-widest mb-1 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" /> Security Requirement:
                                    </p>
                                    <p className="text-[10px] text-blue-600 font-bold leading-relaxed">
                                        Password must be <span className="text-blue-900 underline">8 or more characters</span> and include a mix of <span className="text-blue-900">numbers</span> and <span className="text-blue-900">symbols</span>.
                                    </p>
                                </div>
                                <div className="h-1 w-12 bg-gold mx-auto mt-4 rounded-full"></div>
                            </div>

                            {error && (
                                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-sm font-semibold">
                                    <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-red-500" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* New Password */}
                                <div className="space-y-2">
                                    <label className="text-[12px] font-bold text-gray-600 uppercase tracking-widest ml-1">New Password</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full px-5 py-4 pr-12 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-maroon/20 focus:border-maroon/30 font-medium transition-all"
                                            placeholder="8+ chars (A1@...)"
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

                                {/* Confirm Password */}
                                <div className="space-y-2">
                                    <label className="text-[12px] font-bold text-gray-600 uppercase tracking-widest ml-1">Confirm Password</label>
                                    <div className="relative">
                                        <input
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full px-5 py-4 pr-12 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-maroon/20 focus:border-maroon/30 font-medium transition-all"
                                            placeholder="Repeat password"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-maroon transition-colors"
                                            aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                                        >
                                            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || !token}
                                    className="w-full bg-maroon text-white font-black py-4 rounded-xl hover:bg-maroon-dark transition-all shadow-lg uppercase text-xs tracking-widest disabled:opacity-50"
                                >
                                    {loading ? 'Updating...' : 'Update Password'}
                                </button>
                            </form>
                        </>
                    )}
                </div>

                <div className="mt-10 text-center">
                    <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em]">
                        © 2026 Beautex Technical Training College
                    </p>
                </div>
            </div>
        </div>
    );
}
