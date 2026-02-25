const { getDb } = require('./db/init');
getDb().then(db => {
    console.log("Checking all instances of S7464706E...");
    const res = db.exec("SELECT id, entity_id, employee_id, full_name, nationality, national_id FROM employees WHERE national_id = 'S7464706E' OR employee_id = '2007'");

    if (res && res.length) {
        res[0].values.forEach(v => {
            console.log(`ID: ${v[0]}, Entity: ${v[1]}, EmpID: ${v[2]}, Name: ${v[3]}, Nation: ${v[4]}, NID: ${v[5]}`);
        });
    } else {
        console.log("No instances found.");
    }

    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
