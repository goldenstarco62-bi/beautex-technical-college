import React, { useState, useEffect } from 'react';
import { User, Mail, Shield, Camera, Save, Lock, Phone, MapPin, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { profileAPI } from '../services/api';

export default function Profile() {
    const { user, updateUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState({
        name: '',
        phone: '',
        address: '',
        photo: ''
    });

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const { data } = await profileAPI.get();
                setProfile({
                    name: data.name || '',
                    phone: data.phone || '',
                    address: data.address || '',
                    photo: data.photo || ''
                });
            } catch (error) {
                console.error('Failed to fetch profile:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const handleChange = (e) => {
        setProfile({ ...profile, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await profileAPI.update(profile);
            // Update auth context + localStorage
            updateUser(profile);
            alert('Profile updated successfully!');
        } catch (error) {
            console.error('Failed to update profile:', error);
            alert('Failed to update profile.');
        } finally {
            setSaving(false);
        }
    };

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Ensure it's an image
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_SIZE = 512;

                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to compressed JPEG
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                setProfile({ ...profile, photo: compressedBase64 });
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-maroon animate-spin" />
                    <p className="text-xs font-black uppercase tracking-widest text-maroon animate-pulse">Syncing Profile Data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div>
                <h1 className="text-4xl font-black text-black tracking-tight uppercase">User Profile</h1>
                <p className="text-xs text-black/40 font-bold tracking-[0.3em] uppercase mt-2">Personal Identity & Security Settings</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Column: Avatar & Quick Info */}
                <div className="space-y-6">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-2xl flex flex-col items-center group">
                        <div className="relative">
                            <div className="w-40 h-40 bg-maroon rounded-full border-4 border-gold/20 overflow-hidden shadow-2xl mb-6 flex items-center justify-center text-white text-5xl font-black">
                                {profile.photo ? (
                                    <img src={profile.photo} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    (user?.email?.[0] || 'U').toUpperCase()
                                )}
                            </div>
                            <label className="absolute bottom-6 right-2 p-3 bg-gold text-maroon rounded-2xl cursor-pointer hover:scale-110 active:scale-95 transition-all shadow-xl">
                                <Camera className="w-5 h-5" />
                                <input type="file" className="hidden" onChange={handlePhotoUpload} accept="image/*" />
                            </label>
                        </div>
                        <h2 className="text-xl font-black text-black uppercase tracking-tight text-center truncate w-full">
                            {profile.name || user?.email?.split('@')[0]}
                        </h2>
                        <div className="flex items-center gap-2 mt-2 px-4 py-1.5 bg-maroon/5 rounded-full">
                            <Shield className="w-3 h-3 text-maroon" />
                            <span className="text-[10px] font-black text-maroon uppercase tracking-widest">{user?.role}</span>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-2xl space-y-4">
                        <div className="flex items-center gap-3">
                            <Mail className="w-4 h-4 text-maroon" />
                            <div>
                                <p className="text-[10px] font-black text-black/20 uppercase tracking-widest">Official Email</p>
                                <p className="text-xs font-bold text-black truncate">{user?.email}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Lock className="w-4 h-4 text-maroon" />
                            <div>
                                <p className="text-[10px] font-black text-black/20 uppercase tracking-widest">Account Status</p>
                                <p className="text-xs font-bold text-green-600 uppercase">Verified Active</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Edit Form */}
                <div className="md:col-span-2">
                    <form onSubmit={handleSubmit} className="bg-white p-10 rounded-[3rem] border border-black/5 shadow-2xl space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-black/40 uppercase tracking-widest ml-1 flex items-center gap-2">
                                    <User className="w-3 h-3 text-maroon" /> Display Name
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={profile.name}
                                    onChange={handleChange}
                                    placeholder="Enter your full name"
                                    className="w-full px-6 py-4 bg-maroon/[0.02] border border-black/5 rounded-2xl text-sm font-bold text-black outline-none focus:ring-2 ring-maroon/10 focus:bg-white transition-all shadow-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-black/40 uppercase tracking-widest ml-1 flex items-center gap-2">
                                    <Phone className="w-3 h-3 text-maroon" /> Phone Number
                                </label>
                                <input
                                    type="text"
                                    name="phone"
                                    value={profile.phone}
                                    onChange={handleChange}
                                    placeholder="+254..."
                                    className="w-full px-6 py-4 bg-maroon/[0.02] border border-black/5 rounded-2xl text-sm font-bold text-black outline-none focus:ring-2 ring-maroon/10 focus:bg-white transition-all shadow-sm"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-black/40 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <MapPin className="w-3 h-3 text-maroon" /> Physical Address
                            </label>
                            <textarea
                                name="address"
                                value={profile.address}
                                onChange={handleChange}
                                rows="3"
                                placeholder="Enter city, region, or full address"
                                className="w-full px-6 py-4 bg-maroon/[0.02] border border-black/5 rounded-2xl text-sm font-bold text-black outline-none focus:ring-2 ring-maroon/10 focus:bg-white transition-all resize-none shadow-sm"
                            />
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full bg-black text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-xl hover:bg-maroon hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-gold" />}
                                {saving ? 'Updating...' : 'Commit Profile Changes'}
                            </button>
                        </div>
                    </form>

                    <div className="mt-8 p-8 bg-gold/[0.05] border border-gold/10 rounded-3xl">
                        <div className="flex items-start gap-4">
                            <Shield className="w-6 h-6 text-maroon shrink-0 mt-1" />
                            <div>
                                <h4 className="text-sm font-black text-black uppercase tracking-tight">Security Protocol</h4>
                                <p className="text-xs text-black/60 font-medium leading-relaxed mt-1">
                                    Beautex Academy uses end-to-end encryption for all personal data. Your profile photo and contact information are only visible to authorized academic administrators. For password changes, please use the official security portal.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
