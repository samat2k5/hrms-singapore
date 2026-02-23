const { getDb, saveDb } = require('./init');

async function migrate() {
    try {
        const db = await getDb();
        console.log('Running migration: Adding entity_id to payroll_runs');

        // Add entity_id column. Default to 1 (the first entity) so existing data doesn't break.
        db.run('ALTER TABLE payroll_runs ADD COLUMN entity_id INTEGER DEFAULT 1');

        saveDb();
        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        if (err.message.includes('duplicate column name')) {
            console.log('Column entity_id already exists. No migration needed.');
            process.exit(0);
        } else {
            console.error('Migration failed:', err);
            process.exit(1);
        }
    }
}

migrate();
