const { getDb, saveDb } = require('./init');

async function migrateSites() {
    console.log('Starting sites & customers migration...');
    const db = await getDb();

    // Create new tables
    db.run(`
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            FOREIGN KEY (entity_id) REFERENCES business_entities(id) ON DELETE CASCADE
        )
    `);

    // We drop sites and recreate to ensure clean linkage if it was just created previously
    db.run(`DROP TABLE IF EXISTS site_working_hours`);
    db.run(`DROP TABLE IF EXISTS sites`);

    db.run(`
        CREATE TABLE IF NOT EXISTS sites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS site_working_hours (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            site_id INTEGER NOT NULL,
            shift_type TEXT NOT NULL,
            day_of_week INTEGER NOT NULL,  -- 0=Sun, 1=Mon, ..., 6=Sat
            start_time TEXT,               -- HH:MM format (24 hour)
            end_time TEXT,                 -- HH:MM format
            meal_start_time TEXT,          -- optional
            meal_end_time TEXT,            -- optional
            ot_start_time TEXT,            -- explicit OT boundary
            compulsory_ot_hours REAL DEFAULT 0, -- For night shift rules
            FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
        )
    `);

    // Add site_id to employees securely
    try {
        db.run('ALTER TABLE employees ADD COLUMN site_id INTEGER REFERENCES sites(id)');
    } catch (e) {
        if (!e.message.includes('duplicate column name')) {
            console.warn('site_id alteration notice:', e.message);
        }
    }

    saveDb();
    console.log('Sites & Customers migration completed.');
}

migrateSites().catch(console.error);
