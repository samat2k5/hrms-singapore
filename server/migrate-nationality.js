const initSQL = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'db', 'hrms.sqlite');

async function migrate() {
    console.log('Starting Nationality renaming migration...');
    const SQL = await initSQL();
    if (!fs.existsSync(DB_PATH)) {
        console.log('Database file not found at', DB_PATH, '- skipping migration.');
        return;
    }

    const fileBuffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(fileBuffer);

    try {
        db.run("UPDATE employees SET nationality = 'Singapore Citizen' WHERE nationality = 'Citizen'");
        console.log('Updated "Citizen" to "Singapore Citizen".');
    } catch (e) {
        console.error('Error updating Citizen:', e.message);
    }

    try {
        db.run("UPDATE employees SET nationality = 'SPR' WHERE nationality = 'PR'");
        console.log('Updated "PR" to "SPR".');
    } catch (e) {
        console.error('Error updating PR:', e.message);
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
