
import http from 'http';

const login = (email, password, role) => {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ email, password });
        const options = {
            hostname: 'localhost',
            port: 5001,
            path: '/api/auth/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(`✅ ${role} (${email}): Success!`);
                } else {
                    resolve(`❌ ${role} (${email}): Failed (${res.statusCode}) - ${data}`);
                }
            });
        });

        req.on('error', (e) => resolve(`❌ ${role} (${email}): Network Error`));
        req.write(postData);
        req.end();
    });
};

async function runTests() {
    console.log('--- FINAL PASSWORD VERIFICATION ---');
    console.log('Testing passwords set by fix_passwords.js:');
    const results = await Promise.all([
        login('superadmin@beautex.edu', 'admin123', 'Superadmin'),
        login('admin@beautex.edu', 'admin123', 'Admin'),
        login('james.wilson@beautex.edu', 'admin123', 'Teacher'),
        login('student1@beautex.edu', 'admin123', 'Student')
    ]);
    results.forEach(r => console.log(r));
    console.log('-----------------------------------');
}

runTests();
