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
        console.log('Adding Address, Contact, Website, and Domains to entities table...');

        // SQLite doesn't support adding multiple columns in one ALTER TABLE, but we can do them one by one
        try { db.run("ALTER TABLE entities ADD COLUMN address TEXT"); } catch (e) { console.log('address col exists or failed'); }
        try { db.run("ALTER TABLE entities ADD COLUMN contact_number TEXT"); } catch (e) { console.log('contact_number col exists or failed'); }
        try { db.run("ALTER TABLE entities ADD COLUMN website TEXT"); } catch (e) { console.log('website col exists or failed'); }
        try { db.run("ALTER TABLE entities ADD COLUMN email_domains TEXT"); } catch (e) { console.log('email_domains col exists or failed'); }

        // Seed some initial data for domains based on previous implementation
        db.run(`UPDATE entities SET email_domains = 'hypex.com.sg, gmail.com, yahoo.com, hotmail.com, outlook.com'`);

        const data = db.export();
        const outBuffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, outBuffer);

        console.log('✅ Migration complete! Database saved.');

    } catch (err) {
        console.error('Migration failed:', err);
    }
}

migrate();
