const { getDb, saveDb } = require('./init');

async function migrate() {
    const db = await getDb();

    // We drop and recreate since it's just test data right now
    db.run('DROP TABLE IF EXISTS timesheets');
    db.run(`
        CREATE TABLE IF NOT EXISTS timesheets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_id INTEGER NOT NULL,
            employee_id INTEGER NOT NULL,
            date DATE NOT NULL,
            in_time TEXT,
            out_time TEXT,
            shift TEXT,
            ot_hours REAL DEFAULT 0,
            remarks TEXT,
            source_file TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(entity_id) REFERENCES entities(id),
            FOREIGN KEY(employee_id) REFERENCES employees(id),
            UNIQUE(entity_id, employee_id, date)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS attendance_remarks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_id INTEGER NOT NULL,
            employee_id INTEGER NOT NULL,
            date DATE NOT NULL,
            remark_type TEXT NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(entity_id) REFERENCES entities(id),
            FOREIGN KEY(employee_id) REFERENCES employees(id),
            UNIQUE(entity_id, employee_id, date)
        )
    `);

    saveDb();
    console.log('Migration complete');
}

migrate();
