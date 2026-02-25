const { getDb } = require('./db/init');
getDb().then(db => {
    console.log("Searching for 'Singapore Citizen' records in Entity 5...");
    const res = db.exec("SELECT id, employee_id, full_name, nationality, national_id FROM employees WHERE nationality = 'Singapore Citizen' AND entity_id = 5");

    if (res && res.length) {
        res[0].values.forEach(v => {
            console.log(`ID: ${v[0]}, EmpID: '${v[1]}', Name: '${v[2]}', Nation: '${v[3]}', NID: '${v[4]}'`);
        });
    } else {
        console.log("No 'Singapore Citizen' records found in Entity 5.");
    }

    console.log("Checking for ANY record in Entity 5 with empty or whitespace Name/ID...");
    const res2 = db.exec("SELECT id, employee_id, full_name, nationality FROM employees WHERE entity_id = 5 AND (trim(full_name) = '' OR trim(employee_id) = '')");
    if (res2 && res2.length) {
        res2[0].values.forEach(v => {
            console.log(`Found blank row - ID: ${v[0]}, EmpID: '${v[1]}', Name: '${v[2]}', Nation: '${v[3]}'`);
        });
    } else {
        console.log("No blank rows found for Entity 5.");
    }

    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
