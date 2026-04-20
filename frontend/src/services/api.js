import axios from 'axios';

// Remove trailing slash to prevent double-slash in URLs
const rawUrl = import.meta.env.VITE_API_URL || 'https://beautex-technical-college.vercel.app/api';
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
    // Lightweight heartbeat — just triggers the auth middleware which updates last_seen_at
    ping: () => api.get('auth/me'),
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
    // FIX: Added studentId param so students can fetch only their own records server-side
    getAll: (course, date, studentId) => api.get('attendance', { params: { course, date, student_id: studentId } }),
    mark: (data) => api.post('attendance', data),
    update: (id, data) => api.put(`attendance/${encodeURIComponent(id)}`, data),
};

// Grades
export const gradesAPI = {
    getAll: (course) => api.get('grades', { params: { course } }),
    getBatchStudents: (course) => api.get('grades/batch-students', { params: { course } }),
    createBatch: (data) => api.post('grades/batch', data),
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
    updateFinancePermission: (id, can_edit_finance) => api.put(`users/${encodeURIComponent(id)}/finance-permission`, { can_edit_finance }),
    updateStudentPermission: (id, can_edit_students) => api.put(`users/${encodeURIComponent(id)}/student-permission`, { can_edit_students }),
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
    getById: (id, type) => {
        if (type === 'daily') return api.get(`activity-reports/daily/id/${id}`);
        return api.get(`activity-reports/${type}/${id}`);
    },
    getAutoCapture: (params) => api.get('activity-reports/auto-capture', { params }),
};


// Finance
export const financeAPI = {
    getFeeStructures: () => api.get('finance/fees'),
    updateFeeStructure: (id, data) => api.put(`finance/fees/${encodeURIComponent(id)}`, data),
    deleteFeeStructure: (id) => api.delete(`finance/fees/${encodeURIComponent(id)}`),
    getStudentFees: (studentId) => api.get(`finance/student-fees/${encodeURIComponent(studentId)}`),
    getAllStudentFees: () => api.get('finance/student-fees'),
    updateStudentFee: (id, data) => api.put(`finance/student-fees/${encodeURIComponent(id)}`, data),
    getPayments: (studentId) => api.get('finance/payments', { params: studentId ? { studentId } : {} }),
    recordPayment: (data) => api.post('finance/payments', data),
    updatePayment: (id, data) => api.put(`finance/payments/${encodeURIComponent(id)}`, data),
    deletePayment: (id) => api.delete(`finance/payments/${encodeURIComponent(id)}`),
    getAnalytics: () => api.get('finance/analytics'),
    syncLedger: () => api.post('finance/sync'),
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
    // FIX: Downloads via the streaming endpoint instead of a raw base64 data URI.
    // This ensures proper filename and Content-Type headers are sent by the server.
    download: (id, fileName) => api.get(`materials/${encodeURIComponent(id)}/download`, { responseType: 'blob' })
        .then(res => {
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName || 'download';
            a.click();
            URL.revokeObjectURL(url);
        }),
    // Returns the full download URL (optionally with auth token as query param for <a> hrefs)
    getDownloadUrl: (id) => `${API_BASE_URL}materials/${encodeURIComponent(id)}/download`,
};

// Academic Master
export const academicAPI = {
    getDepartments: () => api.get('academic/departments'),
    createDepartment: (data) => api.post('academic/departments', data),
    updateDepartment: (id, data) => api.put(`academic/departments/${id}`, data),
    deleteDepartment: (id) => api.delete(`academic/departments/${id}`),
    getPeriods: () => api.get('academic/periods'),
    createPeriod: (data) => api.post('academic/periods', data),
    activatePeriod: (id) => api.put(`academic/periods/${id}/activate`),
    deletePeriod: (id) => api.delete(`academic/periods/${id}`),
    promoteStudents: (data) => api.post('academic/promote', data),
};

// Settings
export const settingsAPI = {
    get: () => api.get('settings'),
    update: (data) => api.put('settings', data),
    downloadBackup: () => api.get('settings/backup', { responseType: 'blob' }),
};

// Interactions
export const interactionAPI = {
    get: (type, id) => api.get('interactions', { params: { entity_type: type, entity_id: id } }),
    create: (data) => api.post('interactions', data),
    react: (id, emoji) => api.post(`interactions/${id}/react`, { emoji }),
    delete: (id) => api.delete(`interactions/${id}`),
};

// Trainer Reports
export const trainerReportsAPI = {
    getAll: () => api.get('trainer-reports'),
    create: (data) => api.post('trainer-reports', data),
    delete: (id) => api.delete(`trainer-reports/${id}`),
};

// Student Daily Progress Reports
export const studentDailyReportsAPI = {
    getAll: (params) => api.get('student-daily-reports', { params }),
    create: (data) => api.post('student-daily-reports', data),
    addStudentComment: (id, data) => api.patch(`student-daily-reports/${id}/student-comment`, data),
    delete: (id) => api.delete(`student-daily-reports/${id}`),
};

// Inventory Management
export const inventoryAPI = {
    getDashboard: () => api.get('inventory/dashboard'),
    // Categories
    getCategories: () => api.get('inventory/categories'),
    createCategory: (data) => api.post('inventory/categories', data),
    updateCategory: (id, data) => api.put(`inventory/categories/${id}`, data),
    deleteCategory: (id) => api.delete(`inventory/categories/${id}`),
    // Locations
    getLocations: () => api.get('inventory/locations'),
    createLocation: (data) => api.post('inventory/locations', data),
    deleteLocation: (id) => api.delete(`inventory/locations/${id}`),
    // Items
    getItems: (params) => api.get('inventory/items', { params }),
    getItem: (id) => api.get(`inventory/items/${id}`),
    createItem: (data) => api.post('inventory/items', data),
    updateItem: (id, data) => api.put(`inventory/items/${id}`, data),
    deleteItem: (id) => api.delete(`inventory/items/${id}`),
    // Suppliers
    getSuppliers: () => api.get('inventory/suppliers'),
    createSupplier: (data) => api.post('inventory/suppliers', data),
    updateSupplier: (id, data) => api.put(`inventory/suppliers/${id}`, data),
    deleteSupplier: (id) => api.delete(`inventory/suppliers/${id}`),
    // Stock In/Out
    getStockIn: () => api.get('inventory/stock-in'),
    createStockIn: (data) => api.post('inventory/stock-in', data),
    getStockOut: () => api.get('inventory/stock-out'),
    createStockOut: (data) => api.post('inventory/stock-out', data),
    // Department Requests
    getRequests: (params) => api.get('inventory/requests', { params }),
    createRequest: (data) => api.post('inventory/requests', data),
    updateRequest: (id, data) => api.put(`inventory/requests/${id}`, data),
    deleteRequest: (id) => api.delete(`inventory/requests/${id}`),
    // Purchase Requests
    getPurchases: () => api.get('inventory/purchases'),
    createPurchase: (data) => api.post('inventory/purchases', data),
    updatePurchase: (id, data) => api.put(`inventory/purchases/${id}`, data),
    deletePurchase: (id) => api.delete(`inventory/purchases/${id}`),
    // Procurement Wishlist
    getWishlist: (params) => api.get('inventory/wishlist', { params }),
    createWishlist: (data) => api.post('inventory/wishlist', data),
    updateWishlist: (id, data) => api.put(`inventory/wishlist/${id}`, data),
    deleteWishlist: (id) => api.delete(`inventory/wishlist/${id}`),
    // Assets
    getAssets: () => api.get('inventory/assets'),
    createAsset: (data) => api.post('inventory/assets', data),
    updateAsset: (id, data) => api.put(`inventory/assets/${id}`, data),
    deleteAsset: (id) => api.delete(`inventory/assets/${id}`),
    // Damage Logs
    getDamageLogs: () => api.get('inventory/damage-logs'),
    createDamageLog: (data) => api.post('inventory/damage-logs', data),
    // Reports
    getReport: (type) => api.get(`inventory/reports/${type}`),
};

export default api;

