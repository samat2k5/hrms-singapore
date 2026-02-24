const initSQL = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'db', 'hrms.sqlite');

async function debug() {
    console.log('Checking database users...');
    const SQL = await initSQL();
    if (!fs.existsSync(DB_PATH)) {
        console.log('Database file not found at', DB_PATH);
        return;
    }

    const fileBuffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(fileBuffer);

    try {
        const users = db.exec("SELECT id, username FROM users");
        if (users.length && users[0].values) {
            console.log('Current users:');
            users[0].values.forEach(row => {
                console.log(`- ID: ${row[0]}, Username: ${row[1]}`);
            });
        } else {
            console.log('No users found.');
        }
    } catch (err) {
        console.error('Debug failed:', err.message);
    }
}

debug();
