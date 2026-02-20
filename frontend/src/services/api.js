import axios from 'axios';

// Remove trailing slash to prevent double-slash in URLs
const rawUrl = import.meta.env.VITE_API_URL || 'https://beautexcollege-01.vercel.app/api';
const API_BASE_URL = rawUrl.replace(/\/+$/, '') + '/';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Auth
export const authAPI = {
    login: (email, password) => api.post('auth/login', { email, password }),
    register: (email, password, role) => api.post('auth/register', { email, password, role }),
    forgotPassword: (data) => api.post('auth/forgot-password', data),
    resetPassword: (data) => api.post('auth/reset-password', data),
    changePassword: (data) => api.post('auth/change-password', data),
    getMe: () => api.get('auth/me'),
};

// Profile
export const profileAPI = {
    get: () => api.get('profile'),
    update: (data) => api.put('profile', data),
};

// Students
export const studentsAPI = {
    getAll: () => api.get('students'),
    getById: (id) => api.get(`students/${encodeURIComponent(id)}`),
    create: (data) => api.post('students', data),
    update: (id, data) => api.put(`students/${encodeURIComponent(id)}`, data),
    delete: (id) => api.delete(`students/${encodeURIComponent(id)}`),
    search: (query) => api.get(`students/search?q=${query}`),
};

// Courses
export const coursesAPI = {
    getAll: () => api.get('courses'),
    getById: (id) => api.get(`courses/${encodeURIComponent(id)}`),
    create: (data) => api.post('courses', data),
    update: (id, data) => api.put(`courses/${encodeURIComponent(id)}`, data),
};

// Faculty
export const facultyAPI = {
    getAll: () => api.get('faculty'),
    getById: (id) => api.get(`faculty/${encodeURIComponent(id)}`),
    create: (data) => api.post('faculty', data),
    update: (id, data) => api.put(`faculty/${encodeURIComponent(id)}`, data),
    delete: (id) => api.delete(`faculty/${encodeURIComponent(id)}`),
};

// Attendance
export const attendanceAPI = {
    getAll: (course, date) => api.get('attendance', { params: { course, date } }),
    mark: (data) => api.post('attendance', data),
    update: (id, data) => api.put(`attendance/${encodeURIComponent(id)}`, data),
};

// Grades
export const gradesAPI = {
    getAll: (course) => api.get('grades', { params: { course } }),
    create: (data) => api.post('grades', data),
    update: (id, data) => api.put(`grades/${encodeURIComponent(id)}`, data),
    delete: (id) => api.delete(`grades/${encodeURIComponent(id)}`),
};

// Announcements
export const announcementsAPI = {
    getAll: (category, priority) => api.get('announcements', { params: { category, priority } }),
    create: (data) => api.post('announcements', data),
    update: (id, data) => api.put(`announcements/${encodeURIComponent(id)}`, data),
    delete: (id) => api.delete(`announcements/${encodeURIComponent(id)}`),
};

// Notifications
export const notificationsAPI = {
    getAll: () => api.get('notifications'),
    markRead: (id) => api.put(`notifications/${encodeURIComponent(id)}/read`),
};

// Sessions (Schedule)
export const sessionsAPI = {
    getAll: () => api.get('sessions'),
    create: (data) => api.post('sessions', data),
    delete: (id) => api.delete(`sessions/${encodeURIComponent(id)}`),
};

// Users (Superadmin Only)
export const usersAPI = {
    getAll: () => api.get('users'),
    updateRole: (id, role) => api.put(`users/${encodeURIComponent(id)}/role`, { role }),
    updateStatus: (id, status) => api.put(`users/${encodeURIComponent(id)}/status`, { status }),
    resetPassword: (id) => api.put(`users/${encodeURIComponent(id)}/password`),
    resetByEmail: (email) => api.post('users/reset-by-email', { email }),
    delete: (id) => api.delete(`users/${encodeURIComponent(id)}`),
};

// Academic Reports
export const reportsAPI = {
    getAll: (params) => api.get('reports', { params }),
    getStudentReports: (studentId) => api.get(`reports/student/${encodeURIComponent(studentId)}`),
    create: (data) => api.post('reports', data),
    update: (id, data) => api.put(`reports/${encodeURIComponent(id)}`, data),
    delete: (id) => api.delete(`reports/${encodeURIComponent(id)}`),
};

// Activity Reports (College-wide)
export const activityReportsAPI = {
    getDailyReports: (params) => api.get('activity-reports/daily', { params }),
    getDailyReport: (date) => api.get(`activity-reports/daily/${date}`),
    createDailyReport: (data) => api.post('activity-reports/daily', data),
    updateDailyReport: (id, data) => api.put(`activity-reports/daily/${id}`, data),
    deleteDailyReport: (id) => api.delete(`activity-reports/daily/${id}`),
    getWeeklyReports: (params) => api.get('activity-reports/weekly', { params }),
    getWeeklyReport: (id) => api.get(`activity-reports/weekly/${id}`),
    createWeeklyReport: (data) => api.post('activity-reports/weekly', data),
    updateWeeklyReport: (id, data) => api.put(`activity-reports/weekly/${id}`, data),
    deleteWeeklyReport: (id) => api.delete(`activity-reports/weekly/${id}`),
    getMonthlyReports: (params) => api.get('activity-reports/monthly', { params }),
    getMonthlyReport: (id) => api.get(`activity-reports/monthly/${id}`),
    createMonthlyReport: (data) => api.post('activity-reports/monthly', data),
    updateMonthlyReport: (id, data) => api.put(`activity-reports/monthly/${id}`, data),
    deleteMonthlyReport: (id) => api.delete(`activity-reports/monthly/${id}`),
    getSummary: () => api.get('activity-reports/summary'),
};


// Finance
export const financeAPI = {
    getFeeStructures: () => api.get('finance/fees'),
    getStudentFees: (studentId) => api.get(`finance/student-fees/${encodeURIComponent(studentId)}`),
    getAllStudentFees: () => api.get('finance/student-fees'),
    getPayments: (studentId) => api.get('finance/payments', { params: studentId ? { studentId } : {} }),
    recordPayment: (data) => api.post('finance/payments', data),
    getAnalytics: () => api.get('finance/analytics'),
    createFeeStructure: (data) => api.post('finance/fees', data),
};

// Materials
export const materialsAPI = {
    getAll: (courseId) => api.get('materials', { params: courseId ? { courseId } : {} }),
    upload: (data) => {
        // data = { course_id, title, description, file (File object) OR file_url (string) }
        if (data.file instanceof File) {
            const formData = new FormData();
            formData.append('course_id', data.course_id);
            formData.append('title', data.title);
            if (data.description) formData.append('description', data.description);
            formData.append('file', data.file);
            return api.post('materials', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
        }
        // URL-based fallback — send as regular JSON
        return api.post('materials', data);
    },
    delete: (id) => api.delete(`materials/${encodeURIComponent(id)}`),
};

// Academic Master
export const academicAPI = {
    getDepartments: () => api.get('academic/departments'),
    createDepartment: (data) => api.post('academic/departments', data),
    getPeriods: () => api.get('academic/periods'),
    createPeriod: (data) => api.post('academic/periods', data),
    activatePeriod: (id) => api.put(`academic/periods/${id}/activate`),
    promoteStudents: (data) => api.post('academic/promote', data),
};

// Settings
export const settingsAPI = {
    get: () => api.get('settings'),
    update: (data) => api.put('settings', data),
    downloadBackup: () => api.get('settings/backup', { responseType: 'blob' }),
};

export default api;

