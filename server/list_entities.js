const { getDb } = require('./db/init');
getDb().then(db => {
    console.log("Listing all entities...");
    const res = db.exec("SELECT id, name FROM entities");
    if (res && res.length) {
        res[0].values.forEach(v => {
            const count = db.exec("SELECT count(*) FROM employees WHERE entity_id = ?", [v[0]]);
            console.log(`ID: ${v[0]}, Name: ${v[1]}, EmpCount: ${count[0].values[0][0]}`);
        });
    } else {
        console.log("No entities found.");
    }

    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
