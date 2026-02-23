const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const { getDb, saveDb, toObjects } = require('./db/init');

const testDateStr = '2024-02-09'; // A Friday
const entityId = 1; // Assuming Entity 1 exists

async function runSQL(query, params = []) {
    const db = await getDb();
    db.run(query, params);
    saveDb();
    const res = db.exec("SELECT last_insert_rowid()");
    return { lastID: res[0].values[0][0] };
}

async function getSQL(query, params = []) {
    const db = await getDb();
    const res = db.exec(query, params);
    return res.length > 0 ? toObjects(res) : [];
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

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./middleware/auth');

async function main() {
    try {
        const { empIdStr } = await setup();

        const token = jwt.sign({ id: 1, username: 'admin', role: 'Admin', entityId }, JWT_SECRET, { expiresIn: '1h' });

        const excelPath = path.join(__dirname, 'test_timesheet.xlsx');

        console.log('--- Generating Test Excel File ---');
        const wsData = [
            [''], [''], [''], [''],
            ['', 'Day & Date : ', '09-02-2024(FRIDAY)'],
            [''],
            ['Emp.No', 'Full Name', 'In', 'Out', 'Shift (D/N)', 'Remarks (Piping)'],
            [empIdStr, 'John Test', '0800', '1829', 'Day', '']
        ];
        const ws = xlsx.utils.aoa_to_sheet(wsData);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Timesheet');
        xlsx.writeFile(wb, excelPath);

        console.log('--- Uploading via API utilizing native fetch ---');

        const fileBuffer = fs.readFileSync(excelPath);
        const blob = new Blob([fileBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const formData = new FormData();
        formData.append('file', blob, 'test_timesheet.xlsx');
        formData.append('month', '2024-02');

        const res = await fetch('http://localhost:5000/api/attendance/import', {
            method: 'POST',
            headers: {
                'Entity-Id': entityId.toString(),
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const resData = await res.json();
        console.log("API Response:", resData);

        const timesheets = await getSQL(`
            SELECT * FROM timesheets 
            WHERE employee_id = (SELECT id FROM employees WHERE employee_id = ?)
            AND date = ?
        `, [empIdStr, testDateStr]);

        console.log('--- Database Verification ---');
        console.log(timesheets[0]);

        if (timesheets[0] && timesheets[0].ot_hours === 1.75) {
            console.log('✅ TEST PASSED: Overtime correctly calculated as 1.75 hours (rounds 18:29 down to 18:15. Diff from 16:30 = 1h 45m).');
        } else {
            console.error(`❌ TEST FAILED: Overtime was ${timesheets[0] ? timesheets[0].ot_hours : 'undefined'}, expected 1.75`);
        }

    } catch (e) {
        console.error(e);
    }
}

main();
