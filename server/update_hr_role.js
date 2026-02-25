const { getDb, saveDb } = require('./db/init');

async function run() {
    try {
        const db = await getDb();
        const existing = db.exec('SELECT permissions FROM user_roles WHERE name = "HR"');
        let perms = [];
        if (existing.length > 0 && existing[0].values[0][0]) {
            try {
                perms = JSON.parse(existing[0].values[0][0]);
            } catch (e) {
                console.warn('Failed to parse existing permissions, starting fresh');
            }
        }

        const targetPerm = 'attendance:import:cross-entity';
        if (!perms.includes(targetPerm)) {
            perms.push(targetPerm);
        }

        db.run('UPDATE user_roles SET permissions = ? WHERE name = "HR"', [JSON.stringify(perms)]);
        saveDb();
        console.log('Update successful. New permissions for HR:', JSON.stringify(perms));
    } catch (err) {
        console.error('Update failed:', err);
    }
}

run();
