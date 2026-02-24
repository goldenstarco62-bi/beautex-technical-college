import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';
import { Lock, CheckCircle, AlertCircle } from 'lucide-react';

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
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

        if (password.length < 6) {
            setError('Password must be at least 6 characters long');
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
                </div>

                <div className="bg-white rounded-[2rem] p-10 shadow-2xl">
                    {success ? (
                        <div className="text-center space-y-6">
                            <div className="flex justify-center">
                                <CheckCircle className="w-16 h-16 text-green-500" />
                            </div>
                            <h2 className="text-lg font-bold text-gray-800">Password Reset Successful!</h2>
                            <p className="text-sm text-gray-500">You will be redirected to the login page shortly...</p>
                        </div>
                    ) : (
                        <>
                            <div className="text-center mb-10">
                                <p className="text-sm text-gray-500">Enter your new secure password below.</p>
                                <div className="h-1 w-12 bg-gold mx-auto mt-4 rounded-full"></div>
                            </div>

                            {error && (
                                <div className="mb-6 p-4 bg-red-50 rounded-xl flex items-center gap-3 text-red-500 text-xs font-bold border border-red-100 italic">
                                    <AlertCircle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest ml-1">New Password</label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-maroon/5 focus:border-maroon/20 font-medium transition-all"
                                        placeholder="Min 6 characters"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest ml-1">Confirm Password</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-100 text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-maroon/5 focus:border-maroon/20 font-medium transition-all"
                                        placeholder="Repeat password"
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || !token}
                                    className="w-full bg-maroon text-white font-black py-4 rounded-xl hover:bg-maroon-dark transition-all shadow-lg uppercase text-xs tracking-widest disabled:opacity-50"
                                >
                                    {loading ? 'Reseting...' : 'Update Password'}
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
