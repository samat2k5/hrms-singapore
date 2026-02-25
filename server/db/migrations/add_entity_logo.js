const initSQL = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'hrms.sqlite');

async function migrate() {
    const SQL = await initSQL();
    const fileBuffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(fileBuffer);

    console.log("Adding logo_url to entities table...");
    try {
        db.run("ALTER TABLE entities ADD COLUMN logo_url TEXT");
        console.log("Migration successful.");
    } catch (e) {
        if (e.message.includes("duplicate column name")) {
            console.log("Column logo_url already exists.");
        } else {
            console.error("Migration failed:", e.message);
        }
    }

    fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

migrate().catch(console.error);
