import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { settingsAPI } from './services/api';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/layout/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import SplashLoader from './components/shared/SplashLoader';
import PWAInstallPrompt from './components/PWAInstallPrompt';

// Helper to safely import lazy components and recover from chunk loading errors (e.g. after production deployments)
const safeLazy = (importFn) => lazy(async () => {
    try {
        const component = await importFn();
        sessionStorage.removeItem('chunk_reload_attempt');
        return component;
    } catch (error) {
        const errorMsg = error?.message || '';
        const isChunkError = error?.name === 'ChunkLoadError' || 
            errorMsg.includes('Failed to fetch dynamically imported module') ||
            errorMsg.includes('Importing a module script failed') ||
            errorMsg.includes('Loading chunk');
        
        const hasReloaded = sessionStorage.getItem('chunk_reload_attempt');
        if (isChunkError && !hasReloaded) {
            sessionStorage.setItem('chunk_reload_attempt', 'true');
            window.location.reload();
        }
        throw error;
    }
});

// Safe lazy load page components for code splitting & faster bundle loading
const Login = safeLazy(() => import('./pages/Login'));
const ResetPassword = safeLazy(() => import('./pages/ResetPassword'));
const ChangePassword = safeLazy(() => import('./pages/ChangePassword'));
const Dashboard = safeLazy(() => import('./pages/Dashboard'));
const Students = safeLazy(() => import('./pages/Students'));
const Faculty = safeLazy(() => import('./pages/Faculty'));
const Courses = safeLazy(() => import('./pages/Courses'));
const Settings = safeLazy(() => import('./pages/Settings'));
const Users = safeLazy(() => import('./pages/Users'));
const Attendance = safeLazy(() => import('./pages/Attendance'));
const UnitsCovered = safeLazy(() => import('./pages/UnitsCovered'));
const UnitCoverage = safeLazy(() => import('./pages/UnitCoverage'));
const Results = safeLazy(() => import('./pages/Results'));
const AcademicsHub = safeLazy(() => import('./pages/AcademicsHub'));
const Schedule = safeLazy(() => import('./pages/Schedule'));
const Announcements = safeLazy(() => import('./pages/Announcements'));
const AcademicReports = safeLazy(() => import('./pages/AcademicReports'));
const ActivityReports = safeLazy(() => import('./pages/ActivityReports'));
const AuditLogs = safeLazy(() => import('./pages/AuditLogs'));
const Finance = safeLazy(() => import('./pages/Finance'));
const AcademicMaster = safeLazy(() => import('./pages/AcademicMaster'));
const Materials = safeLazy(() => import('./pages/Materials'));
const Profile = safeLazy(() => import('./pages/Profile'));
const TrainerReports = safeLazy(() => import('./pages/TrainerReports'));
const StudentDailyReportEntry = safeLazy(() => import('./pages/StudentDailyReportEntry'));
const DailyStudentLogs = safeLazy(() => import('./pages/DailyStudentLogs'));
const Inventory = safeLazy(() => import('./pages/Inventory'));
const AcademicSummaryReport = safeLazy(() => import('./pages/AcademicSummaryReport'));
const MonthlyFeeTracker = safeLazy(() => import('./pages/MonthlyFeeTracker'));
const AttendanceSummary = safeLazy(() => import('./pages/AttendanceSummary'));
const MonthlyAttendanceSummary = safeLazy(() => import('./pages/MonthlyAttendanceSummary'));
const NotFound = safeLazy(() => import('./pages/NotFound'));


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
    useEffect(() => {
        // Apply cached colors immediately on load for optimal rendering speed
        const cachedPrimary = localStorage.getItem('portal_theme_primary');
        const cachedSidebar = localStorage.getItem('portal_theme_sidebar');

        if (cachedPrimary) {
            document.documentElement.style.setProperty('--primary', cachedPrimary);
            document.documentElement.style.setProperty('--portal-theme', cachedPrimary);
            document.documentElement.style.setProperty('--primary-dark', cachedPrimary);
        }
        if (cachedSidebar) {
            document.documentElement.style.setProperty('--sidebar-bg', cachedSidebar);
        }

        // Fetch latest settings in background and update cache
        settingsAPI.get().then(res => {
            if (res.data) {
                const primary = res.data.portal_theme_colors || '#800000';
                const sidebar = res.data.sidebar_colors || '#7a0000';
                
                document.documentElement.style.setProperty('--primary', primary);
                document.documentElement.style.setProperty('--portal-theme', primary);
                document.documentElement.style.setProperty('--sidebar-bg', sidebar);
                document.documentElement.style.setProperty('--primary-dark', primary);

                localStorage.setItem('portal_theme_primary', primary);
                localStorage.setItem('portal_theme_sidebar', sidebar);
            }
        }).catch(() => {});
    }, []);

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
                                <Route path="/academics" element={<ProtectedRoute><Layout><AcademicsHub /></Layout></ProtectedRoute>} />
                                <Route path="/attendance" element={<ProtectedRoute allowedRoles={['admin', 'teacher', 'student', 'superadmin']}><Layout><Attendance /></Layout></ProtectedRoute>} />
                                <Route path="/grades" element={<ProtectedRoute allowedRoles={['admin', 'teacher', 'student', 'superadmin']}><Layout><UnitsCovered /></Layout></ProtectedRoute>} />
                                <Route path="/unit-coverage" element={<ProtectedRoute allowedRoles={['admin', 'teacher', 'student', 'superadmin']}><Layout><UnitCoverage /></Layout></ProtectedRoute>} />
                                <Route path="/results" element={<ProtectedRoute allowedRoles={['admin', 'teacher', 'student', 'superadmin']}><Layout><Results /></Layout></ProtectedRoute>} />
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
                                <Route path="/monthly-attendance" element={<ProtectedRoute><Layout><MonthlyAttendanceSummary /></Layout></ProtectedRoute>} />

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
