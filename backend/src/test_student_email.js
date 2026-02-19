import 'dotenv/config';
import axios from 'axios';

async function testStudentRegistration() {
    const API_URL = 'http://localhost:5001/api';
    const testStudent = {
        id: `TEST-${Date.now().toString().slice(-4)}`,
        name: 'Test Student',
        email: 'test.student@example.com',
        course: 'Computer Packages',
        semester: '1st Semester',
        status: 'Active',
        contact: '0000000000'
    };

    try {
        console.log('🔑 Logging in as admin...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: 'admin@beautex.edu',
            password: 'admin123'
        });
        const token = loginRes.data.token;
        console.log('✅ Admin logged in.');

        console.log(`🚀 Attempting to create student: ${testStudent.name} (${testStudent.email})`);
        const response = await axios.post(`${API_URL}/students`, testStudent, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✅ Student created successfully:', response.data);
        console.log('Check backend logs for "✅ User account created and email sent for student"');
    } catch (error) {
        console.error('❌ Failed:', error.response?.data || error.message);
    }
}

testStudentRegistration();
