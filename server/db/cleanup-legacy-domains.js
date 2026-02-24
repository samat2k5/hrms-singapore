const fs = require('fs');
const initSQL = require('sql.js');

const DB_PATH = './hrms.sqlite';

async function cleanup() {
    if (!fs.existsSync(DB_PATH)) {
        console.error('Database file not found at', DB_PATH);
        process.exit(1);
    }

    const SQL = await initSQL();
    const buffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(buffer);

    try {
        console.log('Dropping legacy email_domains table...');
        db.run("DROP TABLE IF EXISTS email_domains");

        const data = db.export();
        const outBuffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, outBuffer);

        console.log('✅ Cleanup complete! Database saved.');

    } catch (err) {
        console.error('Cleanup failed:', err);
    }
}

cleanup();
