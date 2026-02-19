import axios from 'axios';

const BASE_URL = 'http://localhost:5001/api';

const testUsers = [
    { email: 'admin@beautex.edu', password: 'admin123', label: 'Admin' },
    { email: 'teacher1@beautex.edu', password: 'admin123', label: 'Teacher (Seeded)' },
    { email: 'james.wilson@beautex.edu', password: 'admin123', label: 'Teacher (Faculty)' },
    { email: 'student1@beautex.edu', password: 'admin123', label: 'Student (Seeded)' },
    { email: 'sarah.johnson@beautex.edu', password: 'admin123', label: 'Student (Profile)' }
];

async function runTests() {
    console.log('🧪 Starting Auth Diagnostics...\n');

    for (const user of testUsers) {
        try {
            console.log(`📡 testing ${user.label} (${user.email})...`);
            const response = await axios.post(`${BASE_URL}/auth/login`, {
                email: user.email,
                password: user.password
            });
            console.log(`✅ Success! Role: ${response.data.user.role}\n`);
        } catch (error) {
            if (error.response) {
                console.log(`❌ Failed: ${error.response.status} - ${JSON.stringify(error.response.data)}\n`);
            } else {
                console.log(`❌ Network Error/No Response: ${error.message}\n`);
            }
        }
    }
}

runTests();
