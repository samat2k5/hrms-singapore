const { getDb, saveDb } = require('./db/init');

async function migrate() {
    const db = await getDb();
    console.log('Running MOM Rates Migration...');

    try {
        db.run('ALTER TABLE employees ADD COLUMN working_hours_per_week REAL DEFAULT 44');
        console.log('Added working_hours_per_week to employees');
    } catch (e) { console.log('working_hours_per_week column might exist'); }

    saveDb();
    console.log('Migration complete.');
}

migrate();
