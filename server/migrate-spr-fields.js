const initSQL = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'db', 'hrms.sqlite');

async function migrate() {
    console.log('Starting SPR CPF fields migration...');
    const SQL = await initSQL();
    if (!fs.existsSync(DB_PATH)) {
        console.log('Database file not found at', DB_PATH, '- skipping migration.');
        return;
    }

    const fileBuffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(fileBuffer);

    try {
        db.run("ALTER TABLE employees ADD COLUMN pr_status_start_date DATE");
        console.log('Added pr_status_start_date column.');
    } catch (e) {
        console.log('pr_status_start_date column might already exist.');
    }

    try {
        db.run("ALTER TABLE employees ADD COLUMN cpf_full_rate_agreed BOOLEAN DEFAULT 0");
        console.log('Added cpf_full_rate_agreed column.');
    } catch (e) {
        console.log('cpf_full_rate_agreed column might already exist.');
    }

    try {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
        console.log('Migration successful.');
    } catch (err) {
        console.error('Migration failed:', err.message);
    }
}

migrate();
