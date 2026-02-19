
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, 'backend/.env') });

const API_URL = 'http://localhost:5001/api'; // Local backend

async function verifyFix() {
    console.log('🧪 Verifying Faculty Registration Fix...');

    const testFaculty = {
        id: `TEST-FAC-${Date.now().toString().slice(-4)}`,
        name: 'Test Faculty Fix',
        email: `fix_test_${Date.now()}@example.com`,
        department: 'Technology',
        position: 'Senior Fix Specialist',
        specialization: 'Debugging',
        contact: '+254 000 000 000',
        courses: JSON.stringify(['Test Course']),
        status: 'Active'
    };

    try {
        console.log(`📤 Registering faculty: ${testFaculty.email}`);
        const response = await axios.post(`${API_URL}/faculty`, testFaculty);

        if (response.status === 201) {
            console.log('✅ Faculty record created successfully in database!');
            console.log('--- Response Data ---');
            console.log(JSON.stringify(response.data, null, 2));

            console.log('\nℹ️ Please check the backend terminal for "Email sent" logs.');
            console.log('ℹ️ You can also run "node check_registrations.js" to see the new records.');
        }
    } catch (error) {
        console.error('❌ Registration failed:', error.response?.data?.error || error.message);
        if (error.response?.data) {
            console.error('Full error response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

verifyFix();
