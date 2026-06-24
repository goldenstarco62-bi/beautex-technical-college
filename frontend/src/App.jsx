import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/layout/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import SplashLoader from './components/shared/SplashLoader';
import PWAInstallPrompt from './components/PWAInstallPrompt';

// Lazy load page components for code splitting & faster bundle loading
const Login = lazy(() => import('./pages/Login'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Students = lazy(() => import('./pages/Students'));
const Faculty = lazy(() => import('./pages/Faculty'));
const Courses = lazy(() => import('./pages/Courses'));
const Settings = lazy(() => import('./pages/Settings'));
const Users = lazy(() => import('./pages/Users'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Grades = lazy(() => import('./pages/Grades'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Announcements = lazy(() => import('./pages/Announcements'));
const AcademicReports = lazy(() => import('./pages/AcademicReports'));
const ActivityReports = lazy(() => import('./pages/ActivityReports'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const Finance = lazy(() => import('./pages/Finance'));
const AcademicMaster = lazy(() => import('./pages/AcademicMaster'));
const Materials = lazy(() => import('./pages/Materials'));
const Profile = lazy(() => import('./pages/Profile'));
const TrainerReports = lazy(() => import('./pages/TrainerReports'));
const StudentDailyReportEntry = lazy(() => import('./pages/StudentDailyReportEntry'));
const DailyStudentLogs = lazy(() => import('./pages/DailyStudentLogs'));
const Inventory = lazy(() => import('./pages/Inventory'));
const AcademicSummaryReport = lazy(() => import('./pages/AcademicSummaryReport'));
const MonthlyFeeTracker = lazy(() => import('./pages/MonthlyFeeTracker'));
const AttendanceSummary = lazy(() => import('./pages/AttendanceSummary'));
const NotFound = lazy(() => import('./pages/NotFound'));

function ProtectedRoute({ children, allowedRoles }) {
    const { user, loading } = useAuth();

    if (loading) return <SplashLoader />;

    if (!user) return <Navigate to="/login" />;

    const userRole = (user?.role ? String(user.role) : '').toLowerCase().trim();

    if (allowedRoles && !allowedRoles.map(r => String(r).toLowerCase().trim()).includes(userRole)) {
        return <Navigate to="/dashboard" />;
    }

    return children;
}

function SemiProtectedRoute({ children }) {
    const token = localStorage.getItem('token');
    if (!token) return <Navigate to="/login" />;
    return children;
}

function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <ErrorBoundary>
                    <BrowserRouter>
                        <PWAInstallPrompt />
                        <Suspense fallback={<SplashLoader />}>
                            <Routes>
                                <Route path="/login" element={<Login />} />
                                <Route path="/change-password" element={<SemiProtectedRoute><ChangePassword /></SemiProtectedRoute>} />
                                <Route path="/reset-password" element={<ResetPassword />} />

                                <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
                                <Route path="/students" element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'teacher']}><Layout><Students /></Layout></ProtectedRoute>} />
                                <Route path="/faculty" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><Layout><Faculty /></Layout></ProtectedRoute>} />
                                <Route path="/courses" element={<ProtectedRoute allowedRoles={['admin', 'teacher', 'student', 'superadmin']}><Layout><Courses /></Layout></ProtectedRoute>} />
                                <Route path="/attendance" element={<ProtectedRoute allowedRoles={['admin', 'teacher', 'student', 'superadmin']}><Layout><Attendance /></Layout></ProtectedRoute>} />
                                <Route path="/grades" element={<ProtectedRoute allowedRoles={['admin', 'teacher', 'student', 'superadmin']}><Layout><Grades /></Layout></ProtectedRoute>} />
                                <Route path="/schedule" element={<ProtectedRoute allowedRoles={['admin', 'teacher', 'student', 'superadmin']}><Layout><Schedule /></Layout></ProtectedRoute>} />
                                <Route path="/announcements" element={<ProtectedRoute allowedRoles={['admin', 'teacher', 'student', 'superadmin']}><Layout><Announcements /></Layout></ProtectedRoute>} />

                                <Route path="/settings" element={<ProtectedRoute allowedRoles={['superadmin', 'admin']}><Settings /></ProtectedRoute>} />
                                <Route path="/users" element={<ProtectedRoute allowedRoles={['superadmin']}><Layout><Users /></Layout></ProtectedRoute>} />
                                <Route path="/profile" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />
                                <Route path="/reports" element={<ProtectedRoute allowedRoles={['teacher', 'admin', 'superadmin']}><Layout><AcademicReports /></Layout></ProtectedRoute>} />
                                <Route path="/academic-master" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><Layout><AcademicMaster /></Layout></ProtectedRoute>} />
                                <Route path="/finance" element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'student']}><Layout><Finance /></Layout></ProtectedRoute>} />
                                <Route path="/monthly-fee-tracker" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><Layout><MonthlyFeeTracker /></Layout></ProtectedRoute>} />
                                <Route path="/inventory" element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'teacher']}><Layout><Inventory /></Layout></ProtectedRoute>} />
                                <Route path="/materials" element={<ProtectedRoute allowedRoles={['admin', 'teacher', 'student', 'superadmin']}><Layout><Materials /></Layout></ProtectedRoute>} />
                                <Route path="/activity-reports" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><Layout><ActivityReports /></Layout></ProtectedRoute>} />
                                <Route path="/daily-student-logs" element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'teacher', 'student']}><Layout><DailyStudentLogs /></Layout></ProtectedRoute>} />

                                <Route path="/audit-logs" element={<ProtectedRoute allowedRoles={['superadmin']}><Layout><AuditLogs /></Layout></ProtectedRoute>} />
                                <Route path="/trainer-reports" element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'teacher']}><Layout><TrainerReports /></Layout></ProtectedRoute>} />
                                <Route path="/student-daily-reports" element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'teacher']}><Layout><StudentDailyReportEntry /></Layout></ProtectedRoute>} />
                                <Route path="/academic-summary" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><Layout><AcademicSummaryReport /></Layout></ProtectedRoute>} />
                                <Route path="/attendance-summary" element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'teacher']}><Layout><AttendanceSummary /></Layout></ProtectedRoute>} />

                                <Route path="/" element={<Navigate to="/login" />} />
                                <Route path="*" element={<NotFound />} />
                            </Routes>
                        </Suspense>
                    </BrowserRouter>
                </ErrorBoundary>
            </AuthProvider>
        </ThemeProvider>
    );
}

export default App;
