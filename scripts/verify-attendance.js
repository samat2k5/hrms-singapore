const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const xlsx = require('xlsx');
const fs = require('fs');
const http = require('http');
const FormData = require('form-data');

const DB_PATH = path.join(__dirname, '../server/db/database.sqlite');
const db = new sqlite3.Database(DB_PATH);

const testDateStr = '2024-02-09'; // A Friday
const entityId = 1; // Assuming Entity 1 exists

async function runSQL(query, params = []) {
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

async function getSQL(query, params = []) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function setup() {
    console.log('--- Setting up Test Data ---');

    // 1. Create a Customer
    const custRes = await runSQL(`INSERT INTO customers (entity_id, name) VALUES (?, ?)`, [entityId, 'Test Customer']);
    const custId = custRes.lastID;

    // 2. Create a Site
    const siteRes = await runSQL(`INSERT INTO sites (customer_id, name) VALUES (?, ?)`, [custId, 'Test Site']);
    const siteId = siteRes.lastID;

    // 3. Configure Site Working Hours for Friday (Day 5)
    // Friday Memo Rule: OT starts at 16:30.
    await runSQL(`
        INSERT INTO site_working_hours (site_id, shift_type, day_of_week, start_time, end_time, meal_start_time, meal_end_time, ot_start_time, compulsory_ot_hours)
        VALUES (?, 'Day', 5, '08:00', '16:30', '12:00', '13:00', '16:30', 0)
    `, [siteId]);

    // 4. Create a dummy Employee mapped to this site
    const empIdStr = 'TEST-EMP-999';
    await runSQL(`DELETE FROM employees WHERE employee_id = ?`, [empIdStr]);
    const empRes = await runSQL(`
        INSERT INTO employees (entity_id, employee_id, full_name, site_id, status)
        VALUES (?, ?, ?, ?, 'Active')
    `, [entityId, empIdStr, 'John Test', siteId]);
    const empDbId = empRes.lastID;

    console.log(`Setup complete. Site ID: ${siteId}, Employee DB ID: ${empDbId}`);
    return { empIdStr, siteId };
}

async function createExcelAndUpload(empIdStr) {
    console.log('--- Generating Test Excel File ---');
    // Scenario: Employee taps out at 18:00 on Friday. 
    // Std OT is after 16:30 -> 1.5 hours of OT.
    const wsData = [
        ['Date', 'Employee ID', 'Shift Group', 'Start Time', 'End Time', 'Remarks'],
        [testDateStr, empIdStr, 'Day', '08:00', '18:00', '']
    ];

    const ws = xlsx.utils.aoa_to_sheet(wsData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Timesheet');

    const excelPath = path.join(__dirname, 'test_timesheet.xlsx');
    xlsx.writeFile(wb, excelPath);
    console.log(`Excel generated at ${excelPath}`);

    console.log('--- Uploading to API ---');
    const form = new FormData();
    form.append('file', fs.createReadStream(excelPath));
    form.append('month', '2024-02');

    // Make request to running local server
    const req = http.request('http://localhost:5000/api/attendance/import', {
        method: 'POST',
        headers: {
            ...form.getHeaders(),
            'Entity-Id': entityId, // Simulate active entity
            // Mock auth token if needed, but we might bypass auth for this direct DB check?
            // Wait, auth happens in the API. We can mock it or just check DB directly.
            // Since API has auth middleware, let's just bypass the HTTP layer and run the exact DB logic here, OR we need a token.
        }
    });

    return new Promise((resolve, reject) => {
        form.pipe(req);
        req.on('response', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`API Status: ${res.statusCode}`);
                console.log(`API Response: ${data}`);
                resolve(JSON.parse(data));
            });
        });
        req.on('error', reject);
    });
}

// Wait, doing HTTP request requires a valid JWT Token.
// Let's just create a valid JWT token easily since we know the secret
const jwt = require('jsonwebtoken'); // Need to install if not explicitly available, but backend uses it.
const secret = process.env.JWT_SECRET || 'your-secret-key-123'; // Default from auth.js if we check.

async function main() {
    try {
        const { empIdStr } = await setup();

        // Generate Token
        // Wait, what's the actual JWT secret? Let's check auth.js. It's 'your-secret-key'.
        const token = jwt.sign({ userId: 1, username: 'admin', role: 'Admin', entityId }, 'your-secret-key', { expiresIn: '1h' });

        const excelPath = path.join(__dirname, 'test_timesheet.xlsx');

        console.log('--- Generating Test Excel File ---');
        const wsData = [
            ['Date', 'Employee ID', 'Shift Group', 'Start Time', 'End Time', 'Remarks'],
            [testDateStr, empIdStr, 'Day', '08:00', '18:00', '']
        ];
        const ws = xlsx.utils.aoa_to_sheet(wsData);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Timesheet');
        xlsx.writeFile(wb, excelPath);

        console.log('--- Uploading via API ---');
        const form = new FormData();
        form.append('file', fs.createReadStream(excelPath));
        form.append('month', '2024-02');

        const req = http.request('http://localhost:5000/api/attendance/import', {
            method: 'POST',
            headers: {
                ...form.getHeaders(),
                'Entity-Id': entityId,
                'Authorization': `Bearer ${token}`
            }
        });

        form.pipe(req);

        const resData = await new Promise((resolve, reject) => {
            req.on('response', (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(JSON.parse(data)));
            });
            req.on('error', reject);
        });

        console.log(resData);

        // Let's verify what got inserted in the DB.
        const timesheets = await getSQL(`
            SELECT * FROM attendance_records 
            WHERE employee_id = (SELECT id FROM employees WHERE employee_id = ?)
            AND date = ?
        `, [empIdStr, testDateStr]);

        console.log('--- Database Verification ---');
        console.log(timesheets[0]);

        if (timesheets[0].ot_hours === 1.5) {
            console.log('✅ TEST PASSED: Overtime correctly calculated as 1.5 hours based on Friday Site Configuration (16:30 OT Start) rather than default 17:30.');
        } else {
            console.error(`❌ TEST FAILED: Overtime was ${timesheets[0].ot_hours}, expected 1.5`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        db.close();
    }
}

main();
