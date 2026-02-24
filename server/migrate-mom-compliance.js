const { getDb, saveDb } = require('./db/init');

async function migrate() {
    const db = await getDb();
    console.log('Running MOM Compliance Migration...');

    try {
        // Add working_hours_per_day to employees
        db.run('ALTER TABLE employees ADD COLUMN working_hours_per_day REAL DEFAULT 8');
        console.log('Added working_hours_per_day to employees');
    } catch (e) { console.log('working_hours_per_day column might exist'); }

    saveDb();
    console.log('Migration complete.');
}

migrate();
