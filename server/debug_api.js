const { getDb } = require('./db/init');
getDb().then(db => {
    console.log("Simulating GET /api/employees for Entity 5...");
    const entityId = 5;
    const result = db.exec('SELECT * FROM employees WHERE entity_id = ?', [entityId]);

    const toObjects = (res) => {
        if (!res || !res.length) return [];
        return res[0].values.map(v => Object.fromEntries(res[0].columns.map((c, i) => [c, v[i]])));
    };

    const data = toObjects(result);
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
