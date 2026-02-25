const { getDb } = require('./db/init');
getDb().then(db => {
    const info = db.exec("SELECT id, entity_id, employee_id, full_name, national_id, date_joined, status FROM employees WHERE employee_id = '2007'");
    console.log(JSON.stringify(info, null, 2));
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
