const initSQL = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db', 'hrms.sqlite');

function toObjects(res) {
    if (!res || !res.length) return [];
    const columns = res[0].columns;
    return res[0].values.map(values => {
        const obj = {};
        columns.forEach((col, i) => obj[col] = values[i]);
        return obj;
    });
}

async function run() {
    const SQL = await initSQL();
    const fileBuffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(fileBuffer);

    console.log("--- Entities Table Schema ---");
    const res = db.exec("PRAGMA table_info(entities)");
    console.table(toObjects(res));
}

run().catch(console.error);
