const { getDb } = require('./db/init');

async function test() {
    const db = await getDb();
    const entities = db.exec('SELECT id, name FROM entities')[0].values;
    const users = db.exec('SELECT id, username FROM users')[0].values;

    for (const [userId, username] of users) {
        console.log(`\n--- User: ${username} (ID: ${userId}) ---`);
        for (const [entityId, entityName] of entities) {
            console.log(`  Checking Entity: ${entityName} (ID: ${entityId})`);

            // Simulating authMiddleware logic
            const roleResult = db.exec(
                `SELECT role, managed_groups FROM user_entity_roles WHERE user_id = ? AND entity_id = ?`,
                [userId, entityId]
            );

            if (!roleResult.length) {
                console.log(`    Access Denied.`);
                continue;
            }

            const { columns, values } = roleResult[0];
            const role = values[0][columns.indexOf('role')];
            let groups = values[0][columns.indexOf('managed_groups')];
            try { groups = JSON.parse(groups); } catch (e) { groups = []; }

            // Simulating GET /balances-all logic
            let sql = `SELECT id, full_name, entity_id FROM employees WHERE entity_id = ? AND status = 'Active'`;
            const params = [entityId];

            if (String(role).toUpperCase() === 'HR') {
                if (groups.length === 0) {
                    console.log(`    HR with no groups. Found: 0`);
                    continue;
                }
                const placeholders = groups.map(() => '?').join(',');
                sql += ` AND employee_group IN (${placeholders})`;
                params.push(...groups);
            }

            const empResult = db.exec(sql, params);
            if (!empResult.length) {
                console.log(`    Found: 0 employees.`);
                continue;
            }

            const emps = empResult[0].values;
            console.log(`    Found: ${emps.length} employees.`);

            // Check for cross-entity leaks in results
            const leakers = emps.filter(e => e[2] !== entityId);
            if (leakers.length > 0) {
                console.error(`    🔴 LEAK DETECTED! ${leakers.length} employees don't belong to entity ${entityId}`);
            } else {
                console.log(`    ✅ IsolatedEmployees.`);
            }

            // Simulating GET /requests logic
            let reqSql = `SELECT lr.id, e.entity_id FROM leave_requests lr JOIN employees e ON lr.employee_id = e.id WHERE e.entity_id = ?`;
            const reqParams = [entityId];
            if (String(role).toUpperCase() === 'HR') {
                reqSql += ` AND e.employee_group IN (${groups.map(() => '?').join(',')})`;
                reqParams.push(...groups);
            }
            const reqResult = db.exec(reqSql, reqParams);
            const reqCount = reqResult.length ? reqResult[0].values.length : 0;
            console.log(`    Found: ${reqCount} requests.`);
            if (reqResult.length) {
                const reqLeakers = reqResult[0].values.filter(r => r[1] !== entityId);
                if (reqLeakers.length > 0) console.error(`    🔴 REQ LEAK!`);
                else console.log(`    ✅ IsolatedRequests.`);
            }
        }
    }
}

test();
