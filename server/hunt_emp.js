const { getDb } = require('./db/init');
getDb().then(db => {
    console.log("Searching for any record with national_id S7464706E or full_name like Sundar...");
    const info = db.exec("SELECT id, entity_id, employee_id, full_name, national_id FROM employees WHERE national_id = 'S7464706E' OR full_name LIKE '%SUNDAR%'");
    console.log(JSON.stringify(info, null, 2));

    console.log("Checking for records with empty employee_id...");
    const emptyId = db.exec("SELECT id, entity_id, employee_id, full_name FROM employees WHERE employee_id = '' OR employee_id IS NULL");
    console.log(JSON.stringify(emptyId, null, 2));

    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
