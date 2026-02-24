const fs = require('fs');
const initSQL = require('sql.js');

const DB_PATH = './hrms.sqlite';

async function migrate() {
    if (!fs.existsSync(DB_PATH)) {
        console.error('Database file not found at', DB_PATH);
        process.exit(1);
    }

    const SQL = await initSQL();
    const buffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(buffer);

    try {
        console.log('Adding contact info columns to employees table...');

        // Add mobile_number
        try {
            db.run('ALTER TABLE employees ADD COLUMN mobile_number TEXT');
            console.log('Added mobile_number column.');
        } catch (e) {
            if (e.message.includes('duplicate column name')) {
                console.log('Column mobile_number already exists.');
            } else {
                throw e;
            }
        }

        // Add whatsapp_number
        try {
            db.run('ALTER TABLE employees ADD COLUMN whatsapp_number TEXT');
            console.log('Added whatsapp_number column.');
        } catch (e) {
            if (e.message.includes('duplicate column name')) {
                console.log('Column whatsapp_number already exists.');
            } else {
                throw e;
            }
        }

        // Add email
        try {
            db.run('ALTER TABLE employees ADD COLUMN email TEXT');
            console.log('Added email column.');
        } catch (e) {
            if (e.message.includes('duplicate column name')) {
                console.log('Column email already exists.');
            } else {
                throw e;
            }
        }

        const data = db.export();
        const outBuffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, outBuffer);

        console.log('✅ Migration complete! Database saved.');

    } catch (err) {
        console.error('Migration failed:', err);
    }
}

migrate();
