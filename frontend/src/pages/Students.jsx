import { useEffect, useState } from 'react';
import { studentsAPI, usersAPI } from '../services/api';
import { Plus, Search, Edit, Trash2, X, Printer, FileBarChart, Eye, Key, Mail, Phone, MapPin, BookOpen, User, Calendar, Shield, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useNavigate } from 'react-router-dom';
import IDCard from '../components/shared/IDCard';
import { useAuth } from '../context/AuthContext';

export default function Students() {
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const [students, setStudents] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(null);
    const [editingStudent, setEditingStudent] = useState(null);
    const [resetLoading, setResetLoading] = useState(false);
    const [formData, setFormData] = useState({
        id: '', name: '', email: '', course: [], intake: 'January Intake',
        gpa: 0, status: 'Active', contact: '',
        dob: '', address: '', guardian_name: '', guardian_contact: '',
        photo: '', completion_date: '', enrolled_date: new Date().toISOString().split('T')[0],
        department: '', level: 'Module 1'
    });
    const [printingStudent, setPrintingStudent] = useState(null);

    useEffect(() => {
        fetchStudents();
    }, []);

    const fetchStudents = async () => {
        try {
            const { data } = await studentsAPI.getAll();
            setStudents(data);
        } catch (error) {
            console.error('Error fetching students:', error);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            fetchStudents();
            return;
        }
        try {
            const { data } = await studentsAPI.search(searchQuery);
            setStudents(data);
        } catch (error) {
            console.error('Error searching students:', error);
        }
    };

    const validateForm = () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!formData.id) return 'Enrollment ID is required';
        if (!formData.name) return 'Full Name is required';
        if (!emailRegex.test(formData.email)) return 'Invalid email format';
        if (!formData.course || (Array.isArray(formData.course) && formData.course.length === 0)) return 'Please select at least one specialization course';
        if (formData.gpa < 0 || formData.gpa > 4) return 'GPA must be between 0.0 and 4.0';
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const validationError = validateForm();
        if (validationError) {
            alert(validationError);
            return;
        }

        try {
            if (editingStudent) {
                await studentsAPI.update(editingStudent.id, formData);
            } else {
                await studentsAPI.create(formData);
            }
            setShowModal(false);
            setEditingStudent(null);
            fetchStudents();
            resetForm();
        } catch (error) {
            console.error('Error saving student:', error);
            alert(error.response?.data?.error || 'Failed to save student record.');
        }
    };

    const handleEdit = (student) => {
        setEditingStudent(student);
        setFormData({
            ...student,
            course: Array.isArray(student.course) ? student.course : [student.course].filter(Boolean)
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (confirm('Are you sure you want to delete this student?')) {
            try {
                await studentsAPI.delete(id);
                fetchStudents();
            } catch (error) {
                console.error('Error deleting student:', error);
            }
        }
    };

    const resetForm = () => {
        setFormData({
            id: '', name: '', email: '', course: [], intake: 'January Intake',
            gpa: 0, status: 'Active', contact: '',
            dob: '', address: '', guardian_name: '', guardian_contact: '',
            photo: '', department: '', level: 'Module 1'
        });
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

    const handlePrintID = (student) => {
        setPrintingStudent(student);
        setTimeout(() => {
            window.print();
            setPrintingStudent(null);
        }, 500);
    };

    const handleDownloadID = async (student) => {
        setPrintingStudent(student);
        // Wait for render and images to load
        setTimeout(async () => {
            const front = document.getElementById(`id-card-front-${student.id}`);
            const back = document.getElementById(`id-card-back-${student.id}`);

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
                    pdf.text("OFFICIAL STUDENT IDENTIFICATION CARD", 105, 28, { align: 'center' });

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

                    pdf.save(`ID_Card_${student.id}_${student.name.replace(/\s+/g, '_')}.pdf`);
                } catch (err) {
                    console.error("PDF generation failed:", err);
                    alert("Failed to generate PDF. Please ensure all resources are loaded.");
                }
            }
            setPrintingStudent(null);
        }, 1200);
    };

    const handleResetPassword = async (student) => {
        if (!window.confirm(`Reset password for ${student.name}?\n\nA new temporary password will be generated and sent to:\n📧 ${student.email}\n\nThe student will be required to change it on next login.`)) return;

        setResetLoading(true);
        try {
            await usersAPI.resetByEmail(student.email);
            alert(`✅ Password reset successful!\n\nA temporary password has been sent to:\n📧 ${student.email}\n\nThe student must change it on next login.`);
        } catch (error) {
            const msg = error.response?.data?.error || 'Failed to reset password. Please try again.';
            alert(msg);
        } finally {
            setResetLoading(false);
        }
    };

    const courses = [
        'Cosmetology', 'Beauty Therapy', 'Hairdressing', 'Catering', 'Computer Packages', 'Website Development', 'Cyber Security',
        'Makeup', 'Sista Locks', 'Braiding, Plaiting & Crotcheting', 'Weaving & Wig Installation', 'Nail Technology'
    ];

    const canResetPassword = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';

    const getStatusColor = (status) => {
        if (status === 'Active') return 'text-green-600 bg-green-50 border-green-200';
        if (status === 'Graduated') return 'text-blue-600 bg-blue-50 border-blue-200';
        return 'text-gray-500 bg-gray-50 border-gray-200';
    };

    return (
        <div className="space-y-6">
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Students</h1>
                        <p className="text-sm text-gray-400 font-medium">Manage and view all student information</p>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button
                            onClick={() => window.print()}
                            className="flex-1 sm:flex-none justify-center bg-gold text-maroon px-4 py-3 rounded-xl flex items-center gap-2 hover:bg-gold-dark transition-all font-bold text-[10px] uppercase tracking-widest shadow-sm"
                        >
                            <Plus className="w-4 h-4" /> Export
                        </button>
                        <button
                            onClick={() => { resetForm(); setShowModal(true); }}
                            className="flex-1 sm:flex-none justify-center bg-maroon text-white px-4 py-3 rounded-xl flex items-center gap-2 hover:bg-maroon-dark transition-all font-bold text-[10px] uppercase tracking-widest shadow-sm"
                        >
                            <Plus className="w-4 h-4" /> Add Student
                        </button>
                    </div>
                </div>

                {/* Statistics Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {[
                        { label: 'Total Students', value: students.length, color: 'text-gray-800' },
                        { label: 'Active', value: students.filter(s => s.status === 'Active').length, color: 'text-gray-800' },
                        { label: 'Average GPA', value: '3.70', color: 'text-gray-800' },
                    ].map((stat, i) => (
                        <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-transform hover:-translate-y-1">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{stat.label}</p>
                            <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                        </div>
                    ))}
                </div>

                {/* Integrated Search */}
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Search students..."
                            className="w-full pl-12 pr-4 py-3 bg-gray-50/50 border border-gray-100 rounded-xl text-sm font-medium text-gray-700 placeholder-gray-300 outline-none focus:border-maroon/20 focus:ring-4 focus:ring-maroon/5 transition-all"
                        />
                    </div>
                    <select
                        onChange={(e) => {
                            const status = e.target.value;
                            if (status === 'All Status') {
                                fetchStudents();
                            } else {
                                const filtered = students.filter(s => s.status === status);
                                setStudents(filtered);
                            }
                        }}
                        className="bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none"
                    >
                        <option>All Status</option>
                        <option>Active</option>
                        <option>Inactive</option>
                    </select>
                </div>

                {/* Table wrapper for horizontal scroll */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-xl overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left min-w-[1000px]">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                {['Student ID', 'Name', 'Course', 'Intake', 'GPA', 'Status', 'Contact', 'Actions'].map(h => (
                                    <th key={h} className="px-6 py-5 text-[11px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {students.map((student) => (
                                <tr key={student.id} className="hover:bg-gray-50/30 transition-colors group">
                                    <td className="px-6 py-5">
                                        <span className="text-xs font-bold text-gray-500">BT{student.id.toString().padStart(7, '0')}</span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => setShowProfileModal(student)}
                                                className="w-10 h-10 rounded-full bg-parchment-200 border border-maroon/10 overflow-hidden flex items-center justify-center hover:ring-2 hover:ring-maroon/30 transition-all"
                                                title="View Full Profile"
                                            >
                                                {student.photo ? (
                                                    <img src={student.photo} alt={student.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-[10px] font-black text-maroon/40">{student.name?.[0]}</span>
                                                )}
                                            </button>
                                            <div className="flex flex-col">
                                                <button
                                                    onClick={() => setShowProfileModal(student)}
                                                    className="text-sm font-bold text-gray-800 hover:text-maroon transition-colors text-left"
                                                >
                                                    {student.name}
                                                </button>
                                                <span className="text-[10px] text-gray-400 font-medium">{student.email}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-xs font-bold text-gray-600">
                                        {Array.isArray(student.course) ? student.course.join(', ') : student.course}
                                    </td>
                                    <td className="px-6 py-5 text-xs font-bold text-gray-400">{student.intake || student.semester || 'N/A'}</td>
                                    <td className="px-6 py-5 text-xs font-bold text-gray-800">{student.gpa}</td>
                                    <td className="px-6 py-5">
                                        <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase ${student.status === 'Active' ? 'text-green-500' : 'text-gray-400'}`}>
                                            {student.status || 'Active'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 text-xs font-bold text-gray-400">
                                        {student.contact || 'No contact'}
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex gap-2">
                                            <button onClick={() => setShowProfileModal(student)} className="p-2 text-primary/20 hover:text-maroon transition-colors border border-gray-100 rounded-lg" title="View Profile"><Eye className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => navigate(`/reports?studentId=${student.id}`)} className="p-2 text-primary/20 hover:text-maroon transition-colors border border-gray-100 rounded-lg" title="View Academic Reports"><FileBarChart className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => handlePrintID(student)} className="p-2 text-primary/20 hover:text-primary transition-colors border border-gray-100 rounded-lg" title="Print ID Card"><Printer className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => handleDownloadID(student)} className="p-2 text-primary/20 hover:text-primary transition-colors border border-gray-100 rounded-lg" title="Download ID Card"><Download className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => handleEdit(student)} className="p-2 text-primary/20 hover:text-primary transition-colors border border-gray-100 rounded-lg"><Edit className="w-3.5 h-3.5" /></button>
                                            {canResetPassword && (
                                                <button onClick={() => handleResetPassword(student)} className="p-2 text-primary/20 hover:text-amber-600 transition-colors border border-gray-100 rounded-lg" title="Reset Password"><Key className="w-3.5 h-3.5" /></button>
                                            )}
                                            <button onClick={() => handleDelete(student.id)} className="p-2 text-primary/10 hover:text-red-600 transition-colors border border-gray-100 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Student Profile Modal */}
            {showProfileModal && (
                <div className="fixed inset-0 bg-maroon/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[200]">
                    <div className="bg-white rounded-2xl sm:rounded-3xl max-w-2xl w-full border border-maroon/10 shadow-2xl relative overflow-hidden max-h-[95vh] flex flex-col">
                        {/* Header Band */}
                        <div className="bg-maroon px-5 sm:px-8 pt-6 sm:pt-8 pb-12 sm:pb-16 relative overflow-hidden shrink-0">
                            <div className="absolute top-0 right-0 w-48 h-48 bg-gold/10 rounded-full -mr-24 -mt-24"></div>
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-16 -mb-16"></div>
                            <button onClick={() => setShowProfileModal(null)} className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10">
                                <X className="w-5 h-5 text-white" />
                            </button>
                            <div className="relative z-10 flex items-end gap-5">
                                <div className="w-20 h-20 rounded-2xl bg-white/10 border-2 border-gold/40 flex items-center justify-center text-gold text-2xl font-black overflow-hidden shadow-2xl shrink-0">
                                    {showProfileModal.photo
                                        ? <img src={showProfileModal.photo} alt={showProfileModal.name} className="w-full h-full object-cover" />
                                        : <span>{showProfileModal.name?.[0]?.toUpperCase()}</span>
                                    }
                                </div>
                                <div className="pb-1">
                                    <h2 className="text-xl font-black text-white tracking-tight">{showProfileModal.name}</h2>
                                    <p className="text-gold text-[10px] font-black uppercase tracking-widest mt-1">
                                        BT{showProfileModal.id?.toString().padStart(7, '0')} · {Array.isArray(showProfileModal.course) ? showProfileModal.course.join(', ') : showProfileModal.course}
                                    </p>
                                    <span className={`inline-block mt-2 px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg border ${showProfileModal.status === 'Active' ? 'bg-green-500/20 text-green-200 border-green-400/30' : 'bg-white/10 text-white border-white/20'}`}>
                                        {showProfileModal.status || 'Active'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Details */}
                        <div className="px-4 sm:px-8 py-5 sm:py-6 -mt-6 relative z-10 overflow-y-auto custom-scrollbar">
                            <div className="bg-white rounded-2xl border border-maroon/8 shadow-lg p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 mb-5">
                                {[
                                    { icon: Mail, label: 'Email Address', value: showProfileModal.email },
                                    { icon: Phone, label: 'Contact Number', value: showProfileModal.contact || 'Not listed' },
                                    { icon: BookOpen, label: 'Course / Programme', value: Array.isArray(showProfileModal.course) ? showProfileModal.course.join(', ') : showProfileModal.course },
                                    { icon: Calendar, label: 'Intake / Semester', value: showProfileModal.intake || showProfileModal.semester || 'N/A' },
                                    { icon: User, label: 'Date of Birth', value: showProfileModal.dob ? new Date(showProfileModal.dob).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A' },
                                    { icon: Shield, label: 'Cumulative GPA', value: showProfileModal.gpa ?? 'N/A' },
                                    { icon: MapPin, label: 'Address', value: showProfileModal.address || 'Not provided' },
                                    { icon: Calendar, label: 'Enrollment Date', value: showProfileModal.enrolled_date ? new Date(showProfileModal.enrolled_date).toLocaleDateString('en-GB') : 'N/A' },
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

                            {/* Guardian Info */}
                            {(showProfileModal.guardian_name || showProfileModal.guardian_contact) && (
                                <div className="bg-maroon/3 rounded-2xl p-5 border border-maroon/8 mb-5">
                                    <p className="text-[9px] font-black text-maroon/30 uppercase tracking-widest mb-3">Guardian Information</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-[9px] text-maroon/30 uppercase tracking-widest font-bold">Name</p>
                                            <p className="text-sm font-bold text-maroon mt-0.5">{showProfileModal.guardian_name || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] text-maroon/30 uppercase tracking-widest font-bold">Contact</p>
                                            <p className="text-sm font-bold text-maroon mt-0.5">{showProfileModal.guardian_contact || 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setShowProfileModal(null); handleEdit(showProfileModal); }}
                                    className="flex-1 py-3 bg-maroon text-gold rounded-xl font-black text-xs uppercase tracking-widest hover:bg-maroon/90 transition-all flex items-center justify-center gap-2"
                                >
                                    <Edit className="w-4 h-4" /> Edit Profile
                                </button>
                                {canResetPassword && (
                                    <button
                                        onClick={() => handleResetPassword(showProfileModal)}
                                        disabled={resetLoading}
                                        className="flex-1 py-3 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-amber-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        <Key className="w-4 h-4" />
                                        {resetLoading ? 'Sending...' : 'Reset Password'}
                                    </button>
                                )}
                                <button
                                    onClick={() => { setShowProfileModal(null); navigate(`/reports?studentId=${showProfileModal.id}`); }}
                                    className="py-3 px-4 bg-gray-50 text-gray-600 border border-gray-200 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
                                >
                                    <FileBarChart className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-maroon-950/60 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4 z-[100]">
                    <div className="bg-white rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-10 max-w-2xl w-full shadow-3xl border border-maroon/10 overflow-hidden relative max-h-[95vh] flex flex-col">
                        {/* Elegant background texture */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-maroon/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gold/5 rounded-full -ml-24 -mb-24 blur-3xl"></div>

                        <div className="relative flex justify-between items-center mb-5 shrink-0">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-black text-maroon uppercase tracking-tight">
                                    {editingStudent ? 'Update Registry' : 'New Enrollment'}
                                </h2>
                                <p className="text-xs text-maroon/40 font-bold mt-1 uppercase tracking-widest">Beautex Student Information</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-parchment-100 rounded-full transition-colors">
                                <X className="w-6 h-6 text-maroon/20" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto pr-1 custom-scrollbar flex-1">
                            {/* Section 1: Personal & Photo */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-6">
                                    <div className="relative group">
                                        <div className="w-24 h-24 rounded-2xl bg-parchment-200 border-2 border-dashed border-maroon/20 flex items-center justify-center overflow-hidden">
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
                                    <div className="flex-1 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Enrollment ID</label>
                                                <input
                                                    type="text"
                                                    value={formData.id}
                                                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold placeholder-maroon/20 outline-none focus:ring-2 focus:ring-maroon/10"
                                                    placeholder="BT/2024/001"
                                                    disabled={!!editingStudent}
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Full Name</label>
                                                <input
                                                    type="text"
                                                    value={formData.name}
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold placeholder-maroon/20 outline-none focus:ring-2 focus:ring-maroon/10"
                                                    placeholder="Sarah Johnson"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Date of Birth</label>
                                    <input
                                        type="date"
                                        value={formData.dob}
                                        onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10"
                                    />
                                </div>
                            </div>

                            {/* Section 2: Contact & Academic */}
                            <div className="space-y-6 pt-6 border-t border-maroon/5">
                                <h3 className="text-[10px] font-black text-gold uppercase tracking-widest">Academic & Contact</h3>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Email</label>
                                            <input
                                                type="email"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Contact</label>
                                            <input
                                                type="text"
                                                value={formData.contact}
                                                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                                                className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Address</label>
                                        <textarea
                                            value={formData.address}
                                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                            className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10 min-h-[80px]"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Specialization Courses (Select all that apply)</label>
                                        <div className="grid grid-cols-2 gap-2 p-4 bg-gray-50 rounded-2xl border border-gray-100 max-h-48 overflow-y-auto custom-scrollbar">
                                            {courses.map(course => {
                                                const isSelected = Array.isArray(formData.course) && formData.course.includes(course);
                                                return (
                                                    <button
                                                        key={course}
                                                        type="button"
                                                        onClick={() => {
                                                            const currentCourses = Array.isArray(formData.course) ? formData.course : [];
                                                            if (isSelected) {
                                                                setFormData({ ...formData, course: currentCourses.filter(c => c !== course) });
                                                            } else {
                                                                setFormData({ ...formData, course: [...currentCourses, course] });
                                                            }
                                                        }}
                                                        className={`text-left px-3 py-2 rounded-lg text-[10px] font-bold transition-all border ${isSelected
                                                            ? 'bg-maroon text-gold border-maroon'
                                                            : 'bg-white text-gray-600 border-gray-100 hover:border-maroon/30'
                                                            }`}
                                                    >
                                                        {course}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Current Intake</label>
                                        <select
                                            value={formData.intake}
                                            onChange={(e) => setFormData({ ...formData, intake: e.target.value })}
                                            className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10"
                                        >
                                            {['January Intake', 'February Intake', 'March Intake', 'April Intake', 'May Intake', 'June Intake', 'July Intake', 'August Intake', 'September Intake', 'October Intake', 'November Intake', 'December Intake'].map(intake => (
                                                <option key={intake} value={intake}>{intake}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Cumulative GPA</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max="4.0"
                                            value={formData.gpa}
                                            onChange={(e) => setFormData({ ...formData, gpa: parseFloat(e.target.value) })}
                                            className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Enrollment Status</label>
                                        <select
                                            value={formData.status}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                            className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10"
                                        >
                                            <option value="Active">Active</option>
                                            <option value="Inactive">Inactive</option>
                                            <option value="Graduated">Graduated</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Department</label>
                                        <select
                                            value={formData.department}
                                            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                            className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10"
                                        >
                                            <option value="">Select Department</option>
                                            <option value="Cosmetology">Cosmetology</option>
                                            <option value="Beauty Therapy">Beauty Therapy</option>
                                            <option value="Hairdressing">Hairdressing</option>
                                            <option value="Information Technology">Information Technology</option>
                                            <option value="Catering & Hospitality">Catering & Hospitality</option>
                                            <option value="Fashion & Design">Fashion & Design</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Academic Level</label>
                                        <select
                                            value={formData.level}
                                            onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                                            className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10"
                                        >
                                            <option value="Module 1">Module 1</option>
                                            <option value="Module 2">Module 2</option>
                                            <option value="Module 3">Module 3</option>
                                            <option value="Short Course">Short Course</option>
                                            <option value="Certificate">Certificate</option>
                                            <option value="Diploma">Diploma</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Enrollment Date</label>
                                        <input
                                            type="date"
                                            value={formData.enrolled_date}
                                            onChange={(e) => setFormData({ ...formData, enrolled_date: e.target.value })}
                                            className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Completion Date</label>
                                        <input
                                            type="date"
                                            value={formData.completion_date}
                                            onChange={(e) => setFormData({ ...formData, completion_date: e.target.value })}
                                            className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Guardian */}
                            <div className="space-y-6 pt-6 border-t border-maroon/5">
                                <h3 className="text-[10px] font-black text-gold uppercase tracking-widest">Guardian Info</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Name</label>
                                        <input
                                            type="text"
                                            value={formData.guardian_name}
                                            onChange={(e) => setFormData({ ...formData, guardian_name: e.target.value })}
                                            className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Contact</label>
                                        <input
                                            type="text"
                                            value={formData.guardian_contact}
                                            onChange={(e) => setFormData({ ...formData, guardian_contact: e.target.value })}
                                            className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-maroon text-gold py-6 rounded-[1.5rem] font-black text-sm uppercase tracking-[0.2em] hover:bg-elite-maroon shadow-xl transition-all mt-4 border border-gold/20 shrink-0">
                                {editingStudent ? 'Synchronize Registry' : 'Finalize Enrollment'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Capturable and Printable Container */}
            <div className={`fixed z-[9999] ${printingStudent ? 'block' : 'hidden'} 
                left-[-9999px] top-0 bg-white
                print:left-0 print:right-0 print:top-0 print:bottom-0 print:bg-white`}>
                {printingStudent && <IDCard data={printingStudent} role="student" />}
            </div>
        </div>
    );
}
