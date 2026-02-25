const { getDb } = require('./db/init');
getDb().then(db => {
    console.log("Searching for ANY record with NULL/EMPTY Name/ID across ALL entities...");
    const res = db.exec("SELECT id, entity_id, employee_id, full_name, nationality, national_id FROM employees WHERE (full_name = '' OR full_name IS NULL) OR (employee_id = '' OR employee_id IS NULL)");
    if (res && res.length) {
        res[0].values.forEach(v => {
            console.log(`FOUND BLANK: ID:${v[0]} | E:${v[1]} | EmpID:'${v[2]}' | Name:'${v[3]}' | Nation:'${v[4]}' | NID:'${v[5]}'`);
        });
    } else {
        console.log("No blank records found at all.");
    }

    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
