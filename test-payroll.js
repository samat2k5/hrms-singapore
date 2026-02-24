const http = require('http');

const loginData = JSON.stringify({
    username: 'admin',
    password: 'admin123'
});

const req = http.request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': loginData.length
    }
}, (res) => {
    let raw = '';
    res.on('data', (c) => raw += c);
    res.on('end', () => {
        const body = JSON.parse(raw);
        console.log('Login token length:', body.token.length);

        const runData = JSON.stringify({
            year: 2026,
            month: 2,
            employee_group: 'Executive'
        });

        const runReq = http.request({
            hostname: 'localhost',
            port: 5000,
            path: '/api/payroll/run',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': runData.length,
                'Authorization': `Bearer ${body.token}`,
                'entity-id': '1'
            }
        }, (res2) => {
            let res2raw = '';
            res2.on('data', (c) => res2raw += c);
            res2.on('end', () => {
                console.log('Payroll Run Response Status:', res2.statusCode);
                console.log('Payroll Run Response Body:', res2raw);
            });
        });
        runReq.write(runData);
        runReq.end();
    });
});

req.write(loginData);
req.end();
