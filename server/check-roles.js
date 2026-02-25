const { getDb } = require('./db/init');

async function check() {
    const db = await getDb();

    console.log('--- Users ---');
    const users = db.exec('SELECT id, username, role FROM users')[0];
    if (users) console.table(users.values.map(v => ({ id: v[0], username: v[1], global_role: v[2] })));

    console.log('\n--- User Entity Roles ---');
    const roles = db.exec('SELECT user_id, entity_id, role, managed_groups FROM user_entity_roles')[0];
    if (roles) {
        console.table(roles.values.map(v => ({
            user_id: v[0],
            entity_id: v[1],
            role: v[2],
            groups: v[3]
        })));
    } else {
        console.log('No user entity roles found.');
    }
}

check();
