const { getDb, saveDb } = require('./init');

async function migrateIras() {
    const db = await getDb();

    try {
        db.run(`
            CREATE TABLE IF NOT EXISTS submission_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            username TEXT,
            submission_type TEXT NOT NULL,
            file_type TEXT,
            acknowledgment_no TEXT,
            records_count INTEGER DEFAULT 0,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (entity_id) REFERENCES entities(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);
        console.log("Created submission_logs table.");
    } catch (e) {
        console.log("submission_logs table already exists:", e.message);
    }

    try {
        db.run(`
            CREATE TABLE IF NOT EXISTS iras_forms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_id INTEGER NOT NULL,
            employee_id INTEGER NOT NULL,
            year_of_assessment INTEGER NOT NULL,
            form_type TEXT NOT NULL,
            is_amendment BOOLEAN DEFAULT 0,
            amendment_reason TEXT,
            form_data TEXT NOT NULL,
            generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_locked BOOLEAN DEFAULT 1,
            FOREIGN KEY (entity_id) REFERENCES entities(id),
            FOREIGN KEY (employee_id) REFERENCES employees(id)
            )
        `);
        console.log("Created iras_forms table.");
    } catch (e) {
        console.log("iras_forms table already exists:", e.message);
    }

    saveDb();
    console.log("IRAS Migration complete.");
}

migrateIras().catch(console.error);
