const { getDb } = require('./db/init');
getDb().then(db => {
    console.log("Dumping all employees across ALL entities...");
    const res = db.exec("SELECT id, entity_id, employee_id, full_name, nationality FROM employees ORDER BY entity_id, id");
    if (res && res.length) {
        res[0].values.forEach(v => {
            console.log(`E:${v[1]} | ID:${v[0]} | EmpID:'${v[2]}' | Name:'${v[3]}' | Nation:'${v[4]}'`);
        });
    }
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
