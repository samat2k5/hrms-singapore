const initSQL = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'db', 'hrms.sqlite');

async function verify() {
    console.log('--- VERIFYING NATIONALITY MIGRATION ---');
    const SQL = await initSQL();
    if (!fs.existsSync(DB_PATH)) {
        console.log('Database file not found.');
        return;
    }

    const fileBuffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(fileBuffer);

    try {
        const results = db.exec("SELECT DISTINCT nationality FROM employees");
        if (results.length > 0) {
            console.log('Current nationalities in DB:', results[0].values.map(v => v[0]));
        } else {
            console.log('No employees found.');
        }

        const citizenCount = db.exec("SELECT COUNT(*) FROM employees WHERE nationality = 'Singapore Citizen'");
        const sprCount = db.exec("SELECT COUNT(*) FROM employees WHERE nationality = 'SPR'");
        const oldCitizenCount = db.exec("SELECT COUNT(*) FROM employees WHERE nationality = 'Citizen'");
        const oldPRCount = db.exec("SELECT COUNT(*) FROM employees WHERE nationality = 'PR'");

        console.log('Singapore Citizen count:', citizenCount[0].values[0][0]);
        console.log('SPR count:', sprCount[0].values[0][0]);
        console.log('Old "Citizen" count:', oldCitizenCount[0].values[0][0]);
        console.log('Old "PR" count:', oldPRCount[0].values[0][0]);

    } catch (e) {
        console.error('Verification error:', e.message);
    }
}

verify();
