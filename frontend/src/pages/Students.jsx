import { useEffect, useState } from 'react';
import { studentsAPI } from '../services/api';
import { Plus, Search, Edit, Trash2, X, Printer, FileBarChart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import IDCard from '../components/shared/IDCard';

export default function Students() {
    const navigate = useNavigate();
    const [students, setStudents] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [formData, setFormData] = useState({
        id: '', name: '', email: '', course: '', intake: 'January Intake',
        gpa: 0, status: 'Active', contact: '',
        dob: '', address: '', guardian_name: '', guardian_contact: '',
        photo: '', completion_date: '', enrolled_date: new Date().toISOString().split('T')[0]
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
        if (!formData.course) return 'Please select a specialization course';
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
        setFormData(student);
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
            id: '', name: '', email: '', course: '', intake: 'January Intake',
            gpa: 0, status: 'Active', contact: '',
            dob: '', address: '', guardian_name: '', guardian_contact: '',
            photo: ''
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

    const courses = [
        'Cosmetology', 'Beauty Therapy', 'Catering', 'Computer Packages', 'Website Development', 'Cyber Security',
        'Makeup', 'Sista Locks', 'Braiding, Plaiting & Crotcheting', 'Weaving & Wig Installation', 'Nail Technology'
    ];

    return (
        <div className="space-y-6">
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Students</h1>
                        <p className="text-sm text-gray-400 font-medium">Manage and view all student information</p>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button
                            onClick={() => window.print()}
                            className="flex-1 md:flex-none justify-center bg-gold text-maroon px-4 md:px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-gold-dark transition-all font-bold text-[10px] md:text-xs uppercase tracking-widest shadow-sm"
                        >
                            <Plus className="w-4 h-4" /> Export
                        </button>
                        <button
                            onClick={() => { resetForm(); setShowModal(true); }}
                            className="flex-1 md:flex-none justify-center bg-maroon text-white px-4 md:px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-maroon-dark transition-all font-bold text-[10px] md:text-xs uppercase tracking-widest shadow-sm"
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
                                            <div className="w-10 h-10 rounded-full bg-parchment-200 border border-maroon/10 overflow-hidden flex items-center justify-center">
                                                {student.photo ? (
                                                    <img src={student.photo} alt={student.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-[10px] font-black text-maroon/20">{student.name?.[0]}</span>
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-gray-800">{student.name}</span>
                                                <span className="text-[10px] text-gray-400 font-medium">{student.email}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-xs font-bold text-gray-600">{student.course}</td>
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
                                        <div className="flex gap-3">
                                            <button onClick={() => navigate(`/reports?studentId=${student.id}`)} className="p-2 text-primary/20 hover:text-maroon transition-colors border border-gray-100 rounded-lg" title="View Academic Reports"><FileBarChart className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => handlePrintID(student)} className="p-2 text-primary/20 hover:text-primary transition-colors border border-gray-100 rounded-lg" title="Print ID Card"><Printer className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => handleEdit(student)} className="p-2 text-primary/20 hover:text-primary transition-colors border border-gray-100 rounded-lg"><Edit className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => handleDelete(student.id)} className="p-2 text-primary/10 hover:text-red-600 transition-colors border border-gray-100 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-maroon-950/60 backdrop-blur-xl flex items-center justify-center p-4 z-[100]">
                    <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-12 max-w-2xl w-full shadow-3xl border border-maroon/10 scale-in-center overflow-hidden relative">
                        {/* Elegant background texture */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-maroon/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gold/5 rounded-full -ml-24 -mb-24 blur-3xl"></div>

                        <div className="relative flex justify-between items-center mb-6 md:mb-12">
                            <div>
                                <h2 className="text-2xl font-black text-maroon uppercase tracking-tight">
                                    {editingStudent ? 'Update Registry' : 'New Enrollment'}
                                </h2>
                                <p className="text-xs text-maroon/40 font-bold mt-1 uppercase tracking-widest">Beautex Student Information</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-parchment-100 rounded-full transition-colors">
                                <X className="w-6 h-6 text-maroon/20" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-8 max-h-[70vh] overflow-y-auto pr-4 custom-scrollbar">
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
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Specialization Course</label>
                                            <select
                                                value={formData.course}
                                                onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                                                className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10"
                                                required
                                            >
                                                <option value="">Select Specialization</option>
                                                {courses.map(course => <option key={course} value={course}>{course}</option>)}
                                            </select>
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
                            </div>

                            {/* Section 3: Guardian */}
                            <div className="space-y-6 pt-6 border-t border-maroon/5">
                                <h3 className="text-[10px] font-black text-gold uppercase tracking-widest">Guardian Info</h3>
                                <div className="grid grid-cols-2 gap-4">
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
                                            className="w-full px-5 py-4 bg-parchment-100 border-none rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-maroon text-gold py-6 rounded-[1.5rem] font-black text-sm uppercase tracking-[0.2em] hover:bg-elite-maroon shadow-xl transition-all mt-4 border border-gold/20">
                                {editingStudent ? 'Synchronize Registry' : 'Finalize Enrollment'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Hidden Print Container */}
            <div className="hidden print:block fixed inset-0 bg-white z-[9999]">
                {printingStudent && <IDCard data={printingStudent} role="student" />}
            </div>
        </div>
    );
}
