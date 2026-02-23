import { useEffect, useState } from 'react';
import { facultyAPI, usersAPI } from '../services/api';
import { Plus, Search, Edit, Trash2, X, Printer, Mail, Phone, BookOpen, Award, MapPin, Key, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import IDCard from '../components/shared/IDCard';
import { useAuth } from '../context/AuthContext';

export default function Faculty() {
    const { user: currentUser } = useAuth();
    const [faculty, setFaculty] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showProfile, setShowProfile] = useState(null);
    const [editingFaculty, setEditingFaculty] = useState(null);
    const [resetLoading, setResetLoading] = useState(false);
    const [formData, setFormData] = useState({
        id: '', name: '', email: '', department: '', position: '', specialization: '', contact: '', passport: '', courses: '', status: 'Active', category: 'Trainer'
    });
    const [printingFaculty, setPrintingFaculty] = useState(null);
    const [filteredFaculty, setFilteredFaculty] = useState([]);

    useEffect(() => { fetchFaculty(); }, []);

    const fetchFaculty = async () => {
        try {
            const { data } = await facultyAPI.getAll();
            setFaculty(data);
            setFilteredFaculty(data);
        } catch (error) {
            console.error('Error fetching faculty:', error);
        }
    };

    useEffect(() => {
        const filtered = faculty.filter(member =>
            member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            member.email.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredFaculty(filtered);
    }, [searchQuery, faculty]);

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this faculty member?')) return;
        try {
            await facultyAPI.delete(id);
            fetchFaculty();
        } catch (error) {
            console.error('Error deleting faculty:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingFaculty) {
                await facultyAPI.update(editingFaculty.id, formData);
            } else {
                const newId = `FAC-${Date.now().toString().slice(-6)}`;
                await facultyAPI.create({ ...formData, id: newId });
            }
            setShowModal(false);
            setEditingFaculty(null);
            fetchFaculty();
            resetForm();
        } catch (error) {
            console.error('Error saving faculty:', error);
            alert(error.response?.data?.error || 'Failed to save faculty record.');
        }
    };

    const handleEdit = (member) => {
        setEditingFaculty(member);
        setFormData({
            id: member.id, name: member.name, email: member.email,
            department: member.department, position: member.position,
            specialization: member.specialization || '', contact: member.contact || '',
            passport: member.passport || '', courses: member.courses || '', status: member.status || 'Active', category: member.category || 'Trainer'
        });
        setShowModal(true);
    };

    const resetForm = () => {
        setFormData({ id: '', name: '', email: '', department: '', position: '', specialization: '', contact: '', passport: '', courses: '', status: 'Active', category: 'Trainer' });
    };

    const handlePhotoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, photo: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handlePrintID = (member) => {
        setPrintingFaculty(member);
        setTimeout(() => { window.print(); setPrintingFaculty(null); }, 500);
    };

    const handleDownloadID = async (member) => {
        setPrintingFaculty(member);
        // Wait for render and images to load
        setTimeout(async () => {
            const front = document.getElementById(`id-card-front-${member.id}`);
            const back = document.getElementById(`id-card-back-${member.id}`);

            if (front && back) {
                try {
                    const canvasFront = await html2canvas(front, {
                        scale: 4,
                        useCORS: true,
                        backgroundColor: '#ffffff'
                    });
                    const canvasBack = await html2canvas(back, {
                        scale: 4,
                        useCORS: true,
                        backgroundColor: '#ffffff'
                    });

                    const pdf = new jsPDF({
                        orientation: 'portrait',
                        unit: 'mm',
                        format: 'a4'
                    });

                    const imgFront = canvasFront.toDataURL('image/png');
                    const imgBack = canvasBack.toDataURL('image/png');

                    // Modern PDF Layout
                    pdf.setTextColor(128, 0, 0); // Maroon
                    pdf.setFontSize(18);
                    pdf.text("BEAUTEX TECHNICAL TRAINING COLLEGE", 105, 20, { align: 'center' });

                    pdf.setTextColor(100, 100, 100);
                    pdf.setFontSize(10);
                    pdf.text("OFFICIAL STAFF IDENTIFICATION CARD", 105, 28, { align: 'center' });

                    // Add Front Side (Centered)
                    pdf.addImage(imgFront, 'PNG', (210 - 85.6) / 2, 40, 85.6, 53.98);

                    // Divider
                    pdf.setDrawColor(128, 0, 0);
                    pdf.setLineWidth(0.2);
                    pdf.line(20, 105, 190, 105);
                    pdf.setTextColor(150, 150, 150);
                    pdf.setFontSize(8);
                    pdf.text("OFFICIAL CARD REVERSE SIDE", 105, 112, { align: 'center' });

                    // Add Back Side (Centered)
                    pdf.addImage(imgBack, 'PNG', (210 - 85.6) / 2, 125, 85.6, 53.98);

                    // Verification Footer
                    pdf.setFontSize(8);
                    pdf.setTextColor(150, 150, 150);
                    const date = new Date().toLocaleDateString();
                    pdf.text(`Generated on ${date} | System Verified ID`, 105, 280, { align: 'center' });

                    pdf.save(`ID_Card_${member.id}_${member.name.replace(/\s+/g, '_')}.pdf`);
                } catch (err) {
                    console.error("PDF generation failed:", err);
                    alert("Failed to generate PDF. Please ensure all resources are loaded.");
                }
            }
            setPrintingFaculty(null);
        }, 1200);
    };

    const handleResetPassword = async (member) => {
        if (!window.confirm(`Reset password for ${member.name}?\n\nA new temporary password will be generated and sent to:\n\u{1F4E7} ${member.email}\n\nThe instructor will be required to change it on next login.`)) return;
        setResetLoading(true);
        try {
            const usersRes = await usersAPI.getAll();
            const matchedUser = usersRes.data.find(u => u.email === member.email);
            if (!matchedUser) {
                alert('No system account found for this instructor. They may not have a login account yet.');
                setResetLoading(false);
                return;
            }
            await usersAPI.resetPassword(matchedUser.id);
            alert(`\u2705 Password reset successful!\n\nA temporary password has been sent to:\n\u{1F4E7} ${member.email}\n\nThe instructor must change it on next login.`);
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to reset password. Please try again.');
        } finally {
            setResetLoading(false);
        }
    };

    const canResetPassword = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';

    const departments = ['Cosmetology', 'Beauty Therapy', 'Hairdressing', 'Catering', 'IT & Computer Science', 'Business'];

    const getInitials = (name) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    return (
        <div className="space-y-8">
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                    <div>
                        <p className="text-[10px] font-black text-maroon/30 uppercase tracking-[0.3em] mb-1">Beautex Training Centre</p>
                        <h1 className="text-2xl sm:text-3xl font-black text-maroon tracking-tight uppercase">Faculty Registry</h1>
                        <div className="w-16 h-0.5 bg-gold mt-3"></div>
                    </div>
                    <button
                        onClick={() => { resetForm(); setShowModal(true); }}
                        className="w-full sm:w-auto bg-maroon text-gold px-6 py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-maroon/90 shadow-lg transition-all border border-gold/20 font-black text-xs uppercase tracking-widest"
                    >
                        <Plus className="w-4 h-4" /> Enroll Instructor
                    </button>
                </div>

                {/* Search */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 bg-white border border-maroon/8 rounded-2xl p-3 flex items-center gap-3 shadow-sm">
                        <Search className="w-4 h-4 text-maroon/20 ml-2 shrink-0" />
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="flex-1 bg-transparent text-sm font-medium text-maroon placeholder-maroon/20 outline-none"
                        />
                    </div>
                    <div className="bg-white border border-maroon/8 rounded-2xl p-3 shadow-sm sm:w-48">
                        <select className="w-full bg-transparent text-xs font-black uppercase tracking-widest text-maroon/50 outline-none">
                            <option>All Departments</option>
                            {departments.map(dept => <option key={dept}>{dept}</option>)}
                        </select>
                    </div>
                </div>

                {/* Stats Bar */}
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: 'Total Faculty', value: faculty.length },
                        { label: 'Active', value: faculty.filter(f => f.status === 'Active').length },
                        { label: 'Departments', value: [...new Set(faculty.map(f => f.department))].length },
                    ].map((s, i) => (
                        <div key={i} className="bg-white border border-maroon/8 rounded-2xl p-5 shadow-sm text-center">
                            <p className="text-2xl font-black text-maroon">{s.value}</p>
                            <p className="text-[9px] font-black text-maroon/30 uppercase tracking-widest mt-1">{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* Faculty Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredFaculty.map((member) => (
                        <div key={member.id} className="bg-white border border-maroon/8 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all group">
                            {/* Card Top — Gold accent bar */}
                            <div className="h-0.5 bg-gradient-to-r from-maroon via-gold to-maroon opacity-60"></div>

                            <div className="p-4">
                                {/* Top row: Avatar + Name + Actions */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        {/* Avatar */}
                                        <div className="relative shrink-0">
                                            <div className="w-11 h-11 rounded-xl bg-maroon flex items-center justify-center text-gold text-sm font-black shadow-md overflow-hidden border border-gold/20">
                                                {member.photo
                                                    ? <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
                                                    : getInitials(member.name)
                                                }
                                            </div>
                                            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${member.status === 'Active' ? 'bg-green-400' : 'bg-gray-300'}`}></div>
                                        </div>
                                        {/* Name & Role */}
                                        <div>
                                            <h3 className="text-sm font-black text-maroon tracking-tight leading-tight">{member.name}</h3>
                                            <p className="text-[9px] font-black text-gold uppercase tracking-widest mt-0.5">{member.position || 'Instructor'}</p>
                                            <span className="inline-block mt-1 px-2 py-0.5 bg-maroon/5 text-[8px] font-black text-maroon/60 uppercase tracking-widest rounded-md border border-maroon/8">
                                                {member.department}
                                            </span>
                                        </div>
                                    </div>
                                    {/* Action buttons - always visible on mobile, hover on desktop */}
                                    <div className="flex gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handlePrintID(member)} className="p-1.5 rounded-lg border border-maroon/10 hover:bg-maroon/5 transition-colors" title="Print ID">
                                            <Printer className="w-3 h-3 text-maroon/40" />
                                        </button>
                                        <button onClick={() => handleDownloadID(member)} className="p-1.5 rounded-lg border border-maroon/10 hover:bg-maroon/5 transition-colors" title="Download ID">
                                            <Download className="w-3 h-3 text-maroon/40" />
                                        </button>
                                        <button onClick={() => handleEdit(member)} className="p-1.5 rounded-lg border border-maroon/10 hover:bg-maroon/5 transition-colors">
                                            <Edit className="w-3 h-3 text-maroon/40" />
                                        </button>
                                        <button onClick={() => handleDelete(member.id)} className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition-colors">
                                            <Trash2 className="w-3 h-3 text-red-400" />
                                        </button>
                                    </div>
                                </div>

                                {/* Info Grid */}
                                <div className="grid grid-cols-2 gap-1.5 mb-3">
                                    <div className="flex items-center gap-2 bg-maroon/3 rounded-lg px-2 py-1.5 border border-maroon/5">
                                        <Mail className="w-3 h-3 text-maroon/30 shrink-0" />
                                        <p className="text-[9px] font-bold text-maroon/60 truncate">{member.email}</p>
                                    </div>
                                    <div className="flex items-center gap-2 bg-maroon/3 rounded-lg px-2 py-1.5 border border-maroon/5">
                                        <Phone className="w-3 h-3 text-maroon/30 shrink-0" />
                                        <p className="text-[9px] font-bold text-maroon/60">{member.contact || 'Not listed'}</p>
                                    </div>
                                    <div className="flex items-center gap-2 bg-maroon/3 rounded-lg px-2 py-1.5 border border-maroon/5">
                                        <Award className="w-3 h-3 text-maroon/30 shrink-0" />
                                        <p className="text-[9px] font-bold text-maroon/60 truncate">{member.specialization || 'General'}</p>
                                    </div>
                                    <div className="flex items-center gap-2 bg-gold/8 rounded-lg px-2 py-1.5 border border-gold/15">
                                        <BookOpen className="w-3 h-3 text-gold shrink-0" />
                                        <p className="text-[9px] font-black text-maroon">{member.courses || '—'} Courses</p>
                                    </div>
                                </div>

                                {/* View Profile Button */}
                                <button
                                    onClick={() => setShowProfile(member)}
                                    className="w-full py-2 bg-maroon text-gold rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-maroon/90 transition-all shadow-sm"
                                >
                                    View Full Profile
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-maroon/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50">
                    <div className="bg-white border border-maroon/10 rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-10 max-w-2xl w-full shadow-2xl overflow-hidden relative max-h-[95vh] flex flex-col">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-maroon via-gold to-maroon opacity-60"></div>
                        <div className="absolute top-0 right-0 w-64 h-64 bg-maroon/3 rounded-full -mr-32 -mt-32 blur-3xl"></div>

                        <div className="relative flex justify-between items-center mb-6 shrink-0">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-black text-maroon uppercase tracking-tight">
                                    {editingFaculty ? 'Update Instructor' : 'Add Faculty Member'}
                                </h2>
                                <div className="w-10 h-0.5 bg-gold mt-2"></div>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-maroon/5 rounded-full transition-colors">
                                <X className="w-6 h-6 text-maroon/30" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto pr-1 custom-scrollbar flex-1">
                            <div className="flex items-center gap-6 mb-6">
                                <div className="relative group">
                                    <div className="w-24 h-24 rounded-2xl bg-gray-50 border-2 border-dashed border-maroon/20 flex items-center justify-center overflow-hidden">
                                        {formData.photo ? (
                                            <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <Plus className="w-6 h-6 text-maroon/20" />
                                        )}
                                    </div>
                                    <input
                                        type="file"
                                        onChange={handlePhotoUpload}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        accept="image/*"
                                    />
                                    <div className="absolute -bottom-2 -right-2 bg-maroon text-gold p-1.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Edit className="w-3 h-3" />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-black text-maroon/60 uppercase tracking-widest mb-1">Passport Photo</p>
                                    <p className="text-[10px] text-maroon/30 font-bold uppercase tracking-tighter">Required for school ID generation</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {[
                                    { label: 'Full Name', key: 'name', type: 'text', placeholder: 'Dr. Jane Smith', required: true },
                                    { label: 'Email Address', key: 'email', type: 'email', placeholder: 'jane@beautex.edu', required: true },
                                    { label: 'Academic Position', key: 'position', type: 'text', placeholder: 'e.g. Senior Lecturer' },
                                    { label: 'Specialization', key: 'specialization', type: 'text', placeholder: 'e.g. Advanced Cosmetology' },
                                    { label: 'Contact Number', key: 'contact', type: 'text', placeholder: '+254 700 000 000' },
                                    { label: 'Passport / ID No.', key: 'passport', type: 'text', placeholder: 'A1234567' },
                                    { label: 'Courses Assigned', key: 'courses', type: 'text', placeholder: 'e.g. Cosmetology, Makeup' },
                                ].map(({ label, key, type, placeholder, required }) => (
                                    <div key={key} className="space-y-1">
                                        <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">{label}</label>
                                        <input
                                            type={type}
                                            placeholder={placeholder}
                                            value={formData[key]}
                                            onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                                            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold placeholder-maroon/20 outline-none focus:ring-2 focus:ring-maroon/10 text-sm"
                                            required={required}
                                        />
                                    </div>
                                ))}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Department</label>
                                    <select
                                        value={formData.department}
                                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                        className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10 text-sm"
                                        required
                                    >
                                        <option value="">Select Department</option>
                                        {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Employment Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10 text-sm"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                        <option value="On Leave">On Leave</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Staff Category</label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10 text-sm"
                                    >
                                        <option value="Trainer">Trainer</option>
                                        <option value="Lecturer">Lecturer</option>
                                        <option value="Staff">Staff</option>
                                        <option value="Administration">Administration</option>
                                    </select>
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-maroon text-gold py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-maroon/90 shadow-xl transition-all mt-2 border border-gold/20">
                                {editingFaculty ? 'Update Record' : 'Enroll Faculty Member'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Profile Modal */}
            {showProfile && (
                <div className="fixed inset-0 bg-maroon/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50">
                    <div className="bg-white rounded-3xl max-w-2xl w-full border border-maroon/10 shadow-2xl relative overflow-hidden max-h-[90vh] flex flex-col">
                        {/* Header band */}
                        <div className="bg-maroon px-5 sm:px-8 pt-6 sm:pt-8 pb-14 sm:pb-16 relative overflow-hidden shrink-0">
                            <div className="absolute top-0 right-0 w-48 h-48 bg-gold/10 rounded-full -mr-24 -mt-24"></div>
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-16 -mb-16"></div>
                            <button onClick={() => setShowProfile(null)} className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10">
                                <X className="w-5 h-5 text-white" />
                            </button>
                            <div className="relative z-10 flex items-end gap-5">
                                <div className="w-20 h-20 rounded-2xl bg-white/10 border-2 border-gold/40 flex items-center justify-center text-gold text-2xl font-black overflow-hidden shadow-2xl shrink-0">
                                    {showProfile.photo
                                        ? <img src={showProfile.photo} alt={showProfile.name} className="w-full h-full object-cover" />
                                        : getInitials(showProfile.name)
                                    }
                                </div>
                                <div className="pb-1">
                                    <h2 className="text-xl font-black text-white tracking-tight">{showProfile.name}</h2>
                                    <p className="text-gold text-[10px] font-black uppercase tracking-widest mt-1">{showProfile.position || 'Instructor'}</p>
                                    <div className="flex items-center gap-2 flex-wrap mt-2">
                                        <span className="px-3 py-1 bg-white/10 text-white text-[9px] font-black uppercase tracking-widest rounded-lg border border-white/20">
                                            {showProfile.department}
                                        </span>
                                        <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg border ${showProfile.status === 'Active' ? 'bg-green-500/20 text-green-200 border-green-400/30' : 'bg-white/10 text-white border-white/20'
                                            }`}>
                                            {showProfile.status || 'Active'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Details */}
                        <div className="px-4 sm:px-8 py-5 sm:py-6 -mt-6 relative z-10 overflow-y-auto custom-scrollbar">
                            <div className="bg-white rounded-2xl border border-maroon/8 shadow-lg p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 mb-5">
                                {[
                                    { icon: Mail, label: 'Email Address', value: showProfile.email },
                                    { icon: Phone, label: 'Contact Number', value: showProfile.contact || 'Not listed' },
                                    { icon: Award, label: 'Specialization', value: showProfile.specialization || 'General' },
                                    { icon: MapPin, label: 'Passport / ID No.', value: showProfile.passport || showProfile.id_number || 'N/A' },
                                    { icon: BookOpen, label: 'Courses Assigned', value: showProfile.courses || 'Not assigned' },
                                    { icon: Award, label: 'Employment Status', value: showProfile.status || 'Active' },
                                ].map(({ icon: Icon, label, value }) => (
                                    <div key={label} className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-maroon/5 flex items-center justify-center shrink-0 mt-0.5">
                                            <Icon className="w-3.5 h-3.5 text-maroon/40" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-maroon/30 uppercase tracking-widest">{label}</p>
                                            <p className="text-sm font-bold text-maroon mt-0.5">{value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mb-5 bg-maroon/3 rounded-2xl p-5 border border-maroon/8">
                                <p className="text-[9px] font-black text-maroon/30 uppercase tracking-widest mb-2">Instructor's Philosophy</p>
                                <p className="text-sm text-maroon/70 font-medium leading-relaxed italic">
                                    "Dedicated to sculpting the next generation of technical leaders through hands-on excellence and rigorous academic discipline."
                                </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setShowProfile(null); handleEdit(showProfile); }}
                                    className="flex-1 py-3 bg-maroon text-gold rounded-xl font-black text-xs uppercase tracking-widest hover:bg-maroon/90 transition-all flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    Edit Profile
                                </button>
                                {canResetPassword && (
                                    <button
                                        onClick={() => handleResetPassword(showProfile)}
                                        disabled={resetLoading}
                                        className="flex-1 py-3 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-amber-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        <Key className="w-4 h-4" />
                                        {resetLoading ? 'Sending...' : 'Reset Password'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Capturable and Printable Container */}
            <div className={`fixed z-[9999] ${printingFaculty ? 'block' : 'hidden'} 
                /* Off-screen for normal view but capturable */
                left-[-9999px] top-0 bg-white
                /* Full screen for print mode */
                print:left-0 print:right-0 print:top-0 print:bottom-0 print:bg-white`}>
                {printingFaculty && <IDCard data={printingFaculty} role="teacher" />}
            </div>
        </div>
    );
}
