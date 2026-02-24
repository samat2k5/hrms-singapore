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
        console.log('Adding highest_education column to employees table...');

        try {
            db.run('ALTER TABLE employees ADD COLUMN highest_education TEXT');
            console.log('Added highest_education column.');
        } catch (e) {
            if (e.message.includes('duplicate column name')) {
                console.log('Column highest_education already exists.');
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
