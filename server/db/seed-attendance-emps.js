const { getDb, saveDb } = require('./init');

async function seed() {
    console.log('Seeding employees for attendance verification...');
    const db = await getDb();

    try {
        // Adding R33 (Manager) and V16 (Supervisor) and R99 (Asst Manager)
        // Entity 1 is Acme Corp Tech
        const employees = [
            { id: 'R33', name: 'James Tan', role: 'MANAGER', salary: 6500, group: 'Operations' },
            { id: 'V16', name: 'Suresh Kumar', role: 'SUPERVISOR', salary: 4500, group: 'Operations' },
            { id: 'T46', name: 'Chen Wei', role: 'QA/QC', salary: 3800, group: 'Operations' },
            { id: 'R99', name: 'Muthu', role: 'AS.ST.MANAGER', salary: 5500, group: 'Operations' }
        ];

        for (const emp of employees) {
            db.run(`
                INSERT INTO employees (entity_id, employee_id, full_name, designation, status, employee_group, basic_salary, cpf_applicable, race, nationality)
                VALUES (?, ?, ?, ?, 'Active', ?, ?, 1, 'Chinese', 'Singaporean')
                ON CONFLICT(entity_id, employee_id) DO UPDATE SET
                full_name = excluded.full_name,
                basic_salary = excluded.basic_salary,
                employee_group = excluded.employee_group,
                designation = excluded.designation
            `, [1, emp.id, emp.name, emp.role, emp.group, emp.salary]);
            console.log(`- Seeded/Updated ${emp.id}`);
        }

        saveDb();
        console.log('Seeding completed.');
    } catch (err) {
        console.error('Seeding failed:', err);
    }
}

seed();
