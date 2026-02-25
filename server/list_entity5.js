const { getDb } = require('./db/init');
getDb().then(db => {
    console.log("Listing all employees for Entity 5...");
    const res = db.exec("SELECT id, employee_id, full_name, nationality FROM employees WHERE entity_id = 5 ORDER BY id ASC");

    if (res && res.length) {
        res[0].values.forEach(v => {
            console.log(`ID: ${v[0]}, EmpID: ${v[1]}, Name: ${v[2]}, Nation: ${v[3]}`);
        });
    } else {
        console.log("No employees found for Entity 5.");
    }

    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
