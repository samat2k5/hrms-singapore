const fs = require('fs');

async function runTest() {
    try {
        console.log("Logging in...");
        const loginRes = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'system', password: 'password123' })
        });
        const loginData = await loginRes.json();

        if (!loginData.token) {
            console.error("Login failed:", loginData);
            return;
        }

        const token = loginData.token;
        const entityId = loginData.user.entities[0].id;
        console.log("Got token. Entity ID:", entityId);

        console.log("Building FormData...");
        const formData = new FormData();
        const fileBuffer = fs.readFileSync('test_batch_1.xlsx');
        const blob = new Blob([fileBuffer]);
        formData.append('files', blob, 'test_batch_1.xlsx');
        formData.append('dryRun', 'true');

        console.log("Sending POST /api/attendance/import...");
        const res = await fetch('http://localhost:5000/api/attendance/import', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Entity-Id': String(entityId)
            },
            body: formData
        });

        console.log("Status:", res.status);
        console.log("Content-Type:", res.headers.get('content-type'));

        const text = await res.text();
        console.log("Body length:", text.length);
        console.log("Body preview:");
        console.log(text.substring(0, 500));

    } catch (e) {
        console.error("Error:", e);
    }
}

runTest();
