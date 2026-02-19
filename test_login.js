const http = require('http');

function login(email, password, role) {
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

    console.log(`Testing login for ${role} (${email})...`);

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            if (res.statusCode === 200) {
                try {
                    const jsonData = JSON.parse(data);
                    console.log(`✅ Success! Token received.`);
                    console.log(`   User: ${jsonData.user.email} (${jsonData.user.role})`);
                } catch (e) {
                    console.log(`✅ Success (Status 200), but JSON parse failed.`);
                }
            } else {
                console.log(`❌ Failed: ${res.statusCode} - ${data}`);
            }
            console.log('---');
        });
    });

    req.on('error', (e) => {
        console.error(`❌ Network Error: ${e.message}`);
        console.log('---');
    });

    req.write(postData);
    req.end();
}

// Run tests
// Run tests
setTimeout(() => login('superadmin@beautex.edu', 'superadmin123', 'Superadmin'), 500);
setTimeout(() => login('admin@beautex.edu', 'admin123', 'Admin'), 1500);
setTimeout(() => login('james.wilson@beautex.edu', 'password123', 'Teacher'), 2500);
setTimeout(() => login('sarah.johnson@beautex.edu', 'password123', 'Student'), 3500);
