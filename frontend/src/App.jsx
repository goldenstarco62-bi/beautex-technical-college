import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Faculty from './pages/Faculty';
import Courses from './pages/Courses';
import Settings from './pages/Settings';
import Users from './pages/Users';
import Attendance from './pages/Attendance';
import Grades from './pages/Grades';
import Schedule from './pages/Schedule';
import Announcements from './pages/Announcements';
import AcademicReports from './pages/AcademicReports';
import ActivityReports from './pages/ActivityReports';
import AuditLogs from './pages/AuditLogs';
import Finance from './pages/Finance';
import AcademicMaster from './pages/AcademicMaster';
import Materials from './pages/Materials';
import Profile from './pages/Profile';
import TrainerReports from './pages/TrainerReports';
import StudentDailyReportEntry from './pages/StudentDailyReportEntry';
import DailyStudentLogs from './pages/DailyStudentLogs';



function ProtectedRoute({ children, allowedRoles }) {
    const { user, loading } = useAuth();

    if (loading) return <div className="min-h-screen bg-maroon flex items-center justify-center text-white font-black tracking-widest uppercase">Initializing...</div>;

    if (!user) return <Navigate to="/login" />;

    const userRole = (user?.role ? String(user.role) : '').toLowerCase().trim();

    if (allowedRoles && !allowedRoles.map(r => String(r).toLowerCase().trim()).includes(userRole)) {
        return <Navigate to="/dashboard" />;
    }

    return children;
}

// FIX: SemiProtectedRoute — requires a token (so anonymous users can't access it)
// but does NOT require a full AuthContext user (for the forced-password-change flow).
function SemiProtectedRoute({ children }) {
    const token = localStorage.getItem('token');
    if (!token) return <Navigate to="/login" />;
    return children;
}

function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        {/* FIX: /change-password now requires a token to prevent anonymous access */}
                        <Route path="/change-password" element={<SemiProtectedRoute><ChangePassword /></SemiProtectedRoute>} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        <Route path="/debug" element={<div className="p-10 text-green-600 font-bold">Debug Route Active</div>} />

                        <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
                        <Route path="/students" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><Layout><Students /></Layout></ProtectedRoute>} />
                        <Route path="/faculty" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><Layout><Faculty /></Layout></ProtectedRoute>} />
                        <Route path="/courses" element={<ProtectedRoute allowedRoles={['admin', 'teacher', 'student', 'superadmin']}><Layout><Courses /></Layout></ProtectedRoute>} />
                        <Route path="/attendance" element={<ProtectedRoute allowedRoles={['admin', 'teacher', 'student', 'superadmin']}><Layout><Attendance /></Layout></ProtectedRoute>} />
                        <Route path="/grades" element={<ProtectedRoute allowedRoles={['admin', 'teacher', 'student', 'superadmin']}><Layout><Grades /></Layout></ProtectedRoute>} />
                        <Route path="/schedule" element={<ProtectedRoute allowedRoles={['admin', 'teacher', 'student', 'superadmin']}><Layout><Schedule /></Layout></ProtectedRoute>} />
                        <Route path="/announcements" element={<ProtectedRoute allowedRoles={['admin', 'teacher', 'student', 'superadmin']}><Layout><Announcements /></Layout></ProtectedRoute>} />

                        <Route path="/settings" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><Layout><Settings /></Layout></ProtectedRoute>} />
                        <Route path="/users" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><Layout><Users /></Layout></ProtectedRoute>} />
                        <Route path="/profile" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />
                        <Route path="/reports" element={<ProtectedRoute allowedRoles={['teacher', 'admin', 'superadmin']}><Layout><AcademicReports /></Layout></ProtectedRoute>} />
                        <Route path="/academic-master" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><Layout><AcademicMaster /></Layout></ProtectedRoute>} />
                        <Route path="/finance" element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'student']}><Layout><Finance /></Layout></ProtectedRoute>} />
                        <Route path="/materials" element={<ProtectedRoute allowedRoles={['admin', 'teacher', 'student', 'superadmin']}><Layout><Materials /></Layout></ProtectedRoute>} />
                        <Route path="/activity-reports" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><Layout><ActivityReports /></Layout></ProtectedRoute>} />
                        <Route path="/daily-student-logs" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><Layout><DailyStudentLogs /></Layout></ProtectedRoute>} />

                        <Route path="/audit-logs" element={<ProtectedRoute allowedRoles={['superadmin']}><Layout><AuditLogs /></Layout></ProtectedRoute>} />
                        <Route path="/trainer-reports" element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'teacher']}><Layout><TrainerReports /></Layout></ProtectedRoute>} />
                        <Route path="/student-daily-reports" element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'teacher']}><Layout><StudentDailyReportEntry /></Layout></ProtectedRoute>} />


                        <Route path="/" element={<Navigate to="/login" />} />
                        <Route path="*" element={<Navigate to="/login" />} />
                    </Routes>
                </BrowserRouter>
            </AuthProvider>
        </ThemeProvider>
    );
}

export default App;
