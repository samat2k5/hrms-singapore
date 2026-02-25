const { getDb } = require('./db/init');
getDb().then(db => {
    console.log("Searching EVERY entity for records with 'Singapore Citizen' and blank Name/ID...");
    const res = db.exec("SELECT id, entity_id, employee_id, full_name, nationality FROM employees WHERE (trim(full_name) = '' OR trim(employee_id) = '') OR nationality = 'Singapore Citizen'");

    if (res && res.length) {
        res[0].values.forEach(v => {
            console.log(`ID: ${v[0]}, Entity: ${v[1]}, EmpID: '${v[2]}', Name: '${v[3]}', Nation: '${v[4]}'`);
        });
    } else {
        console.log("No matching records found in the entire DB.");
    }

    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
