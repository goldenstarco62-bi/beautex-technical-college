import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authAPI } from '../services/api';
import { Lock, Save, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function ChangePassword() {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    // We expect email to be passed in state from Login page
    const email = location.state?.email;

    if (!email) {
        setTimeout(() => navigate('/login'), 0);
        return null;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        const hasNumber = /\d/.test(newPassword);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
        if (!hasNumber || !hasSpecial) {
            setError('Strict Policy: Must include a number and a special character.');
            return;
        }

        setLoading(true);

        try {
            await authAPI.changePassword({
                email,
                newPassword
            });

            alert('Password changed successfully. Please login.');
            navigate('/login');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to change password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-maroon flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-2xl">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-maroon/10 rounded-full mb-4 text-maroon">
                        <Lock size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">Change Password</h2>
                    <p className="text-[11px] text-gray-500 mt-2 font-medium">
                        For security, please update your temporary password.
                    </p>
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl text-left">
                        <p className="text-[10px] text-blue-800 font-black uppercase tracking-widest mb-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Security Requirement:
                        </p>
                        <p className="text-[10px] text-blue-600 font-bold leading-relaxed">
                            Password must be <span className="text-blue-900 underline">8 or more characters</span> and include a mix of <span className="text-blue-900">numbers</span> and <span className="text-blue-900">symbols</span>.
                        </p>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-sm font-semibold">
                        <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-red-500" />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* New Password */}
                    <div className="space-y-1">
                        <label className="text-[12px] font-bold text-gray-600 uppercase tracking-widest">New Password</label>
                        <div className="relative">
                            <input
                                type={showNewPassword ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-4 py-3 pr-12 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-maroon/20 font-medium transition-all"
                                placeholder="8+ chars (A1@...)"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-maroon transition-colors"
                                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                            >
                                {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-1">
                        <label className="text-[12px] font-bold text-gray-600 uppercase tracking-widest">Confirm Password</label>
                        <div className="relative">
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-3 pr-12 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-maroon/20 font-medium transition-all"
                                placeholder="Re-enter password"
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
                        disabled={loading}
                        className="w-full bg-maroon text-white font-bold py-3 rounded-xl hover:bg-maroon-dark transition-all shadow-lg flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
                    >
                        {loading ? 'Updating...' : <><Save size={16} /> Update Password</>}
                    </button>
                </form>
            </div>
        </div>
    );
}
