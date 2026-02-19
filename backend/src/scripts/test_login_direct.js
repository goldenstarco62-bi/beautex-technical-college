import http from 'http';

const data = JSON.stringify({
    email: 'student1@beautex.edu',
    password: 'admin123'
});

const options = {
    hostname: 'localhost',
    port: 5001,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
};

const req = http.request(options, (res) => {
    let body = '';
    console.log('Status:', res.statusCode);
    res.on('data', (d) => body += d);
    res.on('end', () => {
        console.log('Body:', body);
    });
});

req.on('error', (e) => {
    console.error(e);
});

req.write(data);
req.end();
