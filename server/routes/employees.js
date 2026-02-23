const express = require('express');
const { getDb, saveDb } = require('../db/init');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Helper to convert sql.js result to array of objects
function toObjects(result) {
    if (!result.length) return [];
    const { columns, values } = result[0];
    return values.map(row => {
        const obj = {};
        columns.forEach((col, i) => obj[col] = row[i]);
        return obj;
    });
}

// GET /api/employees
router.get('/', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const entityId = req.user.entityId;
        if (!entityId) return res.status(400).json({ error: 'Missing entity context' });

        let query = `SELECT * FROM employees WHERE entity_id = ${entityId}`;

        // RBAC enforcement
        if (req.user.role === 'HR') {
            const groups = req.user.managedGroups || [];
            if (groups.length === 0) {
                return res.json([]); // HR with no groups sees no one
            }
            const groupList = groups.map(g => `'${g}'`).join(',');
            query += ` AND employee_group IN (${groupList})`;
        }

        query += ' ORDER BY employee_id';
        const result = db.exec(query);
        res.json(toObjects(result));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/employees/:id
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const entityId = req.user.entityId;
        if (!entityId) return res.status(400).json({ error: 'Missing entity context' });

        let query = `SELECT * FROM employees WHERE id = ${req.params.id} AND entity_id = ${entityId}`;

        if (req.user.role === 'HR') {
            const groups = req.user.managedGroups || [];
            if (groups.length === 0) return res.status(403).json({ error: 'Access denied' });

            const groupList = groups.map(g => `'${g}'`).join(',');
            query += ` AND employee_group IN (${groupList})`;
        }

        const result = db.exec(query);
        const employees = toObjects(result);
        if (!employees.length) return res.status(404).json({ error: 'Employee not found or access denied' });
        res.json(employees[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/employees
router.post('/', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const entityId = req.user.entityId;
        if (!entityId) return res.status(400).json({ error: 'Missing entity context' });

        const e = req.body;

        // Multi-Entity constraints for Residents
        const isResident = ['Citizen', 'PR'].includes(e.nationality);
        let warning = null;

        if (isResident) {
            if (!e.national_id) {
                return res.status(400).json({ error: 'National ID (NRIC/FIN) is required for Citizens/PRs.' });
            }

            // Count how many entities this resident is already in
            const countCheck = db.exec(`SELECT COUNT(DISTINCT entity_id) FROM employees WHERE national_id = '${e.national_id}'`);
            const activeEntitiesCount = countCheck.length ? countCheck[0].values[0][0] : 0;

            if (activeEntitiesCount >= 2) {
                return res.status(400).json({ error: 'This employee has reached the maximum limit of 2 entities for Citizens/PRs.' });
            }

            if (activeEntitiesCount === 1) {
                warning = 'Note: This employee is now assigned to the maximum of 2 entities.';
            }
        }

        db.run(
            `INSERT INTO employees (entity_id, employee_id, full_name, date_of_birth, national_id, nationality, tax_residency, race, designation, department, employee_group, date_joined, basic_salary, transport_allowance, meal_allowance, other_allowance, bank_name, bank_account, cpf_applicable, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [entityId, e.employee_id || '', e.full_name || '', e.date_of_birth || null, e.national_id || null, e.nationality || 'Citizen', e.tax_residency || 'Resident', e.race || 'Chinese', e.designation || '', e.department || '', e.employee_group || 'General', e.date_joined || null, e.basic_salary || 0, e.transport_allowance || 0, e.meal_allowance || 0, e.other_allowance || 0, e.bank_name || '', e.bank_account || '', e.cpf_applicable !== undefined ? e.cpf_applicable : 1, e.status || 'Active']
        );
        saveDb();

        // Get the created employee
        const result = db.exec(`SELECT * FROM employees WHERE employee_id = '${e.employee_id}' AND entity_id = ${entityId}`);
        const created = toObjects(result)[0];

        // Auto-create KET record
        db.run(
            `INSERT INTO employee_kets (employee_id, job_title, employment_start_date, basic_salary, fixed_allowances) VALUES (?, ?, ?, ?, ?)`,
            [created.id, e.designation || 'Employee', e.date_joined || new Date().toISOString().split('T')[0], e.basic_salary || 0,
            JSON.stringify({ transport: e.transport_allowance || 0, meal: e.meal_allowance || 0 })]
        );

        // Auto-create leave balances
        const leaveTypes = db.exec('SELECT * FROM leave_types');
        const types = toObjects(leaveTypes);
        const year = new Date().getFullYear();
        types.forEach(lt => {
            db.run(
                `INSERT INTO leave_balances (employee_id, leave_type_id, year, entitled, taken, balance) VALUES (?, ?, ?, ?, 0, ?)`,
                [created.id, lt.id, year, lt.default_days, lt.default_days]
            );
        });

        saveDb();
        res.status(201).json({ ...created, warning });
    } catch (err) {
        console.error('ERROR IN POST /api/employees:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/employees/:id
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const entityId = req.user.entityId;
        if (!entityId) return res.status(400).json({ error: 'Missing entity context' });

        const e = req.body;

        const isResident = ['Citizen', 'PR'].includes(e.nationality);
        let warning = null;
        if (isResident) {
            if (!e.national_id) {
                return res.status(400).json({ error: 'National ID (NRIC/FIN) is required for Citizens/PRs.' });
            }
            // Exclude current entity from the count
            const countCheck = db.exec(`SELECT COUNT(DISTINCT entity_id) FROM employees WHERE national_id = '${e.national_id}' AND entity_id != ${entityId}`);
            const otherEntitiesCount = countCheck.length ? countCheck[0].values[0][0] : 0;

            if (otherEntitiesCount >= 2) {
                return res.status(400).json({ error: 'This employee has reached the maximum limit of 2 entities for Citizens/PRs.' });
            }
            if (otherEntitiesCount === 1) {
                warning = 'Note: This employee is assigned to the maximum of 2 entities.';
            }
        }

        db.run(
            `UPDATE employees SET full_name=?, date_of_birth=?, national_id=?, nationality=?, tax_residency=?, race=?, designation=?, department=?, employee_group=?, date_joined=?, basic_salary=?, transport_allowance=?, meal_allowance=?, other_allowance=?, bank_name=?, bank_account=?, cpf_applicable=?, status=? WHERE id=? AND entity_id=?`,
            [e.full_name || '', e.date_of_birth || null, e.national_id || null, e.nationality || 'Citizen', e.tax_residency || 'Resident', e.race || 'Chinese', e.designation || '', e.department || '', e.employee_group || 'General', e.date_joined || null, e.basic_salary || 0, e.transport_allowance || 0, e.meal_allowance || 0, e.other_allowance || 0, e.bank_name || '', e.bank_account || '', e.cpf_applicable !== undefined ? e.cpf_applicable : 1, e.status || 'Active', req.params.id, entityId]
        );
        saveDb();

        const result = db.exec(`SELECT * FROM employees WHERE id = ${req.params.id}`);
        res.json({ ...toObjects(result)[0], warning });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/employees/:id
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        db.run(`DELETE FROM employee_kets WHERE employee_id = ${req.params.id}`);
        db.run(`DELETE FROM leave_balances WHERE employee_id = ${req.params.id}`);
        db.run(`DELETE FROM leave_requests WHERE employee_id = ${req.params.id}`);
        db.run(`DELETE FROM employees WHERE id = ${req.params.id}`);
        saveDb();
        res.json({ message: 'Employee deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/employees/:id/transfer
router.post('/:id/transfer', authMiddleware, async (req, res) => {
    try {
        const db = await getDb();
        const currentEntityId = req.user.entityId;
        const { targetEntityId } = req.body;

        if (!currentEntityId || !targetEntityId) return res.status(400).json({ error: 'Missing entity context' });
        if (currentEntityId === targetEntityId) return res.status(400).json({ error: 'Target entity must be different' });

        db.exec('BEGIN TRANSACTION');

        try {
            // Get original employee
            const empResult = db.exec(`SELECT * FROM employees WHERE id = ${req.params.id} AND entity_id = ${currentEntityId}`);
            if (empResult.length === 0) throw new Error('Employee not found');
            const emp = toObjects(empResult)[0];

            // 1. Check constraints for target entity
            const isResident = ['Citizen', 'PR'].includes(emp.nationality);
            if (isResident) {
                const countCheck = db.exec(`SELECT COUNT(DISTINCT entity_id) FROM employees WHERE national_id = '${emp.national_id}' AND entity_id != ${currentEntityId}`);
                const otherEntitiesCount = countCheck.length ? countCheck[0].values[0][0] : 0;
                if (otherEntitiesCount >= 2) throw new Error('Citizen/PR employee is already at the 2 entity limit. Cannot transfer directly.');
            } else {
                const countCheck = db.exec(`SELECT COUNT(DISTINCT entity_id) FROM employees WHERE national_id = '${emp.national_id}' AND entity_id != ${currentEntityId}`);
                const otherEntitiesCount = countCheck.length ? countCheck[0].values[0][0] : 0;
                if (otherEntitiesCount >= 1) throw new Error('Foreigner can only be in one entity. Transfer blocked.');
            }

            // 2. Clone basic profile
            db.run(
                `INSERT INTO employees (entity_id, employee_id, full_name, date_of_birth, national_id, nationality, tax_residency, race, designation, department, employee_group, date_joined, basic_salary, transport_allowance, meal_allowance, other_allowance, bank_name, bank_account, cpf_applicable, status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [targetEntityId, emp.employee_id || '', emp.full_name || '', emp.date_of_birth || null, emp.national_id || null, emp.nationality || 'Citizen', emp.tax_residency || 'Resident', emp.race || 'Chinese', emp.designation || '', emp.department || '', emp.employee_group || 'General', emp.date_joined || null, emp.basic_salary || 0, emp.transport_allowance || 0, emp.meal_allowance || 0, emp.other_allowance || 0, emp.bank_name || '', emp.bank_account || '', emp.cpf_applicable !== undefined ? emp.cpf_applicable : 1, 'Active']
            );

            const newEmpIdResult = db.exec(`SELECT last_insert_rowid() AS id`);
            const newEmpId = newEmpIdResult[0].values[0][0];

            // 3. Clone Leave Balances
            const leaveBalances = db.exec(`SELECT * FROM leave_balances WHERE employee_id = ${emp.id}`);
            const lbRows = toObjects(leaveBalances);
            lbRows.forEach(lb => {
                db.run(`INSERT INTO leave_balances (employee_id, leave_type_id, year, entitled, taken, balance) VALUES (?, ?, ?, ?, ?, ?)`,
                    [newEmpId, lb.leave_type_id, lb.year, lb.entitled, lb.taken, lb.balance]);
            });

            // 4. Clone KETs
            const kets = db.exec(`SELECT * FROM employee_kets WHERE employee_id = ${emp.id}`);
            if (kets.length > 0) {
                const ket = toObjects(kets)[0];
                db.run(`INSERT INTO employee_kets (employee_id, job_title, employment_start_date, basic_salary, fixed_allowances, working_hours_per_day, working_days_per_week) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [newEmpId, ket.job_title, ket.employment_start_date, ket.basic_salary, ket.fixed_allowances, ket.working_hours_per_day, ket.working_days_per_week]);
            }

            // 5. Update old record to 'Transferred' so it's technically inactive but retains history
            db.run(`UPDATE employees SET status = 'Transferred' WHERE id = ${emp.id}`);

            db.exec('COMMIT');
            saveDb();
            res.status(200).json({ message: 'Employee successfully transferred.', newId: newEmpId });

        } catch (err) {
            db.exec('ROLLBACK');
            res.status(400).json({ error: err.message });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
