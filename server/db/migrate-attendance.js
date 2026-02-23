const { getDb, saveDb } = require('./init');

async function migrate() {
    console.log('Starting Attendance Migration...');
    const db = await getDb();

    try {
        // Create timesheets table with enhanced fields for detailed tracking
        db.run(`
            CREATE TABLE IF NOT EXISTS timesheets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_id INTEGER NOT NULL,
                employee_id INTEGER NOT NULL,
                date DATE NOT NULL,
                in_time TEXT,
                out_time TEXT,
                shift TEXT, -- 'D' or 'N'
                ot_hours REAL DEFAULT 0,
                remarks TEXT,
                source_file TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(entity_id) REFERENCES entities(id),
                FOREIGN KEY(employee_id) REFERENCES employees(id),
                UNIQUE(entity_id, employee_id, date)
            )
        `);

        // We might also want a table for specific leave/absence markings from timesheets
        // that aren't yet formal leave requests
        db.run(`
            CREATE TABLE IF NOT EXISTS attendance_remarks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_id INTEGER NOT NULL,
                employee_id INTEGER NOT NULL,
                date DATE NOT NULL,
                remark_type TEXT, -- 'Leave', 'Absent', 'MC'
                description TEXT,
                FOREIGN KEY(entity_id) REFERENCES entities(id),
                FOREIGN KEY(employee_id) REFERENCES employees(id),
                UNIQUE(entity_id, employee_id, date)
            )
        `);

        saveDb();
        console.log('Attendance Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    }
}

migrate();
