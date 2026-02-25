const { getDb } = require('./db/init');

function toObjects(result) {
    if (!result.length) return [];
    const { columns, values } = result[0];
    return values.map(row => {
        const obj = {};
        columns.forEach((col, i) => obj[col] = row[i]);
        return obj;
    });
}

async function computeDynamicBalances(db, employeeId, yearString) {
    const year = parseInt(yearString, 10);
    const balResult = db.exec(`
        SELECT lb.*, lt.name as leave_type_name, e.full_name as employee_name, e.employee_id as employee_code, e.date_joined, e.employee_grade, e.entity_id
        FROM leave_balances lb
        JOIN leave_types lt ON lb.leave_type_id = lt.id
        JOIN employees e ON lb.employee_id = e.id
        WHERE lb.employee_id = ? AND lb.year = ? AND e.status = 'Active'
        ORDER BY lt.id
    `, [employeeId, year]);

    let balances = toObjects(balResult);
    if (!balances.length) return [];
    return balances; // Simplified for this check
}

async function simulate() {
    const db = await getDb();
    const entities = db.exec('SELECT id, name FROM entities')[0].values;

    for (const [entityId, entityName] of entities) {
        console.log(`\nChecking Entity: ${entityName} (ID: ${entityId})`);

        // Simulating the Route Logic for Admin
        let sql = `SELECT id FROM employees WHERE entity_id = ? AND status = 'Active'`;
        const params = [entityId];

        const empResult = db.exec(sql, params);
        const employees = toObjects(empResult);
        console.log(`  Found ${employees.length} active employees.`);

        let allBalances = [];
        const year = 2026;
        for (const emp of employees) {
            const bals = await computeDynamicBalances(db, emp.id, year);
            allBalances = allBalances.concat(bals);
        }
        console.log(`  Found ${allBalances.length} balance records.`);
        if (allBalances.length > 0) {
            console.log(`  Sample balance keys:`, Object.keys(allBalances[0]));
            if (allBalances[0].entity_id === undefined) {
                console.error(`  🔴 entity_id is MISSING from balance objects!`);
            } else {
                console.log(`  ✅ entity_id is present:`, allBalances[0].entity_id);
            }
        }
    }
}

simulate();
