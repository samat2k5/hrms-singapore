const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'hrms.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('--- Timesheets for Jan 2026 ---');
db.all("SELECT * FROM timesheets WHERE date LIKE '2026-01-%' LIMIT 20", (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.table(rows);
    }

    console.log('--- Employee IDs check ---');
    db.all("SELECT id, full_name, employee_id FROM employees LIMIT 10", (err, emps) => {
        if (err) console.error(err);
        else console.table(emps);
        db.close();
    });
});
