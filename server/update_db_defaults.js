const initSQL = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db', 'hrms.sqlite');

async function run() {
    const SQL = await initSQL();
    const fileBuffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(fileBuffer);

    console.log("Updating performance_multiplier to 1.5 for all entities...");
    db.run("UPDATE entities SET performance_multiplier = 1.5");

    console.log("Updating Day Shift timings for all entities to 16:30 end/start...");
    db.run("UPDATE shift_settings SET end_time = '16:30', ot_start_time = '16:30' WHERE shift_name = 'Day'");

    console.log("Updating Night Shift timings for all entities to 04:30 end/start...");
    db.run("UPDATE shift_settings SET end_time = '04:30', ot_start_time = '04:30' WHERE shift_name = 'Night'");

    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
    console.log("Successfully updated database.");
}

run().catch(console.error);
