const { getDb } = require('./db/init');
getDb().then(db => {
    console.log("Checking record 228 specifically...");
    const res = db.exec("SELECT id, entity_id, employee_id, full_name, national_id FROM employees WHERE id = 228");
    console.log(JSON.stringify(res, null, 2));

    console.log("Checking for ANY record with employee_id '2007' in Entity 5...");
    const res2 = db.exec("SELECT id, entity_id, employee_id, full_name FROM employees WHERE employee_id = '2007' AND entity_id = 5");
    console.log(JSON.stringify(res2, null, 2));

    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
