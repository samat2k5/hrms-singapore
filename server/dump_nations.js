const { getDb } = require('./db/init');
getDb().then(db => {
    console.log("Listing unique nationalities in the DB...");
    const res = db.exec("SELECT DISTINCT nationality FROM employees");
    console.log(JSON.stringify(res, null, 2));

    console.log("Total employee count:");
    const res2 = db.exec("SELECT count(*) FROM employees");
    console.log(res2[0].values[0][0]);

    console.log("Searching for ANY record with empty full_name OR empty employee_id anywhere...");
    const res3 = db.exec("SELECT id, entity_id, employee_id, full_name, nationality FROM employees WHERE trim(full_name) = '' OR full_name IS NULL OR trim(employee_id) = '' OR employee_id IS NULL");
    if (res3 && res3.length) {
        res3[0].values.forEach(v => {
            console.log(`ID: ${v[0]}, Entity: ${v[1]}, EmpID: '${v[2]}', Name: '${v[3]}', Nation: '${v[4]}'`);
        });
    } else {
        console.log("None found.");
    }

    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
