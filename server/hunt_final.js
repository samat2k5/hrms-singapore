const { getDb } = require('./db/init');
getDb().then(db => {
    console.log("Searching for nationality 'Singapore Citizen'...");
    const res = db.exec("SELECT id, entity_id, employee_id, full_name, nationality FROM employees WHERE nationality = 'Singapore Citizen'");
    if (res && res.length) {
        res[0].values.forEach(v => {
            console.log(`Found! E:${v[1]} | ID:${v[0]} | EmpID:'${v[2]}' | Name:'${v[3]}' | Nation:'${v[4]}'`);
        });
    } else {
        console.log("Not found with exact string.");
    }

    console.log("Searching for nationality LIKE '%Citizen%'...");
    const res2 = db.exec("SELECT id, entity_id, employee_id, full_name, nationality FROM employees WHERE nationality LIKE '%Citizen%'");
    if (res2 && res2.length) {
        res2[0].values.forEach(v => {
            console.log(`Found! E:${v[1]} | ID:${v[0]} | EmpID:'${v[2]}' | Name:'${v[3]}' | Nation:'${v[4]}'`);
        });
    }

    console.log("Searching for records with blank full_name in Entity 5...");
    const res3 = db.exec("SELECT id, entity_id, employee_id, full_name, nationality FROM employees WHERE entity_id = 5 AND (full_name = '' OR full_name IS NULL)");
    if (res3 && res3.length) {
        res3[0].values.forEach(v => {
            console.log(`Blank row found! ID:${v[0]} | EmpID:'${v[2]}' | Nation:'${v[4]}'`);
        });
    }

    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
