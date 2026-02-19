import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authAPI } from '../services/api';
import { Lock, Save } from 'lucide-react';

export default function ChangePassword() {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    // We expect email to be passed in state from Login page
    const email = location.state?.email;

    if (!email) {
        // If no email in state, redirect back to login
        // In a real app, you might want to handle this better (e.g., check if user is already logged in but needs password change)
        // But for this flow, we assume they come from Login.

        // However, if we preserve the session, we might be able to get it from context. 
        // For now, let's just redirect if missing.
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

        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);

        try {
            // For forced changes, we don't need currentPassword as the user is semi-authenticated
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
                    <p className="text-xs text-gray-500 mt-2">
                        For security, please update your temporary password.
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs font-bold mb-4 text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">New Password</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 text-gray-800 focus:outline-none focus:ring-2 focus:ring-maroon/20"
                            placeholder="Min 6 characters"
                            required
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Confirm Password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 text-gray-800 focus:outline-none focus:ring-2 focus:ring-maroon/20"
                            placeholder="Re-enter password"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-maroon text-white font-bold py-3 rounded-xl hover:bg-maroon-dark transition-all shadow-lg flex items-center justify-center gap-2 mt-4"
                    >
                        {loading ? 'Updating...' : <><Save size={16} /> Update Password</>}
                    </button>
                </form>
            </div>
        </div>
    );
}
