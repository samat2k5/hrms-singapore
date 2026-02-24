const http = require('http');

async function testLogin(username, password) {
    return new Promise((resolve) => {
        const data = JSON.stringify({ username, password });
        const req = http.request({
            hostname: 'localhost',
            port: 5000,
            path: '/api/auth/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        }, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                resolve({ status: res.statusCode, body });
            });
        });
        req.on('error', (e) => resolve({ error: e.message }));
        req.write(data);
        req.end();
    });
}

async function run() {
    console.log('Testing Admin Login...');
    const oldRes = await testLogin('admin', 'admin123');
    console.log('Admin Result:', oldRes);

    console.log('\nTesting System Login...');
    const newRes = await testLogin('system', 'manager');
    console.log('System Result:', newRes);
}

run();
