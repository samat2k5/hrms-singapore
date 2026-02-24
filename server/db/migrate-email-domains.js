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
        console.log('Creating email_domains table...');

        db.run(`
            CREATE TABLE IF NOT EXISTS email_domains (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_id INTEGER NOT NULL,
                domain TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (entity_id) REFERENCES entities(id),
                UNIQUE(entity_id, domain)
            )
        `);

        // Seed initial data based on current hardcoded list
        // Entity 1 defaults
        db.run(`INSERT OR IGNORE INTO email_domains (entity_id, domain) VALUES (?, ?)`, [1, 'hypex.com.sg']);
        db.run(`INSERT OR IGNORE INTO email_domains (entity_id, domain) VALUES (?, ?)`, [1, 'gmail.com']);
        db.run(`INSERT OR IGNORE INTO email_domains (entity_id, domain) VALUES (?, ?)`, [1, 'yahoo.com']);
        db.run(`INSERT OR IGNORE INTO email_domains (entity_id, domain) VALUES (?, ?)`, [1, 'hotmail.com']);
        db.run(`INSERT OR IGNORE INTO email_domains (entity_id, domain) VALUES (?, ?)`, [1, 'outlook.com']);

        // Entity 2 defaults
        db.run(`INSERT OR IGNORE INTO email_domains (entity_id, domain) VALUES (?, ?)`, [2, 'hypex.com.sg']);
        db.run(`INSERT OR IGNORE INTO email_domains (entity_id, domain) VALUES (?, ?)`, [2, 'gmail.com']);
        db.run(`INSERT OR IGNORE INTO email_domains (entity_id, domain) VALUES (?, ?)`, [2, 'yahoo.com']);
        db.run(`INSERT OR IGNORE INTO email_domains (entity_id, domain) VALUES (?, ?)`, [2, 'hotmail.com']);
        db.run(`INSERT OR IGNORE INTO email_domains (entity_id, domain) VALUES (?, ?)`, [2, 'outlook.com']);

        const data = db.export();
        const outBuffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, outBuffer);

        console.log('✅ Migration complete! Database saved.');

    } catch (err) {
        console.error('Migration failed:', err);
    }
}

migrate();
