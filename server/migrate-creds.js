const initSQL = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'db', 'hrms.sqlite');

async function migrate() {
    console.log('Starting credential migration...');
    const SQL = await initSQL();
    if (!fs.existsSync(DB_PATH)) {
        console.log('Database file not found at', DB_PATH, '- skipping migration.');
        return;
    }

    const fileBuffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(fileBuffer);

    const systemHash = bcrypt.hashSync('manager', 10);

    try {
        // Update 'admin' to 'system' and set new password
        db.run("UPDATE users SET username = ?, password_hash = ? WHERE username = ?", ['system', systemHash, 'admin']);

        // Also update management roles if 'admin' was used as a reference (id 1 is usually the admin)
        // In this schema, it's safer to just update the username/password.

        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
        console.log('Migration successful: "admin" is now "system" with password "manager".');
    } catch (err) {
        console.error('Migration failed:', err.message);
    }
}

migrate();
