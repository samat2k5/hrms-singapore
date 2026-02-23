const fs = require('fs');
const initSQL = require('sql.js');
const path = require('path');

const DB_PATH = path.join(__dirname, 'hrms.sqlite');

async function migrate() {
    const SQL = await initSQL();
    const buffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(buffer);

    db.run(`
        CREATE TABLE IF NOT EXISTS employee_grades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (entity_id) REFERENCES entities(id),
            UNIQUE(entity_id, name)
        );
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS leave_policies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_id INTEGER NOT NULL,
            employee_grade TEXT NOT NULL,
            leave_type_id INTEGER NOT NULL,
            base_days REAL DEFAULT 0,
            increment_per_year REAL DEFAULT 0,
            max_days REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (entity_id) REFERENCES entities(id),
            FOREIGN KEY (leave_type_id) REFERENCES leave_types(id),
            UNIQUE(entity_id, employee_grade, leave_type_id)
        );
    `);

    try { db.run(`ALTER TABLE employees ADD COLUMN employee_grade TEXT DEFAULT ''`); } catch (e) { console.log('employees.employee_grade already exists or error:', e.message); }
    try { db.run(`ALTER TABLE employee_kets ADD COLUMN employee_grade TEXT DEFAULT ''`); } catch (e) { console.log('employee_kets.employee_grade already exists or error:', e.message); }

    // Seed some initial data for current entities
    const entitiesCheck = db.exec("SELECT id FROM entities");
    if (entitiesCheck.length > 0) {
        const entityIds = entitiesCheck[0].values.map(v => v[0]);
        for (const eId of entityIds) {
            try {
                db.run(`INSERT INTO employee_grades (entity_id, name, description) VALUES (?, ?, ?)`, [eId, 'Executive', 'Executive Level']);
                db.run(`INSERT INTO employee_grades (entity_id, name, description) VALUES (?, ?, ?)`, [eId, 'Staff', 'General Staff']);
            } catch (e) { /* ignore unique constraint violations */ }
        }
    }

    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
    console.log('Leave Migration completed.');
}

migrate();
