import axios from 'axios';

const BASE_URL = 'http://localhost:5001/api';

async function testStudentLogin() {
    try {
        console.log('📡 Testing student login...');
        const response = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'student1@beautex.edu',
            password: 'admin123'
        });
        console.log('✅ Success:', response.data.user);
    } catch (error) {
        console.log('❌ Failed:', error.response?.status, error.response?.data);
    }
}

testStudentLogin();
