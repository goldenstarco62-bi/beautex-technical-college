
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createFaculty } from './backend/src/controllers/facultyController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, 'backend/.env') });

async function testLogic() {
    console.log('🧪 Testing Faculty Registration Logic directly...');

    // Mock Request and Response
    const req = {
        body: {
            id: `TEST-LOGIC-${Date.now().toString().slice(-4)}`,
            name: 'Direct Logic Test',
            email: `logic_test_${Date.now()}@example.com`,
            department: 'Catering',
            position: 'Head Chef',
            specialization: 'French Cuisine',
            contact: '+254 999 999 999',
            courses: ['Advanced Baking'],
            status: 'Active'
        }
    };

    const res = {
        status: (code) => {
            console.log(`📡 Response Status: ${code}`);
            return res;
        },
        json: (data) => {
            console.log('📡 Response JSON:', JSON.stringify(data, null, 2));
            return res;
        }
    };

    try {
        await createFaculty(req, res);
        console.log('\n✅ Logic execution finished.');
        console.log('ℹ️ Check logs above for user account creation and email status.');
    } catch (error) {
        console.error('❌ Logic Test Failed:', error);
    }
}

testLogic();
