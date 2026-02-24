const initSQL = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'db', 'hrms.sqlite');

async function migrate() {
    console.log('Starting Work-Week Fields migration...');
    const SQL = await initSQL();
    if (!fs.existsSync(DB_PATH)) {
        console.log('Database file not found.');
        return;
    }

    const fileBuffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(fileBuffer);

    try {
        db.run("ALTER TABLE employees ADD COLUMN working_days_per_week REAL DEFAULT 5");
        console.log('Added working_days_per_week.');
    } catch (e) {
        console.log('working_days_per_week already exists or error:', e.message);
    }

    try {
        db.run("ALTER TABLE employees ADD COLUMN rest_day TEXT DEFAULT 'Sunday'");
        console.log('Added rest_day.');
    } catch (e) {
        console.log('rest_day already exists or error:', e.message);
    }

    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
    console.log('Migration successful.');
}

migrate();
